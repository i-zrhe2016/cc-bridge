// Legacy password sessions no longer grant workspace access.
function retired() {
  return Response.json({ message: '请使用 Google 登录。' }, { status: 410, headers: { 'Cache-Control': 'no-store' } });
}
export const POST = retired;
export const DELETE = retired;
