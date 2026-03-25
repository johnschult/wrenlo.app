'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';
import { ThemeToggle, useTheme } from '@/src/lib/theme';
import {
  claimConversationAction,
  releaseConversationAction,
  sendOwnerMessageAction,
} from '@/src/actions/dashboard';
import type { Business, DbMessage } from '@/src/db/schema';
import type { ConversationWithCustomer, BusinessStats } from '@/src/services/business';

const HOT_THRESHOLD = 3;
const REFRESH_MS = 30_000;

function parseDate(str: string) {
  if (!str) return new Date(0);
  const s = str.includes('T') ? str : str.replace(' ', 'T') + 'Z';
  return new Date(s);
}

function timeAgo(dateStr: string | null) {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - parseDate(dateStr).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 172800) return 'Yesterday';
  return parseDate(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTime(dateStr: string) {
  return parseDate(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function customerLabel(conv: ConversationWithCustomer) {
  return conv.customer_name || conv.customer_identifier || 'Anonymous';
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  handed_off: 'Claimed',
  closed: 'Closed',
  resolved: 'Resolved',
};

interface Props {
  businessId: string;
  business: Business;
  initialConversations: ConversationWithCustomer[];
  initialStats: BusinessStats;
}

export function DashboardClient({ businessId, business, initialConversations, initialStats }: Props) {
  const { theme } = useTheme();
  const [conversations, setConversations] = useState(initialConversations);
  const [stats, setStats] = useState(initialStats);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DbMessage[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [compose, setCompose] = useState('');
  const [sending, setSending] = useState(false);
  const [view, setView] = useState<'list' | 'detail'>('list');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  const refresh = useCallback(async () => {
    try {
      const [convsRes, statsRes] = await Promise.all([
        fetch(`/api/owner/${businessId}/conversations`),
        fetch(`/api/owner/${businessId}/stats`),
      ]);
      if (convsRes.ok) {
        const d = await convsRes.json();
        setConversations(d.conversations ?? []);
      }
      if (statsRes.ok) setStats(await statsRes.json());
    } catch {
      // silent
    }
  }, [businessId]);

  useEffect(() => {
    const t = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    if (!selectedId) return;
    setLoadingMsgs(true);
    fetch(`/api/conversations/${selectedId}`)
      .then((r) => r.json())
      .then((d) => setMessages(d.messages ?? []))
      .catch(() => setMessages([]))
      .finally(() => setLoadingMsgs(false));
  }, [selectedId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const openConversation = (id: string) => {
    setSelectedId(id);
    setView('detail');
  };

  const handleClaim = async () => {
    if (!selectedId) return;
    await claimConversationAction(selectedId, business.ownerName ?? 'Owner');
    await refresh();
    const res = await fetch(`/api/conversations/${selectedId}`);
    const d = await res.json();
    setMessages(d.messages ?? []);
  };

  const handleRelease = async () => {
    if (!selectedId || !confirm('Release back to AI?')) return;
    await releaseConversationAction(selectedId);
    await refresh();
  };

  const handleSend = async () => {
    if (!selectedId || !compose.trim()) return;
    setSending(true);
    const text = compose.trim();
    setCompose('');
    try {
      await sendOwnerMessageAction(selectedId, text, business.ownerName ?? 'Owner');
      const res = await fetch(`/api/conversations/${selectedId}`);
      const d = await res.json();
      setMessages(d.messages ?? []);
      await refresh();
    } finally {
      setSending(false);
    }
  };

  const isClaimed = selected?.status === 'handed_off';

  const clerkAppearance = {
    variables: {
      colorPrimary: '#D85A30',
      colorBackground: theme === 'dark' ? '#1a1a19' : '#ffffff',
      colorText: theme === 'dark' ? '#e8e8e6' : '#0d0d0c',
      colorTextSecondary: theme === 'dark' ? '#a8a89e' : '#6b6b65',
      colorNeutral: theme === 'dark' ? '#e8e8e6' : '#0d0d0c',
      colorInputBackground: theme === 'dark' ? '#262625' : '#f5f5f4',
      colorInputText: theme === 'dark' ? '#e8e8e6' : '#0d0d0c',
    },
  };

  return (
    <div className="h-screen flex flex-col bg-[var(--bg)] text-[var(--text)]">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-1.5">
            <Image src="/wrenlo-icon.svg" alt="" width={22} height={22} />
          </Link>
          <span className="font-semibold text-sm">{business.name}</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/setup/${businessId}`}
            className="text-sm text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors"
          >
            Settings
          </Link>
          <ThemeToggle />
          <UserButton appearance={clerkAppearance} />
        </div>
      </header>

      {/* Stats bar */}
      <div className="grid grid-cols-4 border-b border-[var(--border)] shrink-0">
        {[
          { label: 'Active', value: stats.active },
          { label: 'Hot leads', value: stats.hot_leads, hot: true },
          { label: 'Today', value: stats.today },
          { label: 'Total', value: stats.total },
        ].map(({ label, value, hot }) => (
          <div key={label} className="flex flex-col items-center py-3 border-r last:border-r-0 border-[var(--border)]">
            <span className={`text-xl font-bold ${hot && value > 0 ? 'text-brand' : ''}`}>{value ?? '—'}</span>
            <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">{label}</span>
          </div>
        ))}
      </div>

      <div className="flex-1 flex min-h-0">
        {/* List panel */}
        <div
          className={`${view === 'detail' ? 'hidden lg:flex' : 'flex'} lg:w-80 xl:w-96 flex-col border-r border-[var(--border)]`}
        >
          <div className="overflow-y-auto flex-1">
            {conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-[var(--text-muted)] p-8 text-center">
                <span className="text-4xl">💬</span>
                <p className="text-sm">No conversations yet.<br />Your wrenlo assistant is ready!</p>
              </div>
            ) : (
              conversations.map((conv) => {
                const isHot = conv.leadScore >= HOT_THRESHOLD;
                const label = customerLabel(conv);
                const preview = conv.last_message ?? 'No messages yet';
                const time = timeAgo(conv.last_message_at || conv.updatedAt);
                return (
                  <button
                    key={conv.id}
                    onClick={() => openConversation(conv.id)}
                    className={`w-full flex items-start gap-3 px-4 py-3 border-b border-[var(--border)] text-left hover:bg-[var(--surface-raised)] transition-colors ${selectedId === conv.id ? 'bg-[var(--surface-active)]' : ''}`}
                  >
                    <div className="relative shrink-0 mt-0.5">
                      <div className="w-9 h-9 rounded-full bg-[var(--surface)] border border-[var(--border-strong)] flex items-center justify-center text-sm font-medium">
                        {label[0]?.toUpperCase()}
                      </div>
                      {isHot && <span className="absolute -top-1 -right-1 text-xs">🔥</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-medium text-sm truncate">{label}</span>
                        <span className="text-[10px] text-[var(--text-muted)] shrink-0 ml-2">{time}</span>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] truncate">{preview.slice(0, 80)}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          conv.status === 'active' ? 'bg-green-500/15 text-green-500' :
                          conv.status === 'handed_off' ? 'bg-brand/15 text-brand' :
                          'bg-[var(--surface-active)] text-[var(--text-muted)]'
                        }`}>
                          {STATUS_LABELS[conv.status] ?? conv.status}
                        </span>
                        {conv.leadScore > 0 && (
                          <span className="text-[10px] text-[var(--text-muted)]">★ {conv.leadScore}</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Detail panel */}
        {view === 'detail' && selected ? (
          <div className="flex-1 flex flex-col min-w-0">
            {/* Detail header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] shrink-0">
              <button
                onClick={() => setView('list')}
                className="lg:hidden text-[var(--text-secondary)] hover:text-[var(--text)] text-sm"
              >
                ← Back
              </button>
              <div className="flex-1 min-w-0">
                <span className="font-medium">{customerLabel(selected)}</span>
                <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
                  selected.status === 'active' ? 'bg-green-500/15 text-green-500' :
                  selected.status === 'handed_off' ? 'bg-brand/15 text-brand' :
                  'bg-[var(--surface-active)] text-[var(--text-muted)]'
                }`}>
                  {STATUS_LABELS[selected.status]}
                </span>
                {selected.leadScore >= HOT_THRESHOLD && (
                  <span className="ml-1 text-xs">🔥 {selected.leadScore}</span>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {loadingMsgs ? (
                <div className="flex items-center justify-center h-full">
                  <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                </div>
              ) : messages.filter((m) => m.role !== 'system').length === 0 ? (
                <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">
                  No messages yet
                </div>
              ) : (
                messages
                  .filter((m) => m.role !== 'system')
                  .map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                          msg.role === 'user'
                            ? 'bg-[var(--surface)] border border-[var(--border-strong)] text-[var(--text)]'
                            : msg.role === 'owner'
                            ? 'bg-brand/90 text-white'
                            : 'bg-[var(--surface-hover)] text-[var(--text)]'
                        }`}
                      >
                        {msg.role === 'assistant' && (
                          <p className="text-[10px] text-[var(--text-secondary)] mb-1">wrenlo</p>
                        )}
                        <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                        <p className="text-[10px] opacity-50 mt-1 text-right">{formatTime(msg.createdAt)}</p>
                      </div>
                    </div>
                  ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Action bar */}
            <div className="border-t border-[var(--border)] p-4 shrink-0">
              {!isClaimed ? (
                <button
                  onClick={handleClaim}
                  className="w-full bg-brand hover:bg-brand-hover text-white font-semibold py-3 rounded-xl transition-colors"
                >
                  Take Over Conversation
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <textarea
                      value={compose}
                      onChange={(e) => setCompose(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                      placeholder="Message as owner…"
                      rows={2}
                      className="flex-1 bg-[var(--surface)] border border-[var(--border-strong)] rounded-xl px-4 py-2.5 text-sm placeholder-[var(--text-muted)] focus:outline-none focus:border-brand resize-none"
                    />
                    <button
                      onClick={handleSend}
                      disabled={sending || !compose.trim()}
                      className="bg-brand hover:bg-brand-hover disabled:opacity-40 text-white px-4 rounded-xl transition-colors"
                    >
                      {sending ? '…' : '↑'}
                    </button>
                  </div>
                  <button
                    onClick={handleRelease}
                    className="w-full text-xs text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors py-1"
                  >
                    Release back to AI
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="hidden lg:flex flex-1 items-center justify-center text-[var(--text-muted)]">
            <p className="text-sm">Select a conversation</p>
          </div>
        )}
      </div>
    </div>
  );
}
