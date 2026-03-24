import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import { generateIntakeQuestions, processIntakeResponse } from '../services/intake.js';
import { upsertBusiness } from '../services/business.js';
import type {
  IntakeSession,
  IntakeStartRequest,
  IntakeStartResponse,
  IntakeCompleteRequest,
  IntakeCompleteResponse,
  IntakeResponse,
} from '../types/index.js';

// In-memory session store (sufficient for stateless intake flows)
const sessions = new Map<string, IntakeSession>();

export async function intakeRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /intake/start
   *
   * Kicks off an intake session for a given business type. Calls Claude to
   * generate tailored questions and returns them for the owner to answer.
   *
   * Body: { businessType: string }
   * Returns: { sessionId, questions }
   */
  app.post<{ Body: IntakeStartRequest; Reply: IntakeStartResponse }>(
    '/intake/start',
    {
      schema: {
        body: {
          type: 'object',
          required: ['businessType'],
          properties: {
            businessType: { type: 'string', minLength: 1 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              sessionId: { type: 'string' },
              questions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    question: { type: 'string' },
                    hint: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { businessType } = request.body;

      const questions = await generateIntakeQuestions(businessType);
      const sessionId = randomUUID();

      const session: IntakeSession = {
        sessionId,
        businessType,
        questions,
        createdAt: new Date().toISOString(),
      };
      sessions.set(sessionId, session);

      return reply.code(200).send({ sessionId, questions });
    },
  );

  /**
   * POST /intake/complete
   *
   * Takes the owner's answers, pairs them with the original questions, and
   * calls Claude to generate a production-ready system prompt. Optionally
   * persists the result as a business record in SQLite.
   *
   * Body: { sessionId, responses, businessId?, businessName? }
   * Returns: { systemPrompt, businessId? }
   */
  app.post<{ Body: IntakeCompleteRequest; Reply: IntakeCompleteResponse }>(
    '/intake/complete',
    {
      schema: {
        body: {
          type: 'object',
          required: ['sessionId', 'responses'],
          properties: {
            sessionId: { type: 'string' },
            responses: {
              type: 'array',
              minItems: 1,
              items: {
                type: 'object',
                required: ['questionId', 'answer'],
                properties: {
                  questionId: { type: 'string' },
                  answer: { type: 'string' },
                },
              },
            },
            businessId: { type: 'string' },
            businessName: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              systemPrompt: { type: 'string' },
              businessId: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { sessionId, responses, businessId, businessName } = request.body;

      const session = sessions.get(sessionId);
      if (!session) {
        return reply
          .code(404)
          .send({ error: `Session '${sessionId}' not found or expired` } as never);
      }

      // Pair each answer with its original question text
      const questionMap = new Map(session.questions.map((q) => [q.id, q.question]));
      const enrichedResponses: IntakeResponse[] = responses.map((r) => ({
        questionId: r.questionId,
        question: questionMap.get(r.questionId) ?? r.questionId,
        answer: r.answer,
      }));

      const systemPrompt = await processIntakeResponse(session.businessType, enrichedResponses);

      // Optionally persist as a business record
      let savedBusinessId: string | undefined;
      if (businessId || businessName) {
        const id = businessId ?? randomUUID();
        const name = businessName ?? session.businessType;
        upsertBusiness(id, name, systemPrompt);
        savedBusinessId = id;
      }

      // Clean up the session once complete
      sessions.delete(sessionId);

      return reply.code(200).send({
        systemPrompt,
        ...(savedBusinessId !== undefined && { businessId: savedBusinessId }),
      });
    },
  );
}
