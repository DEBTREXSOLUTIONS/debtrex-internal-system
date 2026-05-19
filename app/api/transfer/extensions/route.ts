import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/supabase';

// List of all active agents with their extensions, and a PATCH to set them.
//
//   GET    — read access for anyone with call.transfer or transfer.manage
//   PATCH  — transfer.manage only. Body: { agent_id, extension }

async function canRead(role: string): Promise<boolean> {
  return (await hasPermission(role, 'call.transfer')) || (await hasPermission(role, 'transfer.manage'));
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canRead(user.role))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, role, extension, status, status_locked, twilio_phone_number')
    .eq('is_active', true)
    .order('extension', { ascending: true, nullsFirst: false })
    .order('full_name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ agents: data || [] });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await hasPermission(user.role, 'transfer.manage')))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }

  const agent_id = body.agent_id;
  let extension = body.extension;
  if (typeof agent_id !== 'string' || !agent_id) {
    return NextResponse.json({ error: 'agent_id required' }, { status: 400 });
  }

  if (extension === '' || extension === null || extension === undefined) {
    extension = null;
  } else if (typeof extension === 'string') {
    extension = extension.trim();
    if (!/^[0-9*#]{1,8}$/.test(extension)) {
      return NextResponse.json({ error: 'Extension must be 1-8 digits (or * #)' }, { status: 400 });
    }
  } else {
    return NextResponse.json({ error: 'extension must be string or null' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({ extension })
    .eq('id', agent_id)
    .select('id, full_name, extension')
    .single();

  if (error) {
    // Unique violation surfaces as 23505
    if ((error as any).code === '23505') {
      return NextResponse.json({ error: 'Extension already in use' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
