/* ============================================================
   wrenlo Chat Widget
   Vanilla JS — no framework dependencies
   ============================================================ */

const CONFIG = {
  businessId: window.location.pathname.split('/')[2] || null,
  apiBase: '',              // same origin
  maxImageBytes: 5 * 1024 * 1024,
  typingDelayMin: 400,
  typingDelayMax: 800,
};

/* ---- State ---- */
const state = {
  conversationId: null,
  pendingImage: null,       // { dataUrl, mimeType }
  sending: false,
};

/* ---- DOM refs ---- */
const $ = id => document.getElementById(id);
const messagesArea    = $('messagesArea');
const messageInput    = $('messageInput');
const sendBtn         = $('sendBtn');
const themeToggle     = $('themeToggle');
const typingIndicator = $('typingIndicator');
const attachBtn       = $('attachBtn');
const fileInput       = $('fileInput');
const imagePreviewArea = $('imagePreviewArea');
const imagePreview    = $('imagePreview');
const removeImageBtn  = $('removeImage');
const dropOverlay     = $('dropOverlay');
const chatContainer   = document.querySelector('.chat-container');

/* ============================================================
   Theme
   ============================================================ */
function applyTheme(isDark) {
  document.body.classList.toggle('dark', isDark);
  try { localStorage.setItem('theme', isDark ? 'dark' : 'light'); } catch {}
}

function initTheme() {
  let stored;
  try { stored = localStorage.getItem('theme'); } catch {}

  if (stored === 'dark') {
    applyTheme(true);
  } else if (stored === 'light') {
    applyTheme(false);
  } else {
    // Respect system preference
    applyTheme(window.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  // Watch for system changes (only if no manual override)
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    let s;
    try { s = localStorage.getItem('theme'); } catch {}
    if (!s) applyTheme(e.matches);
  });
}

themeToggle.addEventListener('click', () => {
  applyTheme(!document.body.classList.contains('dark'));
});

/* ============================================================
   Markdown renderer (basic, safe)
   ============================================================ */
