'use client';

import type { AdminOverview, AdminSection, AdminUsage, GatewayState, MutationResult, ProviderList } from './contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';
import { adminRequest } from './client';
import AdminDialog from './dialog';
import PageContainer from './layout/page-container';
import Resources from './resources';
import UsageCharts, { UsageCards } from './usage';

const stateLabels: Record<GatewayState['state'], string> = { running: '运行中', stopped: '已停止', starting: '正在启动', error: '异常', unknown: '未知' };
function Overview() {
  const query = useQuery({ queryKey: ['admin', 'overview'], queryFn: () => adminRequest<AdminOverview>('overview'), refetchInterval: 30_000, refetchIntervalInBackground: false });
  return (
    <PageContainer pageTitle="概览" pageDescription="查看平台资源与最近七天的实际用量。" pageHeaderAction={<Button variant="outline" disabled={query.isFetching} onClick={() => void query.refetch()}>刷新</Button>}>
      {query.isPending && <p role="status">正在加载概览…</p>}
      {query.isError && <p role="alert" className="admin-error">{query.error.message}</p>}
      {query.data && !query.isError && (
        <>
          <div className="admin-metrics">
            {[{ title: '上游连接', value: query.data.providers, href: '/admin/providers', caption: '查看全部连接 ↗' }, { title: '有效访问密钥', value: query.data.activeKeys, href: '/admin/keys', caption: '管理访问凭证 ↗' }, { title: '网关状态', value: stateLabels[query.data.gateway.state], href: '/admin/system', caption: '查看系统状态 ↗' }].map(item => (
              <Card key={item.title}>
                <CardHeader>
                  <CardDescription>{item.title}</CardDescription>
                  <CardTitle className="text-3xl tabular-nums">{item.value}</CardTitle>
                </CardHeader>
                <CardContent><Link href={item.href} className="admin-muted">{item.caption}</Link></CardContent>
              </Card>
            ))}
          </div>
          <UsageCards usage={query.data.usage} />
          <UsageCharts usage={query.data.usage} />
        </>
      )}
    </PageContainer>
  );
}
function Usage() {
  const [range, setRange] = useState('7d');
  const [provider, setProvider] = useState('');
  const providers = useQuery({ queryKey: ['admin', 'providers'], queryFn: () => adminRequest<ProviderList>('providers') });
  const query = useQuery({ queryKey: ['admin', 'usage', range, provider], queryFn: () => adminRequest<AdminUsage>(`usage?${new URLSearchParams({ range, ...(provider ? { provider } : {}) })}`) });
  return (
    <PageContainer
      pageTitle="用量统计"
      pageDescription="查看全局或单个连接的请求与 Token 用量。"
      pageHeaderAction={(
        <Button
          variant="outline"
          disabled={query.isFetching}
          onClick={() => {
            void query.refetch();
            void providers.refetch();
          }}
        >
          刷新
        </Button>
      )}
    >
      <div className="admin-table-toolbar">
        <select aria-label="统计周期" value={range} onChange={event => setRange(event.target.value)}>
          <option value="7d">最近 7 天</option>
          <option value="30d">最近 30 天</option>
        </select>
        <select aria-label="统计连接" value={provider} onChange={event => setProvider(event.target.value)}>
          <option value="">全部连接</option>
          {providers.data?.providers.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </div>
      {providers.isError && (
        <p role="alert" className="admin-error">
          连接筛选暂不可用：
          {providers.error.message}
        </p>
      )}
      {query.isPending && <p role="status">正在加载用量…</p>}
      {query.isError && <p role="alert" className="admin-error">{query.error.message}</p>}
      {query.data && !query.isError && (
        <>
          <UsageCards usage={query.data} />
          {query.data.requests === 0 && <p role="status" className="admin-notice">所选范围内暂无请求记录。</p>}
          <UsageCharts usage={query.data} />
        </>
      )}
    </PageContainer>
  );
}
function System() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['admin', 'gateway'], queryFn: () => adminRequest<GatewayState>('gateway'), refetchInterval: 30_000, refetchIntervalInBackground: false });
  const [action, setAction] = useState<'start' | 'stop' | 'restart' | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const names = { start: '启动网关', stop: '停止网关', restart: '重启网关' };
  async function execute() {
    if (!action || busy) {
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await adminRequest<MutationResult>('gateway', { action });
      setMessage(result.message);
    }
    catch (error) {
      setError(error instanceof Error ? error.message : '网关操作未完成。');
    }
    finally {
      await client.invalidateQueries({ queryKey: ['admin'] });
      setBusy(false);
      setAction(null);
    }
  }
  return (
    <PageContainer pageTitle="系统状态" pageDescription="检查管理服务和模型网关的运行情况。" pageHeaderAction={<Button variant="outline" disabled={query.isFetching || busy} onClick={() => void query.refetch()}>刷新</Button>}>
      {query.isPending && <p role="status">正在检查服务…</p>}
      {query.isError && (
        <p role="alert" className="admin-error">
          管理服务不可达：
          {query.error.message}
        </p>
      )}
      {error && <p role="alert" className="admin-error">{error}</p>}
      {message && <p role="status" className="admin-success">{message}</p>}
      <div className="admin-metrics">
        <Card>
          <CardHeader>
            <CardDescription>管理服务</CardDescription>
            <CardTitle>{query.isPending ? '检查中' : query.isError ? '不可达' : '可达'}</CardTitle>
          </CardHeader>
          <CardContent className="admin-muted">每 30 秒自动检查</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>模型网关</CardDescription>
            <CardTitle>{query.isPending ? '检查中' : query.isError ? '未知' : stateLabels[query.data.state]}</CardTitle>
          </CardHeader>
          <CardContent className="admin-muted">页面隐藏时暂停自动检查</CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>网关控制</CardTitle>
          <CardDescription>停止和重启会影响当前模型请求；保存连接也可能触发网关启动或重载。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">{(['start', 'stop', 'restart'] as const).map(value => <Button key={value} variant={value === 'start' ? 'default' : 'outline'} disabled={busy || !query.data || query.isError} onClick={() => setAction(value)}>{names[value]}</Button>)}</CardContent>
      </Card>
      {action && (
        <AdminDialog title={names[action]} description={action === 'start' ? '确认启动当前实例的模型网关？' : '此操作会中断或影响正在进行的模型请求，请确认后继续。'} busy={busy} onClose={() => setAction(null)}>
          <div className="mt-6 flex gap-2">
            <Button disabled={busy} onClick={() => void execute()}>{busy ? '正在处理…' : `确认${names[action]}`}</Button>
            <Button disabled={busy} variant="outline" onClick={() => setAction(null)}>取消</Button>
          </div>
        </AdminDialog>
      )}
    </PageContainer>
  );
}
export default function AdminScreen({ section }: { section: AdminSection }) {
  if (section === 'providers' || section === 'keys') {
    return <Resources key={section} kind={section} />;
  }
  if (section === 'usage') {
    return <Usage />;
  }
  if (section === 'system') {
    return <System />;
  }
  return <Overview />;
}
