import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// Called by the CallWidget when a call accepts (lock=true, status=otl) and
// when it ends (lock=false, restore prior status). Not callable to set
// arbitrary statuses — only the OTL transition.

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let lock: unknown, restore_to: unknown;
  try {
    const body = await request.json();
    lock = body.lock;
    restore_to = body.restore_to;
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  if (typeof lock !== 'boolean') {
    return NextResponse.json({ error: 'lock must be boolean' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {
    status_updated_at: new Date().toISOString(),
    status_locked: lock,
  };

  if (lock) {
    updates.status = 'otl';
  } else {
    // Restore to a sane status. Caller hints the previous one; we sanity-
    // check and fall back to 'online'.
    const allowed = ['online', 'meeting', 'break', 'offline'];
    updates.status = (typeof restore_to === 'string' && allowed.includes(restore_to)) ? restore_to : 'online';
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select('status, status_locked')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
