'use server';

import { auth } from '@clerk/nextjs/server';
import { randomUUID } from 'crypto';
import { analyzeUrls, generatePromptFromExtraction, refinePrompt } from '../services/analyst';
import { chat } from '../services/llm';
import { getBusinessById, upsertBusiness } from '../services/business';
import { sessions } from '../lib/sessions';
import type { Message } from '../types';

export async function analyzeUrlsAction(urls: string[]) {
  const extractedData = await analyzeUrls(urls);
  const systemPrompt = await generatePromptFromExtraction(extractedData);

  const sessionId = randomUUID();
  sessions.set(sessionId, {
    sessionId,
    extractedData,
    systemPrompt,
    refinementHistory: [],
    previewMessages: [],
    createdAt: new Date().toISOString(),
  });

  return { sessionId, extractedData, systemPrompt };
}

export async function loadExistingAction(businessId: string) {
  const business = getBusinessById(businessId);
  if (!business) throw new Error('Business not found');

  const sessionId = randomUUID();
  sessions.set(sessionId, {
    sessionId,
    extractedData: {
      businessName: business.name,
      businessType: '',
      services: [],
      hours: null,
      bookingMethod: null,
      location: null,
      phone: null,
      email: null,
      tone: null,
      commonQuestions: [],
      specialFeatures: [],
      aboutText: null,
      sourceUrls: [],
    },
    systemPrompt: business.systemPrompt,
    refinementHistory: [],
    previewMessages: [],
    businessId,
    createdAt: new Date().toISOString(),
  });

  return { sessionId, systemPrompt: business.systemPrompt, businessName: business.name };
}

export async function refinePromptAction(sessionId: string, feedback: string) {
  const session = sessions.get(sessionId);
  if (!session) throw new Error('Session not found or expired');

  const newPrompt = await refinePrompt(
    session.systemPrompt,
    feedback,
    session.refinementHistory
  );
  session.systemPrompt = newPrompt;
  session.refinementHistory.push(feedback);
  session.previewMessages = [];

  return { systemPrompt: newPrompt };
}

export async function goLiveAction(params: {
  sessionId: string;
  businessName?: string;
  businessId?: string;
  ownerName?: string;
  ownerEmail?: string;
}) {
  const { userId } = await auth();
  const session = sessions.get(params.sessionId);
  if (!session) throw new Error('Session not found or expired');

  const name = params.businessName || session.extractedData.businessName || 'My Business';
  const businessId =
    session.businessId ||
    params.businessId ||
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 50);

  upsertBusiness(businessId, name, session.systemPrompt, {
    clerkUserId: userId ?? undefined,
    ownerName: params.ownerName,
    ownerEmail: params.ownerEmail,
  });

  sessions.delete(params.sessionId);
  return { businessId, widgetUrl: `/w/${businessId}`, dashboardUrl: `/owner/${businessId}` };
}
