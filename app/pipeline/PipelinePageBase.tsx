import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission, type PermissionKey } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import PipelineList from './PipelineList';

interface Props {
  type: 'management' | 'sales';
}

export default async function PipelinePageBase({ type }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const sectionKey: PermissionKey = type === 'management'
    ? 'section.pipeline_management'
    : 'section.pipeline_sales';
  if (!(await hasPermission(user.role, sectionKey))) redirect('/');

  const canViewAll = await hasPermission(user.role, 'pipeline.view_all');

  // Fetch contacts
  let query = supabaseAdmin
    .from('pipeline_contacts')
    .select(`
      *,
      assigned_to_profile:profiles!pipeline_contacts_assigned_to_fkey(full_name),
      created_by_profile:profiles!pipeline_contacts_created_by_fkey(full_name)
    `)
    .eq('pipeline_type', type)
    .order('updated_at', { ascending: false });

  if (!canViewAll) {
    // User only sees contacts they own or are assigned to
    query = query.or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`);
  }

  const { data: contacts } = await query;

  // Permissions object for the client component
  const permissions = {
    create: await hasPermission(user.role, 'pipeline.create'),
    edit_any: await hasPermission(user.role, 'pipeline.edit_any'),
    delete: await hasPermission(user.role, 'pipeline.delete'),
    assign: await hasPermission(user.role, 'pipeline.assign_to_anyone'),
    export: await hasPermission(user.role, 'pipeline.export'),
    call: await hasPermission(user.role, 'call.make'),
    log_call: await hasPermission(user.role, 'call.log'),
  };

  const title = type === 'management' ? 'Pipeline · Management' : 'Pipeline · Sales';

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar user={user} />
      <main className="flex-1 min-w-0">
        <TopBar user={user} title={title} />
        <div className="p-4 sm:p-6 max-w-7xl mx-auto">
          <PipelineList
            type={type}
            contacts={contacts || []}
            currentUser={user}
            permissions={permissions}
          />
        </div>
      </main>
    </div>
  );
}
