import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

const VALID_STATUSES = ['online', 'otl', 'meeting', 'break', 'offline'];

export async function PATCH(request: Request) {
  return handleStatusUpdate(request);
}

// sendBeacon uses POST with text/plain — also accept it
export async function POST(request: Request) {
  return handleStatusUpdate(request);
}

async function handleStatusUpdate(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let status: string | undefined, status_message: string | undefined;
  try {
    const text = await request.text();
    const parsed = JSON.parse(text);
    status = parsed.status;
    status_message = parsed.status_message;
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  if (status && !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  // If the caller is locked (on a live call), refuse manual changes. Only the
  // CallWidget's server-side lock-release path (POST /api/me/status/lock) can
  // unlock; admins use /api/admin/agent-status.
  if (status !== undefined) {
    const { data: cur } = await supabaseAdmin
      .from('profiles')
      .select('status_locked')
      .eq('id', user.id)
      .single();
    if (cur?.status_locked) {
      return NextResponse.json(
        { error: 'Status locked — you are on a call. Contact an admin to override.' },
        { status: 423 },
      );
    }
  }

  const updates: any = {
    status_updated_at: new Date().toISOString(),
  };
  if (status !== undefined) updates.status = status;
  if (status_message !== undefined) updates.status_message = status_message || null;

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select('status, status_message, status_updated_at, status_locked')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// GET — return current user status + list of all online team members
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: me } = await supabaseAdmin
    .from('profiles')
    .select('status, status_message, status_updated_at, status_locked')
    .eq('id', user.id)
    .single();

  const { data: team } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, role, status, status_message, status_updated_at, status_locked, extension')
    .eq('is_active', true)
    .order('status', { ascending: true })
    .order('full_name');

  return NextResponse.json({ me, team: team || [] });
}
