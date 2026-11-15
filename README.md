# DropSort

<p align="center">
  <strong>Smart, offline desktop file organizer for macOS.</strong><br>
  Organize cluttered Downloads, Desktop, and project directories with zero risk of data loss.
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

## 💡 Why DropSort?

Most desktop file organizers operate like a black box: they move or delete files automatically, occasionally breaking paths or losing important work. 

**DropSort is built on a "Safety First" philosophy**:
- **Always Preview First**: See the exact destination path of every file before any operation begins.
- **Never Overwrite or Delete**: Conflicts are safely renamed (`file (1).pdf`) or skipped. Originals remain intact.
- **Full Undo History**: Every move is recorded in a local SQLite database. Revert a single file or an entire organization session with one click.
- **100% Private & Offline**: Works entirely on your local machine with zero external network requests.

---

## 📥 Download & Installation

DropSort is available as a standalone desktop installer for macOS (Apple Silicon M1/M2/M3/M4):

### [⬇️ Download DropSort-1.0.0-arm64.dmg](../../releases/latest)

### Quick Setup:
1. Download **`DropSort-1.0.0-arm64.dmg`** from the [Releases](../../releases/latest) section.
2. Open the `.dmg` file and drag **DropSort** into your **Applications** folder.
3. Open DropSort from Applications or Spotlight (`⌘ Space`).

> **Note for macOS:**  
> Because this is a free open-source build without a paid Apple Developer certificate, macOS Gatekeeper may prompt you on first launch:
> - **Option 1**: Right-click `DropSort.app` in Applications and choose **Open**.
> - **Option 2**: In Terminal, run:
>   ```bash
>   xattr -cr /Applications/DropSort.app
>   ```

---

## ⚡ Key Features

| Feature | Description |
|---|---|
| **Smart Rules Engine** | Define custom rules (by filename pattern, extension, file size, or age) to direct files into designated folders before generic categorization. |
| **Flexible Sorting Layouts** | Organize by category (Documents, Images, Archives, Code, etc.), by category + date (`Documents/2026-11/`), or date-only folders. |
| **Exact Duplicate Finder** | Identifies identical files using quick size matching followed by byte-for-byte SHA-256 checksums. Review duplicates without risking accidental deletion. |
| **Folder Clutter Analytics** | Instantly visualize folder clutter scores, category breakdowns, and top space hogs. |
| **Session History & Instant Undo** | Complete transactional log of every session. Roll back moves safely whenever you need. |
| **Export to Spreadsheet** | Export file manifests, scan results, and history logs to sanitized CSV files. |
| **Native macOS Integration** | Drag-and-drop folders directly onto the window, use native file pickers, and enjoy macOS keyboard shortcuts (`⌘O`, `⌘,`). |

---

## 🔄 How It Works

```
 ┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
 │ 1. Choose    │ ──> │ 2. Scan &    │ ──> │ 3. Preview   │ ──> │ 4. Organize  │
 │    Folder    │     │    Inspect   │     │    Plan      │     │    & Undo    │
 └──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

1. **Select Folder**: Pick any folder (Downloads, Desktop, or external drives) or drag it into the app.
2. **Scan & Inspect**: Filter files by category, search names, toggle inclusions, and view clutter recommendations.
3. **Review Preview**: Inspect the proposed folder layout, conflicts, and renames before anything moves.
4. **Organize**: Watch real-time progress. Any operation can be immediately undone from the History page.

---

## 🛡️ Architecture & Security

DropSort adheres to strict desktop security and data integrity standards:

- **Isolated Renderer**: The UI runs with `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, and a strict Content Security Policy (CSP).
- **Hardened IPC Bridge**: The preload layer exposes only validated, explicit method handlers. Arbitrary file path execution from the renderer is prohibited.
- **Non-Destructive Move Strategy**: On the same disk, file relocations use atomic linking/non-overwrite semantics (`EEXIST` checks). Cross-disk operations employ verified copy-and-checksum before source cleanup.
- **Embedded SQLite Storage**: Sessions and audit logs are safely stored locally in `~/Library/Application Support/DropSort/dropsort.db`.

---

## 🛠️ Tech Stack

- **Runtime**: [Electron](https://www.electronjs.org/)
- **Frontend**: [React 19](https://react.dev/), [Vite](https://vitejs.dev/), [Tailwind CSS v4](https://tailwindcss.com/)
- **Database**: [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)
- **Packaging**: [electron-builder](https://www.electron.build/)
- **Testing**: Node.js built-in test runner (`node:test`)

---

## 💻 Developer Guide

### Prerequisites
- macOS 12 Monterey or later
- Node.js LTS (v20+ recommended)
- Xcode Command Line Tools (`xcode-select --install`)

### Local Setup

```bash
# Clone the repository
git clone https://github.com/BuiltByNishant/DropSort-Smart-Desktop-File-Organizer.git
cd DropSort-Smart-Desktop-File-Organizer

# Install dependencies
npm install

# Start Vite + Electron in development mode
npm run dev
```

### Testing & Verification

```bash
# Run unit & integration test suites (50+ tests covering scanner, rules, safety moves, undo)
npm test

# Run UI smoke test
npm run test:ui

# Build production bundle
npm run build

# Package local macOS installer (.dmg)
npm run dist:mac
```

---

## 📁 Repository Structure

```
electron/
  main.js                 # App lifecycle and window creation
  preload.js              # Secure IPC bridge
  ipc/handlers.js         # Validated IPC channels
  services/               # Scanner, organizer, categorizer, duplicates, history
  database/               # SQLite database connection and SQL schema
src/
  App.jsx                 # Main application layout and navigation
  pages/                  # Dashboard, Organizer, Preview, Smart Rules, History, Settings
  components/             # Reusable UI widgets (cards, steppers, modals, insights)
  hooks/AppContext.jsx    # Application context state
tests/                    # Comprehensive unit and integration test suites
build/icon.png            # Application icon asset
```

---

## 📄 License

Distributed under the MIT License. See `package.json` for details.
