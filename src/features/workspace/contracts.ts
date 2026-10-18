import type { ConnectionInput, UsageDay, WorkspaceState } from './demo-service';

export interface WorkspaceSnapshot {
  state: WorkspaceState;
  usage: UsageDay[];
  gatewayUrl: string;
  gatewayModel: string;
}

export type WorkspaceAction
  = | { action: 'save'; input: ConnectionInput }
    | { action: 'delete' | 'rotate' | 'revoke' };

export async function workspaceRequest(action?: WorkspaceAction): Promise<WorkspaceSnapshot> {
  const response = await fetch('/api/workspace', {
    method: action ? 'POST' : 'GET',
    headers: action ? { 'Content-Type': 'application/json' } : undefined,
    body: action ? JSON.stringify(action) : undefined,
    cache: 'no-store',
  });
  if (response.status === 401) {
    window.location.assign('/auth/sign-in');
    throw new Error('登录已过期，请重新登录。');
  }
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message || '工作台暂时不可用，请稍后重试。');
  }
  return response.json();
}
