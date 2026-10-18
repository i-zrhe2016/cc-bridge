import type { WorkspaceAction, WorkspaceSnapshot } from '../features/workspace/contracts.ts';
import type { ConnectionInput } from '../features/workspace/demo-service.ts';
import type { OwnedWorkspace } from './database.ts';
import { randomBytes } from 'node:crypto';
import { validateConnection } from '../features/workspace/demo-service.ts';
import { renameWorkspace, workspaceFor } from './database.ts';

// CCR 3.1.3 management RPC. Preserve unowned settings and configRevision.
export interface Provider {
  id?: string;
  name: string;
  api_base_url?: string;
  api_key?: string;
  models: string[];
  [key: string]: unknown;
}
export interface ClientKey { id: string; name?: string; key: string; createdAt: string; expiresAt?: string }
export interface Config {
  Providers: Provider[];
  APIKEYS: ClientKey[];
  configRevision?: string;
  [key: string]: unknown;
}
interface Usage { series: { label: string; requestCount: number; inputTokens: number; outputTokens: number }[] }

export const providerId = 'cc-bridge-workspace';
export const keyId = 'cc-bridge-workspace-key';

export class WorkspaceError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
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

export async function rpc<T>(method: string, args: unknown[] = []): Promise<T> {
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

function ownedProvider(config: Config, owner: OwnedWorkspace) {
  return config.Providers.find(provider => provider.id === owner.providerId);
}

export async function snapshot(userId: string, config?: Config): Promise<WorkspaceSnapshot> {
  const owner = workspaceFor(userId);
  const gatewayUrl = process.env.CC_BRIDGE_PUBLIC_URL;
  if (!gatewayUrl || !['http:', 'https:'].includes(new URL(gatewayUrl).protocol)) {
    throw new WorkspaceError(503, '请配置工作台公开访问地址。');
  }
  const current = config || await rpc<Config>('getConfig');
  const provider = ownedProvider(current, owner);
  const model = provider?.models[0] || '';
  const usage = await rpc<Usage>('getUsageStats', ['7d', { provider: provider?.name || owner.providerId, includeProxy: false }]);
  const key = current.APIKEYS.find(key => key.id === owner.keyId);
  const activeKey = key && (!key.expiresAt || Date.parse(key.expiresAt) > Date.now()) ? key.key : null;
  return {
    state: {
      connection: provider
        ? {
            name: owner.displayName || provider.name,
            endpoint: provider.api_base_url || '',
            model,
            keyMask: '••••••••',
          }
        : null,
      bridgeKey: provider ? activeKey : null,
    },
    usage: (provider ? usage.series : []).map(day => ({ label: day.label, requests: day.requestCount, input: day.inputTokens, output: day.outputTokens })),
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
  if (/[,\r\n*?]/.test(parsed.model)) {
    throw new WorkspaceError(400, '模型名称不能包含逗号、通配符或换行。');
  }
  if (/[/,\r\n]/.test(parsed.name)) {
    throw new WorkspaceError(400, '名称不能包含斜线、逗号或换行。');
  }
  // Public signup must not turn CCR into an arbitrary network/metadata proxy.
  // Operators explicitly trust upstream origins, including any local development fixture.
  const allowed = (process.env.CC_BRIDGE_UPSTREAM_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
  if (!allowed.includes(new URL(parsed.endpoint).origin)) {
    throw new WorkspaceError(400, '此 API 地址尚未由管理员允许。');
  }
  return parsed;
}

// Serialize read-modify-write operations in this single-server deployment.
// Next.js can load API routes into separate module bundles; keep the queue process-wide.
const ccrState = globalThis as typeof globalThis & { ccBridgePending?: Promise<unknown> };
export function serializeCcr<T>(operation: () => Promise<T>): Promise<T> {
  const next = (ccrState.ccBridgePending || Promise.resolve()).then(operation);
  ccrState.ccBridgePending = next.catch(() => undefined);
  return next;
}

export function mutate(userId: string, action: WorkspaceAction): Promise<WorkspaceSnapshot> {
  return serializeCcr(() => apply(userId, action));
}

async function apply(userId: string, action: WorkspaceAction) {
  const owner = workspaceFor(userId);
  let config = await rpc<Config>('getConfig');
  const previous = ownedProvider(config, owner);
  if (action.action === 'save') {
    const input = parseInput(action.input, Boolean(previous));
    // Keep the internal name immutable: CCR usage is grouped by provider name.
    const internalName = previous?.name || owner.providerId;
    if (config.Providers.some(provider => provider.name === internalName && provider.id !== owner.providerId)) {
      throw new WorkspaceError(409, '连接标识冲突，请联系管理员。');
    }
    const provider: Provider = {
      ...previous,
      id: owner.providerId,
      name: internalName,
      type: 'openai_chat_completions',
      protocolDetectionMode: 'manual',
      api_base_url: input.endpoint.replace(/\/$/, ''),
      api_key: input.apiKey || previous?.api_key,
      enabled: true,
      models: [input.model],
    };
    config.Providers = [...config.Providers.filter(provider => provider.id !== owner.providerId), provider];
    config = await rpc<Config>('saveConfig', [config, { applyProfile: false }]);
    renameWorkspace(userId, input.name);
    const status = await rpc<{ state: string }>('startGateway');
    if (status.state !== 'running') {
      throw new WorkspaceError(502, '配置已保存，但网关未启动，请联系管理员。');
    }
  }
  else if (action.action === 'delete' || action.action === 'revoke') {
    // Revoke first: deleting a connection must never leave its key usable.
    config = await rpc<Config>('saveApiKeys', [config.APIKEYS.filter(key => key.id !== owner.keyId)]);
    if (action.action === 'delete') {
      config.Providers = config.Providers.filter(provider => provider.id !== owner.providerId);
      config = await rpc<Config>('saveConfig', [config, { applyProfile: false }]);
    }
  }
  else if (action.action === 'rotate') {
    if (!previous) {
      throw new WorkspaceError(400, '请先保存 GPT 连接。');
    }
    const key: ClientKey = { id: owner.keyId, name: 'CC Bridge', key: `ccb_${randomBytes(32).toString('hex')}`, createdAt: new Date().toISOString() };
    config = await rpc<Config>('saveApiKeys', [[...config.APIKEYS.filter(key => key.id !== owner.keyId), key]]);
  }
  else {
    throw new WorkspaceError(400, '不支持的操作。');
  }
  return snapshot(userId, config);
}
