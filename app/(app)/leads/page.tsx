import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/supabase';
import LeadsClient from './LeadsClient';

export default async function LeadsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  if (!(await hasPermission(user.role, 'section.leads'))) redirect('/');

  // Initial page rendered server-side for an instant first paint.
  const { data: leads, count } = await supabaseAdmin
    .from('leads')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(0, 49);

  const [pCreate, pEdit, pDelete, pExport] = await Promise.all([
    hasPermission(user.role, 'leads.create'),
    hasPermission(user.role, 'leads.edit'),
    hasPermission(user.role, 'leads.delete'),
    hasPermission(user.role, 'leads.export'),
  ]);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <LeadsClient
        initialLeads={leads || []}
        initialTotal={count || 0}
        permissions={{ create: pCreate, edit: pEdit, delete: pDelete, export: pExport }}
      />
    </div>
  );
}
