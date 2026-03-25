import { sessions } from '@/lib/sessions';
import { chatWithFollowups } from '@/services/llm';
import type { Message } from '@/types';
import { type NextRequest, NextResponse } from 'next/server';

const SUPPORTED_LANGUAGES = new Set(['en', 'es']);

function getLanguage(value: unknown): 'en' | 'es' {
  if (typeof value === 'string' && SUPPORTED_LANGUAGES.has(value)) {
    return value as 'en' | 'es';
  }
  return 'en';
}

export async function POST(req: NextRequest) {
  const { sessionId, message, language } = await req.json();
  const selectedLanguage = getLanguage(language);

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

  const history: Message[] = session.previewMessages.slice(-20);
  const { response, followUpQuestions } = await chatWithFollowups(
    prompt,
    history,
    message,
    1024,
    selectedLanguage
  );

  session.previewMessages.push(
    { role: 'user', content: message },
    { role: 'assistant', content: response }
  );

  return NextResponse.json({ response, conversationId: sessionId, followUpQuestions });
}
