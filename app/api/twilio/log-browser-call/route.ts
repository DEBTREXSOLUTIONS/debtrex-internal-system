import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// POST: create a call_logs row immediately after a browser call is placed.
// PATCH: update the row on disconnect with duration/outcome (so we don't
// depend on Twilio webhooks reaching localhost during development).
//
// Permission isn't re-checked here — /api/twilio/voice-token already gates
// `call.make` before a token is issued, so any reach-able caller of this
// endpoint already passed that check.

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { contact_id, call_sid, to_number } = await request.json();

    const { data, error } = await supabaseAdmin
      .from('call_logs')
      .insert({
        contact_id: contact_id || null,
        user_id: user.id,
        direction: 'outbound',
        // Placeholder. PATCH (or status webhook) overwrites later.
        outcome: 'no_answer',
        twilio_call_sid: call_sid || null,
        to_number: to_number || null,
        notes: 'Browser-based call (Voice SDK)',
      })
      .select('id')
      .single();

    if (error) {
      console.error('log-browser-call insert failed:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (contact_id) {
      await supabaseAdmin
        .from('pipeline_contacts')
        .update({ last_contacted_at: new Date().toISOString() })
        .eq('id', contact_id);
    }

    return NextResponse.json({ id: data?.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id, duration_seconds, outcome, call_sid } = await request.json();
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const updates: Record<string, unknown> = {};
    if (typeof duration_seconds === 'number') updates.duration_seconds = duration_seconds;
    if (outcome) updates.outcome = outcome;
    if (call_sid) updates.twilio_call_sid = call_sid;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ ok: true });
    }

    const { error } = await supabaseAdmin
      .from('call_logs')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
