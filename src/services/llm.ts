import Anthropic from '@anthropic-ai/sdk';
import type { Message } from '../types';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-sonnet-4-6';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type SupportedImageMime =
	| 'image/jpeg'
	| 'image/png'
	| 'image/gif'
	| 'image/webp';

const SUPPORTED_IMAGE_MIME_TYPES = new Set<SupportedImageMime>([
	'image/jpeg',
	'image/png',
	'image/gif',
	'image/webp',
]);

type SupportedLanguage = 'en' | 'es';
type ImagePayload = { dataUrl: string; mimeType?: string };

function getBase64SizeBytes(base64: string): number {
	const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
	return Math.floor((base64.length * 3) / 4) - padding;
}

function parseDataUrlImage(dataUrl: string): {
	mimeType: SupportedImageMime;
	base64: string;
} {
	const match = dataUrl.match(
		/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/,
	);
	if (!match) {
		throw new Error('Invalid image data URL format.');
	}

	const mimeType = match[1].toLowerCase() as SupportedImageMime;
	if (!SUPPORTED_IMAGE_MIME_TYPES.has(mimeType)) {
		throw new Error('Unsupported image type. Use JPEG, PNG, GIF, or WEBP.');
	}

	const base64 = match[2].replace(/\s+/g, '');
	const sizeBytes = getBase64SizeBytes(base64);
	if (sizeBytes > MAX_IMAGE_BYTES) {
		throw new Error('Image exceeds 5MB limit.');
	}

	return { mimeType, base64 };
}

function buildUserMessage(
	userMessage: string,
	image?: ImagePayload,
): Anthropic.MessageParam {
	if (!image) {
		return { role: 'user', content: userMessage };
	}

	const parsed = parseDataUrlImage(image.dataUrl);
	return {
		role: 'user',
		content: [
			{ type: 'text', text: userMessage },
			{
				type: 'image',
				source: {
					type: 'base64',
					media_type: parsed.mimeType,
					data: parsed.base64,
				},
			},
		],
	};
}

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
	image?: ImagePayload,
): Promise<string> {
	const messages: Anthropic.MessageParam[] = [
		...history.map(m => ({ role: m.role, content: m.content })),
		buildUserMessage(userMessage, image),
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
	image?: ImagePayload,
): Promise<{ response: string; followUpQuestions: string[] }> {
	const followupPrompt = `${withLanguageInstruction(systemPrompt, language)}

**IMPORTANT: Generate Follow-up Questions**
After providing your response, provide 2-3 follow-up questions that the user might want to ask next.
Format them as a JSON array immediately after your response.
Format: FOLLOW_UP_QUESTIONS: ["Question 1?", "Question 2?", "Question 3?"]`;

	const messages: Anthropic.MessageParam[] = [
		...history.map(m => ({ role: m.role, content: m.content })),
		buildUserMessage(userMessage, image),
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
