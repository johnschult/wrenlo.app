import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import {
  QUESTION_GENERATION_SYSTEM_PROMPT,
  SYSTEM_PROMPT_GENERATION_SYSTEM_PROMPT,
  buildQuestionPrompt,
  buildSystemPromptRequest,
} from '../prompts/intake-meta-prompt.js';
import type { IntakeQuestion, IntakeResponse } from '../types/index.js';

const client = new Anthropic({ apiKey: config.anthropicApiKey });
const MODEL = 'claude-sonnet-4-6';

/**
 * Uses Claude to generate a tailored set of intake questions for the given
 * business type (e.g. "auto detailer", "barber", "dog groomer").
 */
export async function generateIntakeQuestions(businessType: string): Promise<IntakeQuestion[]> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: QUESTION_GENERATION_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildQuestionPrompt(businessType) }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Claude during question generation');
  }

  return parseJsonArray<IntakeQuestion>(textBlock.text);
}

/**
 * Takes the business owner's intake answers (each response paired with its
 * question text) and generates a complete, production-ready system prompt.
 */
export async function processIntakeResponse(
  businessType: string,
  responses: IntakeResponse[],
): Promise<string> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT_GENERATION_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildSystemPromptRequest(businessType, responses) }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Claude during system prompt generation');
  }

  return textBlock.text.trim();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseJsonArray<T>(text: string): T[] {
  // Strip markdown code fences if present
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const raw = fenceMatch ? fenceMatch[1] : text.trim();

  // Find the first JSON array in the text
  const arrayMatch = raw.match(/\[[\s\S]*\]/);
  if (!arrayMatch) {
    throw new Error('Claude did not return a JSON array in the expected format');
  }

  try {
    const parsed = JSON.parse(arrayMatch[0]);
    if (!Array.isArray(parsed)) throw new Error('Parsed value is not an array');
    return parsed as T[];
  } catch {
    throw new Error(`Failed to parse JSON from Claude response: ${arrayMatch[0].slice(0, 200)}`);
  }
}
