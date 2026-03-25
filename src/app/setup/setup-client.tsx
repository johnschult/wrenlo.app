"use client";

import {
  analyzeUrlsAction,
  goLiveAction,
  refinePromptAction,
} from "@/actions/intake";
import { Button } from "@/components/ui/button";
import { LocaleToggle } from "@/lib/locale";
import { ThemeToggle, useTheme } from "@/lib/theme";
import type { ExtractedBusinessData } from "@/types";
import { UserButton } from "@clerk/nextjs";
import { Gauge } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ExtractedDataCard } from "./_components/extracted-data-card";
import { GoLiveForm } from "./_components/go-live-form";
import { RefineSection } from "./_components/refine-section";
import { type SuccessData, SuccessScreen } from "./_components/success-screen";
import { UrlAnalyzer } from "./_components/url-analyzer";

interface Props {
  existingBusinessId?: string;
  initial?: {
    sessionId: string;
    systemPrompt: string;
    businessName: string;
  } | null;
}

type Step = "url" | "ready" | "success";

export default function SetupClient({ existingBusinessId, initial }: Props) {
  const { theme } = useTheme();
  const locale = useLocale() as "en" | "es";
  const t = useTranslations("setup");
  const [urls, setUrls] = useState([{ id: crypto.randomUUID(), value: "" }]);
  const [step, setStep] = useState<Step>(initial ? "ready" : "url");
  const [sessionId, setSessionId] = useState(initial?.sessionId ?? "");
  const [extracted, setExtracted] = useState<ExtractedBusinessData | null>(
    null,
  );
  const [feedback, setFeedback] = useState("");
  const [chips, setChips] = useState<string[]>([]);
  const [bizName, setBizName] = useState(initial?.businessName ?? "");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [success, setSuccess] = useState<SuccessData | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [refining, setRefining] = useState(false);
  const [goingLive, setGoingLive] = useState(false);
  const [error, setError] = useState("");
  const [previewKey, setPreviewKey] = useState(0);
  const [previewLocale, setPreviewLocale] = useState<"en" | "es">(locale);

  const clerkAppearance = {
    variables: {
      colorPrimary: "#D85A30",
      colorBackground: theme === "dark" ? "#1a1a19" : "#ffffff",
      colorText: theme === "dark" ? "#e8e8e6" : "#0d0d0c",
      colorTextSecondary: theme === "dark" ? "#a8a89e" : "#6b6b65",
      colorNeutral: theme === "dark" ? "#e8e8e6" : "#0d0d0c",
      colorInputBackground: theme === "dark" ? "#262625" : "#f5f5f4",
      colorInputText: theme === "dark" ? "#e8e8e6" : "#0d0d0c",
    },
  };

  const isEdit = Boolean(existingBusinessId);

  const setUrl = (i: number, val: string) => {
    const next = [...urls];
    next[i] = { ...next[i], value: val };
    setUrls(next);
  };

  const handleAnalyze = async () => {
    const valid = urls.map((u) => u.value.trim()).filter(Boolean);
    if (!valid.length) {
      setError(t("errors.enterOneUrl"));
      return;
    }
    setAnalyzing(true);
    setError("");
    try {
      const data = await analyzeUrlsAction(valid, locale);
      setSessionId(data.sessionId);
      setExtracted(data.extractedData);
      setBizName(data.extractedData.businessName || "");
      setStep("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.analysisFailed"));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleRefine = async () => {
    if (!feedback.trim() || !sessionId) return;
    setRefining(true);
    setError("");
    try {
      await refinePromptAction(sessionId, feedback.trim(), previewLocale);
      setChips([...chips, feedback.trim()]);
      setFeedback("");
      setPreviewKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.refineFailed"));
    } finally {
      setRefining(false);
    }
  };

  const handleGoLive = async () => {
    if (!sessionId) return;
    setGoingLive(true);
    setError("");
    try {
      const data = await goLiveAction({
        sessionId,
        businessName: bizName || extracted?.businessName,
        businessId: existingBusinessId,
        ownerName: ownerName || undefined,
        ownerEmail: ownerEmail || undefined,
      });
      setSuccess(data);
      setStep("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.goLiveFailed"));
    } finally {
      setGoingLive(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="shrink-0 border-b border-border/70 bg-background/95 px-4 py-3 backdrop-blur md:px-6">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/wrenlo-logo.svg" alt="" width={113} height={30} />
          </Link>
          <nav className="flex items-center gap-2 md:gap-3">
            {existingBusinessId && (
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="h-8 min-w-24 justify-center px-2.5"
              >
                <Link
                  href={`/owner/${existingBusinessId}`}
                  className="flex items-center"
                >
                  <Gauge className="size-4" />
                  {t("header.dashboard")}
                </Link>
              </Button>
            )}
            <LocaleToggle />
            <ThemeToggle />
            <UserButton appearance={clerkAppearance} />
          </nav>
        </div>
      </header>

      {step === "success" && success
        ? <SuccessScreen success={success} isEdit={isEdit} />
        : (
          <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
            <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-6 border-b border-border lg:w-105 lg:flex-none lg:border-b-0 lg:border-r">
              <UrlAnalyzer
                urls={urls}
                onUrlChange={setUrl}
                onAddUrl={() =>
                  setUrls([...urls, { id: crypto.randomUUID(), value: "" }])}
                onAnalyze={handleAnalyze}
                analyzing={analyzing}
                error={error}
                isEdit={isEdit}
              />

              {step === "ready" && (
                <>
                  {extracted && <ExtractedDataCard extracted={extracted} />}
                  <RefineSection
                    chips={chips}
                    feedback={feedback}
                    onFeedbackChange={setFeedback}
                    onRefine={handleRefine}
                    refining={refining}
                    analyzing={analyzing}
                    error={error}
                  />
                  <GoLiveForm
                    bizName={bizName}
                    onBizNameChange={setBizName}
                    ownerName={ownerName}
                    onOwnerNameChange={setOwnerName}
                    ownerEmail={ownerEmail}
                    onOwnerEmailChange={setOwnerEmail}
                    onGoLive={handleGoLive}
                    goingLive={goingLive}
                    analyzing={analyzing}
                    isEdit={isEdit}
                  />
                </>
              )}
            </div>

            <div className="h-[44svh] min-h-80 shrink-0 border-t border-border lg:h-auto lg:min-h-0 lg:flex-1 lg:border-t-0">
              {!sessionId
                ? (
                  <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
                    <Image
                      src="/wrenlo-icon.svg"
                      alt=""
                      width={48}
                      height={48}
                      className="opacity-40"
                    />
                    <p className="text-sm">
                      {t("preview.placeholder")}
                    </p>
                  </div>
                )
                : (
                  <div className="h-full flex flex-col">
                    <div className="shrink-0 flex items-center justify-between border-b border-border/60 bg-background/80 px-3 py-2">
                      <p className="text-xs font-medium text-foreground">
                        {t("preview.chatPreviewTitle")}
                      </p>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-muted-foreground">
                          {t("preview.languageLabel")}
                        </p>
                        <div className="inline-flex items-center rounded-md border border-border/60 bg-card p-1">
                          <Button
                            type="button"
                            size="xs"
                            variant="ghost"
                            onClick={() => setPreviewLocale("en")}
                            className={previewLocale === "en"
                              ? "h-6 border border-brand/50 bg-brand/15 px-2 text-brand hover:bg-brand/25"
                              : "h-6 px-2 text-muted-foreground"}
                          >
                            {t("preview.english")}
                          </Button>
                          <Button
                            type="button"
                            size="xs"
                            variant="ghost"
                            onClick={() => setPreviewLocale("es")}
                            className={previewLocale === "es"
                              ? "h-6 border border-brand/50 bg-brand/15 px-2 text-brand hover:bg-brand/25"
                              : "h-6 px-2 text-muted-foreground"}
                          >
                            {t("preview.spanish")}
                          </Button>
                        </div>
                      </div>
                    </div>
                    <iframe
                      key={`${previewKey}-${theme}-${previewLocale}`}
                      src={`/w/preview/${sessionId}?name=${
                        encodeURIComponent(
                          bizName,
                        )
                      }&theme=${theme}&locale=${previewLocale}`}
                      className="w-full h-full border-0"
                      sandbox="allow-scripts allow-same-origin allow-forms"
                      title={t("preview.chatPreviewTitle")}
                    />
                  </div>
                )}
            </div>
          </div>
        )}
    </div>
  );
}
