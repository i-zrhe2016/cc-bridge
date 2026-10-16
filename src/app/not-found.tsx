import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CenteredContainer } from '@/features/auth/CenteredContainer';

export default function NotFound() {
  return (
    <CenteredContainer>
      <h1 className="text-3xl font-semibold">404 · 页面不存在</h1>
      <Button asChild><Link href="/">返回首页</Link></Button>
    </CenteredContainer>
  );
}
