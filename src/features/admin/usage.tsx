'use client';

// Chart composition adapted from Kiranism features/overview/components/area-graph.tsx (MIT).
import type { AdminUsage, UsagePoint } from './contracts';
import { useId } from 'react';
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';

export function UsageCards({ usage }: { usage: AdminUsage }) {
  return (
    <div className="admin-metrics">
      {[{ title: '请求总量', value: usage.requests, unit: '次请求' }, { title: '输入 Token', value: usage.input, unit: 'Tokens' }, { title: '输出 Token', value: usage.output, unit: 'Tokens' }].map(item => (
        <Card key={item.title}>
          <CardHeader>
            <CardDescription>{item.title}</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{item.value.toLocaleString('zh-CN')}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">{item.unit}</CardContent>
        </Card>
      ))}
    </div>
  );
}
function Trend({ series, tokens }: { series: UsagePoint[]; tokens?: boolean }) {
  const patternId = useId().replaceAll(':', '');
  const fields = tokens ? [{ key: 'input', label: '输入 Token', color: '#4f46e5' }, { key: 'output', label: '输出 Token', color: '#0891b2' }] : [{ key: 'requests', label: '请求次数', color: '#4f46e5' }];
  return (
    <Card>
      <CardHeader>
        <CardTitle>{tokens ? 'Token 用量' : '请求趋势'}</CardTitle>
        <CardDescription>按 CCR 统计时间展示</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="admin-chart" role="img" aria-label={tokens ? '每日输入和输出 Token 趋势图' : '每日请求次数趋势图'}>
          <ResponsiveContainer width="100%" height="100%" minWidth={1}>
            <AreaChart accessibilityLayer data={series} margin={{ left: 0, right: 12, bottom: 0, top: 12 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={25} tick={{ fontSize: 11 }} />
              <YAxis width={48} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <defs>{fields.map(field => <pattern key={field.key} id={`${patternId}-${field.key}`} x="0" y="0" width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="5" cy="5" r="1.5" fill={field.color} opacity={0.5} /></pattern>)}</defs>
              {fields.map(field => <Area key={field.key} name={field.label} dataKey={field.key} type="monotone" fill={`url(#${patternId}-${field.key})`} fillOpacity={0.4} stroke={field.color} strokeWidth={1.5} isAnimationActive={false} />)}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
export default function UsageCharts({ usage }: { usage: AdminUsage }) {
  return (
    <div className="admin-charts">
      <Trend series={usage.series} />
      <Trend series={usage.series} tokens />
    </div>
  );
}
