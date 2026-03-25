'use server';

import type { AppLocale } from '@/18n/config';
import { auth } from '@clerk/nextjs/server';
import { randomUUID } from 'node:crypto';
import { sessions } from '../lib/sessions';
import {
	analyzeUrls,
	generatePromptFromExtraction,
	refinePrompt,
} from '../services/analyst';
import { getBusinessById, upsertBusiness } from '../services/business';

function isSpanish(locale: AppLocale) {
	return locale === 'es';
}

export async function analyzeUrlsAction(urls: string[], locale: AppLocale) {
	const extractedData = await analyzeUrls(urls);
	const englishResult = await generatePromptFromExtraction(extractedData, 'en');
	const spanishResult = await generatePromptFromExtraction(extractedData, 'es');

	const useSpanish = isSpanish(locale);
	const systemPrompt = useSpanish
		? spanishResult.systemPrompt
		: englishResult.systemPrompt;
	const exampleQuestions = useSpanish
		? spanishResult.exampleQuestions
		: englishResult.exampleQuestions;

	const sessionId = randomUUID();
	sessions.set(sessionId, {
		sessionId,
		extractedData,
		systemPrompt: englishResult.systemPrompt,
		systemPromptEs: spanishResult.systemPrompt,
		exampleQuestions: englishResult.exampleQuestions,
		exampleQuestionsEs: spanishResult.exampleQuestions,
		refinementHistory: [],
		previewMessages: [],
		createdAt: new Date().toISOString(),
	});

	return { sessionId, extractedData, systemPrompt, exampleQuestions };
}

export async function loadExistingAction(
	businessId: string,
	locale: AppLocale,
) {
	const business = getBusinessById(businessId);
	if (!business) throw new Error('Business not found');
	const useSpanish = isSpanish(locale);
	const englishQuestions = business.exampleQuestions
		? JSON.parse(business.exampleQuestions)
		: [];
	const spanishQuestions = business.exampleQuestionsEs
		? JSON.parse(business.exampleQuestionsEs)
		: [];

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
		systemPromptEs: business.systemPromptEs,
		exampleQuestions: englishQuestions,
		exampleQuestionsEs: spanishQuestions,
		refinementHistory: [],
		previewMessages: [],
		businessId,
		createdAt: new Date().toISOString(),
	});

	return {
		sessionId,
		systemPrompt: useSpanish ? business.systemPromptEs : business.systemPrompt,
		businessName: business.name,
	};
}

export async function refinePromptAction(
	sessionId: string,
	feedback: string,
	locale: AppLocale,
) {
	const session = sessions.get(sessionId);
	if (!session) throw new Error('Session not found or expired');
	const useSpanish = isSpanish(locale);
	const currentPrompt = useSpanish
		? session.systemPromptEs
		: session.systemPrompt;

	const newPrompt = await refinePrompt(
		currentPrompt,
		feedback,
		session.refinementHistory,
	);
	if (useSpanish) {
		session.systemPromptEs = newPrompt;
	} else {
		session.systemPrompt = newPrompt;
	}
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

	const name =
		params.businessName || session.extractedData.businessName || 'My Business';
	const businessId =
		session.businessId ||
		params.businessId ||
		name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/(^-|-$)/g, '')
			.slice(0, 50);

	upsertBusiness(
		businessId,
		name,
		session.systemPrompt,
		session.systemPromptEs,
		{
			clerkUserId: userId ?? undefined,
			ownerName: params.ownerName,
			ownerEmail: params.ownerEmail,
			exampleQuestions: session.exampleQuestions,
			exampleQuestionsEs: session.exampleQuestionsEs,
		},
	);

	sessions.delete(params.sessionId);
	return {
		businessId,
		widgetUrl: `/w/${businessId}`,
		dashboardUrl: `/owner/${businessId}`,
	};
}
