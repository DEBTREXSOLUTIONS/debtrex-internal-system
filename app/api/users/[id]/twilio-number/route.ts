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
  const { twilio_phone_number, twilio_phone_label } = await request.json();

  // Normalize phone if set
  let normalizedNumber: string | null = null;
  if (twilio_phone_number) {
    normalizedNumber = normalizePhone(twilio_phone_number);
    if (!normalizedNumber) {
      return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 });
    }

    // Check it's not already assigned to a different user
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

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      twilio_phone_number: normalizedNumber,
      twilio_phone_label: twilio_phone_label || null,
      twilio_phone_assigned_at: normalizedNumber ? new Date().toISOString() : null,
      twilio_phone_assigned_by: normalizedNumber ? user.id : null,
    })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin.from('audit_log').insert({
    user_id: user.id,
    action: normalizedNumber ? 'twilio_number_assigned' : 'twilio_number_unassigned',
    resource_type: 'profile',
    resource_id: id,
    details: { twilio_phone_number: normalizedNumber, label: twilio_phone_label },
  });

  return NextResponse.json({ success: true });
}
