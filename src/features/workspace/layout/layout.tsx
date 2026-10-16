'use client';

// Adapted from Apptension SaaS Boilerplate layout, sidebar and header.
// Upstream caa46d26e01f9cd2c29f0e67bb72ff073c755053; see docs/template-source.md.
import type { ReactNode } from 'react';
import type { WorkspaceSection } from './sections';
import Link from 'next/link';
import { CCBridgeLogo } from '@/components/brand/cc-bridge-logo';
import { cn } from '@/utils/Helpers';
import { workspaceSections } from './sections';

interface LayoutProps {
  active: WorkspaceSection;
  onSelect: (section: WorkspaceSection) => void;
  children: ReactNode;
}

function Sidebar({ active, onSelect }: Omit<LayoutProps, 'children'>) {
  return (
    <aside className="workspace-sidebar fixed inset-y-0 left-0 z-50 flex w-56 flex-col border-r bg-background">
      <div className="sidebar-brand flex flex-col gap-4 border-b p-4"><CCBridgeLogo prefetch={false} /></div>
      <nav aria-label="工作台导航" className="sidebar-navigation flex-1 overflow-y-auto overflow-x-hidden px-3 py-4">
        <p className="sidebar-caption px-3 py-2 text-xs font-medium tracking-wider text-muted-foreground">功能菜单</p>
        <div className="sidebar-items flex flex-col gap-1">
          {workspaceSections.map(item => (
            <button
              key={item.id}
              type="button"
              aria-pressed={active === item.id}
              aria-controls={`panel-${item.id}`}
              onClick={() => onSelect(item.id)}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
                active === item.id ? 'bg-accent text-accent-foreground' : 'text-muted-foreground',
              )}
            >
              <span aria-hidden="true" className="sidebar-symbol w-5 shrink-0 text-center">{item.symbol}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
      <div className="sidebar-bottom border-t p-4">
        <Link href="/" prefetch={false} className="text-sm text-muted-foreground">返回官网 ↗</Link>
        <p className="mt-3 text-xs text-muted-foreground">CC Bridge</p>
      </div>
    </aside>
  );
}

export function WorkspaceLayout({ active, onSelect, children }: LayoutProps) {
  return (
    <div className="workspace">
      <Sidebar active={active} onSelect={onSelect} />
      <div className="workspace-body pl-56">
        <header className="workspace-toolbar sticky top-0 z-40 border-b bg-background/80 backdrop-blur-sm">
          <div className="flex h-16 items-center gap-3 px-6">
            <span className="text-sm text-muted-foreground">用户工作台</span>
            <span className="text-xs text-muted-foreground" aria-hidden="true">/</span>
            <span className="text-sm font-medium">{workspaceSections.find(item => item.id === active)?.label}</span>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
