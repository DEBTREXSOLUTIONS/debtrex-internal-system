import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import LeadEntryForm from './LeadEntryForm';

export default async function NewLeadPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  if (!(await hasPermission(user.role, 'section.leads'))) redirect('/');
  if (!(await hasPermission(user.role, 'leads.create'))) redirect('/leads');

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <LeadEntryForm />
    </div>
  );
}
