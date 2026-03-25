import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getBusinessesByClerkUserId } from '@/src/services/business';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const businesses = getBusinessesByClerkUserId(userId);
  return NextResponse.json({ businesses });
}
