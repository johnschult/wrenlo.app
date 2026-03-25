import { ThemeProvider } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { ClerkProvider } from "@clerk/nextjs";
import { shadcn } from "@clerk/ui/themes";
import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "wrenlo — AI front desk for small businesses",
  description:
    "An AI front desk that knows your business, handles customers, and sends you the leads that matter.",
};

export default function RootLayout(
  { children }: { children: React.ReactNode },
) {
  return (
    <ClerkProvider
      appearance={{
        theme: shadcn,
      }}
    >
      <html
        lang="en"
        suppressHydrationWarning
        className={cn("font-sans", geist.variable)}
      >
        <body
          className="antialiased"
          style={{ background: "var(--bg)", color: "var(--text)" }}
        >
          {/* Prevent flash of wrong theme before React hydrates */}
          <script
            // biome-ignore lint/security/noDangerouslySetInnerHtml: This is necessary to set the initial theme before React hydration to prevent a flash of the wrong theme.
            dangerouslySetInnerHTML={{
              __html:
                `(function(){try{var t=localStorage.getItem('wrenlo-app-theme')||(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.classList.add(t);}catch(e){document.documentElement.classList.add('dark');}})()`,
            }}
          />
          <ThemeProvider>{children}</ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
