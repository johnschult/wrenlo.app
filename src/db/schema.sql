CREATE TABLE IF NOT EXISTS businesses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
