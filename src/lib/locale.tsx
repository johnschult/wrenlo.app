"use client";

import { type AppLocale, SUPPORTED_LOCALES } from "@/18n/config";
import { setLocaleAction } from "@/actions/locale";
import { Button } from "@/components/ui/button";
import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

const LOCALE_LABELS: Record<AppLocale, string> = {
  en: "EN",
  es: "ES",
};

function getNextLocale(currentLocale: string): AppLocale {
  const index = SUPPORTED_LOCALES.indexOf(currentLocale as AppLocale);
  if (index < 0) return "en";
  return SUPPORTED_LOCALES[(index + 1) % SUPPORTED_LOCALES.length];
}

export function LocaleToggle() {
  const locale = useLocale();
  const t = useTranslations("common.localeToggle");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const current =
    (SUPPORTED_LOCALES.includes(locale as AppLocale)
      ? locale
      : "en") as AppLocale;
  const next = getNextLocale(current);

  const onToggle = () => {
    startTransition(async () => {
      await setLocaleAction(next);
      router.refresh();
    });
  };

  return (
    <Button
      onClick={onToggle}
      variant="ghost"
      size="icon-sm"
      className="text-muted-foreground hover:text-foreground"
      aria-label={t("ariaLabel")}
      title={pending
        ? t("switching")
        : t("switchTo", { locale: LOCALE_LABELS[next] })}
      type="button"
      disabled={pending}
    >
      <Languages size={18} />
      <span className="sr-only">{t("ariaLabel")}</span>
    </Button>
  );
}
