import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '登录',
  description: '使用 Google 继续访问 CC Bridge，登录和注册共用一个入口。',
  robots: { index: false, follow: false }
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
