import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import {
  getBusinessById,
  getBusinessConversations,
  getBusinessStats,
} from '@/src/services/business';
import { DashboardClient } from './dashboard-client';

export default async function OwnerDashboard({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const { businessId } = await params;
  const business = getBusinessById(businessId);
  if (!business) redirect('/setup');

  const conversations = getBusinessConversations(businessId);
  const stats = getBusinessStats(businessId);

  return (
    <DashboardClient
      businessId={businessId}
      business={business}
      initialConversations={conversations}
      initialStats={stats}
    />
  );
}
