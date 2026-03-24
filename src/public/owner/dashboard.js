'use strict';

// ── Config ─────────────────────────────────────────────────────────────────────
const BUSINESS_ID = new URLSearchParams(location.search).get('b') || 'xdetailing-001';
const HOT_THRESHOLD = 3;
const REFRESH_MS = 30_000;

// ── State ──────────────────────────────────────────────────────────────────────
let conversations = [];
let stats = { total: 0, active: 0, hot_leads: 0, today: 0 };
let settings = null;
let currentConvId = null;
let currentMessages = [];
let currentView = 'list';
let refreshTimer = null;

// ── Utilities ──────────────────────────────────────────────────────────────────
function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Parse SQLite "YYYY-MM-DD HH:MM:SS" as UTC, or ISO strings normally. */
function parseDate(str) {
  if (!str) return new Date(0);
  const s = str.includes('T') ? str : str.replace(' ', 'T') + 'Z';
  return new Date(s);
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - parseDate(dateStr)) / 1000);
  if (diff < 60)      return 'just now';
  if (diff < 3600)    return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)   return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 172800)  return 'Yesterday';
  return parseDate(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  return parseDate(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

function customerLabel(conv) {
  return conv.customer_name || conv.customer_identifier || 'Anonymous';
}

function statusLabel(status) {
  return { active: 'Active', handed_off: 'Claimed by Owner', closed: 'Closed', resolved: 'Resolved' }[status] || status;
}

function setEl(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function on(id, event, fn) {
  const el = document.getElementById(id);
  if (el) el.addEventListener(event, fn);
}

function isNearBottom(el, threshold = 80) {
  if (!el) return true;
  return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
}

// ── Theme ──────────────────────────────────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('owner-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(saved || (prefersDark ? 'dark' : 'light'));
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
}

function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('owner-theme', next);
  applyTheme(next);
}

// ── API Layer ──────────────────────────────────────────────────────────────────
async function apiFetch(method, path, body) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(path, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

async function loadSettings() {
  const data = await apiFetch('GET', `/api/owner/${BUSINESS_ID}/settings`);
  settings = data;
  setEl('header-business-name', data.name);
  const avatar = document.getElementById('header-avatar');
  if (avatar) avatar.textContent = (data.name || '?')[0].toUpperCase();
  document.title = `${data.name} — wrenlo`;
}

async function loadStats() {
  const data = await apiFetch('GET', `/api/owner/${BUSINESS_ID}/stats`);
  stats = data;
  renderStats();
}

async function loadConversations() {
  const data = await apiFetch('GET', `/api/owner/${BUSINESS_ID}/conversations`);
  conversations = data.conversations || [];
  renderConversationList();
  renderLeadAlert();
}

async function loadMessages(convId) {
  const data = await apiFetch('GET', `/conversations/${convId}`);
  currentMessages = data.messages || [];
}

async function doClaim() {
  await apiFetch('POST', `/conversations/${currentConvId}/claim`, {
    claimedBy: settings?.ownerName || 'Owner',
  });
  await Promise.all([loadConversations(), loadMessages(currentConvId)]);
  renderDetail();
}

async function doRelease() {
  await apiFetch('POST', `/conversations/${currentConvId}/release`);
  await Promise.all([loadConversations(), loadMessages(currentConvId)]);
  renderDetail();
}

async function doSendMessage(text) {
  await apiFetch('POST', `/conversations/${currentConvId}/owner-message`, {
    message: text,
    senderName: settings?.ownerName || 'Owner',
  });
  await Promise.all([loadMessages(currentConvId), loadConversations()]);
  renderMessages();
  scrollToBottom();
}

// ── Auto Refresh ───────────────────────────────────────────────────────────────
async function refresh() {
  try {
    await Promise.all([loadStats(), loadConversations()]);
    if (currentConvId && currentView === 'detail') {
      const wasAtBottom = isNearBottom(document.getElementById('messages-area'));
      await loadMessages(currentConvId);
      renderMessages();
      if (wasAtBottom) scrollToBottom();
      const conv = conversations.find(c => c.id === currentConvId);
      if (conv) updateBottomBar(conv);
    }
  } catch {
    // Silently ignore background refresh errors
  }
}

function startAutoRefresh() {
  clearInterval(refreshTimer);
  refreshTimer = setInterval(refresh, REFRESH_MS);
}

// ── Render: Stats Bar ──────────────────────────────────────────────────────────
function renderStats() {
  setEl('stat-active', stats.active ?? '—');
  setEl('stat-hot',    stats.hot_leads ?? '—');
  setEl('stat-today',  stats.today ?? '—');
  setEl('stat-total',  stats.total ?? '—');
  const hotEl = document.getElementById('stat-hot');
  if (hotEl) hotEl.classList.toggle('stat-value--hot', (stats.hot_leads ?? 0) > 0);
}

// ── Render: Lead Alert ─────────────────────────────────────────────────────────
function renderLeadAlert() {
  const hot = conversations.filter(
    c => c.lead_score >= HOT_THRESHOLD && (c.status === 'active' || c.status === 'handed_off')
  );
  const alertEl = document.getElementById('lead-alert');
  if (!alertEl) return;
  if (hot.length === 0) { alertEl.classList.add('hidden'); return; }
  alertEl.classList.remove('hidden');
  setEl('alert-title',
    hot.length === 1 ? '1 hot lead needs attention' : `${hot.length} hot leads need attention`
  );
}

// ── Render: Conversation List ──────────────────────────────────────────────────
function renderConversationList() {
  const list = document.getElementById('conv-list');
  if (!list) return;

  const loading = list.querySelector('.loading-state');
  if (loading) loading.remove();

  if (conversations.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div style="font-size:40px;margin-bottom:12px">💬</div>
        No conversations yet.<br>Your wrenlo assistant is ready!
      </div>`;
    return;
  }

  const rolePrefix = { assistant: '🤖 ', owner: '↩ ', user: '', system: '' };

  list.innerHTML = conversations.map(conv => {
    const isHot = conv.lead_score >= HOT_THRESHOLD;
    const label = customerLabel(conv);
    const initial = (label[0] || '?').toUpperCase();
    const prefix = conv.last_message_role ? (rolePrefix[conv.last_message_role] || '') : '';
    const preview = conv.last_message ? (prefix + conv.last_message) : 'No messages yet';
    const time = timeAgo(conv.last_message_at || conv.updated_at);
    const hotAttr = isHot ? ' data-hot="true"' : '';

    return `
      <button class="conv-card" data-id="${conv.id}"${hotAttr} role="listitem">
        <div class="conv-avatar conv-avatar--${conv.status}${isHot ? ' conv-avatar--hot' : ''}">
          <span>${initial}</span>
          <div class="status-dot status-dot--${conv.status}"></div>
        </div>
        <div class="conv-body">
          <div class="conv-top">
            <span class="conv-name">${escHtml(label)}</span>
            <span class="conv-time">${time}</span>
          </div>
          <div class="conv-bottom">
            <span class="conv-preview">${escHtml(preview.slice(0, 95))}</span>
            ${isHot ? '<span class="lead-badge" aria-label="Hot lead">🔥</span>' : ''}
          </div>
          <div class="conv-tags">
            <span class="status-badge status-badge--${conv.status}">${statusLabel(conv.status)}</span>
            ${conv.customer_vehicle
              ? `<span class="vehicle-tag">${escHtml(conv.customer_vehicle.slice(0, 32))}</span>`
              : ''}
            ${conv.lead_score > 0
              ? `<span class="score-tag">Score: ${conv.lead_score}</span>`
              : ''}
          </div>
        </div>
      </button>`;
  }).join('');
}

// ── Render: Detail View ────────────────────────────────────────────────────────
function renderDetail() {
  const conv = conversations.find(c => c.id === currentConvId);
  if (!conv) return;

  // Header
  setEl('detail-name', customerLabel(conv));

  const statusEl = document.getElementById('detail-status');
  if (statusEl) {
    statusEl.textContent = statusLabel(conv.status);
    statusEl.className = `detail-status-badge status-badge--${conv.status}`;
  }

  const scoreEl = document.getElementById('detail-score');
  if (scoreEl) {
    if (conv.lead_score >= HOT_THRESHOLD) {
      scoreEl.textContent = `🔥 ${conv.lead_score}`;
      scoreEl.className = 'lead-score-badge';
    } else if (conv.lead_score > 0) {
      scoreEl.textContent = `★ ${conv.lead_score}`;
      scoreEl.className = 'score-badge';
    } else {
      scoreEl.textContent = '';
      scoreEl.className = '';
    }
  }

  renderMessages();
  updateBottomBar(conv);
  scrollToBottom();
}

function updateBottomBar(conv) {
  const isClaimed = conv.status === 'handed_off';
  const claimArea   = document.getElementById('claim-area');
  const composeArea = document.getElementById('compose-area');
  if (claimArea)   claimArea.classList.toggle('hidden', isClaimed);
  if (composeArea) composeArea.classList.toggle('hidden', !isClaimed);
}

// ── Render: Messages ───────────────────────────────────────────────────────────
function renderMessages() {
  const area = document.getElementById('messages-area');
  if (!area) return;

  const msgs = currentMessages.filter(m => m.role !== 'system');

  if (msgs.length === 0) {
    area.innerHTML = '<div class="empty-messages">No messages yet</div>';
    return;
  }

  area.innerHTML = msgs.map((msg, i) => {
    const prev = msgs[i - 1];
    const next = msgs[i + 1];
    const isFirst = !prev || prev.role !== msg.role;
    const isLast  = !next || next.role !== msg.role;

    const groupClass = [
      isFirst ? 'msg-first' : '',
      isLast  ? 'msg-last'  : 'msg-mid',
    ].filter(Boolean).join(' ');

    // Show sender label only at start of a group
    let senderLabel = '';
    if (isFirst) {
      if (msg.role === 'owner')     senderLabel = settings?.ownerName || 'Owner';
      if (msg.role === 'assistant') senderLabel = 'wrenlo';
    }

    return `
      <div class="message message--${msg.role} ${groupClass}">
        ${senderLabel ? `<div class="message-sender">${escHtml(senderLabel)}</div>` : ''}
        <div class="message-bubble">
          <span class="message-text">${escHtml(msg.content)}</span>
        </div>
        ${isLast ? `<div class="message-time">${formatTime(msg.created_at)}</div>` : ''}
      </div>`;
  }).join('');
}

function scrollToBottom() {
  const area = document.getElementById('messages-area');
  if (area) requestAnimationFrame(() => { area.scrollTop = area.scrollHeight; });
}

// ── Navigation ─────────────────────────────────────────────────────────────────
function showView(view) {
  const listView   = document.getElementById('view-list');
  const detailView = document.getElementById('view-detail');
  currentView = view;

  if (view === 'detail') {
    listView.classList.remove('active');
    listView.classList.add('slide-left');
    detailView.classList.add('active');
    history.pushState({ view: 'detail', convId: currentConvId }, '');
  } else {
    detailView.classList.remove('active');
    listView.classList.remove('slide-left');
    listView.classList.add('active');
  }
}

async function openConversation(convId) {
  currentConvId = convId;

  // Render header + bottom bar from cached list data immediately
  renderDetail();
  showView('detail');

  // Show spinner in messages while loading
  const area = document.getElementById('messages-area');
  if (area) area.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';

  try {
    await loadMessages(convId);
    renderMessages();
  } catch (e) {
    if (area) area.innerHTML = '<div class="empty-messages">Failed to load messages</div>';
  }

  const conv = conversations.find(c => c.id === convId);
  if (conv) updateBottomBar(conv);
  scrollToBottom();
}

function goBack() {
  currentConvId = null;
  currentMessages = [];
  showView('list');
}

// ── Event Listeners ────────────────────────────────────────────────────────────
function setupListeners() {
  on('theme-toggle', 'click', toggleTheme);

  on('refresh-btn', 'click', async () => {
    const btn = document.getElementById('refresh-btn');
    if (btn) { btn.style.opacity = '.4'; btn.style.pointerEvents = 'none'; }
    try { await refresh(); }
    finally {
      if (btn) { btn.style.opacity = ''; btn.style.pointerEvents = ''; }
    }
  });

  on('back-btn', 'click', goBack);

  on('alert-scroll-btn', 'click', () => {
    const firstHot = document.querySelector('.conv-card[data-hot="true"]');
    if (firstHot) firstHot.scrollIntoView({ behavior: 'smooth', block: 'center' });
    else document.getElementById('conv-list-container')?.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Conversation card tap — use event delegation
  document.getElementById('conv-list')?.addEventListener('click', e => {
    const card = e.target.closest('.conv-card');
    if (card?.dataset?.id) openConversation(card.dataset.id);
  });

  // Claim
  on('claim-btn', 'click', async () => {
    const btn = document.getElementById('claim-btn');
    if (!btn) return;
    btn.disabled = true;
    btn.textContent = 'Claiming…';
    try {
      await doClaim();
    } catch (e) {
      alert('Could not claim: ' + e.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = 'Take Over Conversation';
    }
  });

  // Release
  on('release-btn', 'click', async () => {
    if (!confirm('Release this conversation back to the AI?\n\nThe AI will continue responding automatically.')) return;
    const btn = document.getElementById('release-btn');
    if (!btn) return;
    btn.disabled = true;
    btn.textContent = 'Releasing…';
    try {
      await doRelease();
    } catch (e) {
      alert('Could not release: ' + e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Release to AI';
    }
  });

  // Compose textarea — auto-resize
  const input = document.getElementById('compose-input');
  if (input) {
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    });
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });
  }

  on('send-btn', 'click', handleSend);

  // Back button / browser history
  window.addEventListener('popstate', e => {
    if (currentView === 'detail') {
      currentConvId = null;
      currentMessages = [];
      const listView   = document.getElementById('view-list');
      const detailView = document.getElementById('view-detail');
      detailView.classList.remove('active');
      listView.classList.remove('slide-left');
      listView.classList.add('active');
      currentView = 'list';
    }
  });

  // System theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (!localStorage.getItem('owner-theme')) applyTheme(e.matches ? 'dark' : 'light');
  });
}

async function handleSend() {
  const input = document.getElementById('compose-input');
  const sendBtn = document.getElementById('send-btn');
  if (!input) return;

  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  input.style.height = 'auto';
  if (sendBtn) sendBtn.disabled = true;

  try {
    await doSendMessage(text);
  } catch (e) {
    input.value = text; // restore on failure
    alert('Failed to send: ' + e.message);
  } finally {
    if (sendBtn) sendBtn.disabled = false;
    input.focus();
  }
}

// ── Pull-to-Refresh ────────────────────────────────────────────────────────────
function setupPullToRefresh() {
  const container = document.getElementById('conv-list-container');
  if (!container) return;

  let startY = 0;
  let pulling = false;

  container.addEventListener('touchstart', e => {
    startY = e.touches[0].clientY;
  }, { passive: true });

  container.addEventListener('touchmove', e => {
    const dy = e.touches[0].clientY - startY;
    pulling = container.scrollTop === 0 && dy > 72;
  }, { passive: true });

  container.addEventListener('touchend', async () => {
    if (!pulling) return;
    pulling = false;
    const btn = document.getElementById('refresh-btn');
    if (btn) { btn.style.opacity = '.4'; btn.style.pointerEvents = 'none'; }
    try { await refresh(); }
    finally {
      if (btn) { btn.style.opacity = ''; btn.style.pointerEvents = ''; }
    }
  });
}

// ── Init ───────────────────────────────────────────────────────────────────────
async function init() {
  initTheme();
  setupListeners();
  setupPullToRefresh();

  // List view is visible by default
  document.getElementById('view-list')?.classList.add('active');

  try {
    await Promise.all([loadSettings(), loadStats(), loadConversations()]);
  } catch (e) {
    console.error('[dashboard] init error:', e);
    const list = document.getElementById('conv-list');
    const loading = list?.querySelector('.loading-state');
    if (loading) loading.innerHTML = `<span style="color:var(--text-tertiary)">Could not load dashboard</span>`;
  }

  startAutoRefresh();
}

document.addEventListener('DOMContentLoaded', init);
