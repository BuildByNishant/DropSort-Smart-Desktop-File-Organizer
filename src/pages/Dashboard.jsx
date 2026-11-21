import { useEffect, useState } from 'react';
import { useApp } from '../hooks/AppContext.jsx';
import { api } from '../utils/api.js';
import { formatBytes, formatDate, plural, folderName } from '../utils/format.js';
import { categoryMeta, QUICK_FOLDERS, totalBytes } from '../utils/categories.js';
import Button from '../components/Button.jsx';
import Card, { StatCard } from '../components/Card.jsx';
import { Badge, statusTone } from '../components/Badge.jsx';

const WHY = [
  ['👁️', 'Preview first', 'See every move before it happens.'],
  ['↩️', 'Undo anytime', 'Restore a file or a whole session.'],
  ['🧠', 'Smart Rules', 'Teach it your own sorting habits.'],
  ['🔒', 'Private & offline', 'Nothing ever leaves your Mac.'],
];

export default function Dashboard() {
  const { navigate, pickSource, scan, lastResult, settings, setTourOpen } = useApp();
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    api.getDashboard().then((d) => alive && setData(d)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [lastResult]);

  async function start(startIn) {
    const picked = await pickSource(startIn);
    if (picked) navigate('organizer');
  }

  const scanSize = totalBytes(scan?.files);
  const maxCount = data?.categoryTotals?.[0]?.count || 1;
  const activeRules = settings.rules.filter((r) => r.enabled).length;

  return (
    <div className="mx-auto max-w-5xl">
      <section className="hero-gradient mb-6 rounded-3xl p-8 text-white shadow-lg">
        <h2 className="text-3xl font-semibold tracking-tight">Tidy any folder in under a minute</h2>
        <p className="mt-2 max-w-xl text-white/85">Pick a folder, check the preview, and DropSort sorts everything into neat folders. Nothing is deleted or overwritten, and you can undo it all.</p>
        <div className="mt-6 flex flex-wrap items-center gap-2.5">
          {QUICK_FOLDERS.map(([id, icon, label]) => (
            <button key={id} onClick={() => start(id)} className="no-drag inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow transition hover:scale-[1.02]">
              <span aria-hidden="true">{icon}</span>{label}
            </button>
          ))}
          <button onClick={() => start()} className="no-drag inline-flex items-center gap-2 rounded-xl bg-white/20 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/40 transition hover:bg-white/30">
            <span aria-hidden="true">📂</span>Choose another folder
          </button>
        </div>
        <p className="mt-4 text-sm text-white/75">Tip: you can also drag a folder anywhere onto this window.</p>
      </section>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {WHY.map(([icon, title, text]) => (
          <div key={title} className="card-lift rounded-2xl border border-line bg-surface p-4 shadow-sm">
            <div className="text-2xl" aria-hidden="true">{icon}</div>
            <div className="mt-2 text-sm font-semibold">{title}</div>
            <div className="text-xs text-muted">{text}</div>
          </div>
        ))}
      </div>

      {scan && (
        <Card title="Latest scan" className="mb-5" action={<Button size="sm" onClick={() => navigate('results')}>View results</Button>}>
          <p className="truncate font-mono text-xs text-muted" title={scan.folder}>{scan.folder}</p>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <StatCard label="Files" value={scan.files.length.toLocaleString()} />
            <StatCard label="Total size" value={formatBytes(scanSize)} />
            <StatCard label="Categories" value={new Set(scan.files.map((f) => f.category)).size} />
          </div>
          <div className="mt-3"><Button variant="primary" onClick={() => navigate('preview')}>Preview organization</Button></div>
        </Card>
      )}

      {lastResult && (
        <Card className="mb-5 flex items-center justify-between gap-3">
          <p className="text-sm">
            Last organization: <strong>{plural(lastResult.counts.moved, 'file')}</strong> moved from <span className="font-medium">{folderName(lastResult.sourceRoot)}</span>.
          </p>
          <Button size="sm" onClick={() => navigate('summary')}>View result</Button>
        </Card>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Sessions" value={data ? data.totals.sessions.toLocaleString() : '-'} hint="Organizations completed" />
        <StatCard label="Files organized" value={data ? data.totals.moved.toLocaleString() : '-'} hint="In their new folders" />
        <StatCard label="Restored" value={data ? data.totals.reversed.toLocaleString() : '-'} hint="Undone from History" />
        <button onClick={() => navigate('rules')} className="card-lift rounded-2xl border border-line bg-surface p-4 text-left shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wide text-muted">Smart Rules</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{activeRules}</div>
          <div className="mt-0.5 text-xs text-accent">{activeRules ? 'Manage rules' : 'Add your first rule'}</div>
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Organized by category">
          {data && data.categoryTotals.length > 0 ? (
            <ul className="space-y-2.5">
              {data.categoryTotals.map((c) => {
                const { icon, color } = categoryMeta(c.category);
                return (
                  <li key={c.category}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{icon} {c.category}</span>
                      <span className="tabular-nums text-muted">{c.count.toLocaleString()} · {formatBytes(c.bytes)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface2"><div className="h-full rounded-full" style={{ width: `${(c.count / maxCount) * 100}%`, backgroundColor: color }} /></div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted">Nothing organized yet. These totals only cover folders you organize with DropSort.</p>
          )}
        </Card>

        <Card title="Recent activity" action={<Button size="sm" variant="ghost" onClick={() => navigate('history')}>See all</Button>}>
          {data && data.recentSessions.length > 0 ? (
            <ul className="divide-y divide-line">
              {data.recentSessions.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium" title={s.source_folder}>{folderName(s.source_folder)}</div>
                    <div className="text-xs text-muted">{formatDate(s.created_at)} · {plural(s.total_moved, 'file')} moved</div>
                  </div>
                  <Badge tone={statusTone(s.status)}>{s.status}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No activity yet.</p>
          )}
        </Card>
      </div>

      <p className="mt-6 text-center text-xs text-muted">
        New here? <button className="text-accent underline" onClick={() => setTourOpen(true)}>Show the quick tour</button>
      </p>
    </div>
  );
}
