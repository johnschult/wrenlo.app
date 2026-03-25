"use client";

import {
  claimConversationAction,
  releaseConversationAction,
  sendOwnerMessageAction,
} from "@/actions/dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { Business, DbMessage } from "@/db/schema";
import { LocaleToggle } from "@/lib/locale";
import { ThemeToggle, useTheme } from "@/lib/theme";
import type {
  BusinessStats,
  ConversationWithCustomer,
} from "@/services/business";
import { UserButton } from "@clerk/nextjs";
import {
  ChevronLeft,
  Flame,
  Gauge,
  Inbox,
  MessageSquareText,
  Settings2,
  TrendingUp,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

const HOT_THRESHOLD = 3;
const REFRESH_MS = 30_000;

function parseDate(str: string) {
  if (!str) return new Date(0);
  const s = str.includes("T") ? str : `${str.replace(" ", "T")}Z`;
  return new Date(s);
}

function timeAgo(
  dateStr: string | null,
  locale: string,
  t: ReturnType<typeof useTranslations>,
) {
  if (!dateStr) return "";
  const diff = Math.floor((Date.now() - parseDate(dateStr).getTime()) / 1000);
  if (diff < 60) return t("time.justNow");
  if (diff < 3600) {
    return t("time.minutesAgo", { value: Math.floor(diff / 60) });
  }
  if (diff < 86400) {
    return t("time.hoursAgo", { value: Math.floor(diff / 3600) });
  }
  if (diff < 172800) return t("time.yesterday");
  return parseDate(dateStr).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
  });
}