function renderMarkdown(text) {
  // Escape HTML first
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code blocks (``` ... ```)
  html = html.replace(/```[\s\S]*?```/g, m => {
    const code = m.slice(3, -3).replace(/^\n/, '');
    return `<pre><code>${code}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Bold **text** or __text__
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');

  // Italic *text* or _text_
  html = html.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  html = html.replace(/_([^_\n]+)_/g, '<em>$1</em>');

  // Links [text](url) — only https/http
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  // Unordered lists
  html = html.replace(/^[ \t]*[-*+] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`);

  // Ordered lists
  html = html.replace(/^[ \t]*\d+\. (.+)$/gm, '<li>$1</li>');

  // Paragraphs — split on double newlines
  const parts = html.split(/\n{2,}/);
  html = parts.map(p => {
    p = p.trim();
    if (!p) return '';
    if (p.startsWith('<ul>') || p.startsWith('<ol>') || p.startsWith('<pre>')) return p;
    // Single line breaks → <br>
    p = p.replace(/\n/g, '<br>');
    return `<p>${p}</p>`;
  }).filter(Boolean).join('\n');

  return html;
}

/* ============================================================
   Message rendering
   ============================================================ */
function formatTime(date = new Date()) {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function createMessageEl({ role, text, imageDataUrl, time }) {
  const group = document.createElement('div');
  group.className = `message-group ${role === 'user' ? 'user-group' : 'assistant-group'}`;

  const msg = document.createElement('div');
  msg.className = `message ${role === 'user' ? 'user-message' : 'assistant-message'}`;

  const content = document.createElement('div');
  content.className = 'message-content';

  if (imageDataUrl) {
    const img = document.createElement('img');
    img.src = imageDataUrl;
    img.alt = 'Attached image';
    img.className = 'message-image';
    content.appendChild(img);
  }

  if (text) {
    if (role === 'assistant') {
      content.innerHTML += renderMarkdown(text);
    } else {
      // User messages: plain text with line breaks
      const p = document.createElement('p');
      p.textContent = text;
      content.appendChild(p);
    }
  }

  const timeEl = document.createElement('span');
  timeEl.className = 'message-time';
  timeEl.textContent = formatTime(time);

  msg.appendChild(content);
  msg.appendChild(timeEl);
  group.appendChild(msg);

  return group;
}

function appendMessage({ role, text, imageDataUrl }) {
  const el = createMessageEl({ role, text, imageDataUrl });
  // Insert before typing indicator
  messagesArea.insertBefore(el, typingIndicator);
  scrollToBottom();
}

function scrollToBottom(smooth = true) {
  messagesArea.scrollTo({
    top: messagesArea.scrollHeight,
    behavior: smooth ? 'smooth' : 'instant',
  });
}

/* ============================================================
   Typing indicator
   ============================================================ */
function showTyping() {
  typingIndicator.hidden = false;
  scrollToBottom();
}

function hideTyping() {
  typingIndicator.hidden = true;
}

/* ============================================================
   Error toast
   ============================================================ */
function showError(msg, duration = 4000) {
  // Remove existing
  document.querySelectorAll('.error-toast').forEach(el => el.remove());

  const toast = document.createElement('div');
  toast.className = 'error-toast';
  toast.textContent = msg;
  document.querySelector('.input-area').appendChild(toast);

  setTimeout(() => toast.remove(), duration);
}

/* ============================================================
   API
   ============================================================ */
async function sendMessage(text, imageDataUrl) {
  const body = {
    businessId: CONFIG.businessId,
    message: text || (imageDataUrl ? '[Image attached]' : ''),
    ...(state.conversationId ? { conversationId: state.conversationId } : {}),
  };

  // If there's an image, include it as part of the message
  if (imageDataUrl && text) {
    body.message = text;
  } else if (imageDataUrl && !text) {
    body.message = 'I\'ve attached a photo of my vehicle. Can you help me with detailing recommendations?';
  }

  const res = await fetch(`${CONFIG.apiBase}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || `Server error ${res.status}`);
  }

  return res.json();
}

/* ============================================================
   Send flow
   ============================================================ */
async function handleSend() {
  if (state.sending) return;

  const text = messageInput.value.trim();
  const image = state.pendingImage;

  if (!text && !image) return;

  state.sending = true;
  setSendEnabled(false);
  messageInput.value = '';
  resizeTextarea();

  // Clear image preview
  const sentImageDataUrl = image ? image.dataUrl : null;
  clearPendingImage();

  // Show user message immediately
  appendMessage({ role: 'user', text, imageDataUrl: sentImageDataUrl });

  // Show typing
  showTyping();

  try {
    const data = await sendMessage(text, sentImageDataUrl);
    state.conversationId = data.conversationId;

    // Small artificial delay so typing indicator doesn't flash
    await sleep(Math.random() * (CONFIG.typingDelayMax - CONFIG.typingDelayMin) + CONFIG.typingDelayMin);

    hideTyping();
    appendMessage({ role: 'assistant', text: data.response });
  } catch (err) {
    hideTyping();
    console.error('Chat error:', err);
    showError(err.message || 'Something went wrong. Please try again.');
  } finally {
    state.sending = false;
    setSendEnabled(Boolean(messageInput.value.trim() || state.pendingImage));
    messageInput.focus();
  }
}

function setSendEnabled(enabled) {
  sendBtn.disabled = !enabled;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/* ============================================================
   Input handling
   ============================================================ */
messageInput.addEventListener('input', () => {
  resizeTextarea();
  setSendEnabled(Boolean(messageInput.value.trim() || state.pendingImage));
});

messageInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!sendBtn.disabled) handleSend();
  }
});

sendBtn.addEventListener('click', handleSend);

function resizeTextarea() {
  messageInput.style.height = 'auto';
  messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
}

/* ============================================================
   Image attachment
   ============================================================ */
attachBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (file) processImageFile(file);
  fileInput.value = '';
});

removeImageBtn.addEventListener('click', clearPendingImage);

function processImageFile(file) {
  if (!file.type.startsWith('image/')) {
    showError('Please attach an image file.');
    return;
  }
  if (file.size > CONFIG.maxImageBytes) {
    showError('Image must be under 5 MB.');
    return;
  }

  const reader = new FileReader();
  reader.onload = e => {
    const dataUrl = e.target.result;
    state.pendingImage = { dataUrl, mimeType: file.type };
    imagePreview.src = dataUrl;
    imagePreviewArea.hidden = false;
    setSendEnabled(true);
    messageInput.focus();
  };
  reader.readAsDataURL(file);
}

function clearPendingImage() {
  state.pendingImage = null;
  imagePreview.src = '';
  imagePreviewArea.hidden = true;
  imagePreview.onload = null;
  setSendEnabled(Boolean(messageInput.value.trim()));
}

/* ============================================================
   Drag & Drop
   ============================================================ */
let dragCounter = 0;

chatContainer.addEventListener('dragenter', e => {
  e.preventDefault();
  dragCounter++;
  if (dragCounter === 1) {
    dropOverlay.hidden = false;
    chatContainer.classList.add('drag-over');
  }
});

chatContainer.addEventListener('dragleave', e => {
  e.preventDefault();
  dragCounter--;
  if (dragCounter === 0) {
    dropOverlay.hidden = true;
    chatContainer.classList.remove('drag-over');
  }
});

chatContainer.addEventListener('dragover', e => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
});

chatContainer.addEventListener('drop', e => {
  e.preventDefault();
  dragCounter = 0;
  dropOverlay.hidden = true;
  chatContainer.classList.remove('drag-over');

  const file = e.dataTransfer.files[0];
  if (file) processImageFile(file);
});

/* ============================================================
   Init
   ============================================================ */
function init() {
  initTheme();

  if (!CONFIG.businessId) {
    messagesArea.innerHTML = `
      <div class="message-group assistant-group">
        <div class="message assistant-message">
          <div class="message-content">
            <p>This chat widget requires a business ID in the URL.</p>
          </div>
        </div>
      </div>`;
    messageInput.disabled = true;
    messageInput.placeholder = 'Chat unavailable';
    sendBtn.disabled = true;
    attachBtn.disabled = true;
    return;
  }

  scrollToBottom(false);
  messageInput.focus();
}

init();
