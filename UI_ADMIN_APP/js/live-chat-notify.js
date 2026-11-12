/* Clockyn admin: Live Chat notifier. Injected by js/layout.js on EVERY page that renders the sidebar (never on login).
 *
 * One WebSocket to the support inbox (`/ws/support-ops?token=<operator session token>`, `?admin_id=<operator e-mail>` against an old
 * backend / legacy mode; see js/operator-session.js) per tab that:
 *   - drives the sidebar badge `.nav-livechat-badge` and prefixes `document.title` with "(n) ",
 *   - plays a sound for each new message: the file assets/sounds/notification.mp3 when it exists (see assets/sounds/README.txt),
 *     otherwise a short built-in chime (WebAudio, no asset). Muted state in localStorage 'clockyn-livechat-mute',
 *   - shows a browser Notification for an incoming ORG message when the tab is hidden / unfocused or another
 *     conversation is open (permission is requested from a button on the Live Chat page: browsers need a gesture),
 *   - re-broadcasts every frame as the `clockyn-livechat` CustomEvent (detail = the frame) so pages never open a second socket,
 *   - falls back to polling GET /gen-dashboard/live-chat/unread-count every 20 s while the socket is down (and
 *     reconciles the count every 60 s even while it is up: another console reading a thread sends no frame).
 *
 * Public API: window.ClockynLiveChat = { unread(), refreshUnread(), isConnected(), permission(), requestPermission(),
 *   isMuted(), setMuted(bool), setActiveOrg(orgId), testSound() }. The open conversation is also readable from
 *   window.__clockynLiveChatActiveOrg (set by live_chat.html before this script has loaded).
 * Events on `document`: `clockyn-livechat` (frame), `clockyn-livechat-state` (detail = snapshot: unread, connected,
 *   permission, muted), `clockyn-livechat-open` (detail.org_id: a notification was clicked on the Live Chat page).
 * Everything tolerates a missing admin e-mail, a missing API_BASE and a failing network silently.
 */
