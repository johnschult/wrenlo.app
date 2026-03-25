import { redirect } from 'next/navigation';
import SetupClient from '../setup-client';
import { loadExistingAction } from '@/src/actions/intake';

export default async function EditSetupPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;

  let initial: { sessionId: string; systemPrompt: string; businessName: string } | null = null;
  try {
    initial = await loadExistingAction(businessId);
  } catch {
    redirect('/setup');
  }

  return <SetupClient existingBusinessId={businessId} initial={initial} />;
}
