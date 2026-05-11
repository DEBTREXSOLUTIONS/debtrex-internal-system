import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { isLeadership } from '@/lib/roles';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const allowed = await hasPermission(user.role, 'section.twilio_numbers') || isLeadership(user.role);
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const body = await request.json();
    const { twilio_phone_number, routing_mode, primary_agent_id, ring_timeout_seconds, voicemail_message } = body;

    if (!twilio_phone_number) {
      return NextResponse.json({ error: 'twilio_phone_number required' }, { status: 400 });
    }
    if (!['agent', 'available', 'voicemail'].includes(routing_mode)) {
      return NextResponse.json({ error: 'Invalid routing_mode' }, { status: 400 });
    }
    if (routing_mode === 'agent' && !primary_agent_id) {
      return NextResponse.json({ error: 'primary_agent_id required for agent mode' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('phone_number_routing')
      .upsert({
        twilio_phone_number,
        routing_mode,
        primary_agent_id: primary_agent_id || null,
        ring_timeout_seconds: ring_timeout_seconds || 20,
        voicemail_message: voicemail_message || 'Thank you for calling DEBTREX Solutions. Please leave a message and we will return your call.',
      }, { onConflict: 'twilio_phone_number' })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
