// ─────────────────────────────────────────────────────────────────────────────
// Coreply — content.js
// Panel cố định bên trái trang, hiện khi reply box được focus
// ─────────────────────────────────────────────────────────────────────────────

const TONES = [
  { id: 'my-style',     label: 'My Style',       icon: '⚡' },
  { id: 'casual',       label: 'Casual tone',    icon: '💬' },
  { id: 'positive',     label: 'Positive reply', icon: '👍' },
  { id: 'professional', label: 'Professional',   icon: '💼' },
  { id: 'funny',        label: 'Funny',          icon: '😄' },
  { id: 'question',     label: 'Ask Question',   icon: '❓' },
  { id: 'supportive',   label: 'Supportive',     icon: '🤗' },
  { id: 'concise',      label: 'Concise',        icon: '✂️' },
];

let panel         = null;
let selectedTone  = 'my-style';
let activeTextbox = null;

// ─── Insert text vào X editor ─────────────────────────────────────────────────
async function insertTextIntoEditor(text) {
  const ed =
    document.querySelector('[data-testid="tweetTextarea_0"] [contenteditable="true"]') ||
    document.querySelector('[role="textbox"][contenteditable="true"]');
  if (!ed) { alert('Coreply: Không tìm thấy ô reply.'); return; }

  ed.focus();
  await navigator.clipboard.writeText(text);

  ed.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'a', code: 'KeyA', keyCode: 65,
    ctrlKey: true, bubbles: true, cancelable: true
  }));
  ed.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'v', code: 'KeyV', keyCode: 86,
    ctrlKey: true, bubbles: true, cancelable: true
  }));
  document.execCommand('paste');
}

// ─── Lấy nội dung tweet đang được reply ──────────────────────────────────────
function getTweetContent() {
  let el = activeTextbox;

  for (let depth = 0; depth < 30 && el; depth++) {
    if (el.tagName === 'ARTICLE' && el.getAttribute('data-testid') === 'tweet') {
      const t = el.querySelector('[data-testid="tweetText"]');
      if (t) return t.innerText.trim();
    }
    let prev = el.previousElementSibling;
    while (prev) {
      if (prev.tagName === 'ARTICLE' && prev.getAttribute('data-testid') === 'tweet') {
        const t = prev.querySelector('[data-testid="tweetText"]');
        if (t) return t.innerText.trim();
      }
      const nested = prev.querySelector('article[data-testid="tweet"] [data-testid="tweetText"]');
      if (nested) return nested.innerText.trim();
      prev = prev.previousElementSibling;
    }
    el = el.parentElement;
  }

  const nodes = document.querySelectorAll('[data-testid="tweetText"]');
  for (const n of nodes) { const t = n.innerText.trim(); if (t) return t; }
  return '';
}

