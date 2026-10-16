'use client';

import type { FormEvent } from 'react';
import type { WorkspaceAction, WorkspaceSnapshot } from './contracts';
import type { ConnectionInput, WorkspaceState } from './demo-service';
import type { WorkspaceSection } from './layout/sections';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { workspaceRequest } from './contracts';
import { buildConfiguration, demoService, validateConnection } from './demo-service';
import { Card } from './layout/card';
import { WorkspaceLayout } from './layout/layout';
import { workspaceSections } from './layout/sections';
import './workspace.css';

const emptyForm: ConnectionInput = { name: '', endpoint: '', apiKey: '', model: '' };
type Action = 'delete' | 'reset' | 'revoke';
const actionLabels: Record<Action, string> = { delete: '删除配置', reset: '更换密钥', revoke: '停用密钥' };

export default function Workspace({ initial, onSignOut }: { initial?: WorkspaceSnapshot; onSignOut?: () => Promise<void> }) {
  const [active, setActive] = useState<WorkspaceSection>('connection');
  const [state, setState] = useState<WorkspaceState>(initial?.state || { connection: null, bridgeKey: null });
  const [form, setForm] = useState<ConnectionInput>(emptyForm);
  const [editing, setEditing] = useState(!initial?.state.connection);
  const [busy, setBusy] = useState(false);
  const pendingRef = useRef(false);
  const [backend, setBackend] = useState(initial);
  const [usage, setUsage] = useState(initial?.usage || demoService.getUsage());
  const [showUpstream, setShowUpstream] = useState(false);
  const [showBridge, setShowBridge] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [action, setAction] = useState<Action | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const configRef = useRef<HTMLPreElement>(null);
  const bridgeRef = useRef<HTMLInputElement>(null);
  const configuration = buildConfiguration(state, backend?.gatewayUrl, backend?.gatewayModel);
  const totals = usage.reduce((sum, day) => ({ requests: sum.requests + day.requests, input: sum.input + day.input, output: sum.output + day.output }), { requests: 0, input: 0, output: 0 });

  useEffect(() => {
    if (initial && active === 'usage') {
      void workspaceRequest().then(value => setUsage(value.usage)).catch(error => setNotice(error.message));
    }
  }, [active, initial]);

  async function update(action: WorkspaceAction) {
    const value = await workspaceRequest(action);
    setState(value.state);
    setUsage(value.usage);
    setBackend(value);
  }

  async function perform(task: () => Promise<void>) {
    if (pendingRef.current) {
      return false;
    }
    pendingRef.current = true;
    setBusy(true);
    setError('');
    try {
      await task();
      return true;
    }
    catch (error) {
      const message = error instanceof Error ? error.message : '操作未完成，请重试。';
      setError(message);
      setNotice(message);
      return false;
    }
    finally {
      pendingRef.current = false;
      setBusy(false);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateConnection(form, Boolean(state.connection));
    if (validation) {
      setError(validation);
      return;
    }
    const saved = await perform(async () => {
      if (initial) {
        await update({ action: 'save', input: form });
      }
      else {
        setState(previous => ({ ...previous, connection: demoService.saveConnection(form, previous.connection) }));
      }
    });
    if (!saved) {
      return;
    }
    setForm(emptyForm);
    setEditing(false);
    setShowUpstream(false);
    setError('');
    setNotice('已保存，下一步生成访问密钥。');
  }

  function startEdit() {
    if (!state.connection) {
      return;
    }
    setForm({ name: state.connection.name, endpoint: state.connection.endpoint, model: state.connection.model, apiKey: '' });
    setEditing(true);
    setError('');
  }

  function confirmAction(next: Action) {
    setAction(next);
    dialogRef.current?.showModal();
  }

  async function applyAction() {
    if (initial) {
      const saved = await perform(() => update({ action: action === 'reset' ? 'rotate' : action === 'delete' ? 'delete' : 'revoke' }));
      if (!saved) {
        return;
      }
    }
    if (action === 'delete') {
      setState({ connection: null, bridgeKey: null });
      setForm(emptyForm);
      setEditing(true);
      setError('');
      setShowUpstream(false);
    }
    else if (action === 'reset' && !initial) {
      setState(previous => ({ ...previous, bridgeKey: demoService.createBridgeKey() }));
    }
    else if (action === 'revoke' && !initial) {
      setState(previous => ({ ...previous, bridgeKey: null }));
    }
    setShowBridge(false);
    setNotice(action === 'delete' ? '配置、访问密钥和命令已清除。' : action === 'reset' ? '密钥已更换，请重新复制命令。' : '访问密钥已停用，命令已清除。');
    dialogRef.current?.close();
  }

  async function generateKey() {
    const saved = await perform(async () => {
      if (initial) {
        await update({ action: 'rotate' });
      }
      else {
        setState(previous => ({ ...previous, bridgeKey: demoService.createBridgeKey() }));
      }
    });
    if (saved) {
      setNotice('访问密钥已生成，下一步查看教程。');
    }
  }

  async function copy(value: string, target: 'config' | 'key') {
    try {
      await navigator.clipboard.writeText(value);
      setNotice('已复制');
    }
    catch {
      if (target === 'config' && configRef.current) {
        const range = document.createRange();
        range.selectNodeContents(configRef.current);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
      else {
        setShowBridge(true);
        // The field always contains the key; masking is visual only.
        bridgeRef.current?.focus();
        bridgeRef.current?.select();
      }
      setNotice('内容已选中，请手动复制。');
    }
  }

  return (
    <WorkspaceLayout active={active} onSelect={setActive}>
      <main className="workspace-main">
        <div className="workspace-heading">
          <div>
            <h1>
              {workspaceSections.find(item => item.id === active)?.label}
            </h1>
          </div>
        </div>
        <aside className="demo-note">{initial ? '配置已连接后端，保存后刷新仍可使用。模型费用由你的 GPT 服务商收取。' : '演示版：请使用测试密钥。刷新后数据会清空，生成的密钥和命令暂不能实际使用。'}</aside>
        {onSignOut && <Button variant="ghost" onClick={() => void onSignOut()}>退出工作台</Button>}
        <div role="status" aria-live="polite" className="workspace-notice">{notice}</div>
        <fieldset disabled={busy} className="workspace-content m-0 min-w-0 border-0 p-0" aria-busy={busy}>
          <Card id="panel-connection" hidden={active !== 'connection'} role="region" className="workspace-card" aria-labelledby="connection-title">
            <div className="card-heading">
              <div>
                <span className="step-number">01</span>
                <h2 id="connection-title">填写 GPT 信息</h2>
              </div>
              <span className="small-label">自备 GPT 密钥</span>
            </div>
            <p className="section-description">填写你购买 GPT 服务时获得的地址、密钥和模型。</p>
            {editing
              ? (
                  <form onSubmit={save} noValidate>
                    <label htmlFor="connection-name">名称</label>
                    <input id="connection-name" value={form.name} maxLength={80} placeholder="例如：我的 GPT 服务" onChange={event => setForm({ ...form, name: event.target.value })} required />
                    <label htmlFor="connection-endpoint">API 地址</label>
                    <input id="connection-endpoint" type="url" value={form.endpoint} placeholder="https://your-provider.example/v1" aria-describedby="endpoint-help" onChange={event => setForm({ ...form, endpoint: event.target.value })} required />
                    <p id="endpoint-help" className="field-help">复制服务商提供的 API 地址。</p>
                    <label htmlFor="connection-key">GPT 密钥（API Key）</label>
                    <div className="secret-field">
                      <input id="connection-key" type={showUpstream ? 'text' : 'password'} value={form.apiKey} autoComplete="off" spellCheck={false} placeholder={state.connection ? '不修改请留空' : initial ? '输入服务商提供的密钥' : '输入测试密钥'} onChange={event => setForm({ ...form, apiKey: event.target.value })} required={!state.connection} />
                      <button type="button" aria-label={showUpstream ? '隐藏 GPT 密钥' : '显示 GPT 密钥'} onClick={() => setShowUpstream(!showUpstream)}>{showUpstream ? '隐藏' : '显示'}</button>
                    </div>
                    <label htmlFor="connection-model">模型</label>
                    <input id="connection-model" value={form.model} maxLength={200} placeholder="填写服务商提供的模型 ID" onChange={event => setForm({ ...form, model: event.target.value })} required />
                    {error && <p role="alert" className="form-error">{error}</p>}
                    <div className="card-actions">
                      <Button type="submit">保存</Button>
                      {state.connection && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setEditing(false);
                            setForm(emptyForm);
                            setShowUpstream(false);
                            setError('');
                          }}
                        >
                          取消
                        </Button>
                      )}
                    </div>
                  </form>
                )
              : state.connection && (
                <>
                  <div className="connection-summary">
                    <span className="connection-symbol">↗</span>
                    <div>
                      <h3>{state.connection.name}</h3>
                      <span className="small-label">已保存，尚未测试</span>
                    </div>
                  </div>
                  <dl>
                    <div>
                      <dt>服务地址</dt>
                      <dd>{state.connection.endpoint}</dd>
                    </div>
                    <div>
                      <dt>模型</dt>
                      <dd>{state.connection.model}</dd>
                    </div>
                    <div>
                      <dt>GPT 密钥</dt>
                      <dd>{state.connection.keyMask}</dd>
                    </div>
                  </dl>
                  <div className="card-actions">
                    <Button onClick={() => setActive('bridge')}>下一步：生成密钥</Button>
                    <Button variant="outline" onClick={startEdit}>编辑</Button>
                    <Button variant="ghost" onClick={() => confirmAction('delete')}>删除配置</Button>
                  </div>
                </>
              )}
          </Card>
          <Card id="panel-bridge" hidden={active !== 'bridge'} role="region" className="workspace-card" aria-labelledby="bridge-title">
            <div className="card-heading">
              <div>
                <span className="step-number">02</span>
                <h2 id="bridge-title">生成访问密钥</h2>
              </div>
              <span className="small-label">用于 Claude Code</span>
            </div>
            <p className="section-description">这是 CC Bridge 的密钥，用来连接 Claude Code。</p>
            {state.bridgeKey
              ? (
                  <>
                    <label htmlFor="bridge-key">当前访问密钥</label>
                    <div className="secret-field">
                      <input ref={bridgeRef} id="bridge-key" readOnly value={state.bridgeKey} type={showBridge ? 'text' : 'password'} />
                      <button type="button" aria-label={showBridge ? '隐藏访问密钥' : '显示访问密钥'} onClick={() => setShowBridge(!showBridge)}>{showBridge ? '隐藏' : '显示'}</button>
                    </div>
                    <div className="card-actions">
                      <Button onClick={() => setActive('configuration')}>下一步：查看教程</Button>
                      <Button variant="outline" onClick={() => void copy(state.bridgeKey!, 'key')}>复制密钥</Button>
                      <Button variant="ghost" onClick={() => confirmAction('reset')}>更换密钥</Button>
                      <Button variant="ghost" onClick={() => confirmAction('revoke')}>停用密钥</Button>
                    </div>
                  </>
                )
              : (
                  <div className="empty-state">
                    <span aria-hidden="true">⌘</span>
                    <p>{state.connection ? '还没有访问密钥，点击下方按钮生成。' : '先填写 GPT 信息，再生成访问密钥。'}</p>
                    {!state.connection && <Button variant="outline" onClick={() => setActive('connection')}>去填写</Button>}
                    <Button
                      disabled={!state.connection}
                      onClick={() => void generateKey()}
                    >
                      生成访问密钥
                    </Button>
                  </div>
                )}
          </Card>

          <Card id="panel-configuration" hidden={active !== 'configuration'} role="region" className="workspace-card configuration-card" aria-labelledby="config-title">
            <div className="card-heading">
              <div>
                <span className="step-number">03</span>
                <h2 id="config-title">在 Claude Code 中使用</h2>
              </div>
              <span className="small-label">终端配置</span>
            </div>
            <p className="section-description">复制下面的命令，粘贴到终端运行。</p>
            {!configuration && (
              <div className="configuration-prerequisite">
                <p>{state.connection ? '先生成访问密钥，再复制命令。' : '先填写 GPT 信息，再复制命令。'}</p>
                <Button variant="outline" onClick={() => setActive(state.connection ? 'bridge' : 'connection')}>{state.connection ? '去生成密钥' : '去填写'}</Button>
              </div>
            )}
            <div className="config-terminal">
              <div className="terminal-caption">
                <span>
                  <i />
                  <i />
                  <i />
                </span>
                <span>终端命令</span>
              </div>
              <pre ref={configRef} tabIndex={0} aria-label="Claude Code 配置命令">{configuration || '# 请先填写 GPT 信息并生成访问密钥'}</pre>
            </div>
            <div className="card-actions">
              <Button disabled={!configuration} onClick={() => void copy(configuration, 'config')}>复制命令</Button>
              <span className="small-label">{initial ? '请在已安装 Claude Code 的终端运行' : '演示命令，暂不能实际使用'}</span>
            </div>
            <div className="setup-checklist">
              <p>
                <span>{state.connection ? '✓' : '01'}</span>
                填写 GPT 信息
              </p>
              <p>
                <span>{state.bridgeKey ? '✓' : '02'}</span>
                生成访问密钥
              </p>
              <p>
                <span>03</span>
                复制命令到终端
              </p>
            </div>
          </Card>
          <Card id="panel-usage" hidden={active !== 'usage'} role="region" className="workspace-card" aria-labelledby="usage-title">
            <div className="card-heading">
              <div><h2 id="usage-title">最近 7 天</h2></div>
              <span className="demo-badge">{initial ? '实际用量' : '示例数据'}</span>
            </div>
            <p className="section-description">{initial ? '最近 7 天的实际使用情况，进入本栏时更新。' : '最近 7 天的使用情况。以下为示例数据。'}</p>
            <p className="field-help">Token 是计算模型用量的单位。</p>
            <dl className="usage-stats">
              <div>
                <dt>调用次数</dt>
                <dd>
                  {totals.requests}
                  <small>次</small>
                </dd>
              </div>
              <div>
                <dt>输入用量（Token）</dt>
                <dd>
                  {totals.input / 1000}
                  <small>K</small>
                </dd>
              </div>
              <div>
                <dt>输出用量（Token）</dt>
                <dd>
                  {totals.output / 1000}
                  <small>K</small>
                </dd>
              </div>
            </dl>
            <div className="usage-chart" role="img" aria-label={`最近 7 天${initial ? '' : '示例'}调用次数：${usage.map(day => `${day.label} ${day.requests} 次`).join('，')}`}>
              {usage.map(day => (
                <div className="chart-column" key={day.label}>
                  <span>{day.requests}</span>
                  <div className="chart-track"><div style={{ height: `${day.requests / Math.max(60, ...usage.map(day => day.requests)) * 100}%` }} /></div>
                  <small>{day.label}</small>
                </div>
              ))}
            </div>
          </Card>
        </fieldset>
        <footer className="workspace-footer">
          <span>CC Bridge · 连接你的开发工作流</span>
        </footer>
      </main>
      <dialog ref={dialogRef} className="workspace-dialog" aria-labelledby="confirm-title" onClose={() => setAction(null)}>
        <h2 id="confirm-title">
          确认
          {action ? actionLabels[action] : '操作'}
          ？
        </h2>
        <p>{action === 'delete' ? '访问密钥和命令也会清除。' : action === 'reset' ? '更换后，旧密钥不能继续使用。请重新复制命令。' : '停用后，当前密钥和对应的命令不能继续使用。'}</p>
        <div className="card-actions">
          <Button variant="outline" onClick={() => dialogRef.current?.close()} autoFocus>取消</Button>
          <Button onClick={() => void applyAction()} disabled={busy}>
            确认
            {action ? actionLabels[action] : '操作'}
          </Button>
        </div>
      </dialog>
    </WorkspaceLayout>
  );
}
