import type { AdminSection } from '@/features/admin/contracts';
import { notFound } from 'next/navigation';
import AdminScreen from '@/features/admin/screen';

export default async function AdminPage({ params }: { params: Promise<{ section?: string[] }> }) {
  const { section = [] } = await params;
  const value = section[0] || 'overview';
  if (section.length > 1 || !['overview', 'providers', 'keys', 'usage', 'system'].includes(value)) {
    notFound();
  }
  return <AdminScreen section={value as AdminSection} />;
}
