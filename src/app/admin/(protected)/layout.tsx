import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AdminShell from '@/features/admin/layout/shell';
import { adminCookie, validAdminSession } from '@/server/admin-auth';

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  if (!validAdminSession((await cookies()).get(adminCookie)?.value)) {
    redirect('/admin/login');
  }
  return <AdminShell>{children}</AdminShell>;
}
