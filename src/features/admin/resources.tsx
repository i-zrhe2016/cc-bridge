'use client';

import type { ColumnDef } from '@tanstack/react-table';
import type { AdminKey, AdminProvider, KeyList, MutationResult, ProviderList } from './contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { adminRequest } from './client';
import DataTable from './data-table';
import AdminDialog from './dialog';
import ResourceEditor from './editor';
import PageContainer from './layout/page-container';

function date(value: string | null) {
  if (!value) {
    return '长期有效';
  }
  const time = new Date(value);
  return Number.isNaN(time.getTime()) ? '—' : time.toLocaleString('zh-CN');
}
export default function Resources({ kind }: { kind: 'providers' | 'keys' }) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['admin', kind], queryFn: () => adminRequest<ProviderList | KeyList>(kind) });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [editor, setEditor] = useState<{ provider?: AdminProvider; revision: string } | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; description: string; input: Record<string, unknown> } | null>(null);
  const [secret, setSecret] = useState('');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const providers = (query.data as ProviderList | undefined)?.providers;
  const keys = (query.data as KeyList | undefined)?.keys;
  const revision = query.data?.revision;
  async function mutate(input: Record<string, unknown>) {
    setError('');
    setMessage('');
    try {
      const result = await adminRequest<MutationResult>(kind, input);
      setMessage(result.message);
      if (result.secret) {
        setCopied(false);
        setSecret(result.secret);
      }
    }
    finally {
      await queryClient.invalidateQueries({ queryKey: ['admin'] });
    }
  }
  function ask(title: string, description: string, input: Record<string, unknown>) {
    setConfirm({ title, description, input: { ...input, revision } });
  }
  async function execute() {
    if (!confirm || busy) {
      return;
    }
    setBusy(true);
    try {
      await mutate(confirm.input);
      setConfirm(null);
    }
    catch (error) {
      setError(error instanceof Error ? error.message : '操作未完成。');
      setConfirm(null);
    }
    finally {
      setBusy(false);
    }
  }
  const providerColumns = useMemo<ColumnDef<AdminProvider>[]>(() => [
    { accessorKey: 'name', header: '连接名称', cell: ({ row }) => (
      <div className="admin-resource-name">
        <strong>{row.original.name}</strong>
        {row.original.owned && <small>工作台专用</small>}
      </div>
    ) },
    { accessorKey: 'endpoint', header: '上游地址', cell: ({ row }) => <span className="admin-endpoint">{row.original.endpoint || '—'}</span> },
    { id: 'models', accessorFn: row => row.models.join(', '), header: '模型', cell: ({ row }) => <div className="admin-models">{row.original.models.map(model => <span key={model} className="admin-tag">{model}</span>)}</div> },
    { accessorKey: 'enabled', header: '状态', cell: ({ row }) => <span className={`admin-badge ${row.original.enabled ? 'admin-badge-green' : ''}`}>{row.original.enabled ? '已启用' : '已停用'}</span> },
    { id: 'actions', header: '操作', enableSorting: false, cell: ({ row }) => (
      <div className="admin-row-actions">
        {row.original.editable
          ? <Button size="sm" variant="outline" onClick={() => setEditor({ provider: row.original, revision: revision! })}>编辑</Button>
          : (
              <span className="admin-muted">
                {row.original.protocol}
                {' '}
                · 暂不支持编辑
              </span>
            )}
        {!row.original.owned && (
          <>
            <Button size="sm" variant="outline" onClick={() => ask(row.original.enabled ? '停用连接' : '启用连接', `确认${row.original.enabled ? '停用' : '启用'}「${row.original.name}」？此操作将影响模型请求。`, { action: 'toggle', id: row.original.id, enabled: !row.original.enabled })}>{row.original.enabled ? '停用' : '启用'}</Button>
            <Button size="sm" variant="outline" onClick={() => ask('删除连接', `删除「${row.original.name}」后，其模型选择器将无法使用。实例访问密钥仍保留。`, { action: 'delete', id: row.original.id })}>删除</Button>
          </>
        )}
      </div>
    ) },
  ], [revision]);
  const keyColumns = useMemo<ColumnDef<AdminKey>[]>(() => [
    { accessorKey: 'name', header: '名称', cell: ({ row }) => (
      <div className="admin-resource-name">
        <strong>{row.original.name}</strong>
        {row.original.owned && <small>工作台专用</small>}
      </div>
    ) },
    { accessorKey: 'mask', header: '访问密钥', cell: ({ row }) => <code>{row.original.mask}</code> },
    { accessorKey: 'createdAt', header: '创建时间', cell: ({ row }) => date(row.original.createdAt) },
    { accessorKey: 'expiresAt', header: '有效期', cell: ({ row }) => date(row.original.expiresAt) },
    { accessorKey: 'active', header: '状态', cell: ({ row }) => <span className={`admin-badge ${row.original.active ? 'admin-badge-green' : ''}`}>{row.original.active ? '有效' : '已失效'}</span> },
    { id: 'actions', header: '操作', enableSorting: false, cell: ({ row }) => (
      <div className="admin-row-actions">
        <Button size="sm" variant="outline" onClick={() => ask('更换密钥', `更换「${row.original.name}」后，旧密钥立即失效。已失效密钥将重新启用并取消过期时间；仍有效密钥保留原有效期。`, { action: 'rotate', id: row.original.id })}>更换</Button>
        {row.original.active && <Button size="sm" variant="outline" onClick={() => ask('撤销密钥', `确认撤销「${row.original.name}」？使用此密钥的客户端将无法继续调用模型。`, { action: 'revoke', id: row.original.id })}>撤销</Button>}
        {!row.original.owned && <Button size="sm" variant="outline" onClick={() => ask('删除密钥', `确认永久删除「${row.original.name}」？密钥将立即失效。`, { action: 'delete', id: row.original.id })}>删除</Button>}
      </div>
    ) },
  ], [revision]);
  const filter = (
    <select aria-label="资源状态" value={status} onChange={event => setStatus(event.target.value)}>
      <option value="all">全部状态</option>
      <option value="active">{kind === 'providers' ? '已启用' : '有效'}</option>
      <option value="inactive">{kind === 'providers' ? '已停用' : '已失效'}</option>
    </select>
  );
  return (
    <PageContainer
      pageTitle={kind === 'providers' ? '上游连接' : '访问密钥'}
      pageDescription={kind === 'providers' ? '管理模型服务连接与可用模型。' : '管理当前实例的模型访问凭证。'}
      pageHeaderAction={(
        <>
          <Button variant="outline" disabled={query.isFetching} onClick={() => void query.refetch()}>刷新</Button>
          <Button disabled={!revision || query.isError} onClick={() => setEditor({ revision: revision! })}>{kind === 'providers' ? '新增连接' : '新建密钥'}</Button>
        </>
      )}
    >
      <div className="admin-notice">{kind === 'providers' ? '工作台专用连接可编辑，停用和删除请在用户工作台操作。保存配置可能触发网关启动或重载。' : '访问密钥可访问当前实例提供的模型。完整密钥仅在新建或更换后展示，请及时保存。'}</div>
      {message && <p role="status" className="admin-success">{message}</p>}
      {error && <p role="alert" className="admin-error">{error}</p>}
      {query.isPending && <div role="status" className="admin-card">正在加载资源…</div>}
      {query.isError && (
        <div role="alert" className="admin-error">
          {query.error.message}
          {' '}
          <button type="button" onClick={() => void query.refetch()}>重试</button>
        </div>
      )}
      {!query.isError && providers && <DataTable data={providers.filter(item => status === 'all' || item.enabled === (status === 'active'))} columns={providerColumns} search={search} onSearch={setSearch}>{filter}</DataTable>}
      {!query.isError && keys && <DataTable data={keys.filter(item => status === 'all' || item.active === (status === 'active'))} columns={keyColumns} search={search} onSearch={setSearch}>{filter}</DataTable>}
      {editor && <ResourceEditor kind={kind === 'providers' ? 'provider' : 'key'} provider={editor.provider} onClose={() => setEditor(null)} submit={input => mutate({ ...input, revision: editor.revision })} />}
      {confirm && (
        <AdminDialog title={confirm.title} description={confirm.description} busy={busy} onClose={() => setConfirm(null)}>
          <div className="mt-6 flex gap-2">
            <Button disabled={busy} onClick={() => void execute()}>{busy ? '正在处理…' : `确认${confirm.title}`}</Button>
            <Button variant="outline" disabled={busy} onClick={() => setConfirm(null)}>取消</Button>
          </div>
        </AdminDialog>
      )}
      {secret && (
        <AdminDialog title="保存访问密钥" description="此窗口关闭后，后台将不再展示完整密钥。请复制到安全位置。" onClose={() => setSecret('')}>
          <label className="admin-field mt-5" htmlFor="generated-secret">
            新访问密钥
            <input id="generated-secret" readOnly value={secret} className="font-mono" />
          </label>
          <div className="mt-4 flex gap-2">
            <Button onClick={async () => {
              try {
                await navigator.clipboard.writeText(secret);
                setCopied(true);
              }
              catch { setCopied(false); }
            }}
            >
              {copied ? '已复制' : '复制密钥'}
            </Button>
            <Button variant="outline" onClick={() => setSecret('')}>已保存，关闭</Button>
          </div>
        </AdminDialog>
      )}
    </PageContainer>
  );
}
