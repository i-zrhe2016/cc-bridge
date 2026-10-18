import type { Config } from './ccr';
import { rpc, WorkspaceError } from './ccr';
import { workspaceByKey } from './database';
import { equalSecret } from './workspace-auth';

export async function gatewayAccess(request: Request) {
  const authorization = request.headers.get('authorization');
  const bearer = authorization?.match(/^Bearer (\S+)$/i)?.[1];
  const apiKey = request.headers.get('x-api-key');
  if ((authorization && !bearer) || (bearer && apiKey && bearer !== apiKey)) {
    throw new WorkspaceError(401, '访问密钥无效。');
  }
  const token = bearer || apiKey;
  if (!token || token.length > 4096) {
    throw new WorkspaceError(401, '请提供有效的访问密钥。');
  }
  const config = await rpc<Config>('getConfig');
  const key = config.APIKEYS.find(key => equalSecret(key.key, token));
  if (!key || (key.expiresAt && !(Date.parse(key.expiresAt) > Date.now()))) {
    throw new WorkspaceError(401, '访问密钥无效或已停用。');
  }
  const owner = workspaceByKey(key.id);
  if (!owner) {
    throw new WorkspaceError(403, '访问密钥尚未绑定用户工作台。');
  }
  const provider = config.Providers.find(item => item.id === owner.providerId && item.enabled !== false);
  if (!provider || provider.models.length !== 1) {
    throw new WorkspaceError(403, '连接不可用。');
  }
  // Global CCR rewriting/fallback could route a correctly scoped request to another user.
  // Fail closed instead of allowing administrator routing rules to bypass tenancy.
  const router = config.Router as { rules?: unknown[]; fallback?: { mode?: string }; builtInRules?: Record<string, { enabled?: boolean }> } | undefined;
  const plugins = config.plugins as { enabled?: boolean }[] | undefined;
  const profiles = config.profile as { enabled?: boolean; profiles?: { enabled?: boolean; routing?: { enabled?: boolean } }[] } | undefined;
  if (Object.values(router?.builtInRules || {}).some(rule => rule.enabled !== false)
    || plugins?.some(plugin => plugin.enabled !== false)
    || (Array.isArray(config.providerPlugins) && config.providerPlugins.length > 0)
    || (Array.isArray(config.virtualModelProfiles) && config.virtualModelProfiles.length > 0)
    || (profiles?.enabled !== false && profiles?.profiles?.some(profile => profile.enabled !== false && profile.routing && profile.routing.enabled !== false))
    || config.CUSTOM_ROUTER_PATH || router?.rules?.length
    || (router?.fallback?.mode && router.fallback.mode !== 'off')) {
    throw new WorkspaceError(503, '多用户网关不支持全局自定义路由或跨连接回退。');
  }
  const model = provider.models[0]!;
  return { token, provider: provider.name, model, selector: `${provider.name}/${model}` };
}
