import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import TransferProtocolClient from './TransferProtocolClient';

export default async function TransferProtocolPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!(await hasPermission(user.role, 'transfer.manage'))) redirect('/');

  return <TransferProtocolClient />;
}
