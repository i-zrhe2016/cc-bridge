import type { WorkspaceAction, WorkspaceSnapshot } from '@/features/workspace/contracts';
import type { ConnectionInput } from '@/features/workspace/demo-service';
import { randomBytes } from 'node:crypto';
import { validateConnection } from '@/features/workspace/demo-service';

// CCR 3.1.3 management RPC. Preserve unowned settings and configRevision.
interface Provider {
  id?: string;
  name: string;
  api_base_url?: string;
  api_key?: string;
  models: string[];
  [key: string]: unknown;
}
interface ClientKey { id: string; name?: string; key: string; createdAt: string; expiresAt?: string }
interface Config {
  Providers: Provider[];
  APIKEYS: ClientKey[];
  configRevision?: string;
  [key: string]: unknown;
}
interface Usage { series: { label: string; requestCount: number; inputTokens: number; outputTokens: number }[] }

const providerId = 'cc-bridge-workspace';
const keyId = 'cc-bridge-workspace-key';

export class WorkspaceError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function internalUrl(variable: 'CCR_MANAGEMENT_URL' | 'CCR_GATEWAY_URL') {
  const value = process.env[variable];
  if (!value) {
    throw new WorkspaceError(503, '服务尚未配置。');
  }
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new WorkspaceError(503, '服务配置不可用。');
  }
  return url;
}

async function rpc<T>(method: string, args: unknown[] = []): Promise<T> {
  const token = process.env.CCR_WEB_AUTH_TOKEN;
  if (!token) {
    throw new WorkspaceError(503, '服务尚未配置。');
  }
  let response: Response;
  try {
    response = await fetch(new URL('/api/ccr/rpc', internalUrl('CCR_MANAGEMENT_URL')), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ccr-web-auth': token },
      body: JSON.stringify({ method, args }),
      signal: AbortSignal.timeout(30_000),
      redirect: 'error',
      cache: 'no-store',
    });
  }
  catch {
    throw new WorkspaceError(503, '连接服务暂时不可用，请稍后重试。');
  }
  if (!response.ok) {
    console.error('[CC Bridge] Management request failed', method, response.status);
    throw new WorkspaceError(response.status === 409 ? 409 : 502, response.status === 409 ? '配置已被更新，请刷新后重试。' : '操作未完成，请稍后重试。');
  }
  const result = await response.json() as { ok: boolean; value: T };
  if (!result.ok) {
    throw new WorkspaceError(502, '操作未完成，请稍后重试。');
  }
  return result.value;
}

function ownedProvider(config: Config) {
  return config.Providers.find(provider => provider.id === providerId);
}

export async function snapshot(config?: Config): Promise<WorkspaceSnapshot> {
  const gatewayUrl = process.env.CC_BRIDGE_PUBLIC_URL;
  if (!gatewayUrl || !['http:', 'https:'].includes(new URL(gatewayUrl).protocol)) {
    throw new WorkspaceError(503, '请配置工作台公开访问地址。');
  }
  const current = config || await rpc<Config>('getConfig');
  const provider = ownedProvider(current);
  const model = provider?.models[0] || '';
  const usage = await rpc<Usage>('getUsageStats', ['7d', { provider: provider?.name || providerId, includeProxy: false }]);
  const key = current.APIKEYS.find(key => key.id === keyId);
  const activeKey = key && (!key.expiresAt || Date.parse(key.expiresAt) > Date.now()) ? key.key : null;
  return {
    state: {
      connection: provider
        ? {
            name: provider.name,
            endpoint: provider.api_base_url || '',
            model,
            keyMask: '••••••••',
          }
        : null,
      bridgeKey: provider ? activeKey : null,
    },
    usage: usage.series.map(day => ({ label: day.label, requests: day.requestCount, input: day.inputTokens, output: day.outputTokens })),
    gatewayUrl,
    gatewayModel: provider ? `${provider.name}/${model}` : '',
  };
}

function parseInput(value: unknown, editing: boolean): ConnectionInput {
  if (!value || typeof value !== 'object') {
    throw new WorkspaceError(400, '请填写连接信息。');
  }
  const input = value as Record<string, unknown>;
  for (const key of ['name', 'endpoint', 'apiKey', 'model']) {
    if (typeof input[key] !== 'string' || input[key].length > (key === 'apiKey' ? 4096 : 2048)) {
      throw new WorkspaceError(400, '连接信息格式不正确。');
    }
  }
  const parsed = Object.fromEntries(Object.entries(input).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value])) as unknown as ConnectionInput;
  const error = validateConnection(parsed, editing);
  if (error) {
    throw new WorkspaceError(400, error);
  }
  if (/[/,\r\n]/.test(parsed.name)) {
    throw new WorkspaceError(400, '名称不能包含斜线、逗号或换行。');
  }
  return parsed;
}

// Serialize read-modify-write operations in this single-server deployment.
let pending: Promise<unknown> = Promise.resolve();
export function mutate(action: WorkspaceAction): Promise<WorkspaceSnapshot> {
  const next = pending.then(() => apply(action));
  pending = next.catch(() => undefined);
  return next;
}

async function apply(action: WorkspaceAction) {
  let config = await rpc<Config>('getConfig');
  const previous = ownedProvider(config);
  if (action.action === 'save') {
    const input = parseInput(action.input, Boolean(previous));
    if (config.Providers.some(provider => provider.name === input.name && provider.id !== providerId)) {
      throw new WorkspaceError(409, '连接名称已被占用，请联系管理员。');
    }
    const provider: Provider = {
      ...previous,
      id: providerId,
      name: input.name,
      type: 'openai_chat_completions',
      protocolDetectionMode: 'manual',
      api_base_url: input.endpoint.replace(/\/$/, ''),
      api_key: input.apiKey || previous?.api_key,
      enabled: true,
      models: [input.model],
    };
    config.Providers = [...config.Providers.filter(provider => provider.id !== providerId), provider];
    config = await rpc<Config>('saveConfig', [config, { applyProfile: false }]);
    const status = await rpc<{ state: string }>('startGateway');
    if (status.state !== 'running') {
      throw new WorkspaceError(502, '配置已保存，但网关未启动，请联系管理员。');
    }
  }
  else if (action.action === 'delete' || action.action === 'revoke') {
    // Revoke first: deleting a connection must never leave its key usable.
    config = await rpc<Config>('saveApiKeys', [config.APIKEYS.filter(key => key.id !== keyId)]);
    if (action.action === 'delete') {
      config.Providers = config.Providers.filter(provider => provider.id !== providerId);
      config = await rpc<Config>('saveConfig', [config, { applyProfile: false }]);
    }
  }
  else if (action.action === 'rotate') {
    if (!previous) {
      throw new WorkspaceError(400, '请先保存 GPT 连接。');
    }
    const key: ClientKey = { id: keyId, name: 'CC Bridge', key: `ccb_${randomBytes(32).toString('hex')}`, createdAt: new Date().toISOString() };
    config = await rpc<Config>('saveApiKeys', [[...config.APIKEYS.filter(key => key.id !== keyId), key]]);
  }
  else {
    throw new WorkspaceError(400, '不支持的操作。');
  }
  return snapshot(config);
}
