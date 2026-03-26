import { generateText, streamText } from 'ai';
import { z } from 'zod';
import { CLAUDE_MODEL, withLanguageInstruction } from '../lib/ai';
import type { Message } from '../types';

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

type FollowupPayload = {
	followUpQuestions: string[];
	answerOptions: string[];
};

const followupsInputSchema = z.object({
	followUpQuestions: z.array(z.string().min(1)).max(3).default([]),
	answerOptions: z.array(z.string().min(1)).max(4).default([]),
});

function getFollowupSystemPrompt(
	systemPrompt: string,
	language?: SupportedLanguage,
): string {
	return `${withLanguageInstruction(systemPrompt, language)}

After writing your assistant response, call the suggestFollowUps tool exactly once.
Tool rules:
- If your assistant response includes a direct question to the customer, provide 2-4 short answer options in answerOptions and leave followUpQuestions empty.
- If your assistant response does not include a direct customer question, provide 2-3 follow-up questions in followUpQuestions and leave answerOptions empty.
- Never fill both arrays at the same time.`;
}

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

function buildMessages(history: Message[], userMessage: string, image?: ImagePayload) {
	const prior = history.map(m => ({ role: m.role, content: m.content }));

	if (!image) {
		return [...prior, { role: 'user' as const, content: userMessage }];
	}

	const parsed = parseDataUrlImage(image.dataUrl);
	const imageDataUrl = `data:${parsed.mimeType};base64,${parsed.base64}`;

	return [
		...prior,
		{
			role: 'user' as const,
			content: [
				{ type: 'text' as const, text: userMessage },
				{ type: 'image' as const, image: imageDataUrl },
			],
		},
	];
}

export async function chat(
	systemPrompt: string,
	history: Message[],
	userMessage: string,
	maxTokens = 1024,
	language?: SupportedLanguage,
	image?: ImagePayload,
): Promise<string> {
	const result = await generateText({
		model: CLAUDE_MODEL,
		system: withLanguageInstruction(systemPrompt, language),
		messages: buildMessages(history, userMessage, image),
		maxOutputTokens: maxTokens,
	});

	if (!result.text?.trim()) throw new Error('No text response from Claude');
	return result.text;
}

export async function chatWithFollowups(
	systemPrompt: string,
	history: Message[],
	userMessage: string,
	maxTokens = 1024,
	language?: SupportedLanguage,
	image?: ImagePayload,
): Promise<{
	response: string;
	followUpQuestions: string[];
	answerOptions: string[];
}> {
	const result = await generateText({
		model: CLAUDE_MODEL,
		system: getFollowupSystemPrompt(systemPrompt, language),
		messages: buildMessages(history, userMessage, image),
		maxOutputTokens: maxTokens,
		tools: {
			suggestFollowUps: {
				description:
					'Suggest follow-up UX options. Provide either answerOptions or followUpQuestions, never both.',
				inputSchema: followupsInputSchema,
				execute: async input => input,
			},
		},
	});

	const followups = extractFollowupsFromSteps(
		result.steps as Array<{
			toolResults: Array<{ toolName: string; output: unknown }>;
		}>,
	);

	return {
		response: result.text,
		answerOptions: followups.answerOptions,
		followUpQuestions: followups.followUpQuestions,
	};
}

export function streamChatWithFollowups(
	systemPrompt: string,
	history: Message[],
	userMessage: string,
	maxTokens = 1024,
	language?: SupportedLanguage,
	image?: ImagePayload,
) {
	return streamText({
		model: CLAUDE_MODEL,
		system: getFollowupSystemPrompt(systemPrompt, language),
		messages: buildMessages(history, userMessage, image),
		maxOutputTokens: maxTokens,
		tools: {
			suggestFollowUps: {
				description:
					'Suggest follow-up UX options. Provide either answerOptions or followUpQuestions, never both.',
				inputSchema: followupsInputSchema,
				execute: async input => input,
			},
		},
	});
}

export function extractFollowupsFromSteps(
	steps: Array<{ toolResults: Array<{ toolName: string; output: unknown }> }>,
): FollowupPayload {
	let answerOptions: string[] = [];
	let followUpQuestions: string[] = [];

	for (const step of steps) {
		for (const toolResult of step.toolResults) {
			if (toolResult.toolName !== 'suggestFollowUps') continue;
			const output = toolResult.output as {
				answerOptions?: string[];
				followUpQuestions?: string[];
			};

			answerOptions = Array.isArray(output.answerOptions)
				? output.answerOptions.slice(0, 4)
				: [];
			followUpQuestions = Array.isArray(output.followUpQuestions)
				? output.followUpQuestions.slice(0, 3)
				: [];
		}
	}

	const useAnswerOptions = answerOptions.length > 0;
	return {
		answerOptions: useAnswerOptions ? answerOptions : [],
		followUpQuestions: useAnswerOptions ? [] : followUpQuestions,
	};
}
