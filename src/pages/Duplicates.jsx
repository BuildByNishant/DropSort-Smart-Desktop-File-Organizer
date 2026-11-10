import { useApp } from '../hooks/AppContext.jsx';
import { formatBytes, plural } from '../utils/format.js';
import Button from '../components/Button.jsx';
import Card, { StatCard } from '../components/Card.jsx';
import EmptyState from '../components/EmptyState.jsx';
import PageHeader from '../components/PageHeader.jsx';
import PathText from '../components/PathText.jsx';
import ProgressBar from '../components/ProgressBar.jsx';

export default function Duplicates() {
  const { scan, dupes, dupeJob, runDuplicates, cancelJob, progress, navigate, reveal } = useApp();

  if (!scan) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Duplicates" />
        <EmptyState icon="🔁" title="Scan a folder first" message="DropSort finds exact copies among the files in your latest scan." action={<Button variant="primary" onClick={() => navigate('organizer')}>Go to Organizer</Button>} />
      </div>
    );
  }

  const dp = progress.duplicates;
  const result = dupes && dupes.scanId === scan.scanId ? dupes : null;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Duplicates"
        subtitle="Finds files with identical contents. Files are compared by size first, then by SHA-256, so only true byte-for-byte copies are listed. DropSort never deletes anything."
        actions={!dupeJob && <Button variant="primary" onClick={runDuplicates}>{result ? 'Search Again' : 'Find Duplicates'}</Button>}
      />

      {dupeJob && (
        <Card className="mb-4">
          <ProgressBar label="Comparing files..." value={dp?.done || 0} max={dp?.total || 0} detail={dp?.currentName || 'Starting...'} />
          <Button className="mt-3" variant="danger" onClick={() => cancelJob(dupeJob.jobId)}>Cancel</Button>
        </Card>
      )}

      {!result && !dupeJob && (
        <EmptyState icon="🔍" title="Ready to search" message={`${plural(scan.files.length, 'file')} from your latest scan will be checked.${scan.options.recursive ? '' : ' Only the top level of the folder was scanned.'}`} />
      )}

      {result && (
        <>
          <div className="mb-4 grid grid-cols-3 gap-3">
            <StatCard label="Duplicate groups" value={result.stats.groupCount.toLocaleString()} />
            <StatCard label="Extra copies" value={result.stats.duplicateFiles.toLocaleString()} />
            <StatCard label="Space used by extra copies" value={formatBytes(result.stats.reclaimableBytes)} />
          </div>

          {result.groups.length === 0 ? (
            <EmptyState icon="🎉" title="No exact duplicates found" message="Every file in this scan has unique contents." />
          ) : (
            <div className="space-y-3">
              {result.groups.map((g) => (
                <Card key={g.hash}>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="font-medium">{g.files.length} identical copies · {formatBytes(g.size)} each</span>
                    <span className="font-mono text-xs text-muted" title={g.hash}>SHA-256 {g.hash.slice(0, 12)}...</span>
                  </div>
                  <ul className="divide-y divide-line">
                    {g.files.map((f) => (
                      <li key={f.id} className="flex items-center gap-3 py-1.5">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm" title={f.name}>{f.name}</div>
                          <PathText path={f.path} className="text-muted" />
                        </div>
                        <Button size="sm" onClick={() => reveal(f.path)}>Show in Finder</Button>
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
          )}

          {result.unverified.length > 0 && (
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer text-muted">{plural(result.unverified.length, 'file')} could not be checked</summary>
              <ul className="mt-2 space-y-1">
                {result.unverified.map((f) => (
                  <li key={f.id} className="flex gap-3"><PathText path={f.path} className="flex-1" /><span className="shrink-0 text-xs text-muted">{f.error}</span></li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}
