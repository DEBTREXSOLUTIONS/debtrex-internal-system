import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { note } = await request.json();

  if (!note?.trim()) return NextResponse.json({ error: 'Note required' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('task_notes')
    .insert({ task_id: id, user_id: user.id, note })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
