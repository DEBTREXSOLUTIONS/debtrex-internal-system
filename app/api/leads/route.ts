import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/supabase';

const PAGE_SIZE = 50;
const VALID_TYPES = ['client', 'business'];
const VALID_STATUSES = ['new', 'contacted', 'converted', 'dead'];

// Strip characters that would break Supabase's .or() filter grammar.
function sanitizeSearch(raw: string): string {
  return raw.replace(/[,()%\\]/g, ' ').trim().slice(0, 100);
}

function cleanLead(input: any) {
  const name = typeof input?.name === 'string' ? input.name.trim() : '';
  if (!name) return null;
  const type = VALID_TYPES.includes(input?.lead_type) ? input.lead_type : 'client';
  const status = VALID_STATUSES.includes(input?.status) ? input.status : 'new';
  return {
    name,
    phone: input?.phone?.toString().trim() || null,
    email: input?.email?.toString().trim() || null,
    website: input?.website?.toString().trim() || null,
    lead_type: type,
    status,
  };
}

// ─── GET — paginated, searchable list ───
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await hasPermission(user.role, 'section.leads')))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const type = url.searchParams.get('type') || '';
  const status = url.searchParams.get('status') || '';
  const search = sanitizeSearch(url.searchParams.get('search') || '');

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabaseAdmin
    .from('leads')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (VALID_TYPES.includes(type)) query = query.eq('lead_type', type);
  if (VALID_STATUSES.includes(status)) query = query.eq('status', status);
  if (search) {
    query = query.or(
      `name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%,website.ilike.%${search}%`
    );
  }

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    leads: data || [],
    total: count || 0,
    page,
    pageSize: PAGE_SIZE,
  });
}

// ─── POST — create one lead, or many at once ───
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await hasPermission(user.role, 'leads.create')))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const body = await request.json();
    const rawList = Array.isArray(body?.leads) ? body.leads : [body];

    const rows = rawList
      .map(cleanLead)
      .filter(Boolean)
      .map((r: any) => ({ ...r, created_by: user.id }));

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.from('leads').insert(rows).select();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Single insert returns the row directly; bulk returns count + rows.
    if (rows.length === 1) return NextResponse.json(data?.[0] ?? null);
    return NextResponse.json({ inserted: data?.length || 0, leads: data || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
