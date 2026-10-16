'use client';

// Adapted from Kiranism layout/app-sidebar.tsx and header.tsx (MIT).
import type { ReactNode } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { IconChartBar, IconDashboard, IconKey, IconLayoutSidebar, IconLogout, IconMenu2, IconPlugConnected, IconServer, IconX } from '@tabler/icons-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const items = [
  { title: '概览', url: '/admin', icon: IconDashboard },
  { title: '上游连接', url: '/admin/providers', icon: IconPlugConnected },
  { title: '访问密钥', url: '/admin/keys', icon: IconKey },
  { title: '用量统计', url: '/admin/usage', icon: IconChartBar },
  { title: '系统状态', url: '/admin/system', icon: IconServer },
];

export default function AdminShell({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 10_000, gcTime: 0, refetchOnWindowFocus: false } } }));
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [error, setError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const pathname = usePathname();
  async function signOut() {
    setSigningOut(true);
    try {
      const response = await fetch('/api/admin/session', { method: 'DELETE' });
      if (!response.ok) {
        throw new Error('退出失败，请重试。');
      }
      queryClient.clear();
      window.location.replace('/admin/login');
    }
    catch (error) {
      setError(error instanceof Error ? error.message : '退出失败。');
    }
    finally {
      setSigningOut(false);
    }
  }
  const navigation = (
    <>
      <div className="admin-sidebar-brand">
        <Link href="/admin" aria-label="CC Bridge 管理后台">
          <strong>
            CC
            <span>↗</span>
          </strong>
          <span className="admin-nav-label">
            CC Bridge
            <small>管理后台</small>
          </span>
        </Link>
      </div>
      <nav aria-label="管理后台导航" className="admin-navigation">
        <p className="admin-nav-label admin-muted">平台管理</p>
        {items.map(item => (
          <Link key={item.url} href={item.url} title={item.title} aria-label={item.title} aria-current={pathname === item.url ? 'page' : undefined} onClick={() => setMobile(false)}>
            <item.icon size={19} aria-hidden="true" />
            <span className="admin-nav-label">{item.title}</span>
          </Link>
        ))}
      </nav>
      <div className="admin-sidebar-footer">
        <Link href="/dashboard" title="用户工作台">
          <IconPlugConnected size={18} aria-hidden="true" />
          <span className="admin-nav-label">用户工作台 ↗</span>
        </Link>
        <button type="button" title="退出后台" disabled={signingOut} onClick={() => void signOut()}>
          <IconLogout size={18} aria-hidden="true" />
          <span className="admin-nav-label">{signingOut ? '正在退出…' : '退出后台'}</span>
        </button>
      </div>
    </>
  );
  return (
    <QueryClientProvider client={queryClient}>
      <div className={`admin-shell ${collapsed ? 'admin-collapsed' : ''}`}>
        <aside className="admin-sidebar">{navigation}</aside>
        <div className="admin-body">
          <header className="bg-background/60 sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between gap-2 border-b px-4 backdrop-blur-md md:h-14">
            <div className="flex min-w-0 items-center gap-3">
              <button className="admin-desktop-toggle admin-icon-button" type="button" aria-label={collapsed ? '展开侧栏' : '折叠侧栏'} onClick={() => setCollapsed(!collapsed)}><IconLayoutSidebar size={20} /></button>
              <button className="admin-mobile-toggle admin-icon-button" type="button" aria-label="打开后台导航" onClick={() => setMobile(true)}><IconMenu2 size={20} /></button>
              <span className="admin-muted admin-header-label">管理后台</span>
              <span className="admin-muted" aria-hidden="true">/</span>
              <span>{items.find(item => item.url === pathname)?.title || '概览'}</span>
            </div>
            <span className="admin-role">
              <span className="admin-status-dot" />
              管理员
            </span>
          </header>
          {error && <p role="alert" className="admin-error">{error}</p>}
          {children}
        </div>
      </div>
      <Dialog.Root open={mobile} onOpenChange={setMobile}>
        <Dialog.Portal>
          <Dialog.Backdrop className="admin-backdrop" />
          <Dialog.Popup className="admin-mobile-sidebar">
            <Dialog.Title className="sr-only">管理后台导航</Dialog.Title>
            <Dialog.Close className="admin-mobile-close admin-icon-button" aria-label="关闭后台导航"><IconX size={20} /></Dialog.Close>
            {navigation}
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </QueryClientProvider>
  );
}
