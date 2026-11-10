import { useState } from 'react';
import { useApp } from '../hooks/AppContext.jsx';
import { api } from '../utils/api.js';
import { plural } from '../utils/format.js';
import Button from '../components/Button.jsx';
import Card, { StatCard } from '../components/Card.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import EmptyState from '../components/EmptyState.jsx';
import PageHeader from '../components/PageHeader.jsx';
import PathText from '../components/PathText.jsx';
import Stepper from '../components/Stepper.jsx';
import { Badge, CategoryBadge, statusTone } from '../components/Badge.jsx';

const TABS = ['all', 'moved', 'skipped', 'failed'];

export default function Summary() {
  const { lastResult, navigate, toast, reveal } = useApp();
  const [tab, setTab] = useState('all');
  const [confirmUndo, setConfirmUndo] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [undone, setUndone] = useState(false);

  if (!lastResult) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Results" />
        <EmptyState icon="✅" title="No recent organization" message="Results appear here after you organize a folder." action={<Button variant="primary" onClick={() => navigate('organizer')}>Go to Organizer</Button>} />
      </div>
    );
  }

  const { counts, results, status, recordFailures, sessionId } = lastResult;
  const rows = results.filter((r) => tab === 'all' || r.status === tab);

  async function undoAll() {
    setUndoing(true);
    try {
      const res = await api.undoSession(sessionId);
      setUndone(true);
      toast(res.blocked ? `Restored ${res.restored}. ${res.blocked} could not be restored (see History).` : `Restored ${plural(res.restored, 'file')}.`, res.blocked ? 'error' : 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setUndoing(false);
      setConfirmUndo(false);
    }
  }

  const headline = status === 'completed' ? 'All done' : status === 'partial' ? 'Finished with some problems' : 'Nothing could be moved';

  return (
    <div className="mx-auto max-w-5xl">
      <Stepper />
      <PageHeader
        title={headline}
        subtitle={`From ${lastResult.sourceRoot} to ${lastResult.destinationRoot}`}
        actions={
          <>
            <Button onClick={() => reveal(lastResult.destinationRoot)}>Show destination in Finder</Button>
            <Button onClick={() => navigate('history')}>Open History</Button>
            <Button variant="primary" onClick={() => navigate('organizer')}>Organize another folder</Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-3 gap-3">
        <StatCard label="Moved" value={counts.moved.toLocaleString()} />
        <StatCard label="Skipped" value={counts.skipped.toLocaleString()} hint="Left where they were" />
        <StatCard label="Failed" value={counts.failed.toLocaleString()} hint="Original files were kept" />
      </div>

      {recordFailures > 0 && (
        <p className="mb-4 rounded-lg bg-bad/15 px-3 py-2 text-sm text-bad" role="alert">
          {plural(recordFailures, 'move')} could not be saved to History, so they cannot be undone from DropSort. The files themselves are safe.
        </p>
      )}
      {!lastResult.sessionRecorded && (
        <p className="mb-4 rounded-lg bg-warn/15 px-3 py-2 text-sm text-warn">The session summary could not be saved, but individual moves were recorded.</p>
      )}

      <Card className="!p-0 overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-3 py-2">
          <div className="flex gap-1" role="tablist">
            {TABS.map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`rounded-md px-3 py-1 text-xs font-medium capitalize ${tab === t ? 'bg-accent text-accentink' : 'hover:bg-surface2'}`}>
                {t}{t !== 'all' && ` (${t === 'moved' ? counts.moved : t === 'skipped' ? counts.skipped : counts.failed})`}
              </button>
            ))}
          </div>
          {counts.moved > 0 && !undone && <Button size="sm" onClick={() => setConfirmUndo(true)}>Undo everything</Button>}
          {undone && <Badge tone="accent">Undo attempted</Badge>}
        </div>
        {rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted">Nothing in this list.</p>
        ) : (
          <ul className="max-h-[28rem] divide-y divide-line overflow-y-auto">
            {rows.slice(0, 500).map((r) => (
              <li key={r.itemId} className="flex items-start gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><span className="truncate text-sm font-medium" title={r.name}>{r.name}</span><CategoryBadge category={r.category} /></div>
                  <PathText path={r.status === 'moved' ? r.destination : r.source} className="text-muted" />
                  {r.error && <p className="mt-0.5 text-xs text-muted">{r.error}</p>}
                  {r.recorded === false && <p className="mt-0.5 text-xs text-bad">{r.recordError}</p>}
                </div>
                <Badge tone={statusTone(r.status)}>{r.status}</Badge>
              </li>
            ))}
          </ul>
        )}
        {rows.length > 500 && <p className="border-t border-line px-3 py-2 text-xs text-muted">Showing the first 500. The full list is in History.</p>}
      </Card>

      <ConfirmDialog open={confirmUndo} title="Undo this whole organization?" confirmLabel="Undo" busy={undoing} onConfirm={undoAll} onCancel={() => setConfirmUndo(false)}>
        <p>Files will be moved back to where they were. Anything whose original spot is now taken stays put, and DropSort tells you why.</p>
      </ConfirmDialog>
    </div>
  );
}
