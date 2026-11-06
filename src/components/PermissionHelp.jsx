import { useApp } from '../hooks/AppContext.jsx';
import Button from './Button.jsx';

// Shown when macOS blocked access to a folder.
export function isPermissionError(message) {
  return typeof message === 'string' && message.startsWith('Permission denied');
}

export default function PermissionHelp() {
  const { openPrivacy } = useApp();
  return (
    <div className="mt-3 rounded-xl border border-warn/40 bg-warn/10 p-4 text-sm" role="alert">
      <div className="font-semibold">macOS is blocking access to this folder</div>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">
        <li>Open <strong className="text-ink">Files and Folders</strong> and switch on the folder (Downloads, Desktop, Documents...) for DropSort.</li>
        <li>If it is not listed, give DropSort <strong className="text-ink">Full Disk Access</strong> instead.</li>
        <li>Come back and press Scan again.</li>
      </ol>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => openPrivacy('files')}>Open Files and Folders</Button>
        <Button onClick={() => openPrivacy('disk')}>Open Full Disk Access</Button>
      </div>
    </div>
  );
}
