import { useMemo, useState } from 'react';
import { useApp } from '../hooks/AppContext.jsx';
import { formatBytes, plural } from '../utils/format.js';
import { categoryMeta, categoryOrder, EXT_RE, normalizeExt, sanitizeCategoryName } from '../utils/categories.js';
import Button from '../components/Button.jsx';
import PageHeader from '../components/PageHeader.jsx';

export default function Categories() {
  const { settings, defaultCategories, saveSettings, scan, navigate, setCategoryFilter, toast } = useApp();
  const [drafts, setDrafts] = useState({});
  const [newName, setNewName] = useState('');

  const stats = useMemo(() => {
    const s = {};
    if (scan) {
      for (const f of scan.files) {
        s[f.category] = s[f.category] || { count: 0, size: 0 };
        s[f.category].count += 1;
        s[f.category].size += f.size;
      }
    }
    return s;
  }, [scan]);

  async function commit(nextCategories, message) {
    try {
      await saveSettings({ categories: nextCategories });
      if (message) toast(message, 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  function addExt(category) {
    const ext = normalizeExt(drafts[category]);
    if (!ext) return;
    if (!EXT_RE.test(ext)) return toast(`"${ext}" is not a valid extension. Use letters and numbers only.`, 'error');
    const next = structuredClone(settings.categories);
    const previous = Object.keys(next).find((c) => next[c].includes(ext));
    if (previous === category) return setDrafts((d) => ({ ...d, [category]: '' }));
    if (previous) next[previous] = next[previous].filter((e) => e !== ext);
    next[category] = [...next[category], ext];
    setDrafts((d) => ({ ...d, [category]: '' }));
    commit(next, previous ? `.${ext} moved from ${previous} to ${category}.` : `Added .${ext} to ${category}.`);
  }

  function removeExt(category, ext) {
    const next = structuredClone(settings.categories);
    next[category] = next[category].filter((e) => e !== ext);
    commit(next);
  }

  function addCategory() {
    const name = sanitizeCategoryName(newName);
    if (!name) return;
    if (name.toLowerCase() === 'others') return toast('"Others" is built in and always exists.', 'error');
    if (Object.keys(settings.categories).some((c) => c.toLowerCase() === name.toLowerCase())) {
      return toast('A category with that name already exists.', 'error');
    }
    setNewName('');
    commit({ ...settings.categories, [name]: [] }, `Category "${name}" added.`);
  }

  function removeCategory(category) {
    const next = structuredClone(settings.categories);
    delete next[category];
    commit(next, `Category "${category}" removed.`);
  }

  const rules = { ...settings.categories, Others: [] };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Categories"
        subtitle="Files are sorted by their extension using these rules. Anything unmatched goes to Others. Changes save immediately."
        actions={
          <Button onClick={() => commit(structuredClone(defaultCategories), 'Categories reset to defaults.')}>
            Reset to defaults
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addCategory()}
          placeholder="New category name"
          aria-label="New category name"
          className="w-60 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm"
        />
        <Button variant="primary" onClick={addCategory} disabled={!newName.trim()}>Add category</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {categoryOrder(settings.categories, Object.keys(stats)).map((name) => {
          const { icon, color } = categoryMeta(name);
          const s = stats[name];
          const isConfigured = name in settings.categories;
          const exts = rules[name] || [];
          return (
            <section key={name} className="rounded-xl border border-line bg-surface p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 font-semibold"><span className="text-lg" aria-hidden="true">{icon}</span>{name}</h3>
                <div className="flex items-center gap-1">
                  {scan && (
                    <Button size="sm" variant="ghost" disabled={!s} onClick={() => { setCategoryFilter(name); navigate('results'); }}>
                      {s ? `${plural(s.count, 'file')} · ${formatBytes(s.size)}` : 'No files'}
                    </Button>
                  )}
                  {isConfigured && (
                    <Button size="sm" variant="ghost" onClick={() => removeCategory(name)} aria-label={`Delete category ${name}`}>Delete</Button>
                  )}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {name === 'Others' ? (
                  <span className="text-xs text-muted">Unknown extensions and files without an extension</span>
                ) : !isConfigured ? (
                  <span className="text-xs text-muted">Created by a Smart Rule</span>
                ) : (
                  <>
                    {exts.map((e) => (
                      <span key={e} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-xs" style={{ color, backgroundColor: `${color}1f` }}>
                        .{e}
                        <button onClick={() => removeExt(name, e)} aria-label={`Remove .${e} from ${name}`} className="opacity-60 hover:opacity-100">×</button>
                      </span>
                    ))}
                    <input
                      value={drafts[name] || ''}
                      onChange={(e) => setDrafts((d) => ({ ...d, [name]: e.target.value }))}
                      onKeyDown={(e) => e.key === 'Enter' && addExt(name)}
                      placeholder="+ ext"
                      aria-label={`Add an extension to ${name}`}
                      className="w-16 rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-xs"
                    />
                  </>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
