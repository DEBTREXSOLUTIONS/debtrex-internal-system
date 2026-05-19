import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/supabase';

// Per-agent OB / IN / total-duration rollup. Window controlled by `range`:
//   today | 7d | 30d | all
//
// Returns rows for every active profile (even ones with zero calls) so the
// tracker table can show all agents.

const RANGES: Record<string, number | null> = {
  today: 0,           // since start of today (local server day)
  '7d': 7,
  '30d': 30,
  all: null,
};

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await hasPermission(user.role, 'calls.view_stats')))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const url = new URL(request.url);
  const range = url.searchParams.get('range') || '7d';
  const days = RANGES[range];

  let since: Date | null = null;
  if (range === 'today') {
    since = new Date();
    since.setHours(0, 0, 0, 0);
  } else if (typeof days === 'number') {
    since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  }

  // Pull only what we need; rollups are computed in JS — call volume is
  // small enough that this is fine and avoids a Postgres function.
  let query = supabaseAdmin
    .from('call_logs')
    .select('user_id, direction, duration_seconds, called_at')
    .order('called_at', { ascending: false });

  if (since) query = query.gte('called_at', since.toISOString());

  const { data: calls, error } = await query.limit(10000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: agents } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, role, twilio_phone_number, extension, status, status_locked')
    .eq('is_active', true)
    .order('full_name');

  // Build a rollup map keyed by user_id
  type Row = {
    user_id: string | null;
    full_name: string;
    role: string;
    phone: string | null;
    extension: string | null;
    status: string | null;
    status_locked: boolean;
    ob_count: number;
    in_count: number;
    total_seconds: number;
  };
  const byId = new Map<string, Row>();

  for (const a of agents || []) {
    byId.set(a.id, {
      user_id: a.id,
      full_name: a.full_name,
      role: a.role,
      phone: a.twilio_phone_number || null,
      extension: a.extension || null,
      status: a.status,
      status_locked: !!a.status_locked,
      ob_count: 0,
      in_count: 0,
      total_seconds: 0,
    });
  }

  for (const c of calls || []) {
    if (!c.user_id) continue; // unassigned inbound
    const row = byId.get(c.user_id);
    if (!row) continue;
    if (c.direction === 'outbound') row.ob_count += 1;
    else if (c.direction === 'inbound') row.in_count += 1;
    row.total_seconds += c.duration_seconds || 0;
  }

  // Sort: most active first
  const rows = Array.from(byId.values()).sort((a, b) => {
    const ax = a.ob_count + a.in_count;
    const bx = b.ob_count + b.in_count;
    if (bx !== ax) return bx - ax;
    return a.full_name.localeCompare(b.full_name);
  });

  return NextResponse.json({ range, rows });
}
