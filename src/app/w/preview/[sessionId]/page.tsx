import {
  type AppLocale,
  DEFAULT_LOCALE,
  isSupportedLocale,
} from "@/18n/config";
import { sessions } from "@/lib/sessions";
import { getLocale } from "next-intl/server";
import { ChatWidget } from "../../[businessId]/chat-widget";

export default async function PreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ name?: string; theme?: string; locale?: string }>;
}) {
  const { sessionId } = await params;
  const requestLocale = await getLocale();
  const { name, theme, locale: queryLocale } = await searchParams;
  const locale: AppLocale = isSupportedLocale(queryLocale)
    ? queryLocale
    : isSupportedLocale(requestLocale)
    ? requestLocale
    : DEFAULT_LOCALE;
  const session = sessions.get(sessionId);
  const exampleQuestions = locale === "es"
    ? session?.exampleQuestionsEs
    : session?.exampleQuestions;

  return (
    <ChatWidget
      sessionId={sessionId}
      businessName={name ?? "Preview"}
      mode="preview"
      initialTheme={theme === "light" ? "light" : "dark"}
      initialLocale={locale}
      exampleQuestions={exampleQuestions ?? []}
    />
  );
}
