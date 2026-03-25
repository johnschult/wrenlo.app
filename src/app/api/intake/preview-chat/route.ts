import { sessions } from '@/lib/sessions';
import { chatWithFollowups } from '@/services/llm';
import type { Message } from '@/types';
import { type NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { sessionId, message } = await req.json();

  if (!sessionId || !message) {
    return NextResponse.json({ error: 'sessionId and message are required' }, { status: 400 });
  }

  const session = sessions.get(sessionId);
  if (!session) {
    return NextResponse.json({ error: 'Session not found or expired' }, { status: 404 });
  }

  const history: Message[] = session.previewMessages.slice(-20);
  const { response, followUpQuestions } = await chatWithFollowups(session.systemPrompt, history, message);

  session.previewMessages.push(
    { role: 'user', content: message },
    { role: 'assistant', content: response }
  );

  return NextResponse.json({ response, conversationId: sessionId, followUpQuestions });
}
