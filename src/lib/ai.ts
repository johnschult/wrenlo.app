import { anthropic } from '@ai-sdk/anthropic';

export const CLAUDE_MODEL = anthropic('claude-sonnet-4-6');

export type SupportedLanguage = 'en' | 'es';

export function withLanguageInstruction(
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
