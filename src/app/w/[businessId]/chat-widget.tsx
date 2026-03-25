"use client";

import {
  type AppLocale,
  DEFAULT_LOCALE,
  isSupportedLocale,
} from "@/18n/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Moon, Sun } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./widget.module.css";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  imageDataUrl?: string;
  time: Date;
  followUpQuestions?: string[];
}

interface Props {
  businessId?: string;
  sessionId?: string;
  businessName: string;
  mode: "live" | "preview";
  initialTheme?: "dark" | "light";
  initialLocale?: AppLocale;
  exampleQuestions?: string[];
}

type LocaleMessage = {
  type?: string;
  locale?: string;
};

function resolveLocale(
  candidates: Array<string | null | undefined>,
): AppLocale {
  for (const candidate of candidates) {
    if (isSupportedLocale(candidate)) return candidate;
  }
  return DEFAULT_LOCALE;
}

function getLocaleFromSearch(): AppLocale | null {
  if (typeof window === "undefined") return null;
  const searchLocale = new URL(window.location.href).searchParams.get("locale");
  return isSupportedLocale(searchLocale) ? searchLocale : null;
}

function renderMarkdown(text: string): string {
  let html = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(
    />/g,
    "&gt;",
  );
  html = html.replace(/```[\s\S]*?```/g, (m) => {
    const code = m.slice(3, -3).replace(/^\n/, "");
    return `<pre><code>${code}</code></pre>`;
  });
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
  );
  html = html.replace(/^[ \t]*[-*+] (.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`);
  const parts = html.split(/\n{2,}/);
  html = parts
    .map((p) => {
      const trimmed = p.trim();
      if (!trimmed) return "";
      if (trimmed.startsWith("<ul>") || trimmed.startsWith("<pre>")) {
        return trimmed;
      }
      return `<p>${trimmed.replace(/\n/g, "<br>")}</p>`;
    })
    .filter(Boolean)
    .join("\n");
  return html;
}

export function ChatWidget(
  {
    businessId,
    sessionId,
    businessName,
    mode,
    initialTheme,
    initialLocale,
    exampleQuestions,
  }: Props,
) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const [pendingImage, setPendingImage] = useState<
    { dataUrl: string; mimeType: string } | null
  >(null);
  // Always start dark on SSR; useEffect sets correct value on client
  const [darkMode, setDarkMode] = useState(true);
  const [convId, setConvId] = useState<string | null>(null);
  const [showExampleQuestions, setShowExampleQuestions] = useState(true);
  const [pendingAssistantMessageId, setPendingAssistantMessageId] = useState<
    string | null
  >(null);
  const appLocale = useLocale();
  const [activeLocale, setActiveLocale] = useState<AppLocale>(
    initialLocale ?? DEFAULT_LOCALE,
  );
  const t = useTranslations("widget");
  const fileRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const browserLocale = typeof navigator === "undefined"
      ? null
      : navigator.language.toLowerCase().split("-")[0];
    const resolved = resolveLocale([
      getLocaleFromSearch(),
      initialLocale,
      appLocale,
      browserLocale,
    ]);
    setActiveLocale(resolved);
  }, [initialLocale, appLocale]);

  useEffect(() => {
    const onMessage = (event: MessageEvent<LocaleMessage>) => {
      if (!event.data || typeof event.data !== "object") return;
      if (event.data.type !== "wrenlo:set-locale") return;
      if (!isSupportedLocale(event.data.locale)) return;

      const nextLocale = event.data.locale;
      setActiveLocale(nextLocale);

      const url = new URL(window.location.href);
      if (url.searchParams.get("locale") !== nextLocale) {
        url.searchParams.set("locale", nextLocale);
        window.location.replace(url.toString());
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    // Preview mode: always use the app theme passed via prop (no localStorage)
    if (mode === "preview" && initialTheme) {
      setDarkMode(initialTheme === "dark");
      return;
    }
    try {
      const saved = localStorage.getItem("wrenlo-widget-theme");
      if (saved) {
        setDarkMode(saved === "dark");
      } else {
        setDarkMode(window.matchMedia("(prefers-color-scheme: dark)").matches);
      }
    } catch {}
  }, [mode, initialTheme]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const scrollAssistantMessageToTop = useCallback((messageId: string) => {
    const messageElement = document.querySelector(
      `[data-message-id="${messageId}"]`,
    );
    if (messageElement instanceof HTMLElement) {
      messageElement.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  useEffect(() => {
    if (!pendingAssistantMessageId) return;

    const rafId = window.requestAnimationFrame(() => {
      scrollAssistantMessageToTop(pendingAssistantMessageId);
      setPendingAssistantMessageId(null);
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [pendingAssistantMessageId, scrollAssistantMessageToTop]);

  const toggleTheme = () => {
    const next = !darkMode;
    setDarkMode(next);
    try {
      localStorage.setItem("wrenlo-widget-theme", next ? "dark" : "light");
    } catch {}
  };

  const handleSend = useCallback(async () => {
    if (sending) return;
    const text = input.trim();
    const image = pendingImage;
    if (!text && !image) return;

    setSending(true);
    setInput("");
    setPendingImage(null);
    setShowExampleQuestions(false);

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      text: text || (image ? t("attachedPhotoPrompt") : ""),
      imageDataUrl: image?.dataUrl,
      time: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setTyping(true);
    setTimeout(scrollToBottom, 50);

    try {
      const body = mode === "preview"
        ? { sessionId, message: userMsg.text, language: activeLocale }
        : {
          businessId,
          message: userMsg.text,
          language: activeLocale,
          ...(convId ? { conversationId: convId } : {}),
        };

      const endpoint = mode === "preview"
        ? "/api/intake/preview-chat"
        : "/api/chat";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (data.conversationId) setConvId(data.conversationId);

      await new Promise((r) => setTimeout(r, 400 + Math.random() * 400));
      setTyping(false);

      const assistantMessageId = (Date.now() + 1).toString();
      setPendingAssistantMessageId(assistantMessageId);
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMessageId,
          role: "assistant",
          text: data.response,
          time: new Date(),
          followUpQuestions: data.followUpQuestions,
        },
      ]);
    } catch {
      setTyping(false);
      const assistantMessageId = (Date.now() + 1).toString();
      setPendingAssistantMessageId(assistantMessageId);
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMessageId,
          role: "assistant",
          text: t("requestFailed"),
          time: new Date(),
        },
      ]);
    } finally {
      setSending(false);
    }
  }, [
    sending,
    input,
    pendingImage,
    mode,
    sessionId,
    businessId,
    convId,
    activeLocale,
    t,
    scrollToBottom,
  ]);

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setPendingImage({
        dataUrl: e.target?.result as string,
        mimeType: file.type,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleExampleQuestionClick = useCallback(async (question: string) => {
    setShowExampleQuestions(false);
    setSending(true);

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      text: question,
      time: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setTyping(true);
    setTimeout(scrollToBottom, 50);

    try {
      const body = mode === "preview"
        ? { sessionId, message: question, language: activeLocale }
        : {
          businessId,
          message: question,
          language: activeLocale,
          ...(convId ? { conversationId: convId } : {}),
        };

      const endpoint = mode === "preview"
        ? "/api/intake/preview-chat"
        : "/api/chat";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (data.conversationId) setConvId(data.conversationId);

      await new Promise((r) => setTimeout(r, 400 + Math.random() * 400));
      setTyping(false);

      const assistantMessageId = (Date.now() + 1).toString();
      setPendingAssistantMessageId(assistantMessageId);
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMessageId,
          role: "assistant",
          text: data.response,
          time: new Date(),
          followUpQuestions: data.followUpQuestions,
        },
      ]);
    } catch {
      setTyping(false);
      const assistantMessageId = (Date.now() + 1).toString();
      setPendingAssistantMessageId(assistantMessageId);
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMessageId,
          role: "assistant",
          text: t("requestFailed"),
          time: new Date(),
        },
      ]);
    } finally {
      setSending(false);
    }
  }, [
    mode,
    sessionId,
    businessId,
    convId,
    activeLocale,
    t,
    scrollToBottom,
  ]);

  return (
    <div
      className={`${styles.body} ${darkMode ? styles.dark : ""} ${
        mode === "preview" ? styles.preview : ""
      }`}
    >
      <div className={styles.chatContainer}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.avatar}>
              <img src="/wrenlo-icon.svg" alt="" />
            </div>
            <div>
              <div className={styles.businessName}>{businessName}</div>
              <div className={styles.businessTagline}>
                {mode === "preview" ? t("previewMode") : t("aiFrontDesk")}
              </div>
            </div>
          </div>
          <Button
            className={styles.themeToggle}
            onClick={toggleTheme}
            aria-label="Toggle theme"
            type="button"
            variant="ghost"
            size="icon-sm"
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </Button>
        </header>

        {/* Messages */}
        <div className={styles.messagesArea}>
          {messages.length === 0 && (
            <div className={styles.emptyState}>
              <p>{t("emptyGreeting")}</p>
              {showExampleQuestions && exampleQuestions &&
                exampleQuestions.length > 0 && (
                <div className={styles.exampleQuestions}>
                  {exampleQuestions.map((question) => (
                    <Button
                      key={question}
                      onClick={() => handleExampleQuestionClick(question)}
                      variant="outline"
                      size="sm"
                      className={styles.exampleQuestionBtn}
                      type="button"
                    >
                      {question}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              data-message-id={msg.id}
              className={`${styles.messageGroup} ${
                msg.role === "user" ? styles.userGroup : styles.assistantGroup
              }`}
            >
              <div
                className={`${styles.message} ${
                  msg.role === "user"
                    ? styles.userMessage
                    : styles.assistantMessage
                }`}
              >
                <div className={styles.messageContent}>
                  {msg.imageDataUrl && (
                    <img
                      src={msg.imageDataUrl}
                      alt={t("attachedAlt")}
                      className={styles.messageImage}
                    />
                  )}
                  {msg.role === "assistant"
                    ? (
                      <div
                        // biome-ignore lint/security/noDangerouslySetInnerHtml: This is safe because the content is sanitized Markdown
                        dangerouslySetInnerHTML={{
                          __html: renderMarkdown(msg.text),
                        }}
                      />
                    )
                    : <p>{msg.text}</p>}
                </div>
                <span className={styles.messageTime}>
                  {msg.time.toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              {msg.role === "assistant" && msg.followUpQuestions &&
                msg.followUpQuestions.length > 0 && (
                <div className={styles.followUpQuestions}>
                  {msg.followUpQuestions.map((question) => (
                    <Button
                      key={`${msg.id}-${question}`}
                      onClick={() => handleExampleQuestionClick(question)}
                      variant="outline"
                      size="sm"
                      className={styles.followUpQuestionBtn}
                      type="button"
                    >
                      {question}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          ))}
          {typing && (
            <div className={`${styles.messageGroup} ${styles.assistantGroup}`}>
              <div
                className={`${styles.message} ${styles.assistantMessage} ${styles.typingMessage}`}
              >
                <div className={styles.typingDots}>
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Image preview */}
        {pendingImage && (
          <div className={styles.imagePreviewArea}>
            <img
              src={pendingImage.dataUrl}
              alt={t("pendingAlt")}
              className={styles.imagePreview}
            />
            <Button
              onClick={() => setPendingImage(null)}
              className={styles.removeImage}
              type="button"
              variant="ghost"
              size="icon-sm"
            >
              ✕
            </Button>
          </div>
        )}

        {/* Input */}
        <div className={styles.inputArea}>
          <div className={styles.inputRow}>
            <Button
              className={styles.attachBtn}
              onClick={() => fileRef.current?.click()}
              aria-label={t("attachAria")}
              type="button"
              variant="ghost"
              size="icon-sm"
            >
              📎
            </Button>
            <input
              type="text"
              className={styles.messageInput}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={t("messagePlaceholder", { businessName })}
            />
            <Button
              className={`${styles.sendBtn} ${
                (!input.trim() && !pendingImage) || sending
                  ? styles.sendDisabled
                  : ""
              }`}
              onClick={handleSend}
              disabled={(!input.trim() && !pendingImage) || sending}
              aria-label={t("sendAria")}
              type="button"
            >
              ↑
            </Button>
          </div>
          <p className={styles.poweredBy}>
            {t("poweredBy")}{"  "}
            <a href="https://wrenlo.app" target="_blank" rel="noreferrer">
              wrenlo
            </a>
          </p>
        </div>

        <Input
          ref={fileRef}
          type="file"
          accept="image/*"
          className={styles.hiddenFileInput}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
