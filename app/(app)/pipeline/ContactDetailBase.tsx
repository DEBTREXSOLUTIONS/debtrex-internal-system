import { redirect, notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/supabase';
import { isTwilioConfigured } from '@/lib/twilio';
import ContactDetail from './ContactDetail';

interface Props {
  type: 'management' | 'sales';
  id: string;
}

export default async function ContactDetailBase({ type, id }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const sectionKey = type === 'management' ? 'section.pipeline_management' : 'section.pipeline_sales';
  if (!(await hasPermission(user.role, sectionKey))) redirect('/');

  const { data: contact } = await supabaseAdmin
    .from('pipeline_contacts')
    .select(`
      *,
      assigned_to_profile:profiles!pipeline_contacts_assigned_to_fkey(id, full_name, phone),
      created_by_profile:profiles!pipeline_contacts_created_by_fkey(full_name)
    `)
    .eq('id', id)
    .eq('pipeline_type', type)
    .single();

  if (!contact) notFound();

  const canViewAll = await hasPermission(user.role, 'pipeline.view_all');
  // If user can't view all, they must own or be assigned this contact
  if (!canViewAll && contact.created_by !== user.id && contact.assigned_to !== user.id) {
    redirect(`/pipeline/${type}`);
  }

  // Fetch call logs and notes
  const { data: callLogs } = await supabaseAdmin
    .from('call_logs')
    .select('*, user:profiles(full_name)')
    .eq('contact_id', id)
    .order('called_at', { ascending: false });

  const { data: notes } = await supabaseAdmin
    .from('contact_notes')
    .select('*, user:profiles(full_name)')
    .eq('contact_id', id)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false });

  // Active users for assignment dropdown
  const { data: users } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, role')
    .eq('is_active', true)
    .order('full_name');

  // Collaborators on this contact
  const { data: collaborators } = await supabaseAdmin
    .from('pipeline_collaborators')
    .select('id, collaboration_role, user:profiles(id, full_name, email, role)')
    .eq('contact_id', id);

  const [pEditAny, pDelete, pAssign, pCall, pLogCall] = await Promise.all([
    hasPermission(user.role, 'pipeline.edit_any'),
    hasPermission(user.role, 'pipeline.delete'),
    hasPermission(user.role, 'pipeline.assign_to_anyone'),
    hasPermission(user.role, 'call.make'),
    hasPermission(user.role, 'call.log'),
  ]);

  const permissions = {
    edit_any: pEditAny, delete: pDelete, assign: pAssign,
    call: pCall, log_call: pLogCall,
  };

  // Can this user edit?
  // Either: has edit_any permission OR is owner/assigned OR is a collaborator
  const isCollaborator = (collaborators || []).some((c: any) => c.user?.id === user.id);
  const canEdit = permissions.edit_any
    || contact.created_by === user.id
    || contact.assigned_to === user.id
    || isCollaborator;

  return (
            <div className="p-4 sm:p-6 max-w-6xl mx-auto">
          <ContactDetail
            contact={contact}
            type={type}
            callLogs={callLogs || []}
            notes={notes || []}
            users={users || []}
            collaborators={collaborators || []}
            currentUser={user}
            permissions={{ ...permissions, edit: canEdit }}
            twilioConfigured={isTwilioConfigured()}
          />
        </div>
  );
}
