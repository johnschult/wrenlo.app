import { NextRequest, NextResponse } from 'next/server';
import { chat } from '@/src/services/llm';
import { sessions } from '@/src/lib/sessions';
import type { Message } from '@/src/types';

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
  const response = await chat(session.systemPrompt, history, message);

  session.previewMessages.push(
    { role: 'user', content: message },
    { role: 'assistant', content: response }
  );

  return NextResponse.json({ response, conversationId: sessionId });
}