// ─── Tạo panel ───────────────────────────────────────────────────────────────
function createPanel() {
  const el = document.createElement('div');
  el.id        = 'coreply-panel';
  el.className = 'coreply-panel';

  el.innerHTML = `
    <div class="cp-header">
      <span class="cp-logo">⚡ Coreply</span>
      <button class="cp-close" title="Đóng">✕</button>
    </div>

    <div class="cp-tones">
      ${TONES.map((t, i) => `
        <button class="cp-tone${i === 0 ? ' active' : ''}" data-tone-id="${t.id}">
          <span class="cp-tone-icon">${t.icon}</span>
          <span class="cp-tone-label">${t.label}</span>
        </button>`).join('')}
    </div>

    <div class="cp-footer">
      <button class="cp-create-btn">✨ Create reply</button>
    </div>

    <div class="cp-loading" style="display:none">
      <div class="cp-spinner"></div>
      <span>Generating 2 replies…</span>
    </div>

    <div class="cp-results" style="display:none"></div>
  `;

  // ── Close ──
  el.querySelector('.cp-close').addEventListener('click', () => hidePanel());

  // ── Chọn tone ──
  el.querySelectorAll('.cp-tone').forEach(btn => {
    btn.addEventListener('click', () => {
      el.querySelectorAll('.cp-tone').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedTone = btn.dataset.toneId;
    });
  });

  // ── Generate ──
  const createBtn = el.querySelector('.cp-create-btn');
  const loadingEl = el.querySelector('.cp-loading');
  const resultsEl = el.querySelector('.cp-results');

  async function generate() {
    const content = getTweetContent();
    if (!content) { alert('Coreply: Không tìm thấy nội dung tweet.'); return; }

    const s = await chrome.storage.sync.get(['groqApiKey','myStyle','language','model']);
    if (!s.groqApiKey) {
      if (confirm('Coreply: Chưa có API key. Mở Settings?'))
        chrome.runtime.sendMessage({ action: 'openOptions' });
      return;
    }

    createBtn.disabled      = true;
    loadingEl.style.display = 'flex';
    resultsEl.style.display = 'none';
    resultsEl.innerHTML     = '';

    try {
      const res = await chrome.runtime.sendMessage({
        action: 'generateReply',
        tweetContent: content,
        toneId:   selectedTone,
        myStyle:  s.myStyle  || '',
        language: s.language || 'same as tweet',
        model:    s.model    || 'llama-3.3-70b-versatile',
        apiKey:   s.groqApiKey,
      });
      if (res.error) throw new Error(res.error);

      // Render 3 reply cards
      res.replies.forEach((reply, idx) => {
        const card = document.createElement('div');
        card.className = 'cp-reply-card';
        card.innerHTML = `
          <div class="cp-reply-num">Option ${idx + 1}</div>
          <p class="cp-reply-text">${escapeHtml(reply)}</p>
          <div class="cp-reply-actions">
            <button class="cp-btn-use" data-idx="${idx}">Use this ↗</button>
          </div>
        `;
        card.querySelector('.cp-btn-use').addEventListener('click', () => {
          insertTextIntoEditor(reply);
          resultsEl.style.display = 'none';
        });
        resultsEl.appendChild(card);
      });

      // Nút Regen chung ở cuối
      const regenRow = document.createElement('div');
      regenRow.className = 'cp-regen-row';
      regenRow.innerHTML = `<button class="cp-btn-regen">↺ Generate again</button>`;
      regenRow.querySelector('.cp-btn-regen').addEventListener('click', () => generate());
      resultsEl.appendChild(regenRow);

      resultsEl.style.display = 'block';
    } catch (e) { alert('Coreply Error: ' + e.message); }
    finally {
      loadingEl.style.display = 'none';
      createBtn.disabled = false;
    }
  }

  createBtn.addEventListener('click', () => generate());

  // Giữ focus reply box khi click panel
  el.addEventListener('mousedown', e => e.preventDefault());

  return el;
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ─── Show / Hide ──────────────────────────────────────────────────────────────
function showPanel() {
  if (!panel) {
    panel = createPanel();
    document.body.appendChild(panel);
  }
  // Reset kết quả cũ khi mở panel cho tweet mới
  const resultsEl = panel.querySelector('.cp-results');
  if (resultsEl) { resultsEl.innerHTML = ''; resultsEl.style.display = 'none'; }
  panel.classList.add('visible');
}

function hidePanel() {
  if (panel) panel.classList.remove('visible');
}

// ─── Lắng nghe focus vào reply box ───────────────────────────────────────────
document.addEventListener('focusin', (e) => {
  const t = e.target;
  if (t.getAttribute('contenteditable') !== 'true') return;
  if (t.getAttribute('role') !== 'textbox') return;
  const inReply =
    t.closest('[data-testid^="tweetTextarea"]') ||
    t.closest('[data-testid="tweetTextarea_0RichTextInputContainer"]');
  if (!inReply) return;
  activeTextbox = t;
  showPanel();
}, true);
