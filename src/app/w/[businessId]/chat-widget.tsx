"use client";

import { Moon, Sun } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  type AppLocale,
  DEFAULT_LOCALE,
  isSupportedLocale,
} from "@/18n/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import styles from "./widget.module.css";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  imageDataUrl?: string;
  time: Date;
  followUpQuestions?: string[];
  answerOptions?: string[];
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

type StreamMetaPayload = {
  conversationId?: string;
};

type StreamTokenPayload = {
  delta?: string;
};

type StreamDonePayload = {
  response?: string;
  followUpQuestions?: string[];
  answerOptions?: string[];
};

type StreamErrorPayload = {
  message?: string;
};

function parseEventBlock(
  block: string,
): { event: string; data: string } | null {
  const lines = block.split("\n");
  let event = "message";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
      continue;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }

  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join("\n") };
}

function getNearestScrollableAncestor(el: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = el.parentElement;
  while (node) {
    const style = window.getComputedStyle(node);
    const overflowY = style.overflowY;
    const canScroll = overflowY === "auto" || overflowY === "scroll";
    if (canScroll && node.scrollHeight > node.clientHeight) return node;
    node = node.parentElement;
  }
  return null;
}

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
  const appLocale = useLocale();
  const [activeLocale, setActiveLocale] = useState<AppLocale>(
    initialLocale ?? DEFAULT_LOCALE,
  );
  const t = useTranslations("widget");
  const fileRef = useRef<HTMLInputElement>(null);
  const messagesAreaRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});

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

  const scrollAssistantMessageToTop = useCallback((messageId: string) => {
    const messageElement = messageRefs.current[messageId];
    if (!(messageElement instanceof HTMLElement)) return;

    messageElement.scrollIntoView({
      block: "start",
      inline: "nearest",
      behavior: "auto",
    });

    const messagesArea = messagesAreaRef.current;
    if (messagesArea) {
      const localTop = messageElement.offsetTop;
      const localMax = Math.max(
        0,
        messagesArea.scrollHeight - messagesArea.clientHeight,
      );
      messagesArea.scrollTop = Math.max(0, Math.min(localTop, localMax));
    }

    const scroller = getNearestScrollableAncestor(messageElement);
    if (scroller) {
      const messageRect = messageElement.getBoundingClientRect();
      const scrollerRect = scroller.getBoundingClientRect();
      const targetTop = scroller.scrollTop +
        (messageRect.top - scrollerRect.top);
      const maxTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
      scroller.scrollTop = Math.max(0, Math.min(targetTop, maxTop));
    }
  }, []);

  const scheduleAssistantMessageAtTop = useCallback((messageId: string) => {
    [0, 30, 80, 160, 280, 420].forEach((delay) => {
      window.setTimeout(() => {
        scrollAssistantMessageToTop(messageId);
      }, delay);
    });
  }, [scrollAssistantMessageToTop]);

  const toggleTheme = () => {
    const next = !darkMode;
    setDarkMode(next);
    try {
      localStorage.setItem("wrenlo-widget-theme", next ? "dark" : "light");
    } catch {}
  };

  const streamAssistantResponse = useCallback(async (
    userMsg: Message,
    image: { dataUrl: string; mimeType: string } | null,
    assistantMessageId: string,
  ) => {
    const body = mode === "preview"
      ? {
        sessionId,
        message: userMsg.text,
        language: activeLocale,
        ...(image ? { image } : {}),
      }
      : {
        businessId,
        message: userMsg.text,
        language: activeLocale,
        ...(image ? { image } : {}),
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

    if (!res.ok) {
      let errorMessage = `HTTP ${res.status}`;
      try {
        const err = await res.json();
        if (typeof err?.error === "string") errorMessage = err.error;
      } catch {}
      throw new Error(errorMessage);
    }

    if (!res.body) throw new Error("Missing stream response body");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() ?? "";

      for (const block of blocks) {
        const parsed = parseEventBlock(block);
        if (!parsed) continue;

        const raw = JSON.parse(parsed.data) as
          | StreamMetaPayload
          | StreamTokenPayload
          | StreamDonePayload
          | StreamErrorPayload;

        if (parsed.event === "meta") {
          const payload = raw as StreamMetaPayload;
          if (payload.conversationId) setConvId(payload.conversationId);
          continue;
        }

        if (parsed.event === "token") {
          const payload = raw as StreamTokenPayload;
          const delta = typeof payload.delta === "string" ? payload.delta : "";
          if (!delta) continue;

          scrollAssistantMessageToTop(assistantMessageId);

          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, text: msg.text + delta }
                : msg
            )
          );
          continue;
        }

        if (parsed.event === "done") {
          const payload = raw as StreamDonePayload;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? {
                  ...msg,
                  text: typeof payload.response === "string" &&
                      payload.response.length > 0
                    ? payload.response
                    : msg.text,
                  followUpQuestions: Array.isArray(payload.followUpQuestions)
                    ? payload.followUpQuestions
                    : [],
                  answerOptions: Array.isArray(payload.answerOptions)
                    ? payload.answerOptions
                    : [],
                }
                : msg
            )
          );
          scheduleAssistantMessageAtTop(assistantMessageId);
          continue;
        }

        if (parsed.event === "error") {
          const payload = raw as StreamErrorPayload;
          throw new Error(payload.message || "Request failed");
        }
      }
    }
  }, [
    mode,
    sessionId,
    activeLocale,
    businessId,
    convId,
    scrollAssistantMessageToTop,
    scheduleAssistantMessageAtTop,
  ]);

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
    const assistantMessageId = (Date.now() + 1).toString();
    const assistantPlaceholder: Message = {
      id: assistantMessageId,
      role: "assistant",
      text: "",
      time: new Date(),
    };
    setMessages((prev) => [...prev, userMsg, assistantPlaceholder]);
    scheduleAssistantMessageAtTop(assistantMessageId);
    setTyping(true);

    try {
      await streamAssistantResponse(userMsg, image, assistantMessageId);
      setTyping(false);
    } catch {
      setTyping(false);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? { ...msg, text: t("requestFailed") }
            : msg
        )
      );
    } finally {
      setSending(false);
    }
  }, [
    sending,
    input,
    pendingImage,
    t,
    scheduleAssistantMessageAtTop,
    streamAssistantResponse,
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
    const assistantMessageId = (Date.now() + 1).toString();
    const assistantPlaceholder: Message = {
      id: assistantMessageId,
      role: "assistant",
      text: "",
      time: new Date(),
    };
    setMessages((prev) => [...prev, userMsg, assistantPlaceholder]);
    scheduleAssistantMessageAtTop(assistantMessageId);
    setTyping(true);

    try {
      await streamAssistantResponse(userMsg, null, assistantMessageId);
      setTyping(false);
    } catch {
      setTyping(false);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? { ...msg, text: t("requestFailed") }
            : msg
        )
      );
    } finally {
      setSending(false);
    }
  }, [
    scheduleAssistantMessageAtTop,
    t,
    streamAssistantResponse,
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
              <Image src="/wrenlo-icon.svg" alt="icon" width={30} height={30} />
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
        <div ref={messagesAreaRef} className={styles.messagesArea}>
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
              ref={(el) => {
                messageRefs.current[msg.id] = el;
              }}
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
                    <Image
                      src={msg.imageDataUrl}
                      alt={t("attachedAlt")}
                      className={styles.messageImage}
                    />
                  )}
                  {msg.role === "assistant"
                    ? (
                      <div className={styles.markdownContent}>
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            a: (props) => (
                              <a
                                {...props}
                                target="_blank"
                                rel="noopener noreferrer"
                              />
                            ),
                          }}
                        >
                          {msg.text}
                        </ReactMarkdown>
                      </div>
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
              {msg.role === "assistant" && msg.answerOptions &&
                msg.answerOptions.length > 0 && (
                <div className={styles.answerOptions}>
                  {msg.answerOptions.map((option) => (
                    <Button
                      key={`${msg.id}-ao-${option}`}
                      onClick={() => handleExampleQuestionClick(option)}
                      variant="outline"
                      size="sm"
                      className={styles.answerOptionBtn}
                      type="button"
                    >
                      {option}
                    </Button>
                  ))}
                </div>
              )}
              {msg.role === "assistant" && (!msg.answerOptions ||
                msg.answerOptions.length === 0) &&
                msg.followUpQuestions &&
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
        </div>

        {/* Image preview */}
        {pendingImage && (
          <div className={styles.imagePreviewArea}>
            <Image
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
