import { getBusinessById } from "@/services/business";
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

  let exampleQuestions: string[] = [];
  try {
    exampleQuestions = JSON.parse(business.exampleQuestions);
  } catch {
    exampleQuestions = [];
  }

  return (
    <ChatWidget
      businessId={businessId}
      businessName={business.name}
      mode="live"
      exampleQuestions={exampleQuestions}
    />
  );
}
