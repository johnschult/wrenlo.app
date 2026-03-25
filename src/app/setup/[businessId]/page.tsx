import { loadExistingAction } from "@/actions/intake";
import { getLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import SetupClient from "../setup-client";

export default async function EditSetupPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const locale = (await getLocale()) as "en" | "es";

  let initial:
    | { sessionId: string; systemPrompt: string; businessName: string }
    | null = null;
  try {
    initial = await loadExistingAction(businessId, locale);
  } catch {
    redirect("/setup");
  }

  return <SetupClient existingBusinessId={businessId} initial={initial} />;
}
