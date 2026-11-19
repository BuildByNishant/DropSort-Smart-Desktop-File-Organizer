import { useEffect, useState } from 'react';
import { useApp } from '../hooks/AppContext.jsx';
import Button from '../components/Button.jsx';
import Card from '../components/Card.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { LAYOUT_OPTIONS } from '../utils/layouts.js';

function Row({ label, hint, children }) {
  return (
    <div className="flex items-center justify-between gap-6 py-2.5">
      <div><div className="text-sm font-medium">{label}</div>{hint && <div className="text-xs text-muted">{hint}</div>}</div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
const selectCls = 'rounded-lg border border-line bg-surface px-2 py-1 text-sm';

export default function Settings() {
  const { settings, saveSettings, toast, setTourOpen, navigate } = useApp();
  const [draft, setDraft] = useState(() => structuredClone(settings));
  const [saving, setSaving] = useState(false);

  useEffect(() => setDraft(structuredClone(settings)), [settings]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);
  const set = (key, value) => setDraft((d) => ({ ...d, [key]: value }));

  async function save() {
    setSaving(true);
    try {
      const payload = { ...draft };
      delete payload.lastDestination; // managed by the app
      await saveSettings(payload);
      toast('Settings saved.', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Settings"
        actions={
          <>
            <Button disabled={!dirty || saving} onClick={() => setDraft(structuredClone(settings))}>Discard</Button>
            <Button variant="primary" disabled={!dirty || saving} onClick={save}>Save changes</Button>
          </>
        }
      />

      <Card title="Appearance and help" className="mb-4">
        <div className="divide-y divide-line">
          <Row label="Quick tour" hint="A 30-second walkthrough of how DropSort works.">
            <Button onClick={() => setTourOpen(true)}>Show tour</Button>
          </Row>
          <Row label="Theme" hint="Follow macOS, or choose light or dark.">
            <select className={selectCls} value={draft.theme} onChange={(e) => set('theme', e.target.value)} aria-label="Theme">
              <option value="system">Match system</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </Row>
        </div>
      </Card>

      <Card title="Scanning" className="mb-4">
        <div className="divide-y divide-line">
          <Row label="Scan subfolders by default" hint="Off by default. You can still change it per scan.">
            <input type="checkbox" checked={draft.recursiveScan} onChange={(e) => set('recursiveScan', e.target.checked)} aria-label="Scan subfolders by default" />
          </Row>
          <Row label="Include hidden files by default" hint="Files whose names start with a dot.">
            <input type="checkbox" checked={draft.includeHidden} onChange={(e) => set('includeHidden', e.target.checked)} aria-label="Include hidden files by default" />
          </Row>
        </div>
      </Card>

      <Card title="Organizing" className="mb-4">
        <div className="divide-y divide-line">
          <Row label="When a file name already exists" hint="Files are never overwritten.">
            <select className={selectCls} value={draft.conflictPolicy} onChange={(e) => set('conflictPolicy', e.target.value)} aria-label="Conflict policy">
              <option value="rename">Rename: file (1).ext</option>
              <option value="skip">Skip the file</option>
            </select>
          </Row>
          <Row label="Default sorting style" hint="How files are arranged inside the destination.">
            <select className={selectCls} value={draft.layout} onChange={(e) => set('layout', e.target.value)} aria-label="Default sorting style">
              {LAYOUT_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
            </select>
          </Row>
          <Row label="Default destination" hint="How the destination folder is chosen.">
            <select className={selectCls} value={draft.destinationMode} onChange={(e) => set('destinationMode', e.target.value)} aria-label="Default destination">
              <option value="choose">Choose each time</option>
              <option value="remember">Start in my last destination</option>
              <option value="in-place">Organize in place</option>
            </select>
          </Row>
        </div>
      </Card>

      <Card title="Sorting rules & extensions">
        <div className="divide-y divide-line">
          <Row label="File Categories" hint="Edit which file extensions go into each folder.">
            <Button onClick={() => navigate('categories')}>Manage Categories</Button>
          </Row>
          <Row label="Smart Rules" hint="Send files matching a name, size, or age to custom folders.">
            <Button onClick={() => navigate('rules')}>Manage Smart Rules</Button>
          </Row>
        </div>
      </Card>
    </div>
  );
}
