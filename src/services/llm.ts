import Anthropic from '@anthropic-ai/sdk';
import type { Message } from '../types';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-sonnet-4-6';

export async function chat(
  systemPrompt: string,
  history: Message[],
  userMessage: string,
  maxTokens = 1024
): Promise<string> {
  const messages: Anthropic.MessageParam[] = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage },
  ];

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages,
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') throw new Error('No text response from Claude');
  return textBlock.text;
}
