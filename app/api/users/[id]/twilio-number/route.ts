import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/supabase';
import { normalizePhone } from '@/lib/twilio';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await hasPermission(user.role, 'section.twilio_numbers')))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const body = await request.json();
  const { twilio_phone_number, twilio_phone_label, outbound_use_default } = body;

  // Only touch fields that were explicitly present in the request — that
  // way a flag-only toggle doesn't accidentally clear the assigned number.
  const updates: Record<string, unknown> = {};

  if ('twilio_phone_number' in body) {
    let normalizedNumber: string | null = null;
    if (twilio_phone_number) {
      normalizedNumber = normalizePhone(twilio_phone_number);
      if (!normalizedNumber) {
        return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 });
      }
      const { data: existing } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name')
        .eq('twilio_phone_number', normalizedNumber)
        .neq('id', id)
        .single();
      if (existing) {
        return NextResponse.json(
          { error: `${normalizedNumber} is already assigned to ${existing.full_name}. Unassign it first.` },
          { status: 409 }
        );
      }
    }
    updates.twilio_phone_number = normalizedNumber;
    updates.twilio_phone_assigned_at = normalizedNumber ? new Date().toISOString() : null;
    updates.twilio_phone_assigned_by = normalizedNumber ? user.id : null;
  }

  if ('twilio_phone_label' in body) {
    updates.twilio_phone_label = twilio_phone_label || null;
  }

  if (typeof outbound_use_default === 'boolean') {
    updates.outbound_use_default = outbound_use_default;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .update(updates)
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin.from('audit_log').insert({
    user_id: user.id,
    action: 'twilio_number_assigned' in updates
      ? (updates.twilio_phone_number ? 'twilio_number_assigned' : 'twilio_number_unassigned')
      : 'twilio_outbound_flag_updated',
    resource_type: 'profile',
    resource_id: id,
    details: updates,
  });

  return NextResponse.json({ success: true });
}
