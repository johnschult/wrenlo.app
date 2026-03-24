import type { FastifyInstance } from 'fastify';
import { getCustomerById, getCustomerConversations } from '../services/business.js';

export async function customerRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { customerId: string } }>(
    '/customers/:customerId',
    {
      schema: {
        params: {
          type: 'object',
          required: ['customerId'],
          properties: {
            customerId: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              customer: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  business_id: { type: 'string' },
                  identifier: { type: 'string' },
                  name: { type: ['string', 'null'] },
                  vehicle_info: { type: ['string', 'null'] },
                  notes: { type: ['string', 'null'] },
                  first_seen_at: { type: 'string' },
                  last_seen_at: { type: 'string' },
                  conversation_count: { type: 'number' },
                },
              },
              conversations: {
                type: 'array',
                items: {
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
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { customerId } = request.params;

      const customer = getCustomerById(customerId);
      if (!customer) {
        return reply.code(404).send({ error: `Customer '${customerId}' not found` } as never);
      }

      const conversations = getCustomerConversations(customerId);

      return { customer, conversations };
    },
  );
}
