import { spawn } from 'node:child_process';
import { appendFileSync, existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createConnection } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Runs the unmodified, pinned CCR package against a deterministic OpenAI-compatible upstream.
const cli = process.env.CCR_TEST_CLI || path.resolve('deployment/ccr-runtime/node_modules/@musistudio/claude-code-router/dist/main/cli.js');
if (!existsSync(cli)) {
  throw new Error('Install the test backend first: npm ci --prefix deployment/ccr-runtime');
}
const home = await mkdtemp(path.join(tmpdir(), 'cc-bridge-ccr-'));
const token = 'integration-only-ccr-management-token';
let cancelledStreams = 0;
const mock = createServer(async (request, response) => {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
  }
  if (request.url === '/test-status') {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ cancelledStreams }));
    return;
  }
  if (request.url === '/v1/models') {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ object: 'list', data: [{ id: 'test-gpt', object: 'model' }] }));
    return;
  }
  if (request.url !== '/v1/chat/completions') {
    response.writeHead(404).end();
    return;
  }
  const input = JSON.parse(body);
  const tool = input.tools?.[0]?.function;
  const used = input.messages?.some(message => message.role === 'tool');
  const callTool = tool && !used;
  const toolCall = { id: 'call_read_file', type: 'function', function: { name: tool?.name, arguments: '{"path":"README.md"}' } };
  const content = used ? 'Tool result received.' : 'Hello from the test upstream.';
  response.writeHead(200, { 'Content-Type': input.stream ? 'text/event-stream' : 'application/json' });
  if (input.stream) {
    const chunk = delta => ({ id: 'chatcmpl-test', object: 'chat.completion.chunk', created: 1, model: 'test-gpt', choices: [{ index: 0, delta, finish_reason: null }] });
    if (JSON.stringify(input.messages).includes('wait-for-cancel')) {
      response.write(`data: ${JSON.stringify(chunk({ role: 'assistant', content: 'cancel-ready' }))}\n\n`);
      const heartbeat = setInterval(() => response.write(`data: ${JSON.stringify(chunk({ content: '.' }))}\n\n`), 100);
      response.on('close', () => {
        clearInterval(heartbeat);
        cancelledStreams++;
      });
      return;
    }
    response.write(`data: ${JSON.stringify(chunk({ role: 'assistant', ...(callTool ? { tool_calls: [{ index: 0, ...toolCall }] } : { content }) }))}\n\n`);
    response.write(`data: ${JSON.stringify({ ...chunk({}), choices: [{ index: 0, delta: {}, finish_reason: callTool ? 'tool_calls' : 'stop' }], usage: { prompt_tokens: 12, completion_tokens: 5, total_tokens: 17 } })}\n\n`);
    response.end('data: [DONE]\n\n');
  }
  else {
    response.end(JSON.stringify({ id: 'chatcmpl-test', object: 'chat.completion', created: 1, model: 'test-gpt', choices: [{ index: 0, message: { role: 'assistant', content: callTool ? null : content, ...(callTool ? { tool_calls: [toolCall] } : {}) }, finish_reason: callTool ? 'tool_calls' : 'stop' }], usage: { prompt_tokens: 12, completion_tokens: 5, total_tokens: 17 } }));
  }
});
await new Promise(resolve => mock.listen(3470, '127.0.0.1', resolve));
const child = spawn(process.execPath, [cli, 'serve', '--host', '127.0.0.1', '--port', '3468', '--no-open', '--no-gateway'], {
  env: { ...process.env, CCR_INTERNAL_HOME_DIR: home, CCR_WEB_AUTH_TOKEN: token },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let logs = '';
const logPath = path.join(tmpdir(), `ccr-fixture-${process.pid}.log`);
function capture(chunk) {
  // Keep diagnostics bounded even when a native process repeatedly restarts.
  logs = (logs + chunk).slice(-4 * 1024 * 1024);
  if (logs.length < 4 * 1024 * 1024) {
    appendFileSync(logPath, String(chunk).replaceAll(token, '[redacted]'));
  }
}
child.stdout.on('data', capture);
child.stderr.on('data', capture);
let stopping = false;
async function stop() {
  if (stopping) {
    return;
  }
  stopping = true;
  if (child.exitCode === null) {
    try {
      await rpc('stopGateway');
    }
    catch (error) {
      capture(`Gateway cleanup failed: ${error.message}\n`);
    }
  }
  await writeFile(logPath, logs.replaceAll(token, '[redacted]'));
  child.kill('SIGTERM');
  await new Promise((resolve) => {
    child.once('exit', resolve);
    setTimeout(() => {
      child.kill('SIGKILL');
      resolve();
    }, 5000).unref();
  });
  const deadline = Date.now() + 5000;
  while (await Promise.all([3466, 3467].map(portOpen)).then(values => values.some(Boolean))) {
    if (Date.now() >= deadline) {
      throw new Error('Test gateway ports remained open after shutdown');
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  mock.closeAllConnections();
  mock.close();
  await rm(home, { recursive: true, force: true });
}
function portOpen(port) {
  return new Promise((resolve) => {
    const socket = createConnection({ host: '127.0.0.1', port });
    const finish = (open) => {
      socket.destroy();
      resolve(open);
    };
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.setTimeout(200, () => finish(true));
  });
}
process.on('SIGTERM', () => void stop());
process.on('SIGINT', () => void stop());
async function rpc(method, args = []) {
  const response = await fetch('http://127.0.0.1:3468/api/ccr/rpc', { signal: AbortSignal.timeout(5000), method: 'POST', headers: { 'Content-Type': 'application/json', 'x-ccr-web-auth': token }, body: JSON.stringify({ method, args }) });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(JSON.stringify(data));
  }
  return data.value;
}
try {
  let config;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (child.exitCode !== null) {
      throw new Error('CCR exited during startup');
    }
    try {
      config = await rpc('getConfig');
      break;
    }
    catch {
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }
  if (!config) {
    throw new Error('CCR did not start');
  }
  config.HOST = '127.0.0.1';
  config.PORT = 3466;
  config.gateway = { ...config.gateway, host: '127.0.0.1', port: 3466, coreHost: '127.0.0.1', corePort: 3467 };
  config.profile.enabled = false;
  config.Router.builtInRules = { 'claude-code': { enabled: false }, 'codex': { enabled: false } };
  config.observability.requestLogBodyCapture = 'off';
  await rpc('saveConfig', [config, { applyProfile: false }]);
  const ready = createServer((_request, response) => response.end('ready'));
  ready.listen(3471, '127.0.0.1');
  child.once('exit', () => {
    ready.close();
    if (!stopping) {
      console.error('CCR stopped unexpectedly');
      void stop().then(() => process.exit(1));
    }
  });
  process.on('SIGTERM', () => ready.close());
  process.on('SIGINT', () => ready.close());
}
catch (error) {
  console.error(error.message);
  console.error(logs.replaceAll(token, '[redacted]'));
  await stop();
  process.exitCode = 1;
}
