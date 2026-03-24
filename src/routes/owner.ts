import type { FastifyInstance } from 'fastify';
import {
  getBusinessById,
  getBusinessConversations,
  getBusinessStats,
} from '../services/business.js';

export async function ownerRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /api/owner/:businessId/conversations ──────────────────────────────
  app.get<{ Params: { businessId: string } }>(
    '/api/owner/:businessId/conversations',
    async (request, reply) => {
      const { businessId } = request.params;
      const business = getBusinessById(businessId);
      if (!business) return reply.code(404).send({ error: 'Business not found' });
      const conversations = getBusinessConversations(businessId);
      return { conversations };
    },
  );

  // ── GET /api/owner/:businessId/stats ──────────────────────────────────────
  app.get<{ Params: { businessId: string } }>(
    '/api/owner/:businessId/stats',
    async (request, reply) => {
      const { businessId } = request.params;
      const business = getBusinessById(businessId);
      if (!business) return reply.code(404).send({ error: 'Business not found' });
      return getBusinessStats(businessId);
    },
  );

  // ── GET /api/owner/:businessId/settings ───────────────────────────────────
  app.get<{ Params: { businessId: string } }>(
    '/api/owner/:businessId/settings',
    async (request, reply) => {
      const { businessId } = request.params;
      const business = getBusinessById(businessId);
      if (!business) return reply.code(404).send({ error: 'Business not found' });
      return {
        id: business.id,
        name: business.name,
        ownerName: business.owner_name,
        ownerEmail: business.owner_notification_email,
        handoffKeywords: JSON.parse(business.handoff_keywords || '[]'),
      };
    },
  );
}
