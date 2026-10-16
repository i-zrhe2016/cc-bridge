import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AdminLogin from '@/features/admin/login';
import { adminCookie, adminEnabled, validAdminSession } from '@/server/admin-auth';

export default async function LoginPage() {
  if (validAdminSession((await cookies()).get(adminCookie)?.value)) {
    redirect('/admin');
  }
  return <AdminLogin enabled={adminEnabled()} />;
}
