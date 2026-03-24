import type { FastifyInstance } from 'fastify';
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
} from '../services/business.js';
import { chat } from '../services/llm.js';
import { detectLead } from '../services/lead-detector.js';
import { NotificationService } from '../services/notifications.js';
import type { ChatRequest, ChatResponse, Customer, Message } from '../types/index.js';

const MAX_HISTORY = 40;

function buildSystemPrompt(basePrompt: string, customer: Customer | null): string {
  if (!customer || customer.conversation_count === 0) return basePrompt;

  const lines: string[] = ['This is a returning customer.'];
  if (customer.name) lines.push(`Their name is ${customer.name}.`);
  lines.push(`They have had ${customer.conversation_count} previous conversation(s) with us.`);
  lines.push(`Their last visit was on ${customer.last_seen_at}.`);
  if (customer.vehicle_info) {
    try {
      const parsed = JSON.parse(customer.vehicle_info);
      lines.push(`Vehicle on file: ${JSON.stringify(parsed)}.`);
    } catch {
      lines.push(`Vehicle info: ${customer.vehicle_info}.`);
    }
  }

  return `${basePrompt}\n\n[Customer context: ${lines.join(' ')}]`;
}

export async function chatRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: ChatRequest; Reply: ChatResponse }>(
    '/chat',
    {
      schema: {
        body: {
          type: 'object',
          required: ['businessId', 'message'],
          properties: {
            businessId: { type: 'string' },
            message: { type: 'string', minLength: 1 },
            conversationId: { type: 'string' },
            customerId: { type: 'string' },
            customerIdentifier: { type: 'string' },
            channel: { type: 'string', enum: ['web', 'sms', 'voice'] },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              response: { type: 'string' },
              conversationId: { type: 'string' },
              customerId: { type: ['string', 'null'] },
              status: { type: 'string' },
              handedOff: { type: 'boolean' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const {
        businessId,
        message,
        conversationId,
        customerId,
        customerIdentifier,
        channel = 'web',
      } = request.body;

      const business = getBusinessById(businessId);
      if (!business) {
        return reply.code(404).send({ error: `Business '${businessId}' not found` } as never);
      }

      // Resolve customer
      let customer: Customer | null = null;
      if (customerId) {
        customer = getCustomerById(customerId);
        if (!customer) {
          return reply.code(404).send({ error: `Customer '${customerId}' not found` } as never);
        }
      } else if (customerIdentifier) {
        customer = getOrCreateCustomer(businessId, customerIdentifier);
      }

      // Resolve or create conversation
      let isNewConversation = false;
      let conversation;
      if (conversationId) {
        conversation = getConversationById(conversationId);
        if (!conversation) {
          return reply
            .code(404)
            .send({ error: `Conversation '${conversationId}' not found` } as never);
        }
      } else {
        conversation = createConversation(businessId, customer?.id ?? null, channel);
        isNewConversation = true;
      }

      // ── Handoff passthrough: if owner has claimed this conversation, skip Claude ──
      if (conversation.status === 'handed_off') {
        addMessage(conversation.id, 'user', message);
        touchConversation(conversation.id);
        if (customer && !isNewConversation) touchCustomerLastSeen(customer.id);

        return {
          response: "Thanks — the owner has been notified and will reply shortly.",
          conversationId: conversation.id,
          customerId: customer?.id ?? null,
          status: conversation.status,
          handedOff: true,
        };
      }

      // ── Normal AI path ────────────────────────────────────────────────────────
      const dbMessages = getConversationMessages(conversation.id, MAX_HISTORY);
      const history: Message[] = dbMessages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      const systemPrompt = buildSystemPrompt(business.system_prompt, customer);
      const assistantResponse = await chat(systemPrompt, history, message);

      // Persist messages and update timestamps
      addMessage(conversation.id, 'user', message);
      addMessage(conversation.id, 'assistant', assistantResponse);
      touchConversation(conversation.id);

      if (customer) {
        if (isNewConversation) {
          incrementCustomerConversationCount(customer.id);
        } else {
          touchCustomerLastSeen(customer.id);
        }
      }

      // ── Lead detection ────────────────────────────────────────────────────────
      const leadResult = detectLead(message, assistantResponse, business);
      if (leadResult.leadScore > conversation.lead_score) {
        updateConversationLeadScore(conversation.id, leadResult.leadScore);
      }

      // Notify owner when lead threshold crossed and not yet notified this conversation
      if (leadResult.isLead && !conversation.notified_at) {
        const freshConv = getConversationById(conversation.id)!;
        const notifier = new NotificationService(business);
        await notifier.sendLeadAlert(business, freshConv, leadResult.triggerReason, message);
        markConversationNotified(conversation.id);
      }

      return {
        response: assistantResponse,
        conversationId: conversation.id,
        customerId: customer?.id ?? null,
        status: conversation.status,
        handedOff: false,
      };
    },
  );
}
