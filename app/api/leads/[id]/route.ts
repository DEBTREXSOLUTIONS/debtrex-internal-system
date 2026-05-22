import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/supabase';

const VALID_TYPES = ['client', 'business'];
const VALID_STATUSES = ['new', 'contacted', 'converted', 'dead'];

// ─── PATCH — edit a lead ───
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await hasPermission(user.role, 'leads.edit')))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const body = await request.json();
  const update: any = {};

  if (typeof body.name === 'string') {
    if (!body.name.trim()) return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
    update.name = body.name.trim();
  }
  for (const f of ['phone', 'email', 'website'] as const) {
    if (body[f] !== undefined) update[f] = body[f]?.toString().trim() || null;
  }
  if (body.lead_type !== undefined) {
    if (!VALID_TYPES.includes(body.lead_type))
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    update.lead_type = body.lead_type;
  }
  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status))
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    update.status = body.status;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('leads')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// ─── DELETE — remove a lead ───
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await hasPermission(user.role, 'leads.delete')))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const { error } = await supabaseAdmin.from('leads').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
