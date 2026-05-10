import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/supabase';

async function checkAccess(userId: string, role: string, contactId: string, requireEdit: boolean = true) {
  const { data: contact } = await supabaseAdmin
    .from('pipeline_contacts')
    .select('created_by, assigned_to')
    .eq('id', contactId)
    .single();
  if (!contact) return { allowed: false, status: 404, error: 'Not found' };

  const owns = contact.created_by === userId || contact.assigned_to === userId;
  if (requireEdit) {
    const editAny = await hasPermission(role, 'pipeline.edit_any');
    if (!owns && !editAny) return { allowed: false, status: 403, error: 'Forbidden' };
  }
  return { allowed: true, contact };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const access = await checkAccess(user.id, user.role, id, true);
  if (!access.allowed) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = await request.json();
  const allowed: any = {};

  // Standard fields anyone with edit can change
  const fields = ['full_name', 'company_name', 'email', 'phone', 'alternative_phone',
    'address', 'city', 'state', 'zip', 'industry', 'company_size', 'deal_value',
    'estimated_debt', 'monthly_income', 'dti_ratio', 'source', 'notes', 'status',
    'next_followup_at', 'tags'];

  for (const f of fields) {
    if (body[f] !== undefined) allowed[f] = body[f] === '' ? null : body[f];
  }

  // Assignment requires extra permission
  if (body.assigned_to !== undefined) {
    if (await hasPermission(user.role, 'pipeline.assign_to_anyone')) {
      allowed.assigned_to = body.assigned_to || null;
    }
  }

  // Track status change side-effects
  if (body.status) {
    if (body.status === 'closed_won' || body.status === 'enrolled') {
      allowed.contract_signed_at = new Date().toISOString();
      allowed.closed_at = new Date().toISOString();
    } else if (body.status?.startsWith('closed_') || body.status === 'not_interested' || body.status === 'unreachable') {
      allowed.closed_at = new Date().toISOString();
    }
  }

  const { data, error } = await supabaseAdmin
    .from('pipeline_contacts')
    .update(allowed)
    .eq('id', id)
    .select(`
      *,
      assigned_to_profile:profiles!pipeline_contacts_assigned_to_fkey(id, full_name, phone),
      created_by_profile:profiles!pipeline_contacts_created_by_fkey(full_name)
    `)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await hasPermission(user.role, 'pipeline.delete')))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const { error } = await supabaseAdmin.from('pipeline_contacts').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin.from('audit_log').insert({
    user_id: user.id,
    action: 'pipeline_contact_deleted',
    resource_type: 'pipeline_contact',
    resource_id: id,
  });

  return NextResponse.json({ success: true });
}
