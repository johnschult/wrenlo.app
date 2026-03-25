import Anthropic from '@anthropic-ai/sdk';
import type { Message } from '../types';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-sonnet-4-6';

type SupportedLanguage = 'en' | 'es';

function withLanguageInstruction(
	systemPrompt: string,
	language?: SupportedLanguage,
): string {
	if (!language) return systemPrompt;

	const instruction =
		language === 'es'
			? 'Always respond in Spanish. Do not switch languages unless the user explicitly asks you to.'
			: 'Always respond in English. Do not switch languages unless the user explicitly asks you to.';

	return `${systemPrompt}\n\n${instruction}`;
}

export async function chat(
	systemPrompt: string,
	history: Message[],
	userMessage: string,
	maxTokens = 1024,
	language?: SupportedLanguage,
): Promise<string> {
	const messages: Anthropic.MessageParam[] = [
		...history.map(m => ({ role: m.role, content: m.content })),
		{ role: 'user', content: userMessage },
	];

	const response = await client.messages.create({
		model: MODEL,
		max_tokens: maxTokens,
		system: withLanguageInstruction(systemPrompt, language),
		messages,
	});

	const textBlock = response.content.find(b => b.type === 'text');
	if (!textBlock || textBlock.type !== 'text')
		throw new Error('No text response from Claude');
	return textBlock.text;
}

export async function chatWithFollowups(
	systemPrompt: string,
	history: Message[],
	userMessage: string,
	maxTokens = 1024,
	language?: SupportedLanguage,
): Promise<{ response: string; followUpQuestions: string[] }> {
	const followupPrompt = `${withLanguageInstruction(systemPrompt, language)}

**IMPORTANT: Generate Follow-up Questions**
After providing your response, provide 2-3 follow-up questions that the user might want to ask next.
Format them as a JSON array immediately after your response.
Format: FOLLOW_UP_QUESTIONS: ["Question 1?", "Question 2?", "Question 3?"]`;

	const messages: Anthropic.MessageParam[] = [
		...history.map(m => ({ role: m.role, content: m.content })),
		{ role: 'user', content: userMessage },
	];

	const response = await client.messages.create({
		model: MODEL,
		max_tokens: maxTokens,
		system: followupPrompt,
		messages,
	});

	const textBlock = response.content.find(b => b.type === 'text');
	if (!textBlock || textBlock.type !== 'text')
		throw new Error('No text response from Claude');

	const fullText = textBlock.text;
	let responseText = fullText;
	let followUpQuestions: string[] = [];

	const followupMatch = fullText.match(/FOLLOW_UP_QUESTIONS:\s*(\[[\s\S]*?\])/);
	if (followupMatch) {
		try {
			responseText = fullText.slice(0, followupMatch.index).trim();
			followUpQuestions = JSON.parse(followupMatch[1]);
		} catch {
			responseText = fullText;
		}
	}

	return { response: responseText, followUpQuestions };
}
