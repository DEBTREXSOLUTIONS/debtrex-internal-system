import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/supabase';

const STRATEGIES = ['round_robin', 'all_ring', 'longest_idle'];

async function canRead(role: string): Promise<boolean> {
  return (await hasPermission(role, 'call.transfer')) || (await hasPermission(role, 'transfer.manage'));
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canRead(user.role))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data: queues, error } = await supabaseAdmin
    .from('call_queues')
    .select(`
      id, name, strategy, ring_timeout_seconds, max_wait_seconds, is_active, hold_music_url,
      members:call_queue_members(profile_id, priority, profile:profiles(id, full_name, status, extension))
    `)
    .order('name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ queues: queues || [] });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await hasPermission(user.role, 'transfer.manage')))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }

  if (!body?.name) return NextResponse.json({ error: 'name required' }, { status: 400 });
  const strategy = body.strategy || 'all_ring';
  if (!STRATEGIES.includes(strategy)) {
    return NextResponse.json({ error: 'Invalid strategy' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('call_queues')
    .insert({
      name: body.name.trim(),
      strategy,
      ring_timeout_seconds: body.ring_timeout_seconds ?? 20,
      max_wait_seconds: body.max_wait_seconds ?? 300,
      hold_music_url: body.hold_music_url || null,
      is_active: body.is_active ?? true,
    })
    .select()
    .single();

  if (error) {
    if ((error as any).code === '23505') {
      return NextResponse.json({ error: 'A queue with that name already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
