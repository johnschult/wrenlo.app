"use client";

import { ThemeToggle, useTheme } from "@/lib/theme";
import { SignIn } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import Image from "next/image";

export default function SignInPage() {
  const { theme } = useTheme();
  const t = useTranslations("auth.signIn");

  return (
    <div className="bg-muted relative flex min-h-screen w-full items-center justify-center p-6 md:p-10">
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>
      <div className="flex w-full max-w-md flex-col items-center gap-4 md:gap-5">
        <Image
          src="/wrenlo-logo.svg"
          alt={t("logoAlt")}
          width={160}
          height={42}
          className="h-auto w-32 md:w-40"
          priority
        />
        <SignIn
          appearance={{
            variables: {
              colorPrimary: "#D85A30",
              colorBackground: theme === "dark" ? "#1a1a19" : "#ffffff",
              colorText: theme === "dark" ? "#e8e8e6" : "#0d0d0c",
              colorTextSecondary: theme === "dark" ? "#a8a89e" : "#6b6b65",
              colorNeutral: theme === "dark" ? "#e8e8e6" : "#0d0d0c",
              colorInputBackground: theme === "dark" ? "#262625" : "#f5f5f4",
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
  );
}
