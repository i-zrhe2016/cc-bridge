import type { Config, Provider } from './ccr';
import type { AdminKey, AdminOverview, AdminProvider, AdminUsage, GatewayState, KeyList, MutationResult, ProviderList } from '@/features/admin/contracts';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { adminSignature } from './admin-auth';
import { keyId, providerId, rpc, serializeCcr, WorkspaceError } from './ccr';

const text = z.string().trim().min(1).max(200);
const identifier = z.string().min(1).max(256);
const version = z.string().regex(/^[a-f0-9]{64}$/);
const endpoint = z.string().trim().max(2048).refine((value) => {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash;
  }
  catch {
    return false;
  }
}, '请填写有效的 HTTP/HTTPS API 地址，不包含账号、查询参数或片段。');
const providerSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('save'), id: identifier.optional(), revision: version, name: text.regex(/^[^/,\r\n]+$/), endpoint, apiKey: z.string().trim().max(4096), models: z.array(text.regex(/^[^,\r\n]+$/)).min(1).max(100) }),
  z.object({ action: z.literal('toggle'), id: identifier, revision: version, enabled: z.boolean() }),
  z.object({ action: z.literal('delete'), id: identifier, revision: version }),
]);
const keySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create'), name: text, expiresAt: z.iso.datetime().optional(), revision: version }),
  z.object({ action: z.enum(['rotate', 'revoke', 'delete']), id: identifier, revision: version }),
]);
const gatewaySchema = z.object({ action: z.enum(['start', 'stop', 'restart']) });

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new WorkspaceError(400, '请检查表单内容、有效期及资源版本。');
  }
  return result.data;
}
function providerIdentity(provider: Provider) {
  return provider.id || `legacy_${createHash('sha256').update(provider.name).digest('hex')}`;
}
function revision(config: Config) {
  // Opaque version includes credentials without exposing them or raw CCR configRevision.
  return adminSignature(JSON.stringify([config.configRevision, config.Providers, config.APIKEYS]));
}
function checkRevision(config: Config, expected: string) {
  if (revision(config) !== expected) {
    throw new WorkspaceError(409, '配置已被更新，请刷新列表后重新编辑。');
  }
}
function providerDto(provider: Provider): AdminProvider {
  return {
    id: providerIdentity(provider),
    name: provider.name,
    endpoint: provider.api_base_url || '',
    models: provider.models || [],
    enabled: provider.enabled !== false,
    owned: provider.id === providerId,
    editable: provider.type === 'openai_chat_completions',
    protocol: typeof provider.type === 'string' ? provider.type : 'unknown',
  };
}
function keyDtos(config: Config): AdminKey[] {
  return config.APIKEYS.map(key => ({
    id: key.id,
    name: key.name || '未命名密钥',
    mask: `••••••••${key.key.length >= 8 ? key.key.slice(-4) : ''}`,
    createdAt: key.createdAt,
    expiresAt: key.expiresAt || null,
    active: !key.expiresAt || Date.parse(key.expiresAt) > Date.now(),
    owned: key.id === keyId,
  }));
}
export async function listProviders(): Promise<ProviderList> {
  const config = await rpc<Config>('getConfig');
  return { providers: config.Providers.map(providerDto), revision: revision(config) };
}
export async function listKeys(): Promise<KeyList> {
  const config = await rpc<Config>('getConfig');
  return { keys: keyDtos(config), revision: revision(config) };
}
export async function gatewayStatus(): Promise<GatewayState> {
  const status = await rpc<{ state: string }>('getGatewayStatus');
  return {
    state: ['running', 'stopped', 'starting', 'error'].includes(status.state) ? status.state as GatewayState['state'] : 'unknown',
    management: true,
  };
}
export async function usageStats(range: string, provider?: string): Promise<AdminUsage> {
  if (!['7d', '30d'].includes(range)) {
    throw new WorkspaceError(400, '请选择七天或三十天。');
  }
  let name: string | undefined;
  if (provider) {
    const config = await rpc<Config>('getConfig');
    name = config.Providers.find(item => providerIdentity(item) === provider)?.name;
    if (!name) {
      throw new WorkspaceError(404, '连接不存在，请刷新列表。');
    }
  }
  const usage = await rpc<{ series: { label: string; requestCount: number; inputTokens: number; outputTokens: number }[] }>('getUsageStats', [range, { provider: name, includeProxy: false }]);
  const series = usage.series.map(day => ({ label: day.label, requests: day.requestCount, input: day.inputTokens, output: day.outputTokens }));
  return { series, ...series.reduce((total, day) => ({ requests: total.requests + day.requests, input: total.input + day.input, output: total.output + day.output }), { requests: 0, input: 0, output: 0 }) };
}
export async function overview(): Promise<AdminOverview> {
  const [config, gateway, usage] = await Promise.all([rpc<Config>('getConfig'), gatewayStatus(), usageStats('7d')]);
  return { providers: config.Providers.length, activeKeys: keyDtos(config).filter(key => key.active).length, gateway, usage };
}
export function mutateProviders(input: unknown): Promise<MutationResult> {
  const data = parse(providerSchema, input);
  return serializeCcr(async () => {
    const config = await rpc<Config>('getConfig');
    checkRevision(config, data.revision);
    const previous = 'id' in data && data.id ? config.Providers.find(item => providerIdentity(item) === data.id) : undefined;
    if ('id' in data && data.id && !previous) {
      throw new WorkspaceError(404, '连接不存在。');
    }
    if (previous?.id === providerId && data.action !== 'save') {
      throw new WorkspaceError(400, '工作台专用连接不能在后台停用或删除。');
    }
    if (data.action === 'save') {
      if (previous && previous.type !== 'openai_chat_completions') {
        throw new WorkspaceError(400, '首期仅支持编辑 OpenAI Chat Completions 连接。');
      }
      if (previous && previous.name !== data.name) {
        throw new WorkspaceError(400, '连接创建后不能修改名称。');
      }
      if (!previous && (!data.apiKey || config.Providers.some(item => item.name === data.name))) {
        throw new WorkspaceError(400, '请填写密钥，并使用未被占用的连接名称。');
      }
      if (previous?.id === providerId && data.models.length !== 1) {
        throw new WorkspaceError(400, '工作台专用连接只支持一个模型。');
      }
      const provider: Provider = {
        ...previous,
        id: previous?.id || (previous ? providerIdentity(previous) : randomUUID()),
        name: data.name,
        type: 'openai_chat_completions',
        protocolDetectionMode: 'manual',
        api_base_url: data.endpoint.replace(/\/$/, ''),
        api_key: data.apiKey || previous?.api_key,
        models: [...new Set(data.models)],
        enabled: previous?.enabled !== false,
      };
      config.Providers = previous ? config.Providers.map(item => item === previous ? provider : item) : [...config.Providers, provider];
    }
    else if (data.action === 'delete') {
      // Keep keys: CCR credentials are instance-wide, not owned by a provider.
      config.Providers = config.Providers.filter(item => item !== previous);
    }
    else if (previous) {
      config.Providers = config.Providers.map(item => item === previous ? { ...item, enabled: data.enabled } : item);
    }
    try {
      await rpc<Config>('saveConfig', [config, { applyProfile: false }]);
    }
    catch (error) {
      if (error instanceof WorkspaceError && error.status === 409) {
        throw error;
      }
      // CCR can persist config before applying it to the gateway fails.
      // Re-read to distinguish a completed save from an uncertain write.
      const persisted = await rpc<Config>('getConfig').catch(() => null);
      if (persisted && JSON.stringify(persisted.Providers) === JSON.stringify(config.Providers)) {
        return { message: '配置已保存，但网关应用未完成，请刷新系统状态后检查。' };
      }
      throw new WorkspaceError(502, '保存或应用未完成，请刷新列表确认实际配置后重试。');
    }
    try {
      const status = await gatewayStatus();
      return { message: status.state === 'running' ? '配置已保存并应用。' : '配置已保存，网关当前未运行，请到系统状态页查看。' };
    }
    catch {
      return { message: '配置已保存，但无法确认网关状态，请到系统状态页刷新。' };
    }
  });
}
export function mutateKeys(input: unknown): Promise<MutationResult> {
  const data = parse(keySchema, input);
  return serializeCcr(async () => {
    const config = await rpc<Config>('getConfig');
    checkRevision(config, data.revision);
    let secret: string | undefined;
    if (data.action === 'create') {
      if (data.expiresAt && Date.parse(data.expiresAt) <= Date.now()) {
        throw new WorkspaceError(400, '有效期必须晚于当前时间。');
      }
      secret = `ccb_${randomBytes(32).toString('hex')}`;
      config.APIKEYS.push({ id: randomUUID(), name: data.name, key: secret, createdAt: new Date().toISOString(), ...(data.expiresAt ? { expiresAt: data.expiresAt } : {}) });
    }
    else {
      const key = config.APIKEYS.find(item => item.id === data.id);
      if (!key) {
        throw new WorkspaceError(404, '密钥不存在，请刷新列表。');
      }
      if (data.action === 'delete') {
        if (key.id === keyId) {
          throw new WorkspaceError(400, '工作台专用密钥不能在后台删除。');
        }
        if (config.APIKEYS.length === 1) {
          throw new WorkspaceError(400, '最后一枚密钥请使用撤销操作。');
        }
        config.APIKEYS = config.APIKEYS.filter(item => item.id !== key.id);
      }
      else if (data.action === 'revoke') {
        // Preserve expired metadata; native CCR rejects credentials past expiresAt.
        key.expiresAt = new Date(Date.now() - 1000).toISOString();
      }
      else {
        if (key.id === keyId && !config.Providers.some(item => item.id === providerId)) {
          throw new WorkspaceError(400, '请先在工作台保存 GPT 连接。');
        }
        secret = `ccb_${randomBytes(32).toString('hex')}`;
        key.key = secret;
        key.createdAt = new Date().toISOString();
        if (key.expiresAt && Date.parse(key.expiresAt) <= Date.now()) {
          delete key.expiresAt;
        }
      }
    }
    await rpc<Config>('saveApiKeys', [config.APIKEYS]);
    return { message: '密钥操作已完成。', ...(secret ? { secret } : {}) };
  });
}
export function controlGateway(input: unknown): Promise<MutationResult> {
  const data = parse(gatewaySchema, input);
  return serializeCcr(async () => {
    await rpc(`${data.action}Gateway`);
    const status = await gatewayStatus();
    if (data.action !== 'stop' && status.state !== 'running') {
      throw new WorkspaceError(502, '操作已提交，但网关未进入运行状态，请刷新系统状态。');
    }
    return { message: '网关操作已完成。' };
  });
}
