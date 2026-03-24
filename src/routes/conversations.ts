import type { FastifyInstance } from 'fastify';
import {
  getConversationById,
  getConversationMessages,
  claimConversation,
  releaseConversation,
  addMessage,
  touchConversation,
} from '../services/business.js';
import type { ClaimRequest, OwnerMessageRequest } from '../types/index.js';

export async function conversationRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /conversations/:conversationId/claim ──────────────────────────────
  app.post<{ Params: { conversationId: string }; Body: ClaimRequest }>(
    '/conversations/:conversationId/claim',
    {
      schema: {
        params: {
          type: 'object',
          required: ['conversationId'],
          properties: { conversationId: { type: 'string' } },
        },
        body: {
          type: 'object',
          properties: { claimedBy: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const { conversationId } = request.params;
      const { claimedBy = 'owner' } = request.body ?? {};

      const conversation = getConversationById(conversationId);
      if (!conversation) {
        return reply.code(404).send({ error: `Conversation '${conversationId}' not found` } as never);
      }
      if (conversation.status === 'handed_off') {
        return reply.code(409).send({
          error: 'Conversation is already claimed',
          claimedBy: conversation.claimed_by,
          claimedAt: conversation.claimed_at,
        } as never);
      }

      claimConversation(conversationId, claimedBy);
      const updated = getConversationById(conversationId)!;

      return {
        conversationId,
        status: updated.status,
        claimedBy: updated.claimed_by,
        claimedAt: updated.claimed_at,
        message: `Conversation claimed by ${claimedBy}. AI responses are now paused.`,
      };
    },
  );

  // ── POST /conversations/:conversationId/release ────────────────────────────
  app.post<{ Params: { conversationId: string } }>(
    '/conversations/:conversationId/release',
    {
      schema: {
        params: {
          type: 'object',
          required: ['conversationId'],
          properties: { conversationId: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const { conversationId } = request.params;

      const conversation = getConversationById(conversationId);
      if (!conversation) {
        return reply.code(404).send({ error: `Conversation '${conversationId}' not found` } as never);
      }
      if (conversation.status !== 'handed_off') {
        return reply.code(409).send({
          error: `Conversation is not handed off (status: ${conversation.status})`,
        } as never);
      }

      releaseConversation(conversationId);

      return {
        conversationId,
        status: 'active',
        message: 'Conversation released back to AI.',
      };
    },
  );

  // ── POST /conversations/:conversationId/owner-message ──────────────────────
  app.post<{ Params: { conversationId: string }; Body: OwnerMessageRequest }>(
    '/conversations/:conversationId/owner-message',
    {
      schema: {
        params: {
          type: 'object',
          required: ['conversationId'],
          properties: { conversationId: { type: 'string' } },
        },
        body: {
          type: 'object',
          required: ['message'],
          properties: {
            message: { type: 'string', minLength: 1 },
            senderName: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { conversationId } = request.params;
      const { message, senderName = 'Owner' } = request.body;

      const conversation = getConversationById(conversationId);
      if (!conversation) {
        return reply.code(404).send({ error: `Conversation '${conversationId}' not found` } as never);
      }
      if (conversation.status !== 'handed_off') {
        return reply.code(409).send({
          error: `Cannot send owner message — conversation is not handed off (status: ${conversation.status}). Claim it first via POST /conversations/${conversationId}/claim`,
        } as never);
      }

      addMessage(conversationId, 'owner', message);
      touchConversation(conversationId);

      return {
        conversationId,
        role: 'owner',
        senderName,
        message,
        timestamp: new Date().toISOString(),
      };
    },
  );

  // ── GET /conversations/:conversationId ─────────────────────────────────────
  app.get<{ Params: { conversationId: string } }>(
    '/conversations/:conversationId',
    {
      schema: {
        params: {
          type: 'object',
          required: ['conversationId'],
          properties: {
            conversationId: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              conversation: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  business_id: { type: 'string' },
                  customer_id: { type: ['string', 'null'] },
                  channel: { type: 'string' },
                  started_at: { type: 'string' },
                  updated_at: { type: 'string' },
                  status: { type: 'string' },
                },
              },
              messages: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    conversation_id: { type: 'string' },
                    role: { type: 'string' },
                    content: { type: 'string' },
                    created_at: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { conversationId } = request.params;

      const conversation = getConversationById(conversationId);
      if (!conversation) {
        return reply
          .code(404)
          .send({ error: `Conversation '${conversationId}' not found` } as never);
      }

      const messages = getConversationMessages(conversationId, 200);

      return { conversation, messages };
    },
  );
}
