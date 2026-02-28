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

let panel         = null;   // DOM element (tạo 1 lần, dùng mãi)
let hideTimer     = null;
let selectedTone  = 'my-style';
let activeTextbox = null;   // textbox đang được focus (để detect đúng tweet/comment)

// ─── Insert text vào X editor ─────────────────────────────────────────────────
function insertTextIntoEditor(text) {
  const ed =
    document.querySelector('[data-testid="tweetTextarea_0"] [contenteditable="true"]') ||
    document.querySelector('[role="textbox"][contenteditable="true"]');
  if (!ed) { alert('Coreply: Không tìm thấy ô reply.'); return; }
  ed.focus();
  document.execCommand('selectAll', false, null);
  document.execCommand('insertText', false, text);
  ed.dispatchEvent(new InputEvent('input', { bubbles: true }));
}

// ─── Lấy nội dung tweet/comment đang được reply ──────────────────────────────
// Đi từ activeTextbox lên DOM, tìm tweet article gần nhất (chính xác hơn
// so với lấy tweet đầu tiên trên trang — giúp reply đúng comment)
function getTweetContent() {
  let el = activeTextbox;

  for (let depth = 0; depth < 30 && el; depth++) {
    // Case A: đang ở bên trong một article tweet
    if (el.tagName === 'ARTICLE' && el.getAttribute('data-testid') === 'tweet') {
      const t = el.querySelector('[data-testid="tweetText"]');
      if (t) return t.innerText.trim();
    }

    // Case B: previous sibling là article tweet
    let prev = el.previousElementSibling;
    while (prev) {
      if (prev.tagName === 'ARTICLE' && prev.getAttribute('data-testid') === 'tweet') {
        const t = prev.querySelector('[data-testid="tweetText"]');
        if (t) return t.innerText.trim();
      }
      // Tweet lồng bên trong sibling
      const nested = prev.querySelector('article[data-testid="tweet"] [data-testid="tweetText"]');
      if (nested) return nested.innerText.trim();
      prev = prev.previousElementSibling;
    }

    el = el.parentElement;
  }

  // Fallback: tweet đầu tiên trên trang
  const nodes = document.querySelectorAll('[data-testid="tweetText"]');
  for (const n of nodes) { const t = n.innerText.trim(); if (t) return t; }
  return '';
}

// ─── Tạo panel (chỉ tạo 1 lần) ───────────────────────────────────────────────
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
      <span>Generating…</span>
    </div>

    <div class="cp-result" style="display:none">
      <p class="cp-result-text"></p>
      <div class="cp-result-actions">
        <button class="cp-btn-regen">↺ Regen</button>
        <button class="cp-btn-use">Use reply ↗</button>
      </div>
    </div>
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
  const createBtn  = el.querySelector('.cp-create-btn');
  const loadingEl  = el.querySelector('.cp-loading');
  const resultEl   = el.querySelector('.cp-result');
  const resultText = el.querySelector('.cp-result-text');

  async function generate() {
    const content = getTweetContent();
    if (!content) { alert('Coreply: Không tìm thấy nội dung tweet.'); return; }

    const s = await chrome.storage.sync.get(['groqApiKey','myStyle','language','model']);
    if (!s.groqApiKey) {
      if (confirm('Coreply: Chưa có API key. Mở Settings?'))
        chrome.runtime.sendMessage({ action: 'openOptions' });
      return;
    }

    createBtn.disabled   = true;
    loadingEl.style.display = 'flex';
    resultEl.style.display  = 'none';

    try {
      const res = await chrome.runtime.sendMessage({
        action: 'generateReply', tweetContent: content, toneId: selectedTone,
        myStyle:  s.myStyle   || '',
        language: s.language  || 'same as tweet',
        model:    s.model     || 'llama-3.3-70b-versatile',
        apiKey:   s.groqApiKey,
      });
      if (res.error) throw new Error(res.error);
      resultText.textContent = res.reply;
      resultEl.style.display = 'block';
    } catch (e) { alert('Coreply Error: ' + e.message); }
    finally {
      loadingEl.style.display = 'none';
      createBtn.disabled = false;
    }
  }

  createBtn.addEventListener('click',          () => generate());
  el.querySelector('.cp-btn-regen').addEventListener('click', () => generate());
  el.querySelector('.cp-btn-use').addEventListener('click',   () => {
    const t = resultText.textContent;
    if (t) { insertTextIntoEditor(t); resultEl.style.display = 'none'; }
  });

  // Click vào bất kỳ đâu trong panel → không ẩn
  el.addEventListener('mousedown', () => clearTimeout(hideTimer));

  return el;
}

// ─── Show / Hide panel ────────────────────────────────────────────────────────
function showPanel() {
  clearTimeout(hideTimer);
  if (!panel) {
    panel = createPanel();
    document.body.appendChild(panel);
  }
  panel.classList.add('visible');
}

function hidePanel(delay = 0) {
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    if (panel) panel.classList.remove('visible');
  }, delay);
}

// ─── Lắng nghe focus vào reply box ───────────────────────────────────────────
document.addEventListener('focusin', (e) => {
  const t = e.target;
  if (t.getAttribute('contenteditable') !== 'true') return;
  if (t.getAttribute('role') !== 'textbox') return;
  // Chỉ hiện khi đang trong reply box (có data-testid tweetTextarea)
  const inReply =
    t.closest('[data-testid^="tweetTextarea"]') ||
    t.closest('[data-testid="tweetTextarea_0RichTextInputContainer"]');
  if (!inReply) return;
  activeTextbox = t;   // lưu lại để getTweetContent dùng
  showPanel();
}, true);

// Panel luôn hiển thị sau khi đã show lần đầu

console.log('[Coreply] loaded ✅');
