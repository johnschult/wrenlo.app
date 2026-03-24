-- Migration 001: Add customers, conversations, and messages tables

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  identifier TEXT NOT NULL,
  name TEXT,
  vehicle_info TEXT,
  notes TEXT,
  first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  conversation_count INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (business_id) REFERENCES businesses(id),
  UNIQUE(business_id, identifier)
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  customer_id TEXT,
  channel TEXT NOT NULL DEFAULT 'web',
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'active',
  FOREIGN KEY (business_id) REFERENCES businesses(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);

CREATE INDEX IF NOT EXISTS idx_customers_business_identifier ON customers(business_id, identifier);
CREATE INDEX IF NOT EXISTS idx_conversations_customer ON conversations(customer_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
