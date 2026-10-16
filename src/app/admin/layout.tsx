import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@/features/admin/admin.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '管理后台', robots: { index: false, follow: false } };
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div className="admin-root">{children}</div>;
}
