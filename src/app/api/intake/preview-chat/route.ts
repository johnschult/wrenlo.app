import { sessions } from '@/lib/sessions';
import { chatWithFollowups } from '@/services/llm';
import type { Message } from '@/types';
import { type NextRequest, NextResponse } from 'next/server';

const SUPPORTED_LANGUAGES = new Set(['en', 'es']);

type ChatImagePayload = {
  dataUrl: string;
  mimeType?: string;
};

function getLanguage(value: unknown): 'en' | 'es' {
  if (typeof value === 'string' && SUPPORTED_LANGUAGES.has(value)) {
    return value as 'en' | 'es';
  }
  return 'en';
}

function parseImagePayload(value: unknown): ChatImagePayload | null {
  if (value == null) return null;
  if (typeof value !== 'object') return null;

  const dataUrl = (value as { dataUrl?: unknown }).dataUrl;
  const mimeType = (value as { mimeType?: unknown }).mimeType;
  if (typeof dataUrl !== 'string' || dataUrl.length === 0) return null;
  if (mimeType != null && typeof mimeType !== 'string') return null;

  return { dataUrl, ...(mimeType ? { mimeType } : {}) };
}

function getVoiceInstruction(language: 'en' | 'es'): string {
  if (language === 'es') {
    return 'Voice requirement: Speak as the business in first-person plural ("nosotros", "nuestro"). Never refer to the business in third person (for example: "ellos", "la empresa", "el negocio") unless quoting the customer.';
  }

  return 'Voice requirement: Speak as the business in first-person plural ("we", "our", "us"). Never refer to the business in third person (for example: "they", "their", "the company", "the business") unless quoting the customer.';
}

export async function POST(req: NextRequest) {
  const { sessionId, message, language, image } = await req.json();
  const selectedLanguage = getLanguage(language);
  const imagePayload = parseImagePayload(image);

  if (image != null && !imagePayload) {
    return NextResponse.json({ error: 'Invalid image payload' }, { status: 400 });
  }

  if (!sessionId || !message) {
    return NextResponse.json({ error: 'sessionId and message are required' }, { status: 400 });
  }

  const session = sessions.get(sessionId);
  if (!session) {
    return NextResponse.json({ error: 'Session not found or expired' }, { status: 404 });
  }

  const prompt = selectedLanguage === 'es'
    ? session.systemPromptEs
    : session.systemPrompt;
  const promptWithVoice = `${prompt}\n\n[${getVoiceInstruction(selectedLanguage)}]`;

  const history: Message[] = session.previewMessages.slice(-20);
  const { response, followUpQuestions } = await chatWithFollowups(
    promptWithVoice,
    history,
    message,
    1024,
    selectedLanguage,
    imagePayload ?? undefined
  );

  session.previewMessages.push(
    { role: 'user', content: message },
    { role: 'assistant', content: response }
  );

  return NextResponse.json({ response, conversationId: sessionId, followUpQuestions });
}
