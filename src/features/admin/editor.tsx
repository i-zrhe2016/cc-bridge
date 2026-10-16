'use client';

import type { AdminProvider } from './contracts';
import { useForm } from '@tanstack/react-form';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import AdminDialog from './dialog';

export default function ResourceEditor({ kind, provider, submit, onClose }: {
  kind: 'provider' | 'key';
  provider?: AdminProvider;
  submit: (input: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
}) {
  const [error, setError] = useState('');
  const form = useForm({
    defaultValues: { name: provider?.name || '', endpoint: provider?.endpoint || '', apiKey: '', models: provider?.models.join('\n') || '', expiresAt: '' },
    onSubmit: async ({ value }) => {
      setError('');
      try {
        await submit(kind === 'provider'
          ? { action: 'save', ...(provider ? { id: provider.id } : {}), name: value.name, endpoint: value.endpoint, apiKey: value.apiKey, models: value.models.split('\n').map(model => model.trim()).filter(Boolean) }
          : { action: 'create', name: value.name, ...(value.expiresAt ? { expiresAt: new Date(value.expiresAt).toISOString() } : {}) });
        onClose();
      }
      catch (error) {
        setError(error instanceof Error ? error.message : '操作失败，请重试。');
      }
    },
  });
  const fields = kind === 'provider'
    ? [{ name: 'name', label: '连接名称', type: 'text', help: '创建后名称固定，用于模型选择器和用量归属。' }, { name: 'endpoint', label: 'API 地址', type: 'url', help: '例如 https://api.openai.com/v1' }, { name: 'apiKey', label: provider ? 'API Key（留空保留原值）' : 'API Key', type: 'password', help: '密钥只保存到服务端。' }, { name: 'models', label: '模型（每行一个）', type: 'textarea', help: provider?.owned ? '工作台专用连接仅支持一个模型。' : '填写服务商提供的模型名称。' }] as const
    : [{ name: 'name', label: '密钥名称', type: 'text', help: '便于识别用途，例如 开发环境。' }, { name: 'expiresAt', label: '有效期（可选）', type: 'datetime-local', help: '按当前浏览器时区填写，留空表示长期有效。' }] as const;
  return (
    <form.Subscribe selector={state => state.isSubmitting}>
      {busy => (
        <AdminDialog drawer title={kind === 'key' ? '新建访问密钥' : provider ? '编辑上游连接' : '新增上游连接'} description={kind === 'key' ? '访问密钥可以调用当前实例提供的模型。' : '使用 OpenAI Chat Completions 协议接入模型。'} onClose={onClose} busy={busy}>
          <form
            className="admin-form mt-6"
            onSubmit={(event) => {
              event.preventDefault();
              void form.handleSubmit();
            }}
          >
            {fields.map(item => (
              <form.Field key={item.name} name={item.name}>
                {field => (
                  <div className="admin-field">
                    <label htmlFor={`editor-${item.name}`}>{item.label}</label>
                    {item.type === 'textarea'
                      ? <textarea id={`editor-${item.name}`} rows={5} required maxLength={20_000} value={field.state.value} onBlur={field.handleBlur} onChange={event => field.handleChange(event.target.value)} disabled={busy} />
                      : <input id={`editor-${item.name}`} type={item.type} autoComplete={item.type === 'password' ? 'new-password' : 'off'} required={item.name !== 'expiresAt' && !(item.name === 'apiKey' && Boolean(provider))} maxLength={item.name === 'apiKey' ? 4096 : 2048} value={field.state.value} onBlur={field.handleBlur} onChange={event => field.handleChange(event.target.value)} disabled={busy || (item.name === 'name' && Boolean(provider))} />}
                    <p className="admin-muted">{item.help}</p>
                  </div>
                )}
              </form.Field>
            ))}
            {error && <p role="alert" className="admin-error">{error}</p>}
            <div className="flex gap-2 border-t pt-4">
              <Button type="submit" disabled={busy}>{busy ? '正在保存…' : '保存'}</Button>
              <Button type="button" variant="outline" onClick={onClose} disabled={busy}>取消</Button>
            </div>
          </form>
        </AdminDialog>
      )}
    </form.Subscribe>
  );
}