(function () {
  'use strict';
  if (window.ClockynLiveChat) return;

  var SELF_SRC = (document.currentScript && document.currentScript.src) || '';
  var MUTE_KEY = 'clockyn-livechat-mute';
  var SOUND_FILE = 'assets/sounds/notification.mp3';
  var SOUND_VOLUME = 0.8;
  var PING_MS = 25000;
  var POLL_MS = 20000;
  var RECONCILE_MS = 60000;
  var BACKOFF_MIN = 1000;
  var BACKOFF_MAX = 30000;

  var state = { unread: 0, connected: false };
  var ws = null;
  var pingTimer = 0;
  var pollTimer = 0;
  var reconcileTimer = 0;
  var reconnectTimer = 0;
  var refreshTimer = 0;
  var backoff = BACKOFF_MIN;
  var stopped = false;
  var wasDown = false;
  var baseTitle = '';
  var seen = [];
  var audioCtx = null;
  var sound = null;          /* HTMLAudioElement of the custom file, or null when there is none */
  var soundFailed = false;   /* the file is missing or cannot be decoded: the built-in chime is used */

  function adminId() {
    try { return localStorage.getItem('admin_email') || ''; } catch (e) { return ''; }
  }

  function apiBase() {
    try { return typeof API_BASE === 'string' ? API_BASE.replace(/\/+$/, '') : ''; } catch (e) { return ''; }
  }

  function loggedIn() {
    try { return !!localStorage.getItem('gen_admin_id'); } catch (e) { return false; }
  }

  function activeOrg() { return window.__clockynLiveChatActiveOrg || ''; }

  function isMuted() {
    try { return localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { return false; }
  }

  function setMuted(on) {
    try { localStorage.setItem(MUTE_KEY, on ? '1' : '0'); } catch (e) { /* private mode */ }
    emitState();
  }

  function permission() {
    try { return 'Notification' in window ? window.Notification.permission : 'unsupported'; } catch (e) { return 'unsupported'; }
  }

  function requestPermission() {
    return new Promise(function (resolve) {
      try {
        if (!('Notification' in window)) return resolve('unsupported');
        var done = function (p) { emitState(); resolve(p || permission()); };
        var r = window.Notification.requestPermission(done);
        if (r && typeof r.then === 'function') r.then(done, function () { done(); });
      } catch (e) { resolve(permission()); }
    });
  }

  function snapshot() {
    return { unread: state.unread, connected: state.connected, permission: permission(), muted: isMuted() };
  }

  function emit(name, detail) {
    try { document.dispatchEvent(new CustomEvent(name, { detail: detail })); } catch (e) { /* old browser */ }
  }

  function emitState() { emit('clockyn-livechat-state', snapshot()); }

  /* ── badge + tab title ── */
  function label(n) { return n > 99 ? '99+' : String(n); }

  function render() {
    var n = state.unread;
    var badges = document.querySelectorAll('.nav-livechat-badge');
    for (var i = 0; i < badges.length; i++) {
      badges[i].textContent = n > 0 ? label(n) : '';
      badges[i].style.display = n > 0 ? '' : 'none';
    }
    document.title = (n > 0 ? '(' + label(n) + ') ' : '') + baseTitle;
    emitState();
  }

  function setUnread(n) {
    n = Math.max(0, parseInt(n, 10) || 0);
    if (n === state.unread) return;
    state.unread = n;
    render();
  }

  /* the global fetch wrapper (js/operator-session.js) adds `Authorization: Bearer <token>`; x-admin-id stays for the legacy mode */
  function headers() { return { 'x-admin-id': adminId() }; }

  function fetchUnread() {
    var base = apiBase();
    if (!base || !loggedIn()) return Promise.resolve();
    return fetch(base + '/gen-dashboard/live-chat/unread-count', { headers: headers(), cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { if (d && typeof d.unread_messages !== 'undefined') setUnread(d.unread_messages); })
      .catch(function () { /* offline: keep the last count */ });
  }

  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(fetchUnread, 1500);
  }

  /* ── sound ── */
  /* The custom file lives at <console root>/assets/sounds/notification.mp3 (found from this script's own address). It is loaded
   * once at start so a missing file is known before the first message arrives. */
  function soundUrl() {
    if (typeof window.CLOCKYN_NOTIFY_SOUND === 'string' && window.CLOCKYN_NOTIFY_SOUND) return window.CLOCKYN_NOTIFY_SOUND;
    return SELF_SRC ? SELF_SRC.replace(/js\/live-chat-notify\.js.*$/, SOUND_FILE) : '';
  }

  function loadSound() {
    try {
      var url = soundUrl();
      if (!url || typeof window.Audio !== 'function') { soundFailed = true; return; }
      sound = new window.Audio(url);
      sound.preload = 'auto';
      sound.volume = SOUND_VOLUME;
      sound.addEventListener('error', function () { soundFailed = true; });
    } catch (e) { soundFailed = true; }
  }

  function chime() {
    if (isMuted()) return;
    if (sound && !soundFailed) {
      try {
        sound.currentTime = 0;
        var played = sound.play();
        if (played && played.catch) {
          played.catch(function (err) {
            /* the browser blocked it until the person clicks on the page: stay silent, like the chime. Anything else: use the chime */
            if (!err || err.name !== 'NotAllowedError') { soundFailed = true; synthChime(); }
          });
        }
        return;
      } catch (e) { soundFailed = true; }
    }
    synthChime();
  }

  /* the built-in two-note chime */
  function synthChime() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!audioCtx) audioCtx = new AC();
      if (audioCtx.state === 'suspended' && audioCtx.resume) audioCtx.resume();
      if (audioCtx.state !== 'running') return;       /* autoplay policy: no gesture yet, stay silent */
      var t0 = audioCtx.currentTime;
      [[880, 0, 0.13], [1174.66, 0.12, 0.2]].forEach(function (n) {
        var osc = audioCtx.createOscillator();
        var g = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = n[0];
        g.gain.setValueAtTime(0.0001, t0 + n[1]);
        g.gain.exponentialRampToValueAtTime(0.16, t0 + n[1] + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + n[1] + n[2]);
        osc.connect(g); g.connect(audioCtx.destination);
        osc.start(t0 + n[1]);
        osc.stop(t0 + n[1] + n[2] + 0.02);
      });
    } catch (e) { /* no audio */ }
  }

  /* a click anywhere unlocks audio for later sounds */
  function unlockAudio() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!audioCtx) audioCtx = new AC();
      if (audioCtx.state === 'suspended' && audioCtx.resume) audioCtx.resume();
    } catch (e) { /* ignore */ }
  }

  /* ── browser notification ── */
  function onLiveChatPage() { return !!document.getElementById('lc-root'); }

  function notify(d) {
    try {
      if (permission() !== 'granted') return;
      var text = d.message_type === 'text' && d.message ? String(d.message) : 'Sent an attachment';
      var icon = SELF_SRC ? SELF_SRC.replace(/js\/live-chat-notify\.js.*$/, 'assets/images/clockyn-logo.png') : undefined;
      var n = new window.Notification(d.org_name || 'Live Chat', {
        body: text.length > 140 ? text.slice(0, 137) + '...' : text,
        tag: 'lc-' + d.org_id,
        renotify: true,
        icon: icon
      });
      n.onclick = function () {
        try { window.focus(); } catch (e) { /* ignore */ }
        try { n.close(); } catch (e) { /* ignore */ }
        if (onLiveChatPage()) emit('clockyn-livechat-open', { org_id: d.org_id });
        else location.href = (SELF_SRC ? SELF_SRC.replace(/js\/live-chat-notify\.js.*$/, 'pages/') : '') + 'live_chat.html?org_id=' + encodeURIComponent(d.org_id);
      };
    } catch (e) { /* notifications unavailable */ }
  }

  /* ── frames ── */
  function remember(id) {
    if (!id) return false;
    if (seen.indexOf(id) >= 0) return true;
    seen.push(id);
    if (seen.length > 500) seen.shift();
    return false;
  }

  function onOrgMessage(d) {
    if (remember(d.message_id)) return;
    var looking = !document.hidden && document.hasFocus() && activeOrg() === d.org_id;
    if (!looking) {
      setUnread(state.unread + 1);
      chime();
      notify(d);
    }
    scheduleRefresh();
  }

  function handleFrame(f) {
    if (!f || typeof f !== 'object' || !f.type) return;
    emit('clockyn-livechat', f);
    if (f.type === 'live_chat_message' && f.data && f.data.sender_type === 'org') onOrgMessage(f.data);
  }

  /* ── socket ── */
  /* js/operator-session.js builds the address: ?token=<operator session token>, or ?admin_id=<e-mail> when there is no token
   * (old backend / legacy mode). The same helper is used on every reconnect, so a renewed token is picked up. */
  function wsUrl() {
    var base = apiBase();
    if (!base || !adminId()) return '';
    if (window.ClockynOperator && typeof window.ClockynOperator.wsUrl === 'function') return window.ClockynOperator.wsUrl('/ws/support-ops');
    return base.replace(/^http/i, 'ws') + '/ws/support-ops?admin_id=' + encodeURIComponent(adminId());
  }

  function clearSocketTimers() {
    clearInterval(pingTimer); pingTimer = 0;
  }

  function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(fetchUnread, POLL_MS);
  }

  function stopPolling() {
    clearInterval(pollTimer); pollTimer = 0;
  }

  function scheduleReconnect() {
    if (stopped) return;
    clearTimeout(reconnectTimer);
    var delay = Math.min(BACKOFF_MAX, backoff) + Math.floor(Math.random() * 250);
    backoff = Math.min(BACKOFF_MAX, backoff * 2);
    reconnectTimer = setTimeout(connect, delay);
  }

  function connect() {
    if (stopped) return;
    var url = wsUrl();
    if (!url || typeof WebSocket === 'undefined') { startPolling(); return; }
    var sock;
    try { sock = new WebSocket(url); } catch (e) { startPolling(); scheduleReconnect(); return; }
    ws = sock;
    sock.onopen = function () {
      if (ws !== sock) return;
      backoff = BACKOFF_MIN;
      state.connected = true;
      stopPolling();
      clearSocketTimers();
      pingTimer = setInterval(function () { try { sock.send('ping'); } catch (e) { /* closing */ } }, PING_MS);
      if (wasDown) { fetchUnread(); emit('clockyn-livechat', { type: 'resync', data: {} }); }
      wasDown = false;
      emitState();
    };
    sock.onmessage = function (ev) {
      var data = ev && ev.data;
      if (typeof data !== 'string' || data === 'pong') return;
      var f = null;
      try { f = JSON.parse(data); } catch (e) { return; }
      handleFrame(f);
    };
    var down = function (ev) {
      if (ws !== sock) return;
      ws = null;
      clearSocketTimers();
      state.connected = false;
      wasDown = true;
      emitState();
      startPolling();
      if (ev && ev.code === 4403) { stopped = true; return; }   /* not an operator: do not hammer the server */
      scheduleReconnect();
    };
    sock.onclose = down;
    sock.onerror = function () { try { sock.close(); } catch (e) { /* already closed */ } };
  }

  /* ── boot ── */
  function init() {
    if (!loggedIn()) return;
    baseTitle = document.title.replace(/^\(\d+\+?\)\s+/, '');
    loadSound();
    document.addEventListener('pointerdown', unlockAudio, { once: true, passive: true });
    document.addEventListener('keydown', unlockAudio, { once: true, passive: true });
    render();
    fetchUnread();
    connect();
    if (!state.connected) startPolling();
    reconcileTimer = setInterval(fetchUnread, RECONCILE_MS);
    window.addEventListener('online', function () { fetchUnread(); if (!ws) { clearTimeout(reconnectTimer); backoff = BACKOFF_MIN; connect(); } });
    window.addEventListener('beforeunload', function () { stopped = true; clearInterval(reconcileTimer); try { if (ws) ws.close(); } catch (e) { /* ignore */ } });
  }

  window.ClockynLiveChat = {
    unread: function () { return state.unread; },
    refreshUnread: function () { return fetchUnread(); },
    isConnected: function () { return state.connected; },
    permission: permission,
    requestPermission: requestPermission,
    isMuted: isMuted,
    setMuted: setMuted,
    setActiveOrg: function (orgId) { window.__clockynLiveChatActiveOrg = orgId || ''; },
    /* plays the notification sound once (respects mute); useful to check a new file from the browser console */
    testSound: function () { chime(); }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
