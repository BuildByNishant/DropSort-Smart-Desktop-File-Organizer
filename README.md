# DropSort

<p align="center">
  <strong>Smart, offline desktop file organizer for macOS.</strong><br>
  Organize cluttered Downloads, Desktop, and project folders with zero risk of data loss.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-macOS%20(Apple%20Silicon)-black?logo=apple" alt="Platform macOS">
  <img src="https://img.shields.io/badge/Electron-45-47848F?logo=electron" alt="Electron">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" alt="React">
  <img src="https://img.shields.io/badge/TailwindCSS-v4-38B2AC?logo=tailwindcss" alt="Tailwind CSS">
  <img src="https://img.shields.io/badge/Database-SQLite-003B57?logo=sqlite" alt="SQLite">
  <img src="https://img.shields.io/badge/Tests-51%20Passing-success" alt="Tests">
  <img src="https://img.shields.io/badge/License-MIT-blue" alt="License MIT">
</p>

---

## Why DropSort?

Most file organizers move or delete files blindly. **DropSort is built around "Safety First"**:

- **Preview Before Moving**: Inspect the exact destination path, folder layout, and conflict resolution for every file before anything changes on disk.
- **Zero Overwrites or Deletions**: Existing files are safely renamed (`file (1).pdf`) or skipped. Same-disk moves use atomic hard-link + unlink; cross-disk moves copy to a temp file, verify size & SHA-256 checksum, publish without overwriting, and only then remove the source.
- **Full Undo History**: Every session and file move is logged in a local SQLite database (`~/Library/Application Support/DropSort/dropsort.db`). Restore a single file or an entire session at any time—never overwriting if the original path is now occupied.
- **100% Local & Offline**: Runs completely on your Mac with no telemetry or network calls.

---

## Key Features

| Feature | Description |
|---|---|
| **Smart Rules Engine** | Match files by name (`contains`, `starts with`, `ends with`), extension, size (MB), or age (days) to route them before default category sorting. |
| **Flexible Sorting Layouts** | Arrange files `By type`, `By type, then month`, `By type, then year`, `By year`, or `By month`. |
| **Editable Categories** | Customize extension-to-folder mappings directly on the **Categories** page with instant scan recategorization. |
| **Exact Duplicate Finder** | Groups files by size first, then compares streaming SHA-256 hashes—never deleting anything automatically. |
| **Folder Clutter Insights** | Displays a clutter score, storage breakdown by category, top 5 largest files, and one-click rule suggestions. |
| **Session History & Undo** | Filterable audit log per session with single-file undo, full-session undo, and **Show in Finder**. |
| **Sanitized CSV Export** | Export preview plans or full history sessions to spreadsheet-safe CSV files (with formula-injection neutralization). |

---

## Install from `.dmg` (End Users)

1. Download **`DropSort-1.0.0-arm64.dmg`** from [Releases](../../releases/latest).
2. Double-click the `.dmg` file and drag **DropSort** into **Applications**.
3. Launch DropSort from **Applications** or Spotlight (`⌘ Space`).

> **Unsigned macOS Build (Gatekeeper):**  
> Because this open-source build is not notarized with an Apple Developer ID, macOS may block the first launch:
> - **Option A (Finder)**: Right-click `/Applications/DropSort.app` -> **Open** -> **Open**.
> - **Option B (Terminal)**: Clear the quarantine attribute:
>   ```bash
>   xattr -cr /Applications/DropSort.app
>   ```

---

## Step-by-Step User Guide

### Main Organize Workflow
1. **Pick a Source Folder**: From **Dashboard** or **Organizer**, click **Downloads**, **Desktop**, **Documents**, **Choose folder...** (`⌘O`), or drag-and-drop any folder onto the window.
2. **Choose Destination & Sorting Style**:
   - Select **A separate folder** (recommended) or **Right inside the same folder** (in-place).
   - Pick a sorting style (`By type`, `By type, then month`, etc.) and toggle **Include files inside subfolders** or **Include hidden files** if needed.
3. **Scan & Inspect**: Click **Scan folder**. Review the clutter score, category breakdown, and file table on **Scan Results**, search/filter files, and untick any files you want to leave untouched.
4. **Preview the Plan**: Open **Preview** to verify every source -> destination path, conflict renames/skips, and new folders. Optionally click **Export CSV** to save the plan.
5. **Organize & Undo Anytime**: Click **Organize**, confirm the dialog, and watch real-time progress. After completion, inspect **Summary** or visit **History** later to reveal folders in Finder or undo individual files / entire sessions.

### Customizing Sorting & Checking Duplicates
- **Smart Rules**: Open **Smart Rules** to enable one-click presets (Screenshots, Invoices, Installers, Large files, Old files) or create prioritized custom rules. Rules run top-to-bottom before extension categories.
- **Categories**: Open **Categories** to add/remove file extensions or create new category folders; changes save immediately and update your current scan.
- **Duplicates**: Open **Duplicates** after any scan and click **Find Duplicates** to locate byte-identical copies and reveal them in Finder.
- **macOS Folder Permissions**: If macOS denies access (`Permission denied`), use the inline **Open Files and Folders** or **Open Full Disk Access** buttons shown by DropSort, grant permission, and click **Scan** again.

