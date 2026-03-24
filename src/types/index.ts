export type ConversationStatus = 'active' | 'closed' | 'handed_off' | 'resolved';

export interface Business {
  id: string;
  name: string;
  system_prompt: string;
  owner_name: string | null;
  owner_notification_webhook: string | null;
  owner_notification_email: string | null;
  handoff_keywords: string; // JSON-serialized string[]
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  business_id: string;
  identifier: string;
  name: string | null;
  vehicle_info: string | null;
  notes: string | null;
  first_seen_at: string;
  last_seen_at: string;
  conversation_count: number;
}

export interface Conversation {
  id: string;
  business_id: string;
  customer_id: string | null;
  channel: 'web' | 'sms' | 'voice';
  started_at: string;
  updated_at: string;
  status: ConversationStatus;
  claimed_by: string | null;
  claimed_at: string | null;
  lead_score: number;
  notified_at: string | null;
}

export interface DbMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system' | 'owner';
  content: string;
  created_at: string;
}

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

// ── Intake Pipeline ────────────────────────────────────────────────────────────

export interface IntakeQuestion {
  id: string;
  question: string;
  hint?: string;
}

export interface IntakeResponse {
  questionId: string;
  question: string;
  answer: string;
}

export interface IntakeSession {
  sessionId: string;
  businessType: string;
  questions: IntakeQuestion[];
  createdAt: string;
}

export interface IntakeStartRequest {
  businessType: string;
}

export interface IntakeStartResponse {
  sessionId: string;
  questions: IntakeQuestion[];
}

export interface IntakeCompleteRequest {
  sessionId: string;
  responses: Array<{ questionId: string; answer: string }>;
  businessId?: string;
  businessName?: string;
}

export interface IntakeCompleteResponse {
  systemPrompt: string;
  businessId?: string;
}
