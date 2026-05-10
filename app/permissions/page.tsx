import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission, getAllPermissions, PERMISSION_GROUPS, PERMISSION_LABELS } from '@/lib/permissions';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import PermissionsManager from './PermissionsManager';

export default async function PermissionsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!(await hasPermission(user.role, 'permissions.manage'))) redirect('/');

  const matrix = await getAllPermissions();

  // Pass groups + labels to client (need to JSON-clone)
  const groups = PERMISSION_GROUPS.map(g => ({ label: g.label, keys: [...g.keys] }));
  const labels: Record<string, string> = { ...PERMISSION_LABELS };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar user={user} />
      <main className="flex-1 min-w-0">
        <TopBar user={user} title="Role Permissions" />
        <div className="p-4 sm:p-6 max-w-6xl mx-auto">
          <PermissionsManager
            matrix={matrix}
            groups={groups}
            labels={labels}
          />
        </div>
      </main>
    </div>
  );
}
