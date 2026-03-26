import {
	EXTRACTION_SYSTEM_PROMPT,
	getPromptGenerationSystemPrompt,
	REFINEMENT_SYSTEM_PROMPT,
} from '../prompts/analyst-prompts';
import type { ExtractedBusinessData } from '../types';
import { generateObject, generateText } from 'ai';
import { z } from 'zod';
import { CLAUDE_MODEL } from '../lib/ai';
import { scrapeUrls } from './scraper';

type PromptLocale = 'en' | 'es';

const extractedBusinessDataSchema = z.object({
	businessName: z.string(),
	businessType: z.string(),
	services: z.array(
		z.object({
			name: z.string(),
			price: z.string().nullable(),
		}),
	),
	hours: z.string().nullable(),
	bookingMethod: z.string().nullable(),
	location: z.string().nullable(),
	phone: z.string().nullable(),
	email: z.string().nullable(),
	tone: z.string().nullable(),
	commonQuestions: z.array(z.string()),
	specialFeatures: z.array(z.string()),
	aboutText: z.string().nullable(),
});

const generatedPromptSchema = z.object({
	systemPrompt: z.string().min(1),
	exampleQuestions: z.array(z.string().min(1)).min(3).max(5),
});

export async function analyzeUrls(
	urls: string[],
): Promise<ExtractedBusinessData> {
	const scrapedText = await scrapeUrls(urls);
	const result = await generateObject({
		model: CLAUDE_MODEL,
		system: EXTRACTION_SYSTEM_PROMPT,
		prompt: scrapedText,
		maxOutputTokens: 2048,
		schema: extractedBusinessDataSchema,
	});
	const data = result.object;
	return { ...data, sourceUrls: urls };
}

export async function generatePromptFromExtraction(
	data: ExtractedBusinessData,
	language: PromptLocale,
): Promise<{ systemPrompt: string; exampleQuestions: string[] }> {
	const userMessage = `Extracted business data:\n\n${JSON.stringify(
		data,
		null,
		2,
	)}`;
	const result = await generateObject({
		model: CLAUDE_MODEL,
		system: `${getPromptGenerationSystemPrompt(language)}\n\nReturn a JSON object with keys systemPrompt and exampleQuestions.`,
		prompt: userMessage,
		maxOutputTokens: 4096,
		schema: generatedPromptSchema,
	});

	return {
		systemPrompt: result.object.systemPrompt,
		exampleQuestions: result.object.exampleQuestions,
	};
}

export async function refinePrompt(
	currentPrompt: string,
	feedback: string,
	history: string[],
): Promise<string> {
	const parts = [`Current system prompt:\n\n${currentPrompt}`];
	if (history.length > 0) {
		parts.push(
			`\nPrior feedback already applied:\n${history
				.map((h, i) => `${i + 1}. ${h}`)
				.join('\n')}`,
		);
	}
	parts.push(`\nNew feedback from the owner:\n${feedback}`);
	const result = await generateText({
		model: CLAUDE_MODEL,
		system: REFINEMENT_SYSTEM_PROMPT,
		prompt: parts.join('\n\n'),
		maxOutputTokens: 4096,
	});

	return result.text;
}
