import { getBusinessById } from "@/src/services/business";
import { notFound } from "next/navigation";
import { ChatWidget } from "./chat-widget";

export default async function WidgetPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const business = getBusinessById(businessId);
  if (!business) notFound();

  return (
    <ChatWidget
      businessId={businessId}
      businessName={business.name}
      mode="live"
    />
  );
}
