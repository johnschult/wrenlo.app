import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { getConversationById, getConversationMessages } from '@/src/services/business';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { conversationId } = await params;
  const conversation = getConversationById(conversationId);
  if (!conversation) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const messages = getConversationMessages(conversationId, 100);
  return NextResponse.json({ conversation, messages });
}
