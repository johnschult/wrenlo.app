import {
  type AppLocale,
  DEFAULT_LOCALE,
  isSupportedLocale,
} from "@/18n/config";
import { getBusinessById } from "@/services/business";
import { getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { ChatWidget } from "./chat-widget";

export default async function WidgetPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ locale?: string }>;
}) {
  const { businessId } = await params;
  const { locale: queryLocale } = await searchParams;
  const requestLocale = await getLocale();
  const locale: AppLocale = isSupportedLocale(queryLocale)
    ? queryLocale
    : isSupportedLocale(requestLocale)
    ? requestLocale
    : DEFAULT_LOCALE;
  const business = getBusinessById(businessId);
  if (!business) notFound();

  let exampleQuestions: string[] = [];
  try {
    exampleQuestions = locale === "es"
      ? JSON.parse(business.exampleQuestionsEs)
      : JSON.parse(business.exampleQuestions);
  } catch {
    exampleQuestions = [];
  }

  return (
    <ChatWidget
      businessId={businessId}
      businessName={business.name}
      mode="live"
      initialLocale={locale}
      exampleQuestions={exampleQuestions}
    />
  );
}
