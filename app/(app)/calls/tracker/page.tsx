import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import CallsTrackerClient from './CallsTrackerClient';

export default async function CallsTrackerPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!(await hasPermission(user.role, 'calls.view_stats'))) redirect('/');

  const canManageStatus = await hasPermission(user.role, 'team.manage_status');

  return <CallsTrackerClient canManageStatus={canManageStatus} />;
}
