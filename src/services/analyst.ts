import { chat } from './llm';
import { scrapeUrls } from './scraper';
import {
  EXTRACTION_SYSTEM_PROMPT,
  PROMPT_GENERATION_FROM_EXTRACTION_SYSTEM_PROMPT,
  REFINEMENT_SYSTEM_PROMPT,
} from '../prompts/analyst-prompts';
import type { ExtractedBusinessData } from '../types';

function parseJson<T>(text: string): T {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  return JSON.parse(cleaned);
}

export async function analyzeUrls(urls: string[]): Promise<ExtractedBusinessData> {
  const scrapedText = await scrapeUrls(urls);
  const response = await chat(EXTRACTION_SYSTEM_PROMPT, [], scrapedText, 2048);
  const data = parseJson<Omit<ExtractedBusinessData, 'sourceUrls'>>(response);
  return { ...data, sourceUrls: urls };
}

export async function generatePromptFromExtraction(data: ExtractedBusinessData): Promise<string> {
  const userMessage = `Extracted business data:\n\n${JSON.stringify(data, null, 2)}`;
  return chat(PROMPT_GENERATION_FROM_EXTRACTION_SYSTEM_PROMPT, [], userMessage, 4096);
}

export async function refinePrompt(
  currentPrompt: string,
  feedback: string,
  history: string[]
): Promise<string> {
  const parts = [`Current system prompt:\n\n${currentPrompt}`];
  if (history.length > 0) {
    parts.push(
      `\nPrior feedback already applied:\n${history.map((h, i) => `${i + 1}. ${h}`).join('\n')}`
    );
  }
  parts.push(`\nNew feedback from the owner:\n${feedback}`);
  return chat(REFINEMENT_SYSTEM_PROMPT, [], parts.join('\n\n'), 4096);
}
