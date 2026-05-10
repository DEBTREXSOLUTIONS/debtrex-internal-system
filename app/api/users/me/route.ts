import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const updates: any = {};

  // Users can only edit their own basic info, NOT role or is_active
  if (body.full_name) updates.full_name = body.full_name;
  if (body.phone !== undefined) updates.phone = body.phone;
  if (body.notification_preferences) updates.notification_preferences = body.notification_preferences;

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