function formatTime(dateStr: string, locale: string) {
  return parseDate(dateStr).toLocaleTimeString(locale, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function customerLabel(
  conv: ConversationWithCustomer,
  t: ReturnType<typeof useTranslations>,
) {
  return conv.customer_name || conv.customer_identifier ||
    t("customer.anonymous");
}

function statusBadgeClass(status: string) {
  if (status === "active") return "bg-green-500/15 text-green-500";
  if (status === "handed_off") return "bg-brand/15 text-brand";
  return "bg-accent text-muted-foreground";
}

interface Props {
  businessId: string;
  business: Business;
  initialConversations: ConversationWithCustomer[];
  initialStats: BusinessStats;
}

export function DashboardClient(
  { businessId, business, initialConversations, initialStats }: Props,
) {
  const { theme } = useTheme();
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const [conversations, setConversations] = useState(initialConversations);
  const [stats, setStats] = useState(initialStats);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DbMessage[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [compose, setCompose] = useState("");
  const [sending, setSending] = useState(false);
  const [view, setView] = useState<"list" | "detail">("list");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selected =
    conversations.find((conversation) => conversation.id === selectedId) ??
      null;
  const visibleMessages = messages.filter((message) =>
    message.role !== "system"
  );
  const claimedCount =
    conversations.filter((conversation) => conversation.status === "handed_off")
      .length;
  const highestLeadScore = conversations.reduce((max, conv) => {
    const score = typeof conv.leadScore === "number" ? conv.leadScore : 0;
    return Math.max(max, score);
  }, 0);

  const summaryCards = [
    {
      label: t("summary.activeThreads"),
      value: stats.active,
      icon: MessageSquareText,
      accent: "text-foreground",
      chip: t("summary.liveChip", { value: stats.active }),
      headline: stats.active === 0
        ? t("summary.activeNone")
        : stats.active === 1
        ? t("summary.activeOne")
        : t("summary.activeMany", { value: stats.active }),
      description: claimedCount === 0
        ? t("summary.claimedNone")
        : claimedCount === 1
        ? t("summary.claimedOne")
        : t("summary.claimedMany", { value: claimedCount }),
    },
    {
      label: t("summary.hotLeads"),
      value: stats.hot_leads,
      icon: Flame,
      accent: stats.hot_leads > 0 ? "text-brand" : "text-foreground",
      chip: t("summary.scoreChip", { value: HOT_THRESHOLD }),
      headline: stats.hot_leads === 0
        ? t("summary.hotNone")
        : stats.hot_leads === 1
        ? t("summary.hotOne")
        : t("summary.hotMany", { value: stats.hot_leads }),
      description: highestLeadScore === 0
        ? t("summary.highestNone")
        : t("summary.highestValue", { value: highestLeadScore }),
    },
    {
      label: t("summary.startedToday"),
      value: stats.today,
      icon: TrendingUp,
      accent: "text-foreground",
      chip: t("summary.todayChip"),
      headline: stats.today === 0
        ? t("summary.todayNone")
        : stats.today === 1
        ? t("summary.todayOne")
        : t("summary.todayMany", { value: stats.today }),
      description: t("summary.todayBased"),
    },
    {
      label: t("summary.totalTracked"),
      value: stats.total,
      icon: Inbox,
      accent: "text-foreground",
      chip: t("summary.allTimeChip"),
      headline: stats.total === 1
        ? t("summary.totalOne")
        : t("summary.totalMany", { value: stats.total }),
      description: t("summary.totalDescription"),
    },
  ] as const;

  const refresh = useCallback(async () => {
    try {
      const [convsRes, statsRes] = await Promise.all([
        fetch(`/api/owner/${businessId}/conversations`),
        fetch(`/api/owner/${businessId}/stats`),
      ]);
      if (convsRes.ok) {
        const data = await convsRes.json();
        setConversations(data.conversations ?? []);
      }
      if (statsRes.ok) setStats(await statsRes.json());
    } catch {
      // silent
    }
  }, [businessId]);

  useEffect(() => {
    const timer = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (!selectedId) return;
    setLoadingMsgs(true);
    fetch(`/api/conversations/${selectedId}`)
      .then((response) => response.json())
      .then((data) => {
        const msgs = data.messages ?? [];
        setMessages(msgs);
      })
      .catch(() => setMessages([]))
      .finally(() => setLoadingMsgs(false));
  }, [selectedId]);

  useEffect(() => {
    if (!messages.length) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const openConversation = (id: string) => {
    setSelectedId(id);
    setView("detail");
  };

  const handleClaim = async () => {
    if (!selectedId) return;
    await claimConversationAction(
      selectedId,
      business.ownerName ?? t("ownerFallback"),
    );
    await refresh();
    const response = await fetch(`/api/conversations/${selectedId}`);
    const data = await response.json();
    const msgs = data.messages ?? [];
    setMessages(msgs);
  };

  const handleRelease = async () => {
    if (!selectedId || !confirm(t("releaseConfirm"))) return;
    await releaseConversationAction(selectedId);
    await refresh();
  };

  const handleSend = async () => {
    if (!selectedId || !compose.trim()) return;
    setSending(true);
    const text = compose.trim();
    setCompose("");
    try {
      await sendOwnerMessageAction(
        selectedId,
        text,
        business.ownerName ?? t("ownerFallback"),
      );
      const response = await fetch(`/api/conversations/${selectedId}`);
      const data = await response.json();
      const msgs = data.messages ?? [];
      setMessages(msgs);
      await refresh();
    } finally {
      setSending(false);
    }
  };

  const isClaimed = selected?.status === "handed_off";

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

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="shrink-0 border-b border-border/70 bg-background/95 px-4 py-3 backdrop-blur md:px-6">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/wrenlo-icon.svg" alt="" width={31} height={31} />
            <div className="flex flex-col">
              <span className="text-md font-semibold leading-none">
                {business.name}
              </span>
              <span className="text-xs text-muted-foreground">
                {t("ownerDashboard")}
              </span>
            </div>
          </Link>
          <div className="flex items-center gap-2 md:gap-3">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="h-8 min-w-24 justify-center px-2.5"
            >
              <Link href={`/setup/${businessId}`} className="flex items-center">
                <Settings2 className="size-4" />
                {t("setup")}
              </Link>
            </Button>
            <LocaleToggle />
            <ThemeToggle />
            <UserButton appearance={clerkAppearance} />
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 md:gap-4 md:p-6">
        <div className="md:hidden shrink-0 flex gap-2 overflow-x-auto pb-1">
          <div className="flex shrink-0 gap-2">
            <div className="flex min-w-max items-center gap-1.5 rounded-lg border border-border/60 bg-card/60 px-2.5 py-1.5 text-xs">
              <MessageSquareText className="size-3.5 text-foreground" />
              <span className="font-medium">{stats.active}</span>
              <span className="text-muted-foreground">active</span>
              <span className="text-muted-foreground">
                {t("mobile.active")}
              </span>
            </div>
            <div className="flex min-w-max items-center gap-1.5 rounded-lg border border-border/60 bg-card/60 px-2.5 py-1.5 text-xs">
              <Flame className="size-3.5 text-brand" />
              <span className="font-medium">{stats.hot_leads}</span>
              <span className="text-muted-foreground">{t("mobile.hot")}</span>
            </div>
            <div className="flex min-w-max items-center gap-1.5 rounded-lg border border-border/60 bg-card/60 px-2.5 py-1.5 text-xs">
              <TrendingUp className="size-3.5 text-foreground" />
              <span className="font-medium">{stats.today}</span>
              <span className="text-muted-foreground">{t("mobile.today")}</span>
            </div>
            <div className="flex min-w-max items-center gap-1.5 rounded-lg border border-border/60 bg-card/60 px-2.5 py-1.5 text-xs">
              <Inbox className="size-3.5 text-foreground" />
              <span className="font-medium">{stats.total}</span>
              <span className="text-muted-foreground">{t("mobile.total")}</span>
            </div>
          </div>
        </div>

        <div className="hidden shrink-0 grid-cols-5 gap-4 md:grid xl:grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,1fr))]">
          <Card className="border border-border/70 bg-linear-to-br from-card via-card to-muted/40">
            <CardHeader className="gap-4">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Gauge className="size-4 text-brand" />
                  {t("command.title")}
                </CardTitle>
                <Badge variant="secondary" className="bg-brand/15 text-brand">
                  {t("command.openThreads", { value: conversations.length })}
                </Badge>
              </div>
              <CardDescription className="max-w-none text-base leading-relaxed text-muted-foreground">
                {t("command.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
              <div className="flex min-h-32 flex-col rounded-2xl border border-border/60 bg-background/80 p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground/80">
                  {t("command.activeNow")}
                </p>
                <p className="mt-auto text-3xl font-semibold tracking-tight text-foreground">
                  {stats.active}
                </p>
              </div>
              <div className="flex min-h-32 flex-col rounded-2xl border border-border/60 bg-background/80 p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground/80">
                  {t("command.claimedNow")}
                </p>
                <p className="mt-auto text-3xl font-semibold tracking-tight text-foreground">
                  {claimedCount}
                </p>
              </div>
              <div className="flex min-h-32 flex-col rounded-2xl border border-border/60 bg-background/80 p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground/80">
                  {t("command.highestLeadScore")}
                </p>
                <p className="mt-auto text-3xl font-semibold tracking-tight text-foreground">
                  {highestLeadScore}
                </p>
              </div>
            </CardContent>
          </Card>

          {summaryCards.map((
            { label, value, icon: Icon, accent, chip, headline, description },
          ) => (
            <Card
              key={label}
              className="flex h-full flex-col rounded-xl border border-border/70 bg-card/90 p-6 shadow-sm"
            >
              <CardHeader className="grid auto-rows-min grid-cols-[1fr_auto] grid-rows-[auto_auto] items-start gap-2 p-0">
                <CardDescription className="text-sm text-muted-foreground">
                  {label}
                </CardDescription>
                <CardTitle
                  className={`text-2xl font-semibold tabular-nums md:text-3xl ${accent}`}
                >
                  {value ?? "—"}
                </CardTitle>
                <div className="col-start-2 row-span-2 row-start-1 self-start justify-self-end">
                  <Badge
                    variant="outline"
                    className="inline-flex shrink-0 items-center justify-center gap-1 rounded-full border-border px-2 py-0.5 text-xs font-medium"
                  >
                    <Icon className="size-3" />
                    {chip}
                  </Badge>
                </div>
              </CardHeader>
              <div className="mt-auto flex flex-col items-start gap-1.5 p-0 text-sm">
                <div className="line-clamp-1 flex gap-2 font-medium text-foreground">
                  {headline}
                </div>
                <div className="text-muted-foreground">
                  {description}
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="flex min-h-0 flex-1 gap-2 md:gap-3 lg:gap-4">
          <div
            className={`${
              view === "detail" ? "hidden lg:flex" : "flex"
            } min-h-0 w-full flex-col shrink-0 sm:w-64 md:w-72 lg:w-80 xl:w-96`}
          >
            <Card className="flex min-h-0 flex-1 border border-border/70 bg-card/90 py-0">
              <CardHeader className="border-b border-border/60 py-2 md:py-3 lg:py-4">
                <div className="flex flex-col items-start justify-between gap-1 md:gap-2">
                  <div className="flex w-full items-center justify-between gap-2">
                    <CardTitle className="text-sm md:text-sm lg:text-base">
                      {t("conversations.title")}
                    </CardTitle>
                    <Badge
                      variant="outline"
                      className="shrink-0 text-[10px] md:text-xs"
                    >
                      {conversations.length}
                    </Badge>
                  </div>
                  <CardDescription className="hidden text-xs md:block md:text-xs lg:text-sm">
                    {t("conversations.pickThread")}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 px-0 sm:px-0">
                <div className="h-full overflow-y-auto">
                  {conversations.length === 0
                    ? (
                      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
                        <div className="rounded-full border border-border/60 bg-background/80 p-4">
                          <MessageSquareText className="size-6" />
                        </div>
                        <p className="text-sm leading-relaxed">
                          {t("conversations.none")}
                          <br />
                          {t("conversations.ready")}
                        </p>
                      </div>
                    )
                    : (
                      conversations.map((conv) => {
                        const isHot = conv.leadScore >= HOT_THRESHOLD;
                        const label = customerLabel(conv, t);
                        const preview = conv.last_message ??
                          t("conversations.noMessages");
                        const time = timeAgo(
                          conv.last_message_at || conv.updatedAt,
                          locale,
                          t,
                        );
                        return (
                          <Button
                            key={conv.id}
                            onClick={() => openConversation(conv.id)}
                            variant="ghost"
                            className={`h-auto w-full justify-start gap-1.5 rounded-none border-b border-border/60 px-1.5 py-1 text-left font-normal text-sm hover:bg-accent/40 md:gap-2 md:px-3 md:py-1.5 md:text-sm lg:gap-3 lg:px-4 lg:py-2 ${
                              selectedId === conv.id
                                ? "bg-brand/12 hover:bg-brand/15"
                                : ""
                            }`}
                          >
                            <div className="relative mt-0.5 shrink-0">
                              <div className="flex h-7 w-7 items-center justify-center rounded-full border border-border/60 bg-background text-xs font-medium md:h-8 md:w-8 md:text-xs lg:h-10 lg:w-10 lg:text-sm">
                                {label[0]?.toUpperCase()}
                              </div>
                              {isHot && (
                                <span className="absolute -right-1 -top-1 text-xs">
                                  🔥
                                </span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="mb-0.5 flex items-center justify-between gap-0.5">
                                <span className="truncate text-xs font-medium md:text-xs lg:text-sm">
                                  {label}
                                </span>
                                <span className="shrink-0 text-[10px] text-muted-foreground md:text-[10px]">
                                  {time}
                                </span>
                              </div>
                              <p className="truncate text-xs text-muted-foreground md:text-[10px] lg:text-xs">
                                {preview.slice(0, 50)}
                              </p>
                              <div className="mt-0.5 flex items-center gap-0.5 md:mt-1 md:gap-1">
                                <Badge
                                  variant="secondary"
                                  className={`h-auto px-0.5 py-0 text-xs md:px-1 md:py-0 md:text-[9px] lg:px-1.5 lg:py-0.5 lg:text-[10px] ${
                                    statusBadgeClass(conv.status)
                                  }`}
                                >
                                  {conv.status === "active"
                                    ? t("status.active")
                                    : conv.status === "handed_off"
                                    ? t("status.claimed")
                                    : conv.status === "closed"
                                    ? t("status.closed")
                                    : conv.status === "resolved"
                                    ? t("status.resolved")
                                    : conv.status}
                                </Badge>
                                {conv.leadScore > 0 && (
                                  <span className="text-xs text-muted-foreground md:text-[9px] lg:text-[10px]">
                                    ★ {conv.leadScore}
                                  </span>
                                )}
                              </div>
                            </div>
                          </Button>
                        );
                      })
                    )}
                </div>
              </CardContent>
            </Card>
          </div>

          {view === "detail" && selected
            ? (
              <Card className="min-h-0 flex-1 border border-border/70 bg-card/90 py-0 md:flex lg:flex">
                <CardHeader className="border-b border-border/60 py-2 md:py-3 lg:py-4">
                  <div className="flex items-center gap-2 md:gap-2 lg:gap-3">
                    <Button
                      onClick={() => setView("list")}
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 md:h-8 md:w-8 lg:hidden"
                    >
                      <ChevronLeft className="size-4 md:size-5" />
                    </Button>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1 md:gap-2">
                        <CardTitle className="text-xs md:text-sm lg:text-base">
                          {customerLabel(selected, t)}
                        </CardTitle>
                        <Badge
                          variant="secondary"
                          className={`h-auto px-0.5 py-0 text-[8px] md:px-1 md:py-0 md:text-[9px] lg:px-1.5 lg:py-0.5 lg:text-[10px] ${
                            statusBadgeClass(selected.status)
                          }`}
                        >
                          {selected.status === "active"
                            ? t("status.active")
                            : selected.status === "handed_off"
                            ? t("status.claimed")
                            : selected.status === "closed"
                            ? t("status.closed")
                            : t("status.resolved")}
                        </Badge>
                        {selected.leadScore >= HOT_THRESHOLD && (
                          <Badge
                            variant="outline"
                            className="gap-1 text-[8px] text-brand md:text-[9px] lg:text-xs"
                          >
                            <Flame className="size-2.5 md:size-3" />
                            {selected.leadScore}
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="text-[10px] md:text-xs lg:text-sm">
                        {selected.customer_identifier ||
                          t("detail.liveConversation")}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 md:p-4">
                  {loadingMsgs
                    ? (
                      <div className="flex h-full items-center justify-center">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand border-t-transparent" />
                      </div>
                    )
                    : visibleMessages.length === 0
                    ? (
                      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                        {t("conversations.noMessages")}
                      </div>
                    )
                    : (
                      visibleMessages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex ${
                            msg.role === "user"
                              ? "justify-start"
                              : "justify-end"
                          }`}
                        >
                          <div
                            className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-xs md:max-w-[75%] md:px-3.5 md:py-2 md:text-sm ${
                              msg.role === "user"
                                ? "border border-border bg-card text-foreground"
                                : msg.role === "owner"
                                ? "bg-brand/40 text-foreground"
                                : "bg-accent text-foreground"
                            }`}
                          >
                            {msg.role === "assistant" && (
                              <p className="mb-0.5 text-[9px] text-muted-foreground md:mb-1 md:text-[10px]">
                                {t("detail.assistantName")}
                              </p>
                            )}
                            {msg.role === "owner" && (
                              <Badge
                                variant="secondary"
                                className="mb-1 h-auto border border-brand/30 bg-background/95 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-[0.18em] text-foreground shadow-sm md:text-[10px]"
                              >
                                {t("detail.ownerBadge")}
                              </Badge>
                            )}
                            <p className="whitespace-pre-wrap leading-relaxed">
                              {msg.content}
                            </p>
                            <p className="mt-0.5 text-right text-[8px] opacity-50 md:mt-1 md:text-[10px]">
                              {formatTime(msg.createdAt, locale)}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  <div ref={messagesEndRef} />
                </CardContent>

                <div className="shrink-0 border-t border-border/60 bg-muted/30 p-2 md:p-3 lg:p-4">
                  {!isClaimed
                    ? (
                      <Button
                        onClick={handleClaim}
                        className="h-9 text-sm md:h-11 md:text-base w-full"
                      >
                        {t("detail.takeOver")}
                      </Button>
                    )
                    : (
                      <div className="space-y-1.5 md:space-y-2">
                        <div className="flex gap-1.5">
                          <Textarea
                            value={compose}
                            onChange={(e) => setCompose(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                              }
                            }}
                            placeholder={t("detail.messagePlaceholder")}
                            rows={1}
                            className="min-h-8 text-xs md:min-h-10 md:text-sm flex-1 resize-none bg-card"
                          />
                          <Button
                            onClick={handleSend}
                            disabled={sending || !compose.trim()}
                            className="h-8 md:h-auto self-stretch px-2.5 md:px-4 text-xs md:text-base"
                          >
                            {sending ? "…" : "↑"}
                          </Button>
                        </div>
                        <Button
                          onClick={handleRelease}
                          variant="ghost"
                          size="sm"
                          className="w-full text-[10px] md:text-xs text-muted-foreground hover:text-foreground h-6 md:h-9"
                        >
                          {t("detail.release")}
                        </Button>
                      </div>
                    )}
                </div>
              </Card>
            )
            : (
              <Card className="hidden flex-1 items-center justify-center border border-dashed border-border/70 bg-card/60 py-0 lg:flex">
                <CardContent className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
                  <div className="rounded-full border border-border/60 bg-background/80 p-4">
                    <MessageSquareText className="size-6" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {t("detail.selectTitle")}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t("detail.selectDescription")}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
        </div>
      </div>
    </div>
  );
}
