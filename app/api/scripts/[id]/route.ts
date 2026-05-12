import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/supabase';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await hasPermission(user.role, 'scripts.manage'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const updates: any = {};
  if (body.title !== undefined) updates.title = body.title.trim();
  if (body.body !== undefined) updates.body = body.body.trim();
  if (body.kind !== undefined) {
    if (!['verbatim', 'objections', 'rebuttals'].includes(body.kind)) {
      return NextResponse.json({ error: 'Invalid kind' }, { status: 400 });
    }
    updates.kind = body.kind;
  }
  if (body.section_id !== undefined) updates.section_id = body.section_id;
  if (body.sort_order !== undefined) updates.sort_order = body.sort_order;

  if (Object.keys(updates).length > 0) {
    const { error } = await supabaseAdmin.from('scripts').update(updates).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Replace tag links if tag_ids was provided
  if (Array.isArray(body.tag_ids)) {
    await supabaseAdmin.from('script_tag_links').delete().eq('script_id', id);
    if (body.tag_ids.length > 0) {
      await supabaseAdmin
        .from('script_tag_links')
        .insert(body.tag_ids.map((tid: string) => ({ script_id: id, tag_id: tid })));
    }
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await hasPermission(user.role, 'scripts.manage'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const { error } = await supabaseAdmin.from('scripts').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
