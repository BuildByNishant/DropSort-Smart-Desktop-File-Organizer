-- DropSort local database (stored in Electron's userData folder).

CREATE TABLE IF NOT EXISTS scans (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  source_folder    TEXT    NOT NULL,
  destination_root TEXT    NOT NULL,
  total_files      INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS organization_sessions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  scan_id       INTEGER NOT NULL REFERENCES scans(id),
  total_planned INTEGER NOT NULL DEFAULT 0,
  total_moved   INTEGER NOT NULL DEFAULT 0,
  total_skipped INTEGER NOT NULL DEFAULT 0,
  total_failed  INTEGER NOT NULL DEFAULT 0,
  status        TEXT    NOT NULL CHECK (status IN ('completed', 'partial', 'failed', 'cancelled')),
  created_at    TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS file_operations (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id       INTEGER NOT NULL REFERENCES organization_sessions(id),
  original_path    TEXT    NOT NULL,
  destination_path TEXT    NOT NULL,
  file_name        TEXT    NOT NULL,
  file_size        INTEGER,
  status           TEXT    NOT NULL CHECK (status IN ('moved', 'failed', 'skipped', 'reversed')),
  error_message    TEXT,
  category         TEXT,
  created_at       TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  setting_key   TEXT NOT NULL UNIQUE,
  setting_value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_scan      ON organization_sessions(scan_id);
CREATE INDEX IF NOT EXISTS idx_ops_session        ON file_operations(session_id);
CREATE INDEX IF NOT EXISTS idx_ops_status         ON file_operations(status);
