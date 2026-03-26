import { ClerkProvider } from "@clerk/nextjs";
import { shadcn } from "@clerk/ui/themes";
import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { ThemeProvider } from "@/lib/theme";
import { cn } from "@/lib/utils";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "wrenlo — AI front desk for small businesses",
  description:
    "An AI front desk that knows your business, handles customers, and sends you the leads that matter.",
};

export default async function RootLayout(
  { children }: { children: React.ReactNode },
) {
  const locale = await getLocale();
  const messages = await getMessages();
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get("wrenlo-app-theme")?.value;
  const initialTheme = themeCookie === "light" ? "light" : "dark";

  return (
    <ClerkProvider
      appearance={{
        theme: shadcn,
      }}
    >
      <html
        lang={locale}
        suppressHydrationWarning
        className={cn("font-sans", geist.variable, initialTheme)}
      >
        <body
          className="antialiased"
          style={{ background: "var(--bg)", color: "var(--text)" }}
        >
          <NextIntlClientProvider locale={locale} messages={messages}>
            <ThemeProvider>{children}</ThemeProvider>
          </NextIntlClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
