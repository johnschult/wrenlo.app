import {
  addMessage,
  createConversation,
  getBusinessById,
  getConversationById,
  getConversationMessages,
  getCustomerById,
  getOrCreateCustomer,
  incrementCustomerConversationCount,
  markConversationNotified,
  touchConversation,
  touchCustomerLastSeen,
  updateConversationLeadScore,
} from '@/services/business';
import { detectLead } from '@/services/lead-detector';
import { chatWithFollowups } from '@/services/llm';
import { NotificationService } from '@/services/notifications';
import type { Conversation, Customer, Message } from '@/types';
import { type NextRequest, NextResponse } from 'next/server';

const MAX_HISTORY = 40;
const SUPPORTED_LANGUAGES = new Set(['en', 'es']);

type ChatImagePayload = {
  dataUrl: string;
  mimeType?: string;
};

function getLanguage(value: unknown): 'en' | 'es' {
  if (typeof value === 'string' && SUPPORTED_LANGUAGES.has(value)) {
    return value as 'en' | 'es';
  }
  return 'en';
}

function parseImagePayload(value: unknown): ChatImagePayload | null {
  if (value == null) return null;
  if (typeof value !== 'object') return null;

  const dataUrl = (value as { dataUrl?: unknown }).dataUrl;
  const mimeType = (value as { mimeType?: unknown }).mimeType;
  if (typeof dataUrl !== 'string' || dataUrl.length === 0) return null;
  if (mimeType != null && typeof mimeType !== 'string') return null;

  return { dataUrl, ...(mimeType ? { mimeType } : {}) };
}

function getVoiceInstruction(language: 'en' | 'es'): string {
  if (language === 'es') {
    return 'Voice requirement: Speak as the business in first-person plural ("nosotros", "nuestro"). Never refer to the business in third person (for example: "ellos", "la empresa", "el negocio") unless quoting the customer.';
  }

  return 'Voice requirement: Speak as the business in first-person plural ("we", "our", "us"). Never refer to the business in third person (for example: "they", "their", "the company", "the business") unless quoting the customer.';
}

function buildSystemPrompt(
  base: string,
  customer: Customer | null,
  language: 'en' | 'es'
): string {
  const voiceInstruction = getVoiceInstruction(language);
  if (!customer || customer.conversationCount === 0) {
    return `${base}\n\n[${voiceInstruction}]`;
  }
  const lines = ['This is a returning customer.'];
  if (customer.name) lines.push(`Their name is ${customer.name}.`);
  lines.push(
    `They have had ${customer.conversationCount} previous conversation(s) with us.`
  );
  lines.push(`Their last visit was on ${customer.lastSeenAt}.`);
  if (customer.vehicleInfo) {
    try {
      lines.push(
        `Vehicle on file: ${JSON.stringify(JSON.parse(customer.vehicleInfo))}.`
      );
    } catch {
      lines.push(`Vehicle info: ${customer.vehicleInfo}.`);
    }
  }
  return `${base}\n\n[${voiceInstruction}]\n\n[Customer context: ${lines.join(' ')}]`;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    businessId,
    message,
    conversationId,
    customerId,
    customerIdentifier,
    channel = 'web',
    language,
    image,
  } = body;
  const selectedLanguage = getLanguage(language);
  const imagePayload = parseImagePayload(image);

  if (image != null && !imagePayload) {
    return NextResponse.json(
      { error: 'Invalid image payload' },
      { status: 400 }
    );
  }

  if (!businessId || !message) {
    return NextResponse.json(
      { error: 'businessId and message are required' },
      { status: 400 }
    );
  }

  const business = getBusinessById(businessId);
  if (!business) {
    return NextResponse.json(
      { error: `Business '${businessId}' not found` },
      { status: 404 }
    );
  }

  // Resolve customer
  let customer: Customer | null = null;
  if (customerId) {
    customer = getCustomerById(customerId);
  } else if (customerIdentifier) {
    customer = getOrCreateCustomer(businessId, customerIdentifier);
  }

  // Resolve or create conversation
  let isNewConversation = false;
  let conversation: Conversation;
  if (conversationId) {
    const existingConversation = getConversationById(conversationId);
    if (!existingConversation) {
      return NextResponse.json(
        { error: `Conversation '${conversationId}' not found` },
        { status: 404 }
      );
    }
    conversation = existingConversation;
  } else {
    conversation = createConversation(
      businessId,
      customer?.id ?? null,
      channel
    );
    isNewConversation = true;
  }

  // Handoff passthrough
  if (conversation.status === 'handed_off') {
    addMessage(conversation.id, 'user', message);
    touchConversation(conversation.id);
    if (customer && !isNewConversation) touchCustomerLastSeen(customer.id);
    return NextResponse.json({
      response: 'Thanks — the owner has been notified and will reply shortly.',
      conversationId: conversation.id,
      customerId: customer?.id ?? null,
      status: conversation.status,
      handedOff: true,
    });
  }

  // Normal AI path
  const dbMessages = getConversationMessages(conversation.id, MAX_HISTORY);
  const history: Message[] = dbMessages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  const basePrompt = selectedLanguage === 'es'
    ? business.systemPromptEs
    : business.systemPrompt;
  const systemPrompt = buildSystemPrompt(basePrompt, customer, selectedLanguage);
  const { response: assistantResponse, followUpQuestions } =
    await chatWithFollowups(
      systemPrompt,
      history,
      message,
      1024,
      selectedLanguage,
      imagePayload ?? undefined
    );

  addMessage(conversation.id, 'user', message);
  addMessage(conversation.id, 'assistant', assistantResponse);
  touchConversation(conversation.id);

  if (customer) {
    if (isNewConversation) incrementCustomerConversationCount(customer.id);
    else touchCustomerLastSeen(customer.id);
  }

  // Lead detection
  const leadResult = detectLead(message, assistantResponse, business);
  if (leadResult.leadScore > conversation.leadScore) {
    updateConversationLeadScore(conversation.id, leadResult.leadScore);
  }
  if (leadResult.isLead && !conversation.notifiedAt) {
    const freshConv = getConversationById(conversation.id);
    if (!freshConv) {
      throw new Error(`Conversation '${conversation.id}' not found during notification`);
    }
    const notifier = new NotificationService(business);
    await notifier.sendLeadAlert(
      business,
      freshConv,
      leadResult.triggerReason,
      message
    );
    markConversationNotified(conversation.id);
  }

  return NextResponse.json({
    response: assistantResponse,
    conversationId: conversation.id,
    customerId: customer?.id ?? null,
    status: conversation.status,
    handedOff: false,
    followUpQuestions,
  });
}
