"use client";

import { ThemeToggle, useTheme } from "@/lib/theme";
import { SignUp } from "@clerk/nextjs";
import { ChartLine, Clock, ShieldCheck, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";

export default function SignUpPage() {
  const { theme } = useTheme();
  const t = useTranslations("auth.signUp");

  return (
    <div className="bg-muted relative flex min-h-screen w-full items-center justify-center p-6 md:p-10">
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>
      <div className="flex w-full max-w-6xl flex-col items-center gap-8 md:gap-10">
        <Image
          src="/wrenlo-logo.svg"
          alt={t("logoAlt")}
          width={160}
          height={42}
          className="h-auto w-32 md:w-40"
          priority
        />
        <div className="grid w-full items-center gap-8 lg:grid-cols-2 lg:gap-12">
          <div className="hidden items-center justify-end lg:flex">
            <ul className="max-w-sm space-y-8">
              <li>
                <div className="flex items-center gap-2">
                  <Clock className="size-4" />
                  <p className="font-semibold">{t("respondTitle")}</p>
                </div>
                <p className="text-muted-foreground mt-2 text-sm">
                  {t("respondBody")}
                </p>
              </li>
              <li>
                <div className="flex items-center gap-2">
                  <ChartLine className="size-4" />
                  <p className="font-semibold">{t("leadsTitle")}</p>
                </div>
                <p className="text-muted-foreground mt-2 text-sm">
                  {t("leadsBody")}
                </p>
              </li>
              <li>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4" />
                  <p className="font-semibold">{t("controlTitle")}</p>
                </div>
                <p className="text-muted-foreground mt-2 text-sm">
                  {t("controlBody")}
                </p>
              </li>
              <li>
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4" />
                  <p className="font-semibold">{t("launchTitle")}</p>
                </div>
                <p className="text-muted-foreground mt-2 text-sm">
                  {t("launchBody")}
                </p>
              </li>
            </ul>
          </div>
          <div className="flex justify-center lg:justify-start">
            <div className="flex w-full max-w-md flex-col items-center gap-4 md:gap-5 lg:items-start">
              <SignUp
                appearance={{
                  variables: {
                    colorPrimary: "#D85A30",
                    colorBackground: theme === "dark" ? "#1a1a19" : "#ffffff",
                    colorText: theme === "dark" ? "#e8e8e6" : "#0d0d0c",
                    colorTextSecondary: theme === "dark"
                      ? "#a8a89e"
                      : "#6b6b65",
                    colorNeutral: theme === "dark" ? "#e8e8e6" : "#0d0d0c",
                    colorInputBackground: theme === "dark"
                      ? "#262625"
                      : "#f5f5f4",
                    colorInputText: theme === "dark" ? "#e8e8e6" : "#0d0d0c",
                  } as Record<string, string>,
                  elements: {
                    socialButtonsIconButton: theme === "dark"
                      ? "bg-[#2e2e2c] border border-[rgba(255,255,255,0.16)] hover:bg-[#3a3a38] text-white"
                      : "bg-white border border-[rgba(0,0,0,0.12)] hover:bg-[#f5f5f4]",
                    providerIcon__apple: theme === "dark"
                      ? { filter: "invert(1)" }
                      : undefined,
                  },
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
