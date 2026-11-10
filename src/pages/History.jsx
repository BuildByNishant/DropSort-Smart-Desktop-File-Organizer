import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../hooks/AppContext.jsx';
import { api } from '../utils/api.js';
import { formatBytes, formatDate, plural, folderName } from '../utils/format.js';
import Button from '../components/Button.jsx';
import Card from '../components/Card.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import EmptyState from '../components/EmptyState.jsx';
import PageHeader from '../components/PageHeader.jsx';
import PathText from '../components/PathText.jsx';
import { Badge, CategoryBadge, statusTone } from '../components/Badge.jsx';

const FILTERS = [['', 'All'], ['moved', 'Moved'], ['reversed', 'Restored'], ['skipped', 'Skipped'], ['failed', 'Failed']];

export default function History() {
  const { navigate, toast, reveal, lastResult, exportCsv } = useApp();
  const [sessions, setSessions] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [ops, setOps] = useState({ operations: [], total: 0 });
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [busyOp, setBusyOp] = useState(null);
  const [confirmSession, setConfirmSession] = useState(false);
  const [error, setError] = useState(null);

  const loadSessions = useCallback(async () => {
    try {
      const list = await api.getHistory({ limit: 100 });
      setSessions(list);
      setSelectedId((cur) => (cur && list.some((s) => s.id === cur) ? cur : list[0]?.id ?? null));
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const loadOps = useCallback(async () => {
    if (!selectedId) return;
    try {
      setOps(await api.getOperations(selectedId, { status, search, limit: 200 }));
    } catch (err) {
      setError(err.message);
    }
  }, [selectedId, status, search]);

  useEffect(() => { loadSessions(); }, [loadSessions, lastResult]);
  useEffect(() => { loadOps(); }, [loadOps]);

  async function loadMore() {
    const more = await api.getOperations(selectedId, { status, search, limit: 200, offset: ops.operations.length });
    setOps((cur) => ({ ...more, operations: [...cur.operations, ...more.operations] }));
  }

  async function undoOne(op) {
    setBusyOp(op.id);
    try {
      const res = await api.undoOperation(op.id);
      toast(res.message, res.ok ? 'success' : 'error');
      await Promise.all([loadOps(), loadSessions()]);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusyOp(null);
    }
  }

  async function undoAll() {
    setConfirmSession(false);
    try {
      const res = await api.undoSession(selectedId);
      toast(res.blocked ? `Restored ${res.restored} of ${res.total}. ${res.blocked} blocked.` : `Restored ${plural(res.restored, 'file')}.`, res.blocked ? 'error' : 'success');
      await Promise.all([loadOps(), loadSessions()]);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  if (error) return <div className="mx-auto max-w-3xl"><PageHeader title="History" /><p className="text-sm text-bad" role="alert">{error}</p></div>;
  if (sessions && sessions.length === 0) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="History" />
        <EmptyState icon="🕘" title="No history yet" message="Every organization you run is recorded here so you can review it or undo it." action={<Button variant="primary" onClick={() => navigate('organizer')}>Go to Organizer</Button>} />
      </div>
    );
  }

  const session = sessions?.find((s) => s.id === selectedId);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="History" subtitle="Review past organizations and restore files to where they came from. DropSort never overwrites a file when restoring." />
      <div className="flex gap-4">
        <ul className="w-64 shrink-0 space-y-2 self-start" aria-label="Sessions">
          {(sessions || []).map((s) => (
            <li key={s.id}>
              <button onClick={() => setSelectedId(s.id)} aria-current={s.id === selectedId} className={`w-full rounded-xl border p-3 text-left transition ${s.id === selectedId ? 'border-accent bg-accent/10' : 'border-line bg-surface hover:bg-surface2'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium" title={s.source_folder}>{folderName(s.source_folder)}</span>
                  <Badge tone={statusTone(s.status)}>{s.status}</Badge>
                </div>
                <div className="mt-1 text-xs text-muted">{formatDate(s.created_at)}</div>
                <div className="mt-0.5 text-xs text-muted">{s.total_moved} moved · {s.total_skipped} skipped · {s.total_failed} failed</div>
              </button>
            </li>
          ))}
        </ul>

        <div className="min-w-0 flex-1">
          {session && (
            <Card className="mb-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs text-muted">From</div><PathText path={session.source_folder} className="text-sm" />
                  <div className="mt-2 text-xs text-muted">To</div><PathText path={session.destination_root} className="text-sm" />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => reveal(session.destination_root)}>Show in Finder</Button>
                  <Button size="sm" onClick={() => exportCsv('history', session.id)}>Export CSV</Button>
                  <Button size="sm" variant="danger" disabled={session.restorable === 0} onClick={() => setConfirmSession(true)}>
                    Undo session{session.restorable ? ` (${session.restorable})` : ''}
                  </Button>
                </div>
              </div>
            </Card>
          )}

          <div className="mb-2 flex flex-wrap items-center gap-2">
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search file name..." aria-label="Search operations" className="w-56 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm" />
            <div className="flex gap-1" role="group" aria-label="Filter by status">
              {FILTERS.map(([value, label]) => (
                <button key={value} aria-pressed={status === value} onClick={() => setStatus(value)} className={`rounded-full px-3 py-1 text-xs font-medium ${status === value ? 'bg-accent text-accentink' : 'bg-surface ring-1 ring-line hover:bg-surface2'}`}>{label}</button>
              ))}
            </div>
          </div>

          <Card className="!p-0 overflow-hidden">
            {ops.operations.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted">No operations match.</p>
            ) : (
              <ul className="divide-y divide-line">
                {ops.operations.map((op) => (
                  <li key={op.id} className="flex items-start gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-medium" title={op.file_name}>{op.file_name}</span>
                        {op.category && <CategoryBadge category={op.category} />}
                        {op.file_size != null && <span className="text-xs text-muted">{formatBytes(op.file_size)}</span>}
                      </div>
                      <div className="mt-1 grid grid-cols-[2.5rem_1fr] gap-x-2 text-muted">
                        <span className="text-xs">From</span><PathText path={op.original_path} />
                        <span className="text-xs">To</span><PathText path={op.destination_path} />
                      </div>
                      {op.error_message && <p className="mt-1 text-xs text-warn">{op.error_message}</p>}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <Badge tone={statusTone(op.status)}>{op.status === 'reversed' ? 'restored' : op.status}</Badge>
                      {op.status === 'moved' && <Button size="sm" disabled={busyOp === op.id} onClick={() => undoOne(op)}>Undo</Button>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {ops.operations.length < ops.total && (
              <div className="border-t border-line p-2 text-center"><Button size="sm" onClick={loadMore}>Load more ({ops.total - ops.operations.length} left)</Button></div>
            )}
          </Card>
        </div>
      </div>

      <ConfirmDialog open={confirmSession} title="Undo this session?" confirmLabel="Undo" onConfirm={undoAll} onCancel={() => setConfirmSession(false)}>
        <p>Every file from this session that is still in its new location will be moved back. Nothing is overwritten; blocked files stay where they are.</p>
      </ConfirmDialog>
    </div>
  );
}
