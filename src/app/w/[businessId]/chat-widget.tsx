"use client";

import { Moon, Sun } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./widget.module.css";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  imageDataUrl?: string;
  time: Date;
}

interface Props {
  businessId?: string;
  sessionId?: string;
  businessName: string;
  mode: "live" | "preview";
  initialTheme?: "dark" | "light";
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
  { businessId, sessionId, businessName, mode, initialTheme }: Props,
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
  const fileRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      text: text || (image ? "I've attached a photo. Can you help?" : ""),
      imageDataUrl: image?.dataUrl,
      time: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setTyping(true);
    setTimeout(scrollToBottom, 50);

    try {
      const body = mode === "preview" ? { sessionId, message: userMsg.text } : {
        businessId,
        message: userMsg.text,
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

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          text: data.response,
          time: new Date(),
        },
      ]);
      setTimeout(scrollToBottom, 50);
    } catch {
      setTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          text: "Sorry, something went wrong. Please try again.",
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
                {mode === "preview" ? "Preview Mode" : "AI front desk"}
              </div>
            </div>
          </div>
          <button
            className={styles.themeToggle}
            onClick={toggleTheme}
            aria-label="Toggle theme"
            type="button"
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </header>

        {/* Messages */}
        <div className={styles.messagesArea}>
          {messages.length === 0 && (
            <div className={styles.emptyState}>
              <p>Hi! How can I help you today?</p>
            </div>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
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
                      alt="Attached"
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
              alt="Pending"
              className={styles.imagePreview}
            />
            <button
              onClick={() => setPendingImage(null)}
              className={styles.removeImage}
              type="button"
            >
              ✕
            </button>
          </div>
        )}

        {/* Input */}
        <div className={styles.inputArea}>
          <div className={styles.inputRow}>
            <button
              className={styles.attachBtn}
              onClick={() => fileRef.current?.click()}
              aria-label="Attach image"
              type="button"
            >
              📎
            </button>
            <textarea
              className={styles.messageInput}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={`Message ${businessName}…`}
              rows={1}
            />
            <button
              className={`${styles.sendBtn} ${
                (!input.trim() && !pendingImage) || sending
                  ? styles.sendDisabled
                  : ""
              }`}
              onClick={handleSend}
              disabled={(!input.trim() && !pendingImage) || sending}
              aria-label="Send"
              type="button"
            >
              ↑
            </button>
          </div>
          <p className={styles.poweredBy}>
            powered by{" "}
            <a href="https://wrenlo.app" target="_blank" rel="noreferrer">
              wrenlo
            </a>
          </p>
        </div>

        <input
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
