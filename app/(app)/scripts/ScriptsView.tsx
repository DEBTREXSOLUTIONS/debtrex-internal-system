"use client";
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X, Tag, Trash2, Edit3, FolderPlus, ChevronDown, ChevronRight } from 'lucide-react';

type Section = { id: string; name: string; description: string | null; sort_order: number };
type ScriptTag = { id: string; name: string; color: string };
type Script = {
  id: string;
  section_id: string;
  kind: 'verbatim' | 'objections' | 'rebuttals';
  title: string;
  body: string;
  sort_order: number;
  tags: ScriptTag[];
};

const KINDS: { value: Script['kind']; label: string; color: string }[] = [
  { value: 'verbatim',   label: 'Verbatim',   color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'objections', label: 'Objections', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  { value: 'rebuttals',  label: 'Rebuttals',  color: 'bg-green-50 text-green-700 border-green-200' },
];

const TAG_COLORS = ['gray', 'red', 'blue', 'green', 'yellow'];
const TAG_COLOR_CLASSES: Record<string, string> = {
  gray:   'bg-gray-100 text-gray-700 border-gray-200',
  red:    'bg-brand-red-pale text-brand-red border-brand-red/20',
  blue:   'bg-blue-50 text-blue-700 border-blue-200',
  green:  'bg-green-50 text-green-700 border-green-200',
  yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
};

export default function ScriptsView({
  sections: initialSections,
  scripts: initialScripts,
  tags: initialTags,
  canManage,
  canManageTags,
}: {
  sections: Section[];
  scripts: Script[];
  tags: ScriptTag[];
  canManage: boolean;
  canManageTags: boolean;
}) {
  const router = useRouter();
  const [activeSectionId, setActiveSectionId] = useState<string | null>(initialSections[0]?.id ?? null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [showSectionModal, setShowSectionModal] = useState(false);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [editingScript, setEditingScript] = useState<Script | null>(null);
  const [showTagModal, setShowTagModal] = useState(false);
  const [editingTag, setEditingTag] = useState<ScriptTag | null>(null);

  const sections = initialSections;
  const scripts = initialScripts;
  const tags = initialTags;

  const activeSection = sections.find(s => s.id === activeSectionId) ?? null;

  const filteredScripts = useMemo(() => {
    let list = scripts;
    if (activeSectionId) list = list.filter(s => s.section_id === activeSectionId);
    if (tagFilter) list = list.filter(s => s.tags.some(t => t.id === tagFilter));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.title.toLowerCase().includes(q) ||
        s.body.toLowerCase().includes(q)
      );
    }
    return list;
  }, [scripts, activeSectionId, tagFilter, search]);

  const byKind = useMemo(() => ({
    verbatim:   filteredScripts.filter(s => s.kind === 'verbatim'),
    objections: filteredScripts.filter(s => s.kind === 'objections'),
    rebuttals:  filteredScripts.filter(s => s.kind === 'rebuttals'),
  }), [filteredScripts]);

  async function deleteSection(s: Section) {
    if (!confirm(`Delete section "${s.name}" and all its scripts? This cannot be undone.`)) return;
    const res = await fetch(`/api/scripts/sections/${s.id}`, { method: 'DELETE' });
    if (!res.ok) { alert('Failed to delete'); return; }
    if (activeSectionId === s.id) setActiveSectionId(null);
    router.refresh();
  }

  async function deleteScript(id: string) {
    if (!confirm('Delete this script?')) return;
    const res = await fetch(`/api/scripts/${id}`, { method: 'DELETE' });
    if (!res.ok) { alert('Failed to delete'); return; }
    router.refresh();
  }

  async function deleteTag(t: ScriptTag) {
    if (!confirm(`Delete tag "${t.name}"? It will be removed from all scripts.`)) return;
    const res = await fetch(`/api/scripts/tags/${t.id}`, { method: 'DELETE' });
    if (!res.ok) { alert('Failed to delete'); return; }
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="font-condensed text-3xl font-black uppercase">Scripts</h1>
          <p className="text-sm text-gray-500">Sections, verbatim scripts, objections, and rebuttals.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canManageTags && (
            <button onClick={() => { setEditingTag(null); setShowTagModal(true); }} className="btn-outline">
              <Tag size={14} /> New Tag
            </button>
          )}
          {canManage && (
            <>
              <button onClick={() => { setEditingSection(null); setShowSectionModal(true); }} className="btn-outline">
                <FolderPlus size={14} /> New Section
              </button>
              <button
                onClick={() => { setEditingScript(null); setShowScriptModal(true); }}
                disabled={sections.length === 0}
                className="btn-primary disabled:opacity-50"
              >
                <Plus size={14} /> New Script
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar with sections + tags */}
        <aside className="lg:col-span-1 space-y-4">
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-condensed text-sm font-black uppercase tracking-wider text-gray-600">Sections</h2>
            </div>
            {sections.length === 0 ? (
              <p className="text-xs text-gray-400">No sections yet. {canManage && 'Create your first section.'}</p>
            ) : (
              <ul className="space-y-1">
                {sections.map(s => {
                  const count = scripts.filter(sc => sc.section_id === s.id).length;
                  const active = activeSectionId === s.id;
                  return (
                    <li key={s.id} className={`group flex items-center gap-1 rounded-md ${active ? 'bg-brand-red-pale' : 'hover:bg-gray-50'}`}>
                      <button
                        onClick={() => setActiveSectionId(s.id)}
                        className={`flex-1 text-left px-3 py-2 text-sm font-semibold flex items-center justify-between ${active ? 'text-brand-red' : 'text-gray-700'}`}
                      >
                        <span className="truncate">{s.name}</span>
                        <span className="text-xs text-gray-400">{count}</span>
                      </button>
                      {canManage && (
                        <div className="opacity-0 group-hover:opacity-100 flex pr-2 gap-1">
                          <button onClick={() => { setEditingSection(s); setShowSectionModal(true); }} className="text-gray-400 hover:text-brand-red"><Edit3 size={12} /></button>
                          <button onClick={() => deleteSection(s)} className="text-gray-400 hover:text-red-700"><Trash2 size={12} /></button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-condensed text-sm font-black uppercase tracking-wider text-gray-600">Tags</h2>
              {tagFilter && (
                <button onClick={() => setTagFilter(null)} className="text-xs text-brand-red hover:underline">clear</button>
              )}
            </div>
            {tags.length === 0 ? (
              <p className="text-xs text-gray-400">No tags yet.</p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {tags.map(t => {
                  const active = tagFilter === t.id;
                  return (
                    <li key={t.id} className="group inline-flex items-center">
                      <button
                        onClick={() => setTagFilter(active ? null : t.id)}
                        className={`text-xs px-2 py-1 rounded-md border ${TAG_COLOR_CLASSES[t.color] || TAG_COLOR_CLASSES.gray} ${active ? 'ring-2 ring-brand-red' : ''}`}
                      >
                        {t.name}
                      </button>
                      {canManageTags && (
                        <div className="opacity-0 group-hover:opacity-100 flex ml-1 gap-1">
                          <button onClick={() => { setEditingTag(t); setShowTagModal(true); }} className="text-gray-400 hover:text-brand-red"><Edit3 size={10} /></button>
                          <button onClick={() => deleteTag(t)} className="text-gray-400 hover:text-red-700"><Trash2 size={10} /></button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* Main content */}
        <section className="lg:col-span-3 space-y-6">
          {sections.length === 0 ? (
            <div className="card p-12 text-center">
              <div className="font-condensed text-2xl font-black uppercase mb-2">No Sections Yet</div>
              <p className="text-gray-500 mb-4">Sections organize your scripts (e.g. Sales, Openers).</p>
              {canManage && (
                <button onClick={() => { setEditingSection(null); setShowSectionModal(true); }} className="btn-primary">
                  <FolderPlus size={14} /> Create First Section
                </button>
              )}
            </div>
          ) : !activeSection ? (
            <div className="card p-12 text-center text-gray-500">Pick a section to view its scripts.</div>
          ) : (
            <>
              <div className="card p-4 sm:p-6">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h2 className="font-condensed text-2xl font-black uppercase">{activeSection.name}</h2>
                    {activeSection.description && <p className="text-sm text-gray-500 mt-1">{activeSection.description}</p>}
                  </div>
                </div>
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search scripts by title or body..."
                  className="input"
                />
              </div>

              {KINDS.map(k => (
                <KindBlock
                  key={k.value}
                  kind={k}
                  scripts={byKind[k.value]}
                  canManage={canManage}
                  onEdit={(s) => { setEditingScript(s); setShowScriptModal(true); }}
                  onDelete={deleteScript}
                />
              ))}
            </>
          )}
        </section>
      </div>

      {showSectionModal && (
        <SectionModal
          existing={editingSection}
          onClose={() => { setShowSectionModal(false); setEditingSection(null); }}
          onSaved={() => { setShowSectionModal(false); setEditingSection(null); router.refresh(); }}
        />
      )}
      {showScriptModal && (
        <ScriptModal
          existing={editingScript}
          sections={sections}
          tags={tags}
          defaultSectionId={activeSectionId}
          onClose={() => { setShowScriptModal(false); setEditingScript(null); }}
          onSaved={() => { setShowScriptModal(false); setEditingScript(null); router.refresh(); }}
        />
      )}
      {showTagModal && (
        <TagModal
          existing={editingTag}
          onClose={() => { setShowTagModal(false); setEditingTag(null); }}
          onSaved={() => { setShowTagModal(false); setEditingTag(null); router.refresh(); }}
        />
      )}
    </>
  );
}

function KindBlock({ kind, scripts, canManage, onEdit, onDelete }: {
  kind: { value: Script['kind']; label: string; color: string };
  scripts: Script[];
  canManage: boolean;
  onEdit: (s: Script) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="card overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 sm:px-6 py-3 hover:bg-gray-50 border-b border-gray-100">
        <div className="flex items-center gap-2">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-md border ${kind.color}`}>{kind.label}</span>
          <span className="text-sm text-gray-500">{scripts.length}</span>
        </div>
      </button>
      {open && (
        <div className="divide-y divide-gray-100">
          {scripts.length === 0 ? (
            <p className="p-6 text-sm text-gray-400 text-center">No {kind.label.toLowerCase()} scripts yet.</p>
          ) : (
            scripts.map(s => (
              <article key={s.id} className="p-4 sm:p-6">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="font-bold text-base">{s.title}</h3>
                  {canManage && (
                    <div className="flex gap-2">
                      <button onClick={() => onEdit(s)} className="text-gray-400 hover:text-brand-red"><Edit3 size={14} /></button>
                      <button onClick={() => onDelete(s.id)} className="text-gray-400 hover:text-red-700"><Trash2 size={14} /></button>
                    </div>
                  )}
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{s.body}</p>
                {s.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {s.tags.map(t => (
                      <span key={t.id} className={`text-xs px-2 py-0.5 rounded-md border ${TAG_COLOR_CLASSES[t.color] || TAG_COLOR_CLASSES.gray}`}>
                        {t.name}
                      </span>
                    ))}
                  </div>
                )}
              </article>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function SectionModal({ existing, onClose, onSaved }: {
  existing: Section | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: existing?.name || '',
    description: existing?.description || '',
    sort_order: existing?.sort_order ?? 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const url = existing ? `/api/scripts/sections/${existing.id}` : '/api/scripts/sections';
      const method = existing ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      onSaved();
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <Modal title={existing ? 'Edit Section' : 'New Section'} onClose={onClose}>
      {error && <Err msg={error} />}
      <form onSubmit={submit} className="space-y-3">
        <div><label className="label">Name *</label>
          <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="input" placeholder="e.g. Sales, Openers" /></div>
        <div><label className="label">Description</label>
          <input value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="input" /></div>
        <div><label className="label">Sort order</label>
          <input type="number" value={form.sort_order} onChange={e => setForm({...form, sort_order: parseInt(e.target.value || '0', 10)})} className="input" /></div>
        <FormActions loading={loading} onClose={onClose} />
      </form>
    </Modal>
  );
}

function ScriptModal({ existing, sections, tags, defaultSectionId, onClose, onSaved }: {
  existing: Script | null;
  sections: Section[];
  tags: ScriptTag[];
  defaultSectionId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    section_id: existing?.section_id || defaultSectionId || (sections[0]?.id ?? ''),
    kind: (existing?.kind || 'verbatim') as Script['kind'],
    title: existing?.title || '',
    body: existing?.body || '',
    sort_order: existing?.sort_order ?? 0,
    tag_ids: (existing?.tags || []).map(t => t.id),
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function toggleTag(id: string) {
    setForm(f => ({
      ...f,
      tag_ids: f.tag_ids.includes(id) ? f.tag_ids.filter(x => x !== id) : [...f.tag_ids, id],
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const url = existing ? `/api/scripts/${existing.id}` : '/api/scripts';
      const method = existing ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, body: form.body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      onSaved();
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <Modal title={existing ? 'Edit Script' : 'New Script'} onClose={onClose} wide>
      {error && <Err msg={error} />}
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Section *</label>
            <select required value={form.section_id} onChange={e => setForm({...form, section_id: e.target.value})} className="input">
              {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div><label className="label">Type *</label>
            <select required value={form.kind} onChange={e => setForm({...form, kind: e.target.value as Script['kind']})} className="input">
              {KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
          </div>
        </div>
        <div><label className="label">Title *</label>
          <input required value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="input" /></div>
        <div><label className="label">Body *</label>
          <textarea required rows={8} value={form.body} onChange={e => setForm({...form, body: e.target.value})} className="input font-mono text-sm" /></div>
        {tags.length > 0 && (
          <div>
            <label className="label">Tags</label>
            <div className="flex flex-wrap gap-1.5">
              {tags.map(t => {
                const active = form.tag_ids.includes(t.id);
                return (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => toggleTag(t.id)}
                    className={`text-xs px-2 py-1 rounded-md border ${TAG_COLOR_CLASSES[t.color] || TAG_COLOR_CLASSES.gray} ${active ? 'ring-2 ring-brand-red' : 'opacity-60'}`}
                  >
                    {t.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <FormActions loading={loading} onClose={onClose} />
      </form>
    </Modal>
  );
}

function TagModal({ existing, onClose, onSaved }: {
  existing: ScriptTag | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: existing?.name || '',
    color: existing?.color || 'gray',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const url = existing ? `/api/scripts/tags/${existing.id}` : '/api/scripts/tags';
      const method = existing ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      onSaved();
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <Modal title={existing ? 'Edit Tag' : 'New Tag'} onClose={onClose}>
      {error && <Err msg={error} />}
      <form onSubmit={submit} className="space-y-3">
        <div><label className="label">Name *</label>
          <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="input" /></div>
        <div>
          <label className="label">Color</label>
          <div className="flex gap-2">
            {TAG_COLORS.map(c => (
              <button
                type="button"
                key={c}
                onClick={() => setForm({...form, color: c})}
                className={`text-xs px-3 py-1.5 rounded-md border ${TAG_COLOR_CLASSES[c]} ${form.color === c ? 'ring-2 ring-brand-red' : ''}`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <FormActions loading={loading} onClose={onClose} />
      </form>
    </Modal>
  );
}

function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className={`bg-white rounded-lg w-full p-6 ${wide ? 'max-w-2xl' : 'max-w-md'}`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-condensed text-2xl font-black uppercase">{title}</h3>
          <button onClick={onClose}><X size={20} className="text-gray-400 hover:text-brand-red" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Err({ msg }: { msg: string }) {
  return <div className="mb-3 p-2 bg-brand-red-pale text-brand-red text-sm rounded">{msg}</div>;
}

function FormActions({ loading, onClose }: { loading: boolean; onClose: () => void }) {
  return (
    <div className="flex gap-2 pt-3 border-t border-gray-100">
      <button type="submit" disabled={loading} className="btn-primary flex-1 disabled:opacity-50">
        {loading ? 'Saving...' : 'Save'}
      </button>
      <button type="button" onClick={onClose} className="btn-outline">Cancel</button>
    </div>
  );
}
