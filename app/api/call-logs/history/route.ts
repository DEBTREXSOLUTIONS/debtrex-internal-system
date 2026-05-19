import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/supabase';

// Recent call history for the side-panel widget. Returns who called, who they
// called, direction, outcome, duration, and when. Users without `call.view_all`
// only see their own calls.
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10) || 50, 200);

  const canViewAll = await hasPermission(user.role, 'call.view_all');

  let query = supabaseAdmin
    .from('call_logs')
    .select(`
      id, direction, outcome, duration_seconds, called_at,
      from_number, to_number, twilio_call_sid,
      user:profiles(id, full_name),
      contact:pipeline_contacts(id, full_name, phone, pipeline_type)
    `)
    .order('called_at', { ascending: false })
    .limit(limit);

  if (!canViewAll) query = query.eq('user_id', user.id);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ calls: data || [], canViewAll });
}
