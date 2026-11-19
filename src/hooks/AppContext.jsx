import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api } from '../utils/api.js';
import { ruleFromPreset } from '../utils/rulePresets.js';

export const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

const newJobId = () => (crypto.randomUUID ? crypto.randomUUID() : `job-${Date.now()}-${Math.random().toString(16).slice(2)}`);

function applyTheme(theme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.classList.toggle('light', theme === 'light');
}

export function AppProvider({ children }) {
  const [page, setPage] = useState('dashboard');
  const [settings, setSettings] = useState(null);
  const [defaultCategories, setDefaultCategories] = useState({});
  const [loadError, setLoadError] = useState(null);

  // Workflow state: select -> scan -> preview -> organize -> results
  const [sourceFolder, setSourceFolder] = useState(null);
  const [scanOptions, setScanOptions] = useState({ recursive: false, includeHidden: false });
  const [destination, setDestination] = useState({ mode: 'separate', path: null });
  const [conflictPolicy, setConflictPolicy] = useState('rename');
  const [layout, setLayout] = useState('type');
  const [tourOpen, setTourOpen] = useState(false);
  const [scan, setScan] = useState(null);
  const [scanning, setScanning] = useState(null); // { jobId }
  const [scanError, setScanError] = useState(null);
  const [excluded, setExcluded] = useState(() => new Set());
  const [plan, setPlan] = useState(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState(null);
  const [organizing, setOrganizing] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [dupes, setDupes] = useState(null);       // { scanId, ...result }
  const [dupeJob, setDupeJob] = useState(null);   // { jobId }
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [progress, setProgress] = useState({});
  const [toasts, setToasts] = useState([]);
  const toastId = useRef(0);
  const toastTimers = useRef(new Set());

  const toast = useCallback((message, kind = 'info') => {
    const id = (toastId.current += 1);
    setToasts((t) => [...t.slice(-3), { id, message, kind }]);
    const timer = setTimeout(() => {
      toastTimers.current.delete(timer);
      setToasts((t) => t.filter((x) => x.id !== id));
    }, kind === 'error' ? 7000 : 3500);
    toastTimers.current.add(timer);
  }, []);

  // ---- startup: settings + progress events ---------------------------------
  useEffect(() => {
    if (!api) return undefined;
    api
      .getSettings()
      .then(({ settings: s, defaultCategories: d }) => {
        setSettings(s);
        setDefaultCategories(d);
        applyTheme(s.theme);
        setScanOptions({ recursive: s.recursiveScan, includeHidden: s.includeHidden });
        setConflictPolicy(s.conflictPolicy);
        setLayout(s.layout);
        setTourOpen(!s.onboarded);
        setDestination((cur) => ({ ...cur, mode: s.destinationMode === 'in-place' ? 'in-place' : 'separate' }));
      })
      .catch((err) => setLoadError(err.message));
    const unsub = api.onProgress((ev) => setProgress((p) => ({ ...p, [ev.type]: ev })));
    const timers = toastTimers.current;
    return () => {
      unsub();
      for (const t of timers) clearTimeout(t);
      timers.clear();
    };
  }, []);

  const resetWorkflowResults = useCallback(() => {
    setScan(null);
    setPlan(null);
    setPlanError(null);
    setDupes(null);
    setExcluded(new Set());
    setCategoryFilter('All');
  }, []);

  // ---- folders ---------------------------------------------------------------
  const adoptSource = useCallback(
    (picked) => {
      if (picked !== sourceFolder) resetWorkflowResults();
      setSourceFolder(picked);
      return picked;
    },
    [sourceFolder, resetWorkflowResults]
  );

  // startIn: optional 'downloads' | 'desktop' | 'documents' to open the picker right there.
  const pickSource = useCallback(
    async (startIn) => {
      try {
        const res = await api.selectFolder('source', typeof startIn === 'string' ? startIn : undefined);
        return res ? adoptSource(res.path) : null; // null = cancelled
      } catch (err) {
        toast(err.message, 'error');
        return null;
      }
    },
    [adoptSource, toast]
  );

  // A folder dragged onto the window.
  const dropFolder = useCallback(
    async (file) => {
      try {
        const res = await api.dropFolder(file);
        adoptSource(res.path);
        setPage('organizer');
        toast('Folder ready. Choose a destination and scan it.', 'success');
      } catch (err) {
        toast(err.message, 'error');
      }
    },
    [adoptSource, toast]
  );

  const pickDestination = useCallback(async () => {
    try {
      const res = await api.selectFolder('destination');
      if (!res) return null;
      setDestination({ mode: 'separate', path: res.path });
      setPlan(null);
      return res.path;
    } catch (err) {
      toast(err.message, 'error');
      return null;
    }
  }, [toast]);

  const setDestinationMode = useCallback((mode) => {
    setDestination((d) => ({ ...d, mode }));
    setPlan(null);
  }, []);

  const runJob = useCallback(
    async ({ key, active, setJob, onError, task, onSuccess }) => {
      if (active) return;
      const jobId = newJobId();
      setJob({ jobId });
      setProgress((p) => ({ ...p, [key]: null }));
      try {
        const res = await task(jobId);
        onSuccess(res);
      } catch (err) {
        if (onError) onError(err.message);
        toast(err.message, 'error');
      } finally {
        setJob(null);
        setProgress((p) => ({ ...p, [key]: null }));
      }
    },
    [toast]
  );

  // ---- scanning --------------------------------------------------------------
  const runScan = useCallback(async () => {
    if (!sourceFolder) return;
    setScanError(null);
    await runJob({
      key: 'scan',
      active: scanning,
      setJob: setScanning,
      onError: setScanError,
      task: (jobId) => api.scanFolder(sourceFolder, { ...scanOptions, jobId }),
      onSuccess: (res) => {
        if (res.cancelled) return toast('Scan cancelled.');
        setScan(res);
        setPlan(null);
        setPlanError(null);
        setDupes(null);
        setExcluded(new Set());
        setCategoryFilter('All');
        toast(`Scan complete: ${res.files.length.toLocaleString()} files found.`, 'success');
      },
    });
  }, [sourceFolder, scanning, scanOptions, runJob, toast]);

  const cancelJob = useCallback((jobId) => {
    if (jobId) api.cancelJob(jobId).catch(() => {});
  }, []);

  // ---- selection (shared by Scan Results and Preview) -----------------------
  const toggleExcluded = useCallback((id) => {
    setExcluded((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const setExcludedMany = useCallback((ids, isExcluded) => {
    setExcluded((cur) => {
      const next = new Set(cur);
      for (const id of ids) {
        if (isExcluded) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, []);

  // ---- preview ---------------------------------------------------------------
  const loadPreview = useCallback(async () => {
    if (!scan) return;
    if (destination.mode === 'separate' && !destination.path) {
      setPlan(null);
      return;
    }
    setPlanLoading(true);
    setPlanError(null);
    try {
      const res = await api.previewOrganization(scan.scanId, {
        destinationMode: destination.mode,
        destinationRoot: destination.path,
        conflictPolicy,
        layout,
      });
      setPlan(res);
    } catch (err) {
      setPlan(null);
      setPlanError(err.message);
    } finally {
      setPlanLoading(false);
    }
  }, [scan, destination, conflictPolicy, layout]);

  // ---- organize --------------------------------------------------------------
  const runOrganize = useCallback(async () => {
    if (!plan || organizing) return null;
    setOrganizing(true);
    setProgress((p) => ({ ...p, organize: null }));
    try {
      const res = await api.organize(plan.planId, { excludedItemIds: [...excluded] });
      setLastResult(res);
      resetWorkflowResults(); // the scan is stale now that files moved
      setPage('summary');
      return res;
    } catch (err) {
      toast(err.message, 'error');
      return null;
    } finally {
      setOrganizing(false);
    }
  }, [plan, organizing, excluded, resetWorkflowResults, toast]);

  // ---- duplicates ------------------------------------------------------------
  const runDuplicates = useCallback(async () => {
    if (!scan) return;
    await runJob({
      key: 'duplicates',
      active: dupeJob,
      setJob: setDupeJob,
      task: (jobId) => api.findDuplicates(scan.scanId, { jobId }),
      onSuccess: (res) => {
        if (res.cancelled) toast('Duplicate search cancelled.');
        else setDupes({ scanId: scan.scanId, ...res });
      },
    });
  }, [scan, dupeJob, runJob, toast]);

  // ---- settings --------------------------------------------------------------
  const saveSettings = useCallback(
    async (data) => {
      const { settings: saved } = await api.saveSettings(data);
      setSettings(saved);
      applyTheme(saved.theme);
      if ((data.categories || data.rules) && scan) {
        try {
          const { categories } = await api.recategorizeScan(scan.scanId);
          setScan((cur) =>
            cur
              ? { ...cur, files: cur.files.map((f) => ({ ...f, category: categories[f.id]?.category ?? f.category, ruleId: categories[f.id] ? categories[f.id].ruleId : f.ruleId })) }
              : cur
          );
          setPlan(null);
        } catch {
          /* the scan expired; the user will rescan */
        }
      }
      return saved;
    },
    [scan]
  );

  const addPreset = useCallback(
    async (preset) => {
      try {
        await saveSettings({ rules: [...settings.rules, ruleFromPreset(preset)] });
        toast(`Rule added: ${preset.name}.`, 'success');
      } catch (err) {
        toast(err.message, 'error');
      }
    },
    [settings, saveSettings, toast]
  );

  const finishTour = useCallback(async () => {
    setTourOpen(false);
    if (settings && !settings.onboarded) {
      try {
        await saveSettings({ onboarded: true });
      } catch {
        /* not critical */
      }
    }
  }, [settings, saveSettings]);

  const runAction = useCallback((fn) => fn().catch((err) => toast(err.message, 'error')), [toast]);

  const exportCsv = useCallback(
    (kind, id, options) => runAction(async () => {
      if (await api.exportCsv(kind, id, options)) toast('Spreadsheet saved.', 'success');
    }),
    [runAction, toast]
  );
  const openPrivacy = useCallback((pane) => runAction(() => api.openPrivacySettings(pane)), [runAction]);
  const reveal = useCallback((p) => runAction(() => api.revealInFinder(p)), [runAction]);

  const value = {
    page, navigate: setPage, settings, defaultCategories, loadError, saveSettings,
    sourceFolder, scanOptions, setScanOptions, destination, setDestinationMode, conflictPolicy, setConflictPolicy,
    layout, setLayout, pickSource, dropFolder, pickDestination, addPreset, tourOpen, setTourOpen, finishTour, exportCsv,
    scan, scanning, scanError, runScan, cancelJob,
    excluded, toggleExcluded, setExcludedMany,
    plan, planLoading, planError, loadPreview,
    organizing, runOrganize, lastResult,
    dupes, dupeJob, runDuplicates,
    categoryFilter, setCategoryFilter,
    progress, toast, toasts, reveal, openPrivacy,
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
