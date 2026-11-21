import { Fragment, useEffect, useMemo, useState } from 'react';
import { useApp } from '../hooks/AppContext.jsx';
import { formatBytes, plural } from '../utils/format.js';
import { categoryOrder, isMovable, STATUS_LABELS } from '../utils/categories.js';
import Button from '../components/Button.jsx';
import Card, { StatCard } from '../components/Card.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import EmptyState from '../components/EmptyState.jsx';
import PageHeader from '../components/PageHeader.jsx';
import PathText from '../components/PathText.jsx';
import Pagination from '../components/Pagination.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import Stepper from '../components/Stepper.jsx';
import PermissionHelp, { isPermissionError } from '../components/PermissionHelp.jsx';
import { LAYOUT_OPTIONS } from '../utils/layouts.js';
import { Badge, CategoryBadge, statusTone } from '../components/Badge.jsx';

const PAGE_SIZE = 100;

export default function Preview() {
  const {
    scan, plan, planLoading, planError, loadPreview, destination, pickDestination, setDestinationMode,
    conflictPolicy, setConflictPolicy, layout, setLayout, exportCsv, excluded, toggleExcluded, setExcludedMany, settings, navigate,
    runOrganize, organizing, progress,
  } = useApp();
  const [confirming, setConfirming] = useState(false);
  const [page, setPage] = useState(0);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  useEffect(() => {
    setPage(0);
  }, [plan?.planId]);

  const items = useMemo(() => {
    if (!plan) return [];
    const order = categoryOrder(settings.categories, plan.items.map((i) => i.category));
    return [...plan.items].sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category) || a.name.localeCompare(b.name));
  }, [plan, settings]);

  if (!scan) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Preview" />
        <EmptyState icon="👁️" title="Nothing to preview yet" message="Scan a folder first. The preview shows exactly where each file would go before anything moves." action={<Button variant="primary" onClick={() => navigate('organizer')}>Go to Organizer</Button>} />
      </div>
    );
  }

  const needsDestination = destination.mode === 'separate' && !destination.path;
  const includedMovable = plan ? plan.items.filter((i) => isMovable(i) && !excluded.has(i.id)) : [];
  const includedBytes = includedMovable.reduce((n, i) => n + i.size, 0);
  const newFolderSet = plan ? new Set(plan.summary.newFolders) : null;
  const activeNewFolders = newFolderSet
    ? new Set(includedMovable.map((i) => i.destinationDir).filter((d) => newFolderSet.has(d))).size
    : 0;
  const pageItems = items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const movableIds = items.filter(isMovable).map((i) => i.id);
  const allMovableChecked = movableIds.length > 0 && movableIds.every((id) => !excluded.has(id));

  const op = progress.organize;

  async function confirm() {
    setConfirming(false);
    await runOrganize();
  }

  return (
    <div className="mx-auto max-w-6xl">
      <Stepper />
      <PageHeader
        title="Preview"
        subtitle="This is only a plan. No file has been moved. Review it, untick anything you want to keep where it is, then confirm."
        actions={
          <>
            <Button disabled={!plan} onClick={() => exportCsv('preview', plan.planId, { excludedItemIds: [...excluded] })}>Export CSV</Button>
            <Button variant="primary" disabled={!plan || includedMovable.length === 0 || organizing} onClick={() => setConfirming(true)}>
              Organize {plural(includedMovable.length, 'file')}
            </Button>
          </>
        }
      />

      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="min-w-[16rem] flex-1">
            <div className="text-xs text-muted">Destination</div>
            {destination.mode === 'in-place' ? (
              <div className="text-sm">Inside the scanned folder (organize in place)</div>
            ) : destination.path ? (
              <PathText path={destination.path} className="text-sm" />
            ) : (
              <div className="text-sm text-muted">Not chosen yet</div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {destination.mode === 'separate' && <Button size="sm" onClick={pickDestination}>{destination.path ? 'Change' : 'Select Destination'}</Button>}
            <Button size="sm" variant="ghost" onClick={() => setDestinationMode(destination.mode === 'in-place' ? 'separate' : 'in-place')}>
              {destination.mode === 'in-place' ? 'Use separate folder' : 'Organize in place'}
            </Button>
          </div>
          <label className="flex items-center gap-2 text-sm">
            Sort
            <select value={layout} onChange={(e) => setLayout(e.target.value)} className="rounded-lg border border-line bg-surface px-2 py-1 text-sm" aria-label="Sorting style">
              {LAYOUT_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            If a name already exists
            <select
              value={conflictPolicy}
              onChange={(e) => setConflictPolicy(e.target.value)}
              className="rounded-lg border border-line bg-surface px-2 py-1 text-sm"
              aria-label="When a file name already exists"
            >
              <option value="rename">Rename (file (1).ext)</option>
              <option value="skip">Skip the file</option>
            </select>
          </label>
        </div>
      </Card>

      {needsDestination && (
        <EmptyState icon="📁" title="Choose a destination" message="Pick the folder where the category folders should be created, or organize in place." action={<Button variant="primary" onClick={pickDestination}>Select Destination</Button>} />
      )}
      {planLoading && !needsDestination && <p className="text-sm text-muted" role="status">Building preview...</p>}
      {planError && <p className="rounded-lg bg-bad/15 px-3 py-2 text-sm text-bad" role="alert">{planError}</p>}
      {isPermissionError(planError) && <PermissionHelp />}

      {plan && !needsDestination && (
        <>
          {(plan.recursive || plan.inPlace) && (
            <div className="mb-4 space-y-1 rounded-lg bg-warn/15 px-3 py-2 text-sm text-warn">
              {plan.recursive && <p>Subfolder scanning was on, so files from subfolders are included and will be moved out of them.</p>}
              {plan.inPlace && <p>Organizing in place: new category folders will be created inside the scanned folder.</p>}
            </div>
          )}

          <div className="mb-4 grid grid-cols-4 gap-3">
            <StatCard label="Planned moves" value={includedMovable.length.toLocaleString()} hint={formatBytes(includedBytes)} />
            <StatCard label="New folders" value={activeNewFolders} hint="Created only after you confirm" />
            <StatCard label="Renamed on conflict" value={plan.items.filter((i) => i.status === 'renamed' && !excluded.has(i.id)).length} />
            <StatCard label="Not moved" value={plan.items.filter((i) => !isMovable(i) || excluded.has(i.id)).length} hint="Skipped or unticked" />
          </div>

          <Card className="!p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th scope="col" className="w-10 px-3 py-2">
                      <input type="checkbox" aria-label="Include all movable files" checked={allMovableChecked} onChange={(e) => setExcludedMany(movableIds, !e.target.checked)} />
                    </th>
                    <th scope="col" className="px-3 py-2">File</th>
                    <th scope="col" className="px-3 py-2">From</th>
                    <th scope="col" className="px-3 py-2">To</th>
                    <th scope="col" className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((item, i) => {
                    const movable = isMovable(item);
                    const off = excluded.has(item.id);
                    const newGroup = i === 0 || pageItems[i - 1].category !== item.category;
                    return (
                      <Fragment key={item.id}>
                        {newGroup && (
                          <tr className="bg-surface2">
                            <td colSpan={5} className="px-3 py-1.5"><CategoryBadge category={item.category} /> <span className="ml-1 text-xs text-muted">{plural(plan.summary.byCategory[item.category]?.count || 0, 'file')} to move</span></td>
                          </tr>
                        )}
                        <tr className={`border-b border-line/60 ${off || !movable ? 'opacity-55' : ''}`}>
                          <td className="px-3 py-1.5">
                            <input type="checkbox" aria-label={`Include ${item.name}`} checked={movable && !off} disabled={!movable} onChange={() => toggleExcluded(item.id)} />
                          </td>
                          <td className="max-w-[14rem] px-3 py-1.5"><span className="block truncate" title={item.name}>{item.name}</span><span className="text-xs text-muted">{formatBytes(item.size)}{item.ruleName && <span className="ml-1 text-accent" title="Smart rule">· {item.ruleName}</span>}</span></td>
                          <td className="max-w-[16rem] px-3 py-1.5"><PathText path={item.source} /></td>
                          <td className="max-w-[16rem] px-3 py-1.5"><PathText path={item.destination} /></td>
                          <td className="px-3 py-1.5">
                            <Badge tone={off ? 'neutral' : statusTone(item.status)} title={item.note}>{off ? 'Excluded' : STATUS_LABELS[item.status]}</Badge>
                          </td>
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} total={items.length} onPage={setPage} />
          </Card>
        </>
      )}

      <ConfirmDialog
        open={confirming}
        title={`Move ${plural(includedMovable.length, 'file')}?`}
        confirmLabel="Organize"
        onConfirm={confirm}
        onCancel={() => setConfirming(false)}
      >
        <p>Files will be moved into category folders{plan ? ` under "${plan.destinationRoot}"` : ''}.</p>
        <p>Nothing is deleted or overwritten. If a name is taken, the file is {conflictPolicy === 'rename' ? 'renamed' : 'skipped'}. You can undo from History.</p>
      </ConfirmDialog>

      {organizing && (
        <div className="no-drag fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl">
            <h3 className="mb-3 text-lg font-semibold">Organizing files...</h3>
            <ProgressBar label={op ? `${op.done.toLocaleString()} of ${op.total.toLocaleString()}` : 'Starting...'} value={op?.done || 0} max={op?.total || 0} detail={op?.currentName} />
            <p className="mt-3 text-xs text-muted">Please keep DropSort open until this finishes.</p>
          </div>
        </div>
      )}
    </div>
  );
}
