import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/supabase';

// Internal contacts directory: agents + external numbers an agent can
// transfer customers to.
//
//   GET   — anyone with call.transfer (so they can pick a target mid-call)
//           OR transfer.manage (so they can edit)
//   POST  — transfer.manage only

async function canRead(role: string): Promise<boolean> {
  return (await hasPermission(role, 'call.transfer')) || (await hasPermission(role, 'transfer.manage'));
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canRead(user.role))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from('internal_contacts')
    .select(`
      id, name, phone, extension, department, notes, profile_id,
      profile:profiles(id, full_name, status, status_locked, extension)
    `)
    .order('name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contacts: data || [] });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await hasPermission(user.role, 'transfer.manage')))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }

  if (!body?.name || typeof body.name !== 'string') {
    return NextResponse.json({ error: 'name required' }, { status: 400 });
  }
  if (!body.phone && !body.extension && !body.profile_id) {
    return NextResponse.json({ error: 'At least one of phone, extension, or profile_id required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('internal_contacts')
    .insert({
      name: body.name.trim(),
      phone: body.phone || null,
      extension: body.extension || null,
      profile_id: body.profile_id || null,
      department: body.department || null,
      notes: body.notes || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
