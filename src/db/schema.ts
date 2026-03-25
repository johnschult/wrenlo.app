import { sql } from 'drizzle-orm';
import {
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const businesses = sqliteTable('businesses', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	systemPrompt: text('system_prompt').notNull().default(''),
	systemPromptEs: text('system_prompt_es').notNull().default(''),
	exampleQuestions: text('example_questions').notNull().default('[]'),
	exampleQuestionsEs: text('example_questions_es').notNull().default('[]'),
	ownerName: text('owner_name'),
	ownerNotificationWebhook: text('owner_notification_webhook'),
	ownerNotificationEmail: text('owner_notification_email'),
	handoffKeywords: text('handoff_keywords')
		.notNull()
		.default(
			'["book","schedule","appointment","price quote","how much","availability","when can"]',
		),
	clerkUserId: text('clerk_user_id'),
	clerkOrgId: text('clerk_org_id'),
	createdAt: text('created_at')
		.notNull()
		.default(sql`(datetime('now'))`),
	updatedAt: text('updated_at')
		.notNull()
		.default(sql`(datetime('now'))`),
});

export const customers = sqliteTable(
	'customers',
	{
		id: text('id').primaryKey(),
		businessId: text('business_id')
			.notNull()
			.references(() => businesses.id),
		identifier: text('identifier').notNull(),
		name: text('name'),
		vehicleInfo: text('vehicle_info'),
		notes: text('notes'),
		firstSeenAt: text('first_seen_at')
			.notNull()
			.default(sql`(datetime('now'))`),
		lastSeenAt: text('last_seen_at')
			.notNull()
			.default(sql`(datetime('now'))`),
		conversationCount: integer('conversation_count').notNull().default(0),
	},
	t => [
		uniqueIndex('customers_business_identifier_idx').on(
			t.businessId,
			t.identifier,
		),
	],
);

export const conversations = sqliteTable('conversations', {
	id: text('id').primaryKey(),
	businessId: text('business_id')
		.notNull()
		.references(() => businesses.id),
	customerId: text('customer_id').references(() => customers.id),
	channel: text('channel', { enum: ['web', 'sms', 'voice'] })
		.notNull()
		.default('web'),
	startedAt: text('started_at')
		.notNull()
		.default(sql`(datetime('now'))`),
	updatedAt: text('updated_at')
		.notNull()
		.default(sql`(datetime('now'))`),
	status: text('status', {
		enum: ['active', 'closed', 'handed_off', 'resolved'],
	})
		.notNull()
		.default('active'),
	claimedBy: text('claimed_by'),
	claimedAt: text('claimed_at'),
	leadScore: integer('lead_score').notNull().default(0),
	notifiedAt: text('notified_at'),
});

export const messages = sqliteTable('messages', {
	id: text('id').primaryKey(),
	conversationId: text('conversation_id')
		.notNull()
		.references(() => conversations.id),
	role: text('role', {
		enum: ['user', 'assistant', 'system', 'owner'],
	}).notNull(),
	content: text('content').notNull(),
	createdAt: text('created_at')
		.notNull()
		.default(sql`(datetime('now'))`),
});

// Inferred types
export type Business = typeof businesses.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type DbMessage = typeof messages.$inferSelect;
