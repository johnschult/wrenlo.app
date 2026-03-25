// Re-export Drizzle inferred types as the canonical row types
export type { Business, Conversation, Customer, DbMessage } from '../db/schema';

export type ConversationStatus =
	| 'active'
	| 'closed'
	| 'handed_off'
	| 'resolved';

export interface Message {
	role: 'user' | 'assistant';
	content: string;
}

export interface ChatRequest {
	businessId: string;
	message: string;
	conversationId?: string;
	customerId?: string;
	customerIdentifier?: string;
	channel?: 'web' | 'sms' | 'voice';
}

export interface ChatResponse {
	response: string;
	conversationId: string;
	customerId: string | null;
	status: ConversationStatus;
	handedOff: boolean;
	followUpQuestions?: string[];
}

export interface OwnerNotification {
	businessId: string;
	businessName: string;
	ownerName: string | null;
	conversationId: string;
	customerSummary: string;
	triggerReason: string;
	claimUrl: string;
	timestamp: string;
}

export interface HandoffEvent {
	conversationId: string;
	businessId: string;
	triggeredBy: 'lead_detected' | 'ai_signal' | 'owner_claim';
	timestamp: string;
	leadScore: number;
}

export interface LeadDetectionResult {
	isLead: boolean;
	leadScore: number;
	triggerReason: string;
	signals: string[];
}

export interface ClaimRequest {
	claimedBy?: string;
}

export interface OwnerMessageRequest {
	message: string;
	senderName?: string;
}

// ── Analyst Pipeline ──────────────────────────────────────────────────────────

export interface ExtractedBusinessData {
	businessName: string;
	businessType: string;
	services: Array<{ name: string; price: string | null }>;
	hours: string | null;
	bookingMethod: string | null;
	location: string | null;
	phone: string | null;
	email: string | null;
	tone: string | null;
	commonQuestions: string[];
	specialFeatures: string[];
	aboutText: string | null;
	sourceUrls: string[];
}

export interface AnalystSession {
	sessionId: string;
	extractedData: ExtractedBusinessData;
	systemPrompt: string;
	exampleQuestions: string[];
	refinementHistory: string[];
	previewMessages: Message[];
	businessId?: string;
	createdAt: string;
}
