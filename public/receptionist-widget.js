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
  // Same host that serves this script (your Zenno domain) – it forwards to the backend.
  var ENDPOINT = script.getAttribute('data-endpoint') || new URL(script.src).origin + '/api/receptionist/chat';
  var POLL_MS = 4000;
  var STORAGE = 'zenno_receptionist_visitor';
  if (!/^wc_[a-f0-9]{32}$/.test(KEY)) { console.warn('[Zenno] receptionist widget: missing or invalid data-key'); return; }

  var TEXT = {
    de: { placeholder: 'Nachricht schreiben…', send: 'Senden', open: 'Chat öffnen', close: 'Chat schließen', hello: 'Hallo! Wie kann ich helfen? Ich kann freie Termine finden, buchen und Fragen zu Preisen und Gutscheinen beantworten.', error: 'Das hat nicht geklappt. Bitte noch einmal versuchen.', team: 'Danke! Unser Team antwortet Ihnen hier so bald wie möglich.', status: 'Online · antwortet sofort', footnote: 'Antworten werden automatisch erstellt – unser Team übernimmt bei Bedarf.' },
    en: { placeholder: 'Write a message…', send: 'Send', open: 'Open chat', close: 'Close chat', hello: 'Hi! How can I help? I can find free times, book appointments and answer questions about prices and vouchers.', error: 'That did not work. Please try again.', team: 'Thanks! Our team will reply here as soon as possible.', status: 'Online · replies instantly', footnote: 'Replies are generated automatically – our team steps in when needed.' },
    th: { placeholder: 'พิมพ์ข้อความ…', send: 'ส่ง', open: 'เปิดแชท', close: 'ปิดแชท', hello: 'สวัสดีค่ะ ให้ช่วยอะไรดีคะ? หาเวลาว่าง จองคิว หรือสอบถามราคาและบัตรของขวัญได้เลยค่ะ', error: 'ไม่สำเร็จ กรุณาลองอีกครั้ง', team: 'ขอบคุณค่ะ ทีมงานจะตอบกลับที่นี่โดยเร็วที่สุด', status: 'ออนไลน์ · ตอบทันที', footnote: 'ข้อความตอบกลับสร้างโดยอัตโนมัติ – ทีมงานจะช่วยต่อเมื่อจำเป็น' },
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
  // Frosted glass: translucent surfaces over a blurred page, the shop colour as accent (--c).
  root.innerHTML =
    '<style>' +
    ':host{all:initial;--c:#1A1714;--glass:rgba(255,255,255,.62);--line:rgba(255,255,255,.55);--ink:#1A1714;--muted:#6b645d}' +
    '*{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}' +
    'button{font:inherit}' +
    '.fab{position:relative;width:60px;height:60px;border-radius:50%;border:1px solid rgba(255,255,255,.35);cursor:pointer;color:#fff;background:var(--c);box-shadow:0 10px 30px rgba(0,0,0,.25),inset 0 1px 0 rgba(255,255,255,.35);display:flex;align-items:center;justify-content:center;transition:transform .2s ease}' +
    '.fab:hover{transform:translateY(-2px) scale(1.03)}.fab:active{transform:scale(.96)}' +
    '.fab .dot{position:absolute;top:3px;right:3px;width:13px;height:13px;border-radius:50%;background:#22c55e;border:2px solid #fff}' +
    ':focus-visible{outline:3px solid color-mix(in srgb,var(--c) 55%,white);outline-offset:2px}' +
    '.panel{position:absolute;bottom:78px;right:0;width:min(380px,calc(100vw - 32px));height:min(580px,calc(100vh - 120px));display:none;flex-direction:column;overflow:hidden;border-radius:24px;' +
      'background:linear-gradient(160deg,rgba(255,255,255,.78),rgba(255,255,255,.52));-webkit-backdrop-filter:blur(28px) saturate(170%);backdrop-filter:blur(28px) saturate(170%);' +
      'border:1px solid var(--line);box-shadow:0 30px 80px rgba(20,16,12,.28),inset 0 1px 0 rgba(255,255,255,.7)}' +
    '.panel::before{content:"";position:absolute;inset:-40% -30% auto auto;width:260px;height:260px;border-radius:50%;background:var(--c);opacity:.16;filter:blur(60px);pointer-events:none}' +
    '.panel.open{display:flex}' +
    '.head{position:relative;display:flex;align-items:center;gap:12px;padding:16px 14px 14px 16px;border-bottom:1px solid rgba(26,23,20,.07)}' +
    '.avatar{width:42px;height:42px;flex:none;border-radius:50%;background:var(--c);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;overflow:hidden;box-shadow:0 4px 14px rgba(0,0,0,.15)}' +
    '.avatar img{width:100%;height:100%;object-fit:cover;background:#fff}' +
    '.who{flex:1;min-width:0}.title{display:block;font-size:16px;font-weight:700;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.sub{display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--muted);margin-top:2px}' +
    '.live{position:relative;width:8px;height:8px;border-radius:50%;background:#22c55e}' +
    '.close{width:36px;height:36px;flex:none;border-radius:50%;border:1px solid var(--line);background:rgba(255,255,255,.55);color:var(--ink);font-size:20px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s}' +
    '.close:hover{background:rgba(255,255,255,.9)}' +
    '.list{position:relative;flex:1;overflow-y:auto;padding:16px 14px;display:flex;flex-direction:column;gap:8px;scrollbar-width:thin}' +
    '.msg{max-width:85%;padding:10px 13px;border-radius:18px;font-size:14px;line-height:1.5;word-wrap:break-word;color:var(--ink)}' +
    '.msg p{margin:0}.msg p+p,.msg ul+p,.msg p+ul{margin-top:6px}.msg ul{margin:0;padding-left:18px}.msg li+li{margin-top:2px}.msg b{font-weight:650}' +
    '.bot{align-self:flex-start;background:var(--glass);border:1px solid var(--line);border-bottom-left-radius:6px;box-shadow:0 2px 10px rgba(20,16,12,.06)}' +
    '.me{align-self:flex-end;background:var(--c);color:#fff;border-bottom-right-radius:6px;box-shadow:0 4px 14px rgba(0,0,0,.14)}' +
    '.note{align-self:center;max-width:90%;padding:6px 12px;border-radius:999px;background:rgba(255,255,255,.55);font-size:12px;color:var(--muted);text-align:center}' +
    '.typing{align-self:flex-start;display:flex;gap:5px;padding:13px 15px;border-radius:18px;border-bottom-left-radius:6px;background:var(--glass);border:1px solid var(--line)}' +
    '.typing i{width:7px;height:7px;border-radius:50%;background:var(--c);opacity:.35}' +
    'form{position:relative;display:flex;align-items:flex-end;gap:8px;margin:0 12px;padding:6px 6px 6px 14px;border-radius:24px;background:rgba(255,255,255,.75);border:1px solid var(--line);box-shadow:0 4px 18px rgba(20,16,12,.08)}' +
    'textarea{flex:1;resize:none;border:0;background:transparent;padding:8px 0;font-size:15px;line-height:1.4;max-height:96px;outline:none;color:var(--ink)}' +
    'textarea::placeholder{color:#9a928a}' +
    'textarea:focus,textarea:focus-visible{outline:none}' +
    'form:focus-within{border-color:color-mix(in srgb,var(--c) 45%,white);box-shadow:0 0 0 3px color-mix(in srgb,var(--c) 18%,transparent),0 4px 18px rgba(20,16,12,.08)}' +
    '.send{width:38px;height:38px;flex:none;border:0;border-radius:50%;background:var(--c);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform .15s,opacity .15s}' +
    '.send:hover{transform:scale(1.06)}.send:disabled{opacity:.4;cursor:default;transform:none}' +
    '.foot{padding:8px 16px 12px;font-size:11px;line-height:1.35;color:var(--muted);text-align:center}' +
    '@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){.panel{background:#fbfaf8}}' +
    '@media (prefers-reduced-motion:no-preference){' +
      '.panel.open{animation:pop .28s cubic-bezier(.16,1,.3,1)}@keyframes pop{from{opacity:0;transform:translateY(14px) scale(.97)}to{opacity:1;transform:none}}' +
      '.msg,.note,.typing{animation:rise .3s cubic-bezier(.16,1,.3,1)}@keyframes rise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}' +
      '.typing i{animation:bounce 1.2s infinite ease-in-out}.typing i:nth-child(2){animation-delay:.15s}.typing i:nth-child(3){animation-delay:.3s}' +
      '@keyframes bounce{0%,60%,100%{transform:translateY(0);opacity:.35}30%{transform:translateY(-5px);opacity:.9}}' +
      '.live::after{content:"";position:absolute;inset:0;border-radius:50%;background:#22c55e;animation:ping 2s infinite}@keyframes ping{0%{transform:scale(1);opacity:.6}80%,100%{transform:scale(2.6);opacity:0}}' +
    '}' +
    '</style>' +
    '<div class="panel" role="dialog" aria-label="Chat">' +
      '<div class="head"><div class="avatar" aria-hidden="true"></div><div class="who"><b class="title"></b><span class="sub"><span class="live" aria-hidden="true"></span><span class="status"></span></span></div><button class="close" type="button">×</button></div>' +
      '<div class="list" aria-live="polite"></div>' +
      '<form><textarea rows="1"></textarea><button class="send" type="submit"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button></form>' +
      '<div class="foot"></div>' +
    '</div>' +
    '<button class="fab" type="button"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span class="dot" aria-hidden="true"></span></button>';
  document.body.appendChild(host);

  var $ = function (sel) { return root.querySelector(sel); };
  var panel = $('.panel'), list = $('.list'), form = $('form'), input = $('textarea'), sendBtn = $('.send'), fab = $('.fab');

  /** Appends text with **bold** turned into <b>, as text nodes only (never HTML). */
  function inline(parent, text) {
    text.split(/(\*\*[^*]+\*\*)/).forEach(function (part) {
      if (/^\*\*[^*]+\*\*$/.test(part)) { var b = document.createElement('b'); b.textContent = part.slice(2, -2); parent.appendChild(b); }
      else if (part) parent.appendChild(document.createTextNode(part));
    });
  }

  /** Paragraphs and "* " / "- " bullet lists from the reply text. */
  function render(el, text) {
    var ul = null;
    text.split('\n').forEach(function (line) {
      var bullet = /^\s*[*\-•]\s+(.*)$/.exec(line);
      if (bullet) {
        if (!ul) { ul = document.createElement('ul'); el.appendChild(ul); }
        var li = document.createElement('li'); inline(li, bullet[1]); ul.appendChild(li);
        return;
      }
      ul = null;
      if (!line.trim()) return;
      var p = document.createElement('p'); inline(p, line); el.appendChild(p);
    });
  }

  function add(text, who, id) {
    if (id) { if (seen[id]) return; seen[id] = true; }
    var el = document.createElement('div');
    el.className = who === 'note' ? 'note' : 'msg ' + (who === 'visitor' ? 'me' : 'bot');
    if (who === 'note' || who === 'visitor') el.textContent = text; else render(el, text);
    list.appendChild(el);
    list.scrollTop = list.scrollHeight;
  }

  function typing(on) {
    var el = $('.typing');
    if (on && !el) {
      el = document.createElement('div'); el.className = 'typing'; el.setAttribute('aria-label', '…');
      for (var i = 0; i < 3; i++) el.appendChild(document.createElement('i'));
      list.appendChild(el); list.scrollTop = list.scrollHeight;
    }
    if (!on && el) el.remove();
  }

  // Longer answers arrive as up to three bubbles with a short "typing" pause, like a person texting.
  function showLikeTyping(text) {
    var parts = text.split(/\n\s*\n/).map(function (p) { return p.trim(); }).filter(Boolean);
    if (parts.length > 3) parts = parts.slice(0, 2).concat([parts.slice(2).join('\n\n')]);
    if (!parts.length) parts = [text];
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return parts.reduce(function (chain, part, index) {
      return chain.then(function () {
        if (index === 0 || reduceMotion) { typing(false); add(part, 'ai'); return; }
        typing(true);
        var pause = Math.min(3000, Math.max(900, part.length * 25));
        return new Promise(function (resolve) { setTimeout(function () { typing(false); add(part, 'ai'); resolve(); }, pause); });
      });
    }, Promise.resolve());
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
      if (data.reply) { lastAt = data.reply.at; seen[data.reply.id] = true; return showLikeTyping(data.reply.text); }
      typing(false);
      if (data.waitingForTeam) add(t.team, 'note');
    }).catch(function (err) {
      typing(false);
      add(err && err.message && err.message.length < 120 ? err.message : t.error, 'note');
    }).then(function () { isSending = false; sendBtn.disabled = false; poll(); });
  });

  request('GET', '?key=' + KEY).then(function (cfg) {
    t = TEXT[cfg.language] || TEXT.de;
    var color = /^#[0-9A-Fa-f]{6}$/.test(cfg.color || '') ? cfg.color : '#1A1714';
    host.style.setProperty('--c', color);
    var shopName = cfg.shop || 'Chat';
    $('.title').textContent = shopName;
    $('.status').textContent = t.status;
    $('.foot').textContent = t.footnote;
    var avatar = $('.avatar');
    if (cfg.logo && /^(https:\/\/|data:image\/(png|jpe?g|webp|svg\+xml);base64,)/.test(cfg.logo)) {
      var img = document.createElement('img'); img.alt = ''; img.src = cfg.logo;
      img.onerror = function () { img.remove(); avatar.textContent = shopName.charAt(0).toUpperCase(); };
      avatar.appendChild(img);
    } else { avatar.textContent = shopName.charAt(0).toUpperCase(); }
    input.placeholder = t.placeholder; sendBtn.setAttribute('aria-label', t.send);
    fab.setAttribute('aria-label', t.open); $('.close').setAttribute('aria-label', t.close);
    add(cfg.greeting || t.hello, 'ai');
    if (script.getAttribute('data-open') === 'true') setOpen(true);
  }).catch(function () { host.remove(); });
})();
