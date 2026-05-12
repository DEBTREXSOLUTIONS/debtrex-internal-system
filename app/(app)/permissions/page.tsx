import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission, getAllPermissions, PERMISSION_GROUPS, PERMISSION_LABELS } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/supabase';
import PermissionsManager from './PermissionsManager';

export default async function PermissionsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!(await hasPermission(user.role, 'permissions.manage'))) redirect('/');

  const matrix = await getAllPermissions();

  // Fetch ALL roles (built-in + custom) for the column headers
  const { data: rolesData } = await supabaseAdmin
    .from('custom_roles')
    .select('role_key, label, is_built_in')
    .order('is_built_in', { ascending: false })
    .order('created_at', { ascending: true });

  const roles = (rolesData || []).map(r => ({
    value: r.role_key,
    label: r.label,
    isCustom: !r.is_built_in,
  }));

  const groups = PERMISSION_GROUPS.map(g => ({ label: g.label, keys: [...g.keys] }));
  const labels: Record<string, string> = { ...PERMISSION_LABELS };

  return (
            <div className="p-4 sm:p-6 max-w-6xl mx-auto">
          <PermissionsManager
            matrix={matrix}
            groups={groups}
            labels={labels}
            roles={roles}
          />
        </div>
  );
}
