export class AdminRequestError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
export async function adminRequest<T>(resource: string, input?: unknown): Promise<T> {
  const response = await fetch(`/api/admin/${resource}`, {
    method: input ? 'POST' : 'GET',
    headers: input ? { 'Content-Type': 'application/json' } : undefined,
    body: input ? JSON.stringify(input) : undefined,
    cache: 'no-store',
  });
  const value = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && resource !== 'session') {
      window.location.assign('/admin/login');
    }
    throw new AdminRequestError(response.status, value?.message || '管理服务暂时不可用。');
  }
  return value as T;
}
