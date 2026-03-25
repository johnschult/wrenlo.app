import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { getBusinessConversations } from '@/src/services/business';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { businessId } = await params;
  const conversations = getBusinessConversations(businessId);
  return NextResponse.json({ conversations });
}
