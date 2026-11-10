import { useEffect, useRef, useState } from 'react';
import { useApp } from './hooks/AppContext.jsx';
import { hasApi } from './utils/api.js';
import Sidebar from './components/Sidebar.jsx';
import Toasts from './components/Toasts.jsx';
import Onboarding from './components/Onboarding.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Organizer from './pages/Organizer.jsx';
import ScanResults from './pages/ScanResults.jsx';
import Preview from './pages/Preview.jsx';
import Summary from './pages/Summary.jsx';
import SmartRules from './pages/SmartRules.jsx';
import Categories from './pages/Categories.jsx';
import Duplicates from './pages/Duplicates.jsx';
import History from './pages/History.jsx';
import Settings from './pages/Settings.jsx';

const PAGES = {
  dashboard: Dashboard,
  organizer: Organizer,
  results: ScanResults,
  preview: Preview,
  summary: Summary,
  rules: SmartRules,
  categories: Categories,
  duplicates: Duplicates,
  history: History,
  settings: Settings,
};

export default function App() {
  const { page, navigate, settings, loadError, toasts, pickSource, dropFolder, scanning } = useApp();
  const Page = PAGES[page] || Dashboard;
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);

  // Keyboard shortcuts: Cmd/Ctrl+O choose a folder, Cmd/Ctrl+, open settings.
  useEffect(() => {
    const onKey = async (e) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === 'o') {
        e.preventDefault();
        if (!scanning && (await pickSource())) navigate('organizer');
      } else if (e.key === ',') {
        e.preventDefault();
        navigate('settings');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pickSource, navigate, scanning]);

  // Drag a folder anywhere onto the window.
  useEffect(() => {
    const hasFiles = (e) => Array.from(e.dataTransfer?.types || []).includes('Files');
    const onEnter = (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current += 1;
      setDragging(true);
    };
    const onOver = (e) => hasFiles(e) && e.preventDefault();
    const onLeave = () => {
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setDragging(false);
    };
    const onDrop = (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current = 0;
      setDragging(false);
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) dropFolder(file);
    };
    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragover', onOver);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [dropFolder]);

  if (!hasApi) {
    return (
      <div className="flex h-full items-center justify-center p-10 text-center">
        <div>
          <h1 className="text-xl font-semibold">DropSort needs to run inside its desktop window</h1>
          <p className="mt-2 text-sm text-muted">Start it with <code>npm run dev</code> instead of opening this page in a browser.</p>
        </div>
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center p-10 text-center">
        <div>
          <h1 className="text-xl font-semibold">DropSort could not load its settings</h1>
          <p className="mt-2 text-sm text-muted">{loadError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <Sidebar />
      <div className="drag absolute left-60 right-0 top-0 h-9" aria-hidden="true" />
      <main className="min-w-0 flex-1 overflow-y-auto px-8 pb-10 pt-12">
        {settings ? <div key={page} className="page-enter"><Page /></div> : <p className="text-muted">Loading...</p>}
      </main>
      <Toasts toasts={toasts} />
      {settings && <Onboarding />}
      {dragging && (
        <div className="no-drag pointer-events-none fixed inset-0 z-[80] flex items-center justify-center bg-accent/15 p-8 backdrop-blur-sm">
          <div className="pop-in rounded-3xl border-2 border-dashed border-accent bg-surface px-12 py-10 text-center shadow-2xl">
            <div className="text-5xl" aria-hidden="true">📂</div>
            <div className="mt-3 text-xl font-semibold">Drop a folder to organize it</div>
            <div className="mt-1 text-sm text-muted">DropSort will not move anything until you review a preview.</div>
          </div>
        </div>
      )}
    </div>
  );
}
