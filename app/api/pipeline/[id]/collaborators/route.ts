import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/supabase';

// Add collaborator(s) to a pipeline contact
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await hasPermission(user.role, 'pipeline.assign_to_anyone')))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id: contact_id } = await params;
  const { user_ids, collaboration_role } = await request.json();

  if (!Array.isArray(user_ids) || user_ids.length === 0) {
    return NextResponse.json({ error: 'user_ids required' }, { status: 400 });
  }

  const rows = user_ids.map((uid: string) => ({
    contact_id,
    user_id: uid,
    collaboration_role: collaboration_role || 'collaborator',
    added_by: user.id,
  }));

  const { data, error } = await supabaseAdmin
    .from('pipeline_collaborators')
    .upsert(rows, { onConflict: 'contact_id,user_id', ignoreDuplicates: true })
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ added: (data || []).length });
}

// List collaborators on a contact
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: contact_id } = await params;
  const { data } = await supabaseAdmin
    .from('pipeline_collaborators')
    .select('id, collaboration_role, created_at, user:profiles(id, full_name, email, role)')
    .eq('contact_id', contact_id)
    .order('created_at');

  return NextResponse.json(data || []);
}
