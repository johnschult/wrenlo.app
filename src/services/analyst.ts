import {
	EXTRACTION_SYSTEM_PROMPT,
	PROMPT_GENERATION_FROM_EXTRACTION_SYSTEM_PROMPT,
	REFINEMENT_SYSTEM_PROMPT,
} from '../prompts/analyst-prompts';
import type { ExtractedBusinessData } from '../types';
import { chat } from './llm';
import { scrapeUrls } from './scraper';

function parseJson<T>(text: string): T {
	const cleaned = text
		.replace(/^```(?:json)?\s*/i, '')
		.replace(/\s*```$/i, '')
		.trim();
	return JSON.parse(cleaned);
}

export async function analyzeUrls(
	urls: string[],
): Promise<ExtractedBusinessData> {
	const scrapedText = await scrapeUrls(urls);
	const response = await chat(EXTRACTION_SYSTEM_PROMPT, [], scrapedText, 2048);
	const data = parseJson<Omit<ExtractedBusinessData, 'sourceUrls'>>(response);
	return { ...data, sourceUrls: urls };
}

export async function generatePromptFromExtraction(
	data: ExtractedBusinessData,
): Promise<{ systemPrompt: string; exampleQuestions: string[] }> {
	const userMessage = `Extracted business data:\n\n${JSON.stringify(
		data,
		null,
		2,
	)}`;
	const response = await chat(
		PROMPT_GENERATION_FROM_EXTRACTION_SYSTEM_PROMPT,
		[],
		userMessage,
		4096,
	);

	// Parse the dual format: system prompt + JSON array of questions
	// Format: [system prompt text]\n[["question1", "question2", ...]]
	const lines = response.trim().split('\n');
	const lastLine = lines[lines.length - 1].trim();

	let systemPrompt = response;
	let exampleQuestions: string[] = [];

	// Try to extract questions from the last line if it looks like a JSON array
	if (lastLine.startsWith('[[') && lastLine.endsWith(']]')) {
		try {
			const parsed = parseJson<string[][]>(lastLine);
			exampleQuestions = parsed[0] || [];
			// Remove the questions line from the prompt
			systemPrompt = lines.slice(0, -1).join('\n').trim();
		} catch {
			// If parsing fails, just use the full response as prompt
			systemPrompt = response;
		}
	}

	return { systemPrompt, exampleQuestions };
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
	return chat(REFINEMENT_SYSTEM_PROMPT, [], parts.join('\n\n'), 4096);
}
