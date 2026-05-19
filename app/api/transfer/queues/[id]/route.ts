import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/supabase';

const STRATEGIES = ['round_robin', 'all_ring', 'longest_idle'];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await hasPermission(user.role, 'transfer.manage')))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }

  const updates: Record<string, unknown> = {};
  if ('name' in body) updates.name = body.name?.trim();
  if ('strategy' in body) {
    if (!STRATEGIES.includes(body.strategy)) return NextResponse.json({ error: 'Invalid strategy' }, { status: 400 });
    updates.strategy = body.strategy;
  }
  if ('ring_timeout_seconds' in body) updates.ring_timeout_seconds = body.ring_timeout_seconds;
  if ('max_wait_seconds' in body) updates.max_wait_seconds = body.max_wait_seconds;
  if ('hold_music_url' in body) updates.hold_music_url = body.hold_music_url || null;
  if ('is_active' in body) updates.is_active = !!body.is_active;

  // members[]: full replace if provided
  if (Array.isArray(body.members)) {
    await supabaseAdmin.from('call_queue_members').delete().eq('queue_id', id);
    if (body.members.length > 0) {
      const rows = body.members.map((m: any, idx: number) => ({
        queue_id: id,
        profile_id: m.profile_id,
        priority: typeof m.priority === 'number' ? m.priority : idx,
      }));
      const { error: memErr } = await supabaseAdmin.from('call_queue_members').insert(rows);
      if (memErr) return NextResponse.json({ error: memErr.message }, { status: 500 });
    }
  }

  if (Object.keys(updates).length > 0) {
    const { error } = await supabaseAdmin
      .from('call_queues')
      .update(updates)
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await hasPermission(user.role, 'transfer.manage')))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const { error } = await supabaseAdmin.from('call_queues').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
