import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await hasPermission(user.role, 'section.scripts'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const sectionId = url.searchParams.get('section_id');
  const kind = url.searchParams.get('kind');

  let q = supabaseAdmin
    .from('scripts')
    .select(`
      id, section_id, kind, title, body, sort_order, created_at, updated_at,
      tags:script_tag_links(tag:script_tags(id, name, color))
    `)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (sectionId) q = q.eq('section_id', sectionId);
  if (kind) q = q.eq('kind', kind);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Flatten the tags shape
  const out = (data ?? []).map((s: any) => ({
    ...s,
    tags: (s.tags ?? []).map((t: any) => t.tag).filter(Boolean),
  }));
  return NextResponse.json(out);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await hasPermission(user.role, 'scripts.manage'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { section_id, kind, title, body: scriptBody, sort_order, tag_ids } = body;

  if (!section_id || !kind || !title?.trim() || !scriptBody?.trim()) {
    return NextResponse.json({ error: 'section_id, kind, title and body are required' }, { status: 400 });
  }
  if (!['verbatim', 'objections', 'rebuttals'].includes(kind)) {
    return NextResponse.json({ error: 'Invalid kind' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('scripts')
    .insert({
      section_id,
      kind,
      title: title.trim(),
      body: scriptBody.trim(),
      sort_order: sort_order ?? 0,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (Array.isArray(tag_ids) && tag_ids.length > 0) {
    await supabaseAdmin
      .from('script_tag_links')
      .insert(tag_ids.map((tid: string) => ({ script_id: data.id, tag_id: tid })));
  }

  return NextResponse.json(data);
}
