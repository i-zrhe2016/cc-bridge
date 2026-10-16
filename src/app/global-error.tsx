'use client';

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="zh-CN">
      <body style={{ margin: 0, minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ textAlign: 'center', padding: 24 }}>
          <h1>页面暂时无法显示</h1>
          <button type="button" onClick={reset}>重试</button>
        </div>
      </body>
    </html>
  );
}
