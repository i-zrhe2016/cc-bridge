import { Buffer } from 'node:buffer';
import { internalUrl, WorkspaceError } from '@/server/ccr';
import { gatewayAccess } from '@/server/gateway-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Context { params: Promise<{ path: string[] }> }

function failure(status: number, message: string) {
  return Response.json({ type: 'error', error: { type: status === 401 ? 'authentication_error' : 'api_error', message } }, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

async function forward(request: Request, context: Context) {
  const path = (await context.params).path.join('/');
  if (!((request.method === 'POST' && ['messages', 'messages/count_tokens'].includes(path)) || (request.method === 'GET' && path === 'models'))) {
    return failure(404, '接口不存在。');
  }
  // Only a user's owned CCR credential and explicit model may reach the private gateway.
  const headers = new Headers();
  for (const name of ['authorization', 'x-api-key', 'content-type', 'anthropic-version', 'anthropic-beta', 'user-agent', 'x-claude-code-session-id', 'x-claude-session-id']) {
    const value = request.headers.get(name);
    if (value) {
      headers.set(name, value);
    }
  }
  try {
    const access = await gatewayAccess(request);
    if (request.method === 'GET') {
      return Response.json({ object: 'list', data: [{ id: access.selector, object: 'model', display_name: access.model }], has_more: false, first_id: access.selector, last_id: access.selector }, { headers: { 'Cache-Control': 'no-store' } });
    }
    const reader = request.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        size += value.byteLength;
        if (size > 16 * 1024 * 1024) {
          await reader.cancel();
          return failure(413, '请求内容过大。');
        }
        chunks.push(value);
      }
    }
    const text = Buffer.concat(chunks).toString('utf8');
    let body;
    try {
      body = JSON.parse(text);
    }
    catch {
      return failure(400, '请求格式不正确。');
    }
    if (!body || body.model !== access.selector) {
      return failure(403, '该密钥无权使用此模型。');
    }
    // These headers are generated here, never accepted from the public request.
    headers.set('x-target-provider', access.provider);
    headers.set('x-target-model', access.model);
    headers.set('content-type', 'application/json');
    headers.set('authorization', `Bearer ${access.token}`);
    headers.delete('x-api-key');
    const destination = new URL(`/v1/${path}`, internalUrl('CCR_GATEWAY_URL'));
    const init: RequestInit & { duplex?: 'half' } = {
      method: request.method,
      headers,
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(600_000)]),
    };
    if (request.method === 'POST') {
      init.body = JSON.stringify(body);
      init.duplex = 'half';
    }
    const upstream = await fetch(destination, init);
    if (!upstream.ok) {
      await upstream.body?.cancel();
      const status = [400, 401, 403, 404, 413, 429].includes(upstream.status) ? upstream.status : 502;
      return failure(status, status === 401 || status === 403 ? '访问密钥无效、已停用或无权限。' : status === 429 ? '请求过于频繁或已达到用量限制。' : '模型请求未完成，请检查配置或稍后重试。');
    }
    const responseHeaders = new Headers({
      'Content-Type': upstream.headers.get('content-type') || 'application/json',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    });
    // Pass successful JSON and SSE bytes through unchanged, including tools and thinking.
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  }
  catch (error) {
    return failure(error instanceof WorkspaceError ? error.status : 502, '模型服务暂时不可用，请稍后重试。');
  }
}

export const GET = forward;
export const POST = forward;
