import { randomUUID } from 'crypto';
import { desc, eq, sql } from 'drizzle-orm';
import { db, sqlite } from '../db';
import {
  businesses,
  conversations,
  customers,
  messages,
  type Business,
  type Conversation,
  type Customer,
  type DbMessage,
} from '../db/schema';

// ── Businesses ────────────────────────────────────────────────────────────────

export function getBusinessById(id: string): Business | null {
  return db.select().from(businesses).where(eq(businesses.id, id)).get() ?? null;
}

export function getBusinessesByClerkUserId(clerkUserId: string): Business[] {
  return db
    .select()
    .from(businesses)
    .where(eq(businesses.clerkUserId, clerkUserId))
    .orderBy(desc(businesses.updatedAt))
    .all();
}

export function upsertBusiness(
  id: string,
  name: string,
  systemPrompt: string,
  opts?: { clerkUserId?: string; ownerName?: string; ownerEmail?: string }
): Business {
  db.insert(businesses)
    .values({
      id,
      name,
      systemPrompt,
      clerkUserId: opts?.clerkUserId ?? null,
      ownerName: opts?.ownerName ?? null,
      ownerNotificationEmail: opts?.ownerEmail ?? null,
    })
    .onConflictDoUpdate({
      target: businesses.id,
      set: {
        name,
        systemPrompt,
        clerkUserId: opts?.clerkUserId,
        ownerName: opts?.ownerName,
        ownerNotificationEmail: opts?.ownerEmail,
        updatedAt: sql`(datetime('now'))`,
      },
    })
    .run();
  return getBusinessById(id)!;
}

// ── Customers ─────────────────────────────────────────────────────────────────

export function getOrCreateCustomer(businessId: string, identifier: string): Customer {
  const existing = db
    .select()
    .from(customers)
    .where(eq(customers.businessId, businessId))
    .get();

  if (existing) return existing;

  const id = randomUUID();
  db.insert(customers).values({ id, businessId, identifier }).run();
  return db.select().from(customers).where(eq(customers.id, id)).get()!;
}

export function getCustomerById(id: string): Customer | null {
  return db.select().from(customers).where(eq(customers.id, id)).get() ?? null;
}

export function touchCustomerLastSeen(id: string): void {
  db.update(customers)
    .set({ lastSeenAt: sql`(datetime('now'))` })
    .where(eq(customers.id, id))
    .run();
}

export const touchCustomer = touchCustomerLastSeen;

export function incrementCustomerConversationCount(id: string): void {
  db.update(customers)
    .set({
      lastSeenAt: sql`(datetime('now'))`,
      conversationCount: sql`${customers.conversationCount} + 1`,
    })
    .where(eq(customers.id, id))
    .run();
}

// ── Conversations ─────────────────────────────────────────────────────────────

export function createConversation(
  businessId: string,
  customerId: string | null,
  channel: 'web' | 'sms' | 'voice'
): Conversation {
  const id = randomUUID();
  db.insert(conversations).values({ id, businessId, customerId, channel }).run();
  return db.select().from(conversations).where(eq(conversations.id, id)).get()!;
}

export function getConversationById(id: string): Conversation | null {
  return db.select().from(conversations).where(eq(conversations.id, id)).get() ?? null;
}

export function touchConversation(id: string): void {
  db.update(conversations)
    .set({ updatedAt: sql`(datetime('now'))` })
    .where(eq(conversations.id, id))
    .run();
}

export function setConversationStatus(id: string, status: string): void {
  db.update(conversations)
    .set({ status: status as Conversation['status'], updatedAt: sql`(datetime('now'))` })
    .where(eq(conversations.id, id))
    .run();
}

export function claimConversation(id: string, claimedBy: string): void {
  db.update(conversations)
    .set({
      status: 'handed_off',
      claimedBy,
      claimedAt: sql`(datetime('now'))`,
      updatedAt: sql`(datetime('now'))`,
    })
    .where(eq(conversations.id, id))
    .run();
}

export function releaseConversation(id: string): void {
  db.update(conversations)
    .set({
      status: 'active',
      claimedBy: null,
      claimedAt: null,
      updatedAt: sql`(datetime('now'))`,
    })
    .where(eq(conversations.id, id))
    .run();
}

export function updateConversationLeadScore(id: string, score: number): void {
  db.update(conversations)
    .set({ leadScore: score, updatedAt: sql`(datetime('now'))` })
    .where(eq(conversations.id, id))
    .run();
}

export function markConversationNotified(id: string): void {
  db.update(conversations)
    .set({ notifiedAt: sql`(datetime('now'))`, updatedAt: sql`(datetime('now'))` })
    .where(eq(conversations.id, id))
    .run();
}

// ── Messages ──────────────────────────────────────────────────────────────────

export function addMessage(
  conversationId: string,
  role: DbMessage['role'],
  content: string
): void {
  db.insert(messages).values({ id: randomUUID(), conversationId, role, content }).run();
}

export function getConversationMessages(conversationId: string, limit = 40): DbMessage[] {
  return sqlite
    .prepare(
      `SELECT * FROM (
         SELECT * FROM messages WHERE conversation_id = ?
         ORDER BY created_at DESC LIMIT ?
       ) ORDER BY created_at ASC`
    )
    .all(conversationId, limit) as DbMessage[];
}

// ── Owner Dashboard ───────────────────────────────────────────────────────────

export interface ConversationWithCustomer extends Conversation {
  customer_identifier: string | null;
  customer_name: string | null;
  customer_vehicle: string | null;
  customer_conversation_count: number | null;
  last_message: string | null;
  last_message_role: string | null;
  last_message_at: string | null;
}

export function getBusinessConversations(
  businessId: string,
  limit = 100
): ConversationWithCustomer[] {
  return sqlite
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
       LIMIT ?`
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
  return sqlite
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status IN ('active','handed_off') THEN 1 ELSE 0 END) AS active,
         SUM(CASE WHEN lead_score >= 3 AND status IN ('active','handed_off') THEN 1 ELSE 0 END) AS hot_leads,
         SUM(CASE WHEN date(started_at) = date('now') THEN 1 ELSE 0 END) AS today
       FROM conversations
       WHERE business_id = ?`
    )
    .get(businessId) as BusinessStats;
}

export function getCustomerConversations(customerId: string): Conversation[] {
  return db
    .select()
    .from(conversations)
    .where(eq(conversations.customerId, customerId))
    .orderBy(desc(conversations.startedAt))
    .all();
}

// Re-export types consumers need
export type { Business, Customer, Conversation, DbMessage };
