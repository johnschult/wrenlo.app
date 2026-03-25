import { NextRequest, NextResponse } from 'next/server';
import {
  getBusinessById,
  getOrCreateCustomer,
  getCustomerById,
  createConversation,
  getConversationById,
  addMessage,
  getConversationMessages,
  touchConversation,
  touchCustomerLastSeen,
  incrementCustomerConversationCount,
  updateConversationLeadScore,
  markConversationNotified,
} from '@/src/services/business';
import { chat } from '@/src/services/llm';
import { detectLead } from '@/src/services/lead-detector';
import { NotificationService } from '@/src/services/notifications';
import type { Customer, Message } from '@/src/types';

const MAX_HISTORY = 40;

function buildSystemPrompt(base: string, customer: Customer | null): string {
  if (!customer || customer.conversationCount === 0) return base;
  const lines = ['This is a returning customer.'];
  if (customer.name) lines.push(`Their name is ${customer.name}.`);
  lines.push(`They have had ${customer.conversationCount} previous conversation(s) with us.`);
  lines.push(`Their last visit was on ${customer.lastSeenAt}.`);
  if (customer.vehicleInfo) {
    try {
      lines.push(`Vehicle on file: ${JSON.stringify(JSON.parse(customer.vehicleInfo))}.`);
    } catch {
      lines.push(`Vehicle info: ${customer.vehicleInfo}.`);
    }
  }
  return `${base}\n\n[Customer context: ${lines.join(' ')}]`;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { businessId, message, conversationId, customerId, customerIdentifier, channel = 'web' } = body;

  if (!businessId || !message) {
    return NextResponse.json({ error: 'businessId and message are required' }, { status: 400 });
  }

  const business = getBusinessById(businessId);
  if (!business) {
    return NextResponse.json({ error: `Business '${businessId}' not found` }, { status: 404 });
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
  let conversation;
  if (conversationId) {
    conversation = getConversationById(conversationId);
    if (!conversation) {
      return NextResponse.json({ error: `Conversation '${conversationId}' not found` }, { status: 404 });
    }
  } else {
    conversation = createConversation(businessId, customer?.id ?? null, channel);
    isNewConversation = true;
  }

  // Handoff passthrough
  if (conversation.status === 'handed_off') {
    addMessage(conversation.id, 'user', message);
    touchConversation(conversation.id);
    if (customer && !isNewConversation) touchCustomerLastSeen(customer.id);
    return NextResponse.json({
      response: "Thanks — the owner has been notified and will reply shortly.",
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

  const systemPrompt = buildSystemPrompt(business.systemPrompt, customer);
  const assistantResponse = await chat(systemPrompt, history, message);

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
    const freshConv = getConversationById(conversation.id)!;
    const notifier = new NotificationService(business);
    await notifier.sendLeadAlert(business, freshConv, leadResult.triggerReason, message);
    markConversationNotified(conversation.id);
  }

  return NextResponse.json({
    response: assistantResponse,
    conversationId: conversation.id,
    customerId: customer?.id ?? null,
    status: conversation.status,
    handedOff: false,
  });
}
