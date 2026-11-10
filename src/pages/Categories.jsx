import { useMemo } from 'react';
import { useApp } from '../hooks/AppContext.jsx';
import { formatBytes, plural } from '../utils/format.js';
import { categoryMeta, categoryOrder } from '../utils/categories.js';
import Button from '../components/Button.jsx';
import PageHeader from '../components/PageHeader.jsx';

export default function Categories() {
  const { settings, scan, navigate, setCategoryFilter } = useApp();

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

  const rules = { ...settings.categories, Others: [] };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Categories"
        subtitle="Files are sorted by their extension using these rules. Anything unmatched goes to Others."
        actions={<Button onClick={() => navigate('settings')}>Edit rules</Button>}
      />
      <div className="grid grid-cols-2 gap-4">
        {categoryOrder(settings.categories, Object.keys(stats)).map((name) => {
          const { icon, color } = categoryMeta(name);
          const s = stats[name];
          const exts = rules[name] || [];
          return (
            <section key={name} className="rounded-xl border border-line bg-surface p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="flex items-center gap-2 font-semibold"><span className="text-lg" aria-hidden="true">{icon}</span>{name}</h3>
                {scan && (
                  <Button size="sm" variant="ghost" disabled={!s} onClick={() => { setCategoryFilter(name); navigate('results'); }}>
                    {s ? `${plural(s.count, 'file')} · ${formatBytes(s.size)}` : 'No files'}
                  </Button>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {name === 'Others' ? (
                  <span className="text-xs text-muted">Unknown extensions and files without an extension</span>
                ) : !(name in settings.categories) ? (
                  <span className="text-xs text-muted">Created by a Smart Rule</span>
                ) : exts.length === 0 ? (
                  <span className="text-xs text-muted">No extensions yet</span>
                ) : (
                  exts.map((e) => (
                    <span key={e} className="rounded px-1.5 py-0.5 font-mono text-xs" style={{ color, backgroundColor: `${color}1f` }}>.{e}</span>
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
