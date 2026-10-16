/*
 * Zenno AI receptionist – website chat widget.
 * Embed on any website:
 *   <script src="https://<your-zenno-host>/receptionist-widget.js" data-key="wc_…" async></script>
 * Optional: data-open="true" opens the chat on load.
 * Renders inside a Shadow DOM, so the site's CSS cannot break it (and vice versa).
 */
(function () {
  'use strict';
  var script = document.currentScript;
  if (!script || window.__zennoReceptionist) return;
  window.__zennoReceptionist = true;

  var KEY = script.getAttribute('data-key') || '';
  var ENDPOINT = script.getAttribute('data-endpoint') || 'https://eicxhwgxelwcmxcjppwt.supabase.co/functions/v1/receptionist-chat';
  var POLL_MS = 4000;
  var STORAGE = 'zenno_receptionist_visitor';
  if (!/^wc_[a-f0-9]{32}$/.test(KEY)) { console.warn('[Zenno] receptionist widget: missing or invalid data-key'); return; }

  var TEXT = {
    de: { placeholder: 'Nachricht schreiben…', send: 'Senden', open: 'Chat öffnen', close: 'Chat schließen', hello: 'Hallo! Wie kann ich helfen? Ich kann freie Termine finden, buchen und Fragen zu Preisen und Gutscheinen beantworten.', error: 'Das hat nicht geklappt. Bitte noch einmal versuchen.', team: 'Danke! Unser Team antwortet Ihnen hier so bald wie möglich.', ai: 'KI-Assistent' },
    en: { placeholder: 'Write a message…', send: 'Send', open: 'Open chat', close: 'Close chat', hello: 'Hi! How can I help? I can find free times, book appointments and answer questions about prices and vouchers.', error: 'That did not work. Please try again.', team: 'Thanks! Our team will reply here as soon as possible.', ai: 'AI assistant' },
    th: { placeholder: 'พิมพ์ข้อความ…', send: 'ส่ง', open: 'เปิดแชท', close: 'ปิดแชท', hello: 'สวัสดีค่ะ ให้ช่วยอะไรดีคะ? หาเวลาว่าง จองคิว หรือสอบถามราคาและบัตรของขวัญได้เลยค่ะ', error: 'ไม่สำเร็จ กรุณาลองอีกครั้ง', team: 'ขอบคุณค่ะ ทีมงานจะตอบกลับที่นี่โดยเร็วที่สุด', ai: 'ผู้ช่วย AI' },
  };

  // 128-bit random id: only this browser can read its own conversation.
  function newVisitorId() {
    var bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return 'v_' + Array.prototype.map.call(bytes, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }

  function visitorId() {
    try {
      var id = localStorage.getItem(STORAGE);
      if (id && /^v_[a-f0-9]{32}$/.test(id)) return id;
      id = newVisitorId();
      localStorage.setItem(STORAGE, id);
      return id;
    } catch (e) {
      return newVisitorId();
    }
  }

  var visitor = visitorId();
  var seen = {};
  var lastAt = null;
  var pollTimer = null;
  var isSending = false;
  var pendingLocal = []; // texts shown before the server echoes them back
  var t = TEXT.de;

  var host = document.createElement('div');
  host.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:2147483000;';
  var root = host.attachShadow({ mode: 'open' });
  root.innerHTML =
    '<style>' +
    ':host{all:initial}*{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}' +
    '.fab{width:60px;height:60px;border-radius:50%;border:0;cursor:pointer;color:#fff;box-shadow:0 8px 24px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center}' +
    '.fab:focus-visible,.send:focus-visible,.close:focus-visible{outline:3px solid #fff;outline-offset:2px}' +
    '.panel{position:absolute;bottom:76px;right:0;width:min(370px,calc(100vw - 32px));height:min(560px,calc(100vh - 120px));background:#fff;border-radius:18px;box-shadow:0 24px 64px rgba(0,0,0,.28);display:none;flex-direction:column;overflow:hidden}' +
    '.panel.open{display:flex}' +
    '.head{padding:14px 16px;color:#fff;display:flex;align-items:center;justify-content:space-between}' +
    '.head b{display:block;font-size:15px}.head span{font-size:12px;opacity:.85}' +
    '.close{background:transparent;border:0;color:#fff;font-size:22px;cursor:pointer;line-height:1;padding:4px 8px}' +
    '.list{flex:1;overflow-y:auto;padding:14px;background:#F7F5F2;display:flex;flex-direction:column;gap:8px}' +
    '.msg{max-width:84%;padding:10px 12px;border-radius:14px;font-size:14px;line-height:1.45;white-space:pre-wrap;word-wrap:break-word;color:#1A1714}' +
    '.bot{background:#fff;align-self:flex-start;border-bottom-left-radius:4px;box-shadow:0 1px 2px rgba(0,0,0,.06)}' +
    '.me{align-self:flex-end;color:#fff;border-bottom-right-radius:4px}' +
    '.note{align-self:center;font-size:12px;color:#78716c;text-align:center}' +
    '.typing{align-self:flex-start;font-size:20px;letter-spacing:2px;color:#a8a29e;padding:0 8px}' +
    'form{display:flex;gap:8px;padding:10px;border-top:1px solid #e7e5e4;background:#fff}' +
    'textarea{flex:1;resize:none;border:1px solid #d6d3d1;border-radius:12px;padding:10px;font-size:14px;max-height:96px;outline:none;color:#1A1714}' +
    'textarea:focus{border-color:#78716c}' +
    '.send{border:0;border-radius:12px;color:#fff;padding:0 14px;font-size:14px;font-weight:600;cursor:pointer}' +
    '.send:disabled{opacity:.5;cursor:default}' +
    '@media (prefers-reduced-motion:no-preference){.panel.open{animation:pop .18s ease-out}@keyframes pop{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}}' +
    '</style>' +
    '<div class="panel" role="dialog" aria-label="Chat"><div class="head"><div><b class="title"></b><span class="sub"></span></div><button class="close" type="button">×</button></div>' +
    '<div class="list" aria-live="polite"></div>' +
    '<form><textarea rows="1"></textarea><button class="send" type="submit"></button></form></div>' +
    '<button class="fab" type="button"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></button>';
  document.body.appendChild(host);

  var $ = function (sel) { return root.querySelector(sel); };
  var panel = $('.panel'), list = $('.list'), form = $('form'), input = $('textarea'), sendBtn = $('.send'), fab = $('.fab');

  function add(text, who, id) {
    if (id) { if (seen[id]) return; seen[id] = true; }
    var el = document.createElement('div');
    el.className = 'msg ' + (who === 'visitor' ? 'me' : who === 'note' ? 'note' : 'bot');
    if (who === 'note') el.className = 'note';
    if (who === 'visitor') el.style.background = fab.style.background;
    el.textContent = text;
    list.appendChild(el);
    list.scrollTop = list.scrollHeight;
  }

  function typing(on) {
    var el = $('.typing');
    if (on && !el) { el = document.createElement('div'); el.className = 'typing'; el.textContent = '•••'; list.appendChild(el); list.scrollTop = list.scrollHeight; }
    if (!on && el) el.remove();
  }

  function request(method, query, body) {
    return fetch(ENDPOINT + (query || ''), {
      method: method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }).then(function (r) { return r.json().then(function (data) { if (!r.ok) throw new Error(data.error || 'error'); return data; }); });
  }

  function poll() {
    request('GET', '?key=' + KEY + '&visitor=' + visitor + (lastAt ? '&after=' + encodeURIComponent(lastAt) : '')).then(function (data) {
      (data.messages || []).forEach(function (m) {
        var local = m.from === 'visitor' ? pendingLocal.indexOf(m.text) : -1;
        if (local !== -1) { pendingLocal.splice(local, 1); seen[m.id] = true; } else { add(m.text, m.from, m.id); }
        lastAt = m.at;
      });
    }).catch(function () { /* keep polling quietly */ });
  }

  function setOpen(open) {
    panel.classList.toggle('open', open);
    fab.setAttribute('aria-label', open ? t.close : t.open);
    if (open) { input.focus(); poll(); pollTimer = setInterval(poll, POLL_MS); } else { clearInterval(pollTimer); }
  }

  fab.addEventListener('click', function () { setOpen(!panel.classList.contains('open')); });
  $('.close').addEventListener('click', function () { setOpen(false); });
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var text = input.value.trim();
    if (!text || isSending) return;
    isSending = true; sendBtn.disabled = true; input.value = '';
    add(text, 'visitor');
    pendingLocal.push(text);
    typing(true);
    request('POST', '', { key: KEY, visitor: visitor, message: text }).then(function (data) {
      typing(false);
      if (data.reply) { add(data.reply.text, 'ai', data.reply.id); lastAt = data.reply.at; }
      else if (data.waitingForTeam) add(t.team, 'note');
    }).catch(function (err) {
      typing(false);
      add(err && err.message && err.message.length < 120 ? err.message : t.error, 'note');
    }).then(function () { isSending = false; sendBtn.disabled = false; poll(); });
  });

  request('GET', '?key=' + KEY).then(function (cfg) {
    t = TEXT[cfg.language] || TEXT.de;
    var color = /^#[0-9A-Fa-f]{6}$/.test(cfg.color || '') ? cfg.color : '#1A1714';
    fab.style.background = color; sendBtn.style.background = color; $('.head').style.background = color;
    $('.title').textContent = cfg.shop || 'Chat';
    $('.sub').textContent = (cfg.assistant || '') + ' · ' + t.ai;
    input.placeholder = t.placeholder; sendBtn.textContent = t.send;
    fab.setAttribute('aria-label', t.open); $('.close').setAttribute('aria-label', t.close);
    add(cfg.greeting || t.hello, 'ai');
    if (script.getAttribute('data-open') === 'true') setOpen(true);
  }).catch(function () { host.remove(); });
})();
