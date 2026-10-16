import type { Metadata, Viewport } from 'next';
import '../styles/globals.css';

export const metadata: Metadata = {
  ...(process.env.NEXT_PUBLIC_APP_URL
    ? { metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL) }
    : {}),
  title: {
    default: 'CC Bridge — 在 Claude Code 中使用 GPT',
    template: '%s | CC Bridge'
  },
  description: '免费使用 CC Bridge，通过协议转换让 Claude Code 使用 GPT 模型。',
  openGraph: {
    title: 'CC Bridge — 在 Claude Code 中使用 GPT',
    description: '一个网关，连接 Claude Code 与 GPT。',
    siteName: 'CC Bridge',
    type: 'website'
  }
};

export const viewport: Viewport = { themeColor: '#fafaf9' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='zh-CN' data-theme='vercel' suppressHydrationWarning>
      <body className='bg-background text-foreground antialiased'>{children}</body>
    </html>
  );
}
