import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/supabase';
import ScriptsView from './ScriptsView';

export default async function ScriptsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  if (!(await hasPermission(user.role, 'section.scripts'))) redirect('/');

  const canManage = await hasPermission(user.role, 'scripts.manage');
  const canManageTags = await hasPermission(user.role, 'scripts.manage_tags');

  const [sectionsRes, scriptsRes, tagsRes] = await Promise.all([
    supabaseAdmin
      .from('script_sections')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true }),
    supabaseAdmin
      .from('scripts')
      .select(`
        id, section_id, kind, title, body, sort_order, created_at, updated_at,
        tags:script_tag_links(tag:script_tags(id, name, color))
      `)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('script_tags')
      .select('*')
      .order('name', { ascending: true }),
  ]);

  const scripts = (scriptsRes.data ?? []).map((s: any) => ({
    ...s,
    tags: (s.tags ?? []).map((t: any) => t.tag).filter(Boolean),
  }));

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <ScriptsView
        sections={sectionsRes.data ?? []}
        scripts={scripts}
        tags={tagsRes.data ?? []}
        canManage={canManage}
        canManageTags={canManageTags}
      />
    </div>
  );
}