---

## Developer Step-by-Step Guide

### Prerequisites
- macOS 12 Monterey or later
- Node.js LTS (v20+ recommended)
- Xcode Command Line Tools:
  ```bash
  xcode-select --install
  ```

### Step 1: Clone & Install Dependencies
```bash
git clone https://github.com/BuiltByNishant/DropSort-Smart-Desktop-File-Organizer.git
cd DropSort-Smart-Desktop-File-Organizer
npm install
```

### Step 2: Run in Development or Production Mode
```bash
# Start Vite dev server + Electron with live reload
npm run dev

# Or build the Vite bundle and launch Electron directly
npm start
```

### Step 3: Run Tests & Verification
> **Note on `better-sqlite3` native bindings:**  
> `npm install` builds `better-sqlite3` for your local Node version, whereas `npm run rebuild` (`electron-builder install-app-deps`) compiles it for Electron's ABI.
> - When compiled for **Node**, `npm test` runs **all 51 tests** (unit + SQLite + IPC integration).
> - When compiled for **Electron**, `npm test` runs the 37 pure-JS tests and automatically skips the 14 SQLite-backed tests until rebuilt for Node (`npm rebuild better-sqlite3`).

```bash
# 1. Run unit & integration test suite (51 tests total)
npm test

# 2. Run SSR smoke test across all 10 React pages & variants
npm run test:ui

# 3. Build production frontend bundle into dist/
npm run build
```

---

## Packaging & `.dmg` Commands

Make sure native dependencies match Electron before packaging:

```bash
# Rebuild native modules (better-sqlite3) for Electron
npm run rebuild
```

### Build `.dmg` Installer
```bash
# Build frontend (dist/) + package macOS .dmg installer into release/
npm run dist:mac
```
Output: `release/DropSort-1.0.0-arm64.dmg` (or `-x64.dmg` on Intel Macs).

### Additional `.dmg` & Build Commands
```bash
# Build an unsigned .dmg (skips Apple Developer certificate lookup in Keychain)
CSC_IDENTITY_AUTO_DISCOVERY=false npm run dist:mac

# Build for a specific Mac architecture or Universal binary (Apple Silicon + Intel)
npm run build && npx electron-builder --mac dmg --arm64
npm run build && npx electron-builder --mac dmg --x64
npm run build && npx electron-builder --mac dmg --universal

# Build an unpacked .app bundle in release/mac-arm64/ (faster for local testing)
npm run dist:dir

# Open / mount the generated .dmg in Finder
open release/DropSort-*.dmg

# Strip quarantine flag if testing the packaged .app locally
xattr -cr release/mac*/DropSort.app
```

---

## Architecture & Security

- **Isolated Renderer**: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, and strict CSP in [index.html](index.html).
- **Hardened IPC Bridge**: [electron/preload.js](electron/preload.js) exposes only explicit channel wrappers; [electron/ipc/handlers.js](electron/ipc/handlers.js) validates every argument and restricts scanning/revealing to user-approved or recorded paths.
- **Embedded SQLite Storage**: Local schema in [electron/database/schema.sql](electron/database/schema.sql) opened in WAL mode with foreign keys enabled.

---

## Repository Structure

```text
electron/
  main.js                    # Electron lifecycle, single-instance lock, BrowserWindow
  preload.js                 # Context-isolated window.dropsort IPC bridge
  ipc/handlers.js            # Validated IPC channels & job cancellation
  database/
    db.js                    # SQLite connection & WAL setup
    schema.sql               # scans, organization_sessions, file_operations, settings
  services/
    scanner.js               # Cancellable folder scanner (skips symlinks & partial downloads)
    categorizer.js           # Extension categories, compiled Smart Rules, layout segments
    organizer.js             # Dry-run planner & non-overwrite move/copy-verify engine
    duplicateDetector.js     # Size-grouped streaming SHA-256 duplicate finder
    history.js               # Session/operation logging, dashboard stats, safe undo
    settings.js              # Schema-validated settings persistence
    exporter.js              # Formula-safe CSV export
    hash.js                  # Streaming SHA-256 helper
    errors.js                # UserError & macOS-friendly errno mapping
src/
  App.jsx                    # Shell, keyboard shortcuts (⌘O, ⌘,), drag-and-drop overlay
  hooks/AppContext.jsx       # Shared workflow state, job runner, toasts, theme
  pages/                     # Dashboard, Organizer, ScanResults, Preview, Summary,
                             # SmartRules, Categories, Duplicates, History, Settings
  components/                # Reusable UI primitives, Sidebar, Stepper, InsightsPanel, Onboarding
  utils/                     # Categories/constants, formatting, insights, layouts, presets
tests/
  *.test.js                  # 51 node:test unit & IPC integration tests
  helpers.js                 # Temp fixtures & fake Electron IPC harness
  ui-smoke.mjs               # Vite SSR smoke test for all pages & insight logic
build/icon.png               # Application icon
```

---

## License

Distributed under the MIT License. See `package.json` for details.
