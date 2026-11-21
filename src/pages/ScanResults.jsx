import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../hooks/AppContext.jsx';
import { formatBytes, formatDate, plural, relativeDir } from '../utils/format.js';
import { categoryMeta, categoryOrder } from '../utils/categories.js';
import Button from '../components/Button.jsx';
import Card from '../components/Card.jsx';
import EmptyState from '../components/EmptyState.jsx';
import PageHeader from '../components/PageHeader.jsx';
import PathText from '../components/PathText.jsx';
import InsightsPanel from '../components/InsightsPanel.jsx';
import Stepper from '../components/Stepper.jsx';
import Pagination from '../components/Pagination.jsx';
import { CategoryBadge } from '../components/Badge.jsx';

const PAGE_SIZE = 100;

export default function ScanResults() {
  const { scan, navigate, settings, categoryFilter, setCategoryFilter, excluded, toggleExcluded, setExcludedMany, reveal } = useApp();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' });
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => setPage(0), [search, sort, categoryFilter, scan?.scanId]);
  useEffect(() => setSelectedId(null), [scan?.scanId]);

  const ruleNames = useMemo(() => Object.fromEntries((settings.rules || []).map((r) => [r.id, r.name])), [settings.rules]);

  const counts = useMemo(() => {
    const c = {};
    if (scan) for (const f of scan.files) c[f.category] = (c[f.category] || 0) + 1;
    return c;
  }, [scan]);

  const filtered = useMemo(() => {
    if (!scan) return [];
    const q = search.trim().toLowerCase();
    let rows = scan.files.filter(
      (f) => (categoryFilter === 'All' || f.category === categoryFilter) && (!q || f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q))
    );
    const dir = sort.dir === 'asc' ? 1 : -1;
    rows = [...rows].sort((a, b) => {
      const av = sort.key === 'name' ? a.name.toLowerCase() : a[sort.key];
      const bv = sort.key === 'name' ? b.name.toLowerCase() : b[sort.key];
      return (av < bv ? -1 : av > bv ? 1 : 0) * dir;
    });
    return rows;
  }, [scan, search, sort, categoryFilter]);

  if (!scan) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Scan Results" />
        <EmptyState title="No scan yet" message="Choose a folder and scan it to see its files here." action={<Button variant="primary" onClick={() => navigate('organizer')}>Go to Organizer</Button>} />
      </div>
    );
  }

  const order = categoryOrder(settings.categories, Object.keys(counts)).filter((c) => counts[c]);
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const selected = scan.files.find((f) => f.id === selectedId);
  const allChecked = filtered.length > 0 && filtered.every((f) => !excluded.has(f.id));
  const includedCount = scan.files.length - excluded.size;
  const showFolder = scan.options.recursive;

  function sortBy(key) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  }
  const arrow = (key) => (sort.key === key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '');
  const ariaSort = (key) => (sort.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none');

  return (
    <div className="mx-auto max-w-6xl">
      <Stepper />
      <PageHeader
        title="Scan Results"
        subtitle={`${plural(scan.files.length, 'file')} in ${scan.folder}. Untick any file you want to leave where it is.`}
        actions={<Button variant="primary" onClick={() => navigate('preview')} disabled={includedCount === 0}>Preview {plural(includedCount, 'file')}</Button>}
      />

      <InsightsPanel />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by file name..."
          aria-label="Search files"
          className="w-64 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm"
        />
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by category">
          {['All', ...order].map((c) => {
            const active = categoryFilter === c;
            return (
              <button
                key={c}
                onClick={() => setCategoryFilter(c)}
                aria-pressed={active}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${active ? 'bg-accent text-accentink' : 'bg-surface text-ink ring-1 ring-line hover:bg-surface2'}`}
              >
                {c === 'All' ? `All (${scan.files.length})` : `${categoryMeta(c).icon} ${c} (${counts[c]})`}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex gap-4">
        <Card className="min-w-0 flex-1 !p-0 overflow-hidden">
          {filtered.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted">No files match your search or filter.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th scope="col" className="w-10 px-3 py-2">
                      <input
                        type="checkbox"
                        aria-label="Include all files in this view"
                        checked={allChecked}
                        onChange={(e) => setExcludedMany(filtered.map((f) => f.id), !e.target.checked)}
                      />
                    </th>
                    <th scope="col" aria-sort={ariaSort('name')} className="px-3 py-2"><button onClick={() => sortBy('name')}>Name{arrow('name')}</button></th>
                    <th scope="col" className="px-3 py-2">Category</th>
                    <th scope="col" aria-sort={ariaSort('size')} className="px-3 py-2 text-right"><button onClick={() => sortBy('size')}>Size{arrow('size')}</button></th>
                    <th scope="col" aria-sort={ariaSort('mtimeMs')} className="px-3 py-2"><button onClick={() => sortBy('mtimeMs')}>Modified{arrow('mtimeMs')}</button></th>
                    {showFolder && <th scope="col" className="px-3 py-2">Folder</th>}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((f) => {
                    const off = excluded.has(f.id);
                    return (
                      <tr
                        key={f.id}
                        onClick={() => setSelectedId(f.id)}
                        className={`cursor-pointer border-b border-line/60 hover:bg-surface2 ${selectedId === f.id ? 'bg-accent/10' : ''} ${off ? 'opacity-50' : ''}`}
                      >
                        <td className="px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" aria-label={`Include ${f.name}`} checked={!off} onChange={() => toggleExcluded(f.id)} />
                        </td>
                        <td className="max-w-[18rem] px-3 py-1.5"><span className="block truncate" title={f.name}>{f.name}</span></td>
                        <td className="px-3 py-1.5">
                          <span className="inline-flex items-center gap-1.5">
                            <CategoryBadge category={f.category} />
                            {f.ruleId && <span title={`Smart rule: ${ruleNames[f.ruleId] || 'rule'}`} className="rounded bg-accent/15 px-1 text-[10px] font-semibold uppercase text-accent">Rule</span>}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-muted">{formatBytes(f.size)}</td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-muted">{formatDate(f.mtimeMs)}</td>
                        {showFolder && <td className="max-w-[12rem] px-3 py-1.5 text-xs text-muted"><span className="block truncate" title={f.dir}>{relativeDir(f.dir, scan.folder) || '.'}</span></td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} />
        </Card>

        {selected && (
          <Card title="File details" className="w-72 shrink-0 self-start" action={<Button size="sm" variant="ghost" onClick={() => setSelectedId(null)} aria-label="Close details">✕</Button>}>
            <dl className="space-y-2 text-sm">
              <div><dt className="text-xs text-muted">Name</dt><dd className="break-all">{selected.name}</dd></div>
              <div><dt className="text-xs text-muted">Category</dt><dd><CategoryBadge category={selected.category} /></dd></div>
              <div><dt className="text-xs text-muted">Size</dt><dd>{formatBytes(selected.size)} ({selected.size.toLocaleString()} bytes)</dd></div>
              <div><dt className="text-xs text-muted">Modified</dt><dd>{formatDate(selected.mtimeMs)}</dd></div>
              <div><dt className="text-xs text-muted">Created</dt><dd>{formatDate(selected.birthtimeMs)}</dd></div>
              <div><dt className="text-xs text-muted">Full path</dt><dd className="break-all select-text font-mono text-xs">{selected.path}</dd></div>
            </dl>
            <Button size="sm" className="mt-3" onClick={() => reveal(selected.path)}>Show in Finder</Button>
          </Card>
        )}
      </div>

      {scan.skippedCount > 0 && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-muted">{plural(scan.skippedCount, 'item')} skipped during the scan</summary>
          <ul className="mt-2 space-y-1">
            {scan.skipped.map((s, i) => (
              <li key={i} className="flex gap-3"><PathText path={s.path} className="flex-1" /><span className="shrink-0 text-xs text-muted">{s.reason}</span></li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
