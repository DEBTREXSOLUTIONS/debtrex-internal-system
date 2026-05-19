import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/supabase';

// Browser calls this AFTER placing a call via the Voice SDK.
// Creates a placeholder call_logs entry that webhooks will update later.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await hasPermission(user.role, 'call.make')))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const { contact_id, call_sid, to_number } = await request.json();

    const { data } = await supabaseAdmin
      .from('call_logs')
      .insert({
        contact_id: contact_id || null,
        user_id: user.id,
        direction: 'outbound',
        // Placeholder — status webhook overwrites with connected/no_answer/etc.
        outcome: 'no_answer',
        twilio_call_sid: call_sid || null,
        to_number: to_number || null,
        notes: 'Browser-based call (Voice SDK)',
      })
      .select()
      .single();

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
