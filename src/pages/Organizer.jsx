import { useApp } from '../hooks/AppContext.jsx';
import Button from '../components/Button.jsx';
import Card from '../components/Card.jsx';
import LayoutPicker from '../components/LayoutPicker.jsx';
import PageHeader from '../components/PageHeader.jsx';
import PathText from '../components/PathText.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import Stepper from '../components/Stepper.jsx';
import PermissionHelp, { isPermissionError } from '../components/PermissionHelp.jsx';
import { formatBytes, plural } from '../utils/format.js';
import { QUICK_FOLDERS, totalBytes } from '../utils/categories.js';

function Toggle({ checked, onChange, label, hint, disabled }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input type="checkbox" className="mt-0.5" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </label>
  );
}

export default function Organizer() {
  const {
    sourceFolder, pickSource, scanOptions, setScanOptions, destination, pickDestination, setDestinationMode,
    layout, setLayout, scan, scanning, scanError, runScan, cancelJob, progress, navigate,
  } = useApp();

  const sp = progress.scan;
  const scanSize = totalBytes(scan?.files);
  const needsDest = destination.mode === 'separate' && !destination.path;

  return (
    <div className="mx-auto max-w-3xl">
      <Stepper />
      <PageHeader title="Organize a folder" subtitle="Four easy steps. You will see a full preview before a single file moves." />

      <Card title="1. Which folder should be organized?" className="mb-4">
        {sourceFolder ? (
          <div className="flex items-center gap-3">
            <span className="text-2xl" aria-hidden="true">📁</span>
            <div className="min-w-0 flex-1"><PathText path={sourceFolder} className="text-sm" /></div>
            <Button onClick={() => pickSource()} disabled={Boolean(scanning)}>Change</Button>
          </div>
        ) : (
          <div className="rounded-xl border-2 border-dashed border-line p-6 text-center">
            <div className="text-3xl" aria-hidden="true">📂</div>
            <p className="mt-2 text-sm font-medium">Drag a folder here, or pick one</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {QUICK_FOLDERS.map(([id, icon, label]) => <Button key={id} onClick={() => pickSource(id)}>{icon} {label}</Button>)}
              <Button variant="primary" onClick={() => pickSource()}>Choose folder...</Button>
            </div>
          </div>
        )}
        <p className="mt-3 text-xs text-muted">DropSort can only open folders you choose. If macOS asks for permission, click Allow.</p>
      </Card>

      <Card title="2. Where should the sorted files go?" className="mb-4">
        <div className="space-y-3">
          <label className="flex cursor-pointer items-start gap-3">
            <input type="radio" name="dest" className="mt-0.5" checked={destination.mode === 'separate'} onChange={() => setDestinationMode('separate')} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">A separate folder <span className="ml-1 rounded bg-ok/15 px-1.5 py-0.5 text-xs font-medium text-ok">Recommended</span></span>
              <span className="block text-xs text-muted">Your original folder stays as it is, minus the files that move out.</span>
            </span>
          </label>
          {destination.mode === 'separate' && (
            <div className="ml-7 flex items-center gap-3">
              <div className="min-w-0 flex-1">{destination.path ? <PathText path={destination.path} className="text-sm" /> : <span className="text-sm text-muted">No destination chosen yet.</span>}</div>
              <Button size="sm" onClick={pickDestination}>{destination.path ? 'Change' : 'Choose destination'}</Button>
            </div>
          )}
          <label className="flex cursor-pointer items-start gap-3">
            <input type="radio" name="dest" className="mt-0.5" checked={destination.mode === 'in-place'} onChange={() => setDestinationMode('in-place')} />
            <span>
              <span className="block text-sm font-medium">Right inside the same folder</span>
              <span className="block text-xs text-muted">New folders are created inside the folder you are scanning.</span>
            </span>
          </label>
        </div>
      </Card>

      <Card title="3. How should files be arranged?" className="mb-4">
        <LayoutPicker value={layout} onChange={setLayout} />
      </Card>

      <Card title="Options" className="mb-4">
        <div className="space-y-3">
          <Toggle checked={scanOptions.recursive} onChange={(v) => setScanOptions((o) => ({ ...o, recursive: v }))} label="Include files inside subfolders" hint="Off by default. When on, files from every subfolder can be moved." disabled={Boolean(scanning)} />
          <Toggle checked={scanOptions.includeHidden} onChange={(v) => setScanOptions((o) => ({ ...o, includeHidden: v }))} label="Include hidden files" hint="Files whose names start with a dot." disabled={Boolean(scanning)} />
        </div>
        {scanOptions.recursive && <p className="mt-3 rounded-lg bg-warn/15 px-3 py-2 text-xs text-warn">Subfolder scanning is on: files from inside subfolders will be included and moved.</p>}
      </Card>

      <Card title="4. Scan the folder">
        {scanning ? (
          <div className="space-y-3">
            <ProgressBar label="Looking through your folder..." detail={sp ? `${plural(sp.filesFound, 'file')} found` : 'Starting...'} />
            <Button variant="danger" onClick={() => cancelJob(scanning.jobId)}>Cancel scan</Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" size="lg" onClick={runScan} disabled={!sourceFolder}>{scan ? 'Scan again' : 'Scan folder'}</Button>
              {!sourceFolder && <span className="text-xs text-muted">Choose a folder first.</span>}
              {sourceFolder && needsDest && !scan && <span className="text-xs text-muted">You can choose the destination after the scan too.</span>}
            </div>
            {scanError && <p className="text-sm text-bad" role="alert">{scanError}</p>}
            {isPermissionError(scanError) && <PermissionHelp />}
            {scan && (
              <div className="rounded-xl bg-ok/10 p-4 text-sm">
                <p className="font-medium text-ok">Scan complete</p>
                <p className="mt-1">
                  Found <strong>{plural(scan.files.length, 'file')}</strong> ({formatBytes(scanSize)}).
                  {scan.skippedCount > 0 && <> {plural(scan.skippedCount, 'item')} skipped.</>}
                  {scan.hiddenIgnored > 0 && <> {plural(scan.hiddenIgnored, 'hidden file')} ignored.</>}
                </p>
                {scan.files.length === 0 && <p className="mt-1 text-muted">There are no eligible files here, so there is nothing to organize.</p>}
                <div className="mt-3 flex gap-2">
                  <Button onClick={() => navigate('results')}>Explore results</Button>
                  <Button variant="primary" onClick={() => navigate('preview')} disabled={scan.files.length === 0}>Continue to preview</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
