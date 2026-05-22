import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/supabase';

const VALID_TYPES = ['client', 'business'];
const VALID_STATUSES = ['new', 'contacted', 'converted', 'dead'];

function sanitizeSearch(raw: string): string {
  return raw.replace(/[,()%\\]/g, ' ').trim().slice(0, 100);
}

function csvCell(value: any): string {
  const s = value == null ? '' : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await hasPermission(user.role, 'leads.export')))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const url = new URL(request.url);
  const type = url.searchParams.get('type') || '';
  const status = url.searchParams.get('status') || '';
  const search = sanitizeSearch(url.searchParams.get('search') || '');

  // Pull every matching row in batches of 1000 (Supabase's per-request cap).
  const rows: any[] = [];
  const BATCH = 1000;
  for (let from = 0; ; from += BATCH) {
    let query = supabaseAdmin
      .from('leads')
      .select('name, phone, email, website, state, address, lead_type, status, created_at')
      .order('created_at', { ascending: false })
      .range(from, from + BATCH - 1);

    if (VALID_TYPES.includes(type)) query = query.eq('lead_type', type);
    if (VALID_STATUSES.includes(status)) query = query.eq('status', status);
    if (search) {
      query = query.or(
        `name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%,website.ilike.%${search}%,state.ilike.%${search}%,address.ilike.%${search}%`
      );
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < BATCH) break;
  }

  const header = ['Name', 'Phone', 'Email', 'Website', 'State', 'Address', 'Type', 'Status', 'Created'];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push(
      [r.name, r.phone, r.email, r.website, r.state, r.address, r.lead_type, r.status, r.created_at]
        .map(csvCell)
        .join(',')
    );
  }
  const csv = lines.join('\r\n');
  const date = new Date().toISOString().split('T')[0];

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="leads-${date}.csv"`,
    },
  });
}
