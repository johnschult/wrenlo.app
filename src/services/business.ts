import Database from 'better-sqlite3';
import { readFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { config } from '../config.js';
import type { Business, Customer, Conversation, DbMessage } from '../types/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let db: Database.Database;

function getDb(): Database.Database {
  if (!db) {
    mkdirSync(dirname(config.dbPath), { recursive: true });
    db = new Database(config.dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

export function initDb(): void {
  const schema = readFileSync(`${__dirname}/../db/schema.sql`, 'utf-8');
  getDb().exec(schema);
  const migration001 = readFileSync(`${__dirname}/../db/migration_001.sql`, 'utf-8');
  getDb().exec(migration001);
  // Migration 002: run each statement individually — SQLite doesn't support
  // "ADD COLUMN IF NOT EXISTS", so we swallow duplicate-column errors.
  const migration002 = readFileSync(`${__dirname}/../db/migration_002.sql`, 'utf-8');
  const stmts = migration002.split(';').map((s) => s.trim()).filter((s) => s.length > 0);
  for (const stmt of stmts) {
    try {
      getDb().exec(stmt + ';');
    } catch (e: unknown) {
      if (!(e as Error).message?.includes('duplicate column')) throw e;
    }
  }
}

export function seedDb(): void {
  const seed = readFileSync(`${__dirname}/../db/seed.sql`, 'utf-8');
  getDb().exec(seed);
}

// ── Businesses ────────────────────────────────────────────────────────────────

export function getBusinessById(id: string): Business | null {
  const row = getDb()
    .prepare('SELECT * FROM businesses WHERE id = ?')
    .get(id) as Business | undefined;
  return row ?? null;
}

export function upsertBusiness(id: string, name: string, systemPrompt: string): Business {
  getDb()
    .prepare(
      `INSERT INTO businesses (id, name, system_prompt, created_at, updated_at)
       VALUES (?, ?, ?, datetime('now'), datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         system_prompt = excluded.system_prompt,
         updated_at = datetime('now')`,
    )
    .run(id, name, systemPrompt);

  return getBusinessById(id)!;
}

// ── Customers ─────────────────────────────────────────────────────────────────

export function getOrCreateCustomer(businessId: string, identifier: string): Customer {
  const existing = getDb()
    .prepare('SELECT * FROM customers WHERE business_id = ? AND identifier = ?')
    .get(businessId, identifier) as Customer | undefined;

  if (existing) return existing;

  const id = randomUUID();
  getDb()
    .prepare(
      `INSERT INTO customers (id, business_id, identifier, first_seen_at, last_seen_at)
       VALUES (?, ?, ?, datetime('now'), datetime('now'))`,
    )
    .run(id, businessId, identifier);

  return getDb()
    .prepare('SELECT * FROM customers WHERE id = ?')
    .get(id) as Customer;
}

export function getCustomerById(id: string): Customer | null {
  const row = getDb()
    .prepare('SELECT * FROM customers WHERE id = ?')
    .get(id) as Customer | undefined;
  return row ?? null;
}

export function touchCustomerLastSeen(id: string): void {
  getDb()
    .prepare(`UPDATE customers SET last_seen_at = datetime('now') WHERE id = ?`)
    .run(id);
}

/** Alias used by chat route for continuing-conversation touches */
export const touchCustomer = touchCustomerLastSeen;

export function incrementCustomerConversationCount(id: string): void {
  getDb()
    .prepare(
      `UPDATE customers
       SET last_seen_at = datetime('now'),
           conversation_count = conversation_count + 1
       WHERE id = ?`,
    )
    .run(id);
}

// ── Conversations ─────────────────────────────────────────────────────────────

export function createConversation(
  businessId: string,
  customerId: string | null,
  channel: 'web' | 'sms' | 'voice',
): Conversation {
  const id = randomUUID();
  getDb()
    .prepare(
      `INSERT INTO conversations (id, business_id, customer_id, channel, started_at, updated_at, status)
       VALUES (?, ?, ?, ?, datetime('now'), datetime('now'), 'active')`,
    )
    .run(id, businessId, customerId, channel);

  return getDb()
    .prepare('SELECT * FROM conversations WHERE id = ?')
    .get(id) as Conversation;
}

export function getConversationById(id: string): Conversation | null {
  const row = getDb()
    .prepare('SELECT * FROM conversations WHERE id = ?')
    .get(id) as Conversation | undefined;
  return row ?? null;
}

export function touchConversation(id: string): void {
  getDb()
    .prepare(`UPDATE conversations SET updated_at = datetime('now') WHERE id = ?`)
    .run(id);
}

export function getCustomerConversations(customerId: string): Conversation[] {
  return getDb()
    .prepare('SELECT * FROM conversations WHERE customer_id = ? ORDER BY started_at DESC')
    .all(customerId) as Conversation[];
}

// ── Messages ──────────────────────────────────────────────────────────────────

export function setConversationStatus(id: string, status: string): void {
  getDb()
    .prepare(`UPDATE conversations SET status = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(status, id);
}

export function claimConversation(id: string, claimedBy: string): void {
  getDb()
    .prepare(
      `UPDATE conversations
       SET status = 'handed_off', claimed_by = ?, claimed_at = datetime('now'), updated_at = datetime('now')
       WHERE id = ?`,
    )
    .run(claimedBy, id);
}

export function releaseConversation(id: string): void {
  getDb()
    .prepare(
      `UPDATE conversations
       SET status = 'active', claimed_by = NULL, claimed_at = NULL, updated_at = datetime('now')
       WHERE id = ?`,
    )
    .run(id);
}

export function updateConversationLeadScore(id: string, score: number): void {
  getDb()
    .prepare(
      `UPDATE conversations SET lead_score = ?, updated_at = datetime('now') WHERE id = ?`,
    )
    .run(score, id);
}

export function markConversationNotified(id: string): void {
  getDb()
    .prepare(
      `UPDATE conversations SET notified_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
    )
    .run(id);
}

export function addMessage(
  conversationId: string,
  role: 'user' | 'assistant' | 'system' | 'owner',
  content: string,
): void {
  getDb()
    .prepare(
      `INSERT INTO messages (id, conversation_id, role, content, created_at)
       VALUES (?, ?, ?, ?, datetime('now'))`,
    )
    .run(randomUUID(), conversationId, role, content);
}

export function getConversationMessages(conversationId: string, limit = 40): DbMessage[] {
  return getDb()
    .prepare(
      `SELECT * FROM (
         SELECT * FROM messages WHERE conversation_id = ?
         ORDER BY created_at DESC LIMIT ?
       ) ORDER BY created_at ASC`,
    )
    .all(conversationId, limit) as DbMessage[];
}

// ── Owner Dashboard ────────────────────────────────────────────────────────────

export interface ConversationWithCustomer extends Conversation {
  customer_identifier: string | null;
  customer_name: string | null;
  customer_vehicle: string | null;
  customer_conversation_count: number | null;
  last_message: string | null;
  last_message_role: string | null;
  last_message_at: string | null;
}

export function getBusinessConversations(businessId: string, limit = 100): ConversationWithCustomer[] {
  return getDb()
    .prepare(
      `SELECT
         c.*,
         cu.identifier        AS customer_identifier,
         cu.name              AS customer_name,
         cu.vehicle_info      AS customer_vehicle,
         cu.conversation_count AS customer_conversation_count,
         lm.content           AS last_message,
         lm.role              AS last_message_role,
         lm.created_at        AS last_message_at
       FROM conversations c
       LEFT JOIN customers cu ON c.customer_id = cu.id
       LEFT JOIN messages lm ON lm.id = (
         SELECT id FROM messages
         WHERE conversation_id = c.id
         ORDER BY created_at DESC LIMIT 1
       )
       WHERE c.business_id = ?
       ORDER BY c.updated_at DESC
       LIMIT ?`,
    )
    .all(businessId, limit) as ConversationWithCustomer[];
}

export interface BusinessStats {
  total: number;
  active: number;
  hot_leads: number;
  today: number;
}

export function getBusinessStats(businessId: string): BusinessStats {
  return getDb()
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status IN ('active','handed_off') THEN 1 ELSE 0 END) AS active,
         SUM(CASE WHEN lead_score >= 3 AND status IN ('active','handed_off') THEN 1 ELSE 0 END) AS hot_leads,
         SUM(CASE WHEN date(started_at) = date('now') THEN 1 ELSE 0 END) AS today
       FROM conversations
       WHERE business_id = ?`,
    )
    .get(businessId) as BusinessStats;
}
