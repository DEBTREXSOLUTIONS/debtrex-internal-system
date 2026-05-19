import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/supabase';

const VALID_STATUSES = ['online', 'otl', 'meeting', 'break', 'offline'];

// Admin-only override: change any agent's status and optionally clear the
// status_locked flag (e.g. when an agent's browser crashed mid-call and they
// are stuck on OTL).
export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await hasPermission(user.role, 'team.manage_status')))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let agent_id: unknown, status: unknown, locked: unknown;
  try {
    const body = await request.json();
    agent_id = body.agent_id;
    status = body.status;
    locked = body.locked;
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  if (typeof agent_id !== 'string' || !agent_id) {
    return NextResponse.json({ error: 'agent_id required' }, { status: 400 });
  }
  if (status !== undefined && (typeof status !== 'string' || !VALID_STATUSES.includes(status))) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }
  if (locked !== undefined && typeof locked !== 'boolean') {
    return NextResponse.json({ error: 'locked must be boolean' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {
    status_updated_at: new Date().toISOString(),
  };
  if (status !== undefined) updates.status = status;
  if (locked !== undefined) updates.status_locked = locked;

  if (Object.keys(updates).length === 1) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update(updates)
    .eq('id', agent_id)
    .select('id, full_name, status, status_locked')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
