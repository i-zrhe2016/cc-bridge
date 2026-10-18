import type { ChildProcess } from 'node:child_process';
import { spawn } from 'node:child_process';
import { createConnection } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { test as base } from '@playwright/test';

const ports = [3466, 3467, 3468, 3470, 3471];

function portOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host: '127.0.0.1', port });
    const finish = (open: boolean) => {
      socket.destroy();
      resolve(open);
    };
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.setTimeout(200, () => finish(true));
  });
}

async function openPorts() {
  const states = await Promise.all(ports.map(portOpen));
  return ports.filter((_, index) => states[index]);
}

function signalGroup(child: ChildProcess, signal: NodeJS.Signals) {
  if (!child.pid) {
    return;
  }
  try {
    // The fixture owns this detached process group, including native CCR children.
    process.kill(-child.pid, signal);
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') {
      throw error;
    }
  }
}

export const test = base.extend<{ ccrBackend: void }>({
  ccrBackend: [async ({ baseURL }, runTest) => {
    if (baseURL !== 'http://localhost:3110') {
      await runTest();
      return;
    }
    const occupied = await openPorts();
    if (occupied.length) {
      throw new Error(`CCR test ports already occupied: ${occupied.join(', ')}`);
    }
    const child = spawn(process.execPath, ['e2e/fixtures/ccr-server.mjs'], {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });
    let output = '';
    child.stdout?.on('data', chunk => output = (output + chunk).slice(-32_768));
    child.stderr?.on('data', chunk => output = (output + chunk).slice(-32_768));
    let spawnError: Error | undefined;
    child.on('error', error => spawnError = error);
    try {
      const deadline = Date.now() + 90_000;
      while (true) {
        if (spawnError || child.exitCode !== null) {
          throw new Error(`CCR fixture failed to start: ${spawnError?.message ?? child.exitCode}\n${output}`);
        }
        try {
          const response = await fetch('http://127.0.0.1:3471', { signal: AbortSignal.timeout(500) });
          if (response.ok) {
            break;
          }
        }
        catch {}
        if (Date.now() >= deadline) {
          throw new Error(`CCR fixture readiness timed out\n${output}`);
        }
        await delay(100);
      }
      await runTest();
    }
    finally {
      await cleanup();
    }
    async function cleanup() {
      // Let the fixture stopGateway and remove its data before reaping any remaining descendants.
      child.kill('SIGTERM');
      const deadline = Date.now() + 15_000;
      while (child.exitCode === null && Date.now() < deadline) {
        await delay(100);
      }
      signalGroup(child, 'SIGTERM');
      await delay(200);
      signalGroup(child, 'SIGKILL');
      const closedDeadline = Date.now() + 5_000;
      let remaining = await openPorts();
      while (remaining.length && Date.now() < closedDeadline) {
        await delay(100);
        remaining = await openPorts();
      }
      if (remaining.length || child.exitCode === null) {
        throw new Error(`CCR fixture did not stop: ports=${remaining.join(', ')} exit=${child.exitCode}\n${output}`);
      }
    }
  }, { auto: true, timeout: 120_000 }],
});
