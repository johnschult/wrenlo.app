-- Migration 002: Add owner notification and handoff fields

ALTER TABLE businesses ADD COLUMN owner_name TEXT;
ALTER TABLE businesses ADD COLUMN owner_notification_webhook TEXT;
ALTER TABLE businesses ADD COLUMN owner_notification_email TEXT;
ALTER TABLE businesses ADD COLUMN handoff_keywords TEXT NOT NULL DEFAULT '["book","schedule","appointment","price quote","how much","availability","when can"]';

ALTER TABLE conversations ADD COLUMN claimed_by TEXT;
ALTER TABLE conversations ADD COLUMN claimed_at TEXT;
ALTER TABLE conversations ADD COLUMN lead_score INTEGER NOT NULL DEFAULT 0;
ALTER TABLE conversations ADD COLUMN notified_at TEXT;
