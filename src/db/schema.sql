CREATE TABLE IF NOT EXISTS businesses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  system_prompt TEXT NOT NULL DEFAULT '',
  system_prompt_es TEXT NOT NULL DEFAULT '',
  example_questions TEXT NOT NULL DEFAULT '[]',
  example_questions_es TEXT NOT NULL DEFAULT '[]',
  owner_name TEXT,
  owner_notification_webhook TEXT,
  owner_notification_email TEXT,
  handoff_keywords TEXT NOT NULL DEFAULT '["book","schedule","appointment","price quote","how much","availability","when can"]',
  clerk_user_id TEXT,
  clerk_org_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

