/* Clockyn admin: operator session + ONE fetch wrapper (security finding S-02).
 *
 * Load order on every page: config.js (defines API_BASE) -> operator-session.js -> auth.js -> page scripts.
 * login.html loads it too (config.js, then this file).
 *
 * SERVER CONTRACT
 *  - POST {API_BASE}/auth/admin-login/verify-otp {email, otp} answers {success, email, role_id} and, only when the
 *    server has a token secret, also {access_token, token_type: "Bearer", expires_in} (seconds). No access_token = old
 *    backend (or legacy mode): the console then keeps working exactly as before with the legacy `x-admin-id: <email>` header.
 *  - Every operator route accepts `Authorization: Bearer <access_token>`.
 *      401 {"detail":"Token expired"} / {"detail":"Not authenticated"} = session over: this module clears the session,
 *          stores the message "Your session expired. Please sign in again." and goes to login.html (once).
 *      403 = signed in but not allowed (e.g. only role_id 1): the caller shows the server message, nobody is logged out.
 *  - WebSocket /ws/support-ops?token=<access_token>  (?admin_id=<email> only works while the server is in legacy mode).
 *
 * WHAT THIS FILE DOES
 *  - Session record {token, expiresAt (ms), email, role}, key "clockyn_operator_session". Stored in sessionStorage
 *    (this tab only), or in localStorage when "Remember me" was ticked. Both are read (sessionStorage first), one is written.
 *    admin_email / gen_admin_id / gen_admin_role / session_last_activity / remember_me stay where login.html/auth.js put them.
 *  - Wraps window.fetch for URLs that start with API_BASE (nothing else is touched: S3 links, CDNs, relative URLs):
 *      * adds `Authorization: Bearer <token>` when there is a live token and the caller set no Authorization header;
 *      * when there is no token, adds `x-admin-id: <email>` if the caller sent none (old backend / legacy mode);
 *        a caller's own x-admin-id is never removed or replaced;
 *      * the login calls (/auth/admin-login, /auth/admin-login/verify-otp) get no credential at all;
 *      * a token whose expiresAt has passed is treated as signed out (so is any call made while the page is already leaving
 *        for login): the request is NOT sent, the caller gets a synthetic 401 {"detail":"Token expired"}, the session ends as below;
 *      * any 401 from API_BASE (except the login calls) ends the session: clear everything, store the notice, redirect to
 *        login.html. Guarded: one redirect per page, never from login.html, parallel 401s are handled once.
 *  - ClockynOperator.wsUrl(path) builds the WebSocket address (?token=, or ?admin_id= when there is no token).
 *
 * SECRECY: the token is a bearer secret. It lives only in web storage, in the Authorization header and in the WebSocket
 * query string. Never log it, never put it in a normal URL or in the page DOM.
 */
(function () {
  'use strict';
  if (window.ClockynOperator) return;

  var KEY = 'clockyn_operator_session';
  var NOTICE_KEY = 'clockyn_operator_notice';
  var EXPIRED_MSG = 'Your session expired. Please sign in again.';
  var LOGIN_PAGE = 'login.html';
  var redirecting = false;

  function store(kind) {
    try { return window[kind]; } catch (e) { return null; }
  }

  function readFrom(s) {
    if (!s) return null;
    try {
      var raw = s.getItem(KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      return o && typeof o === 'object' ? o : null;
    } catch (e) { return null; }
  }

  function removeFrom(s) {
    try { if (s) s.removeItem(KEY); } catch (e) { /* storage blocked */ }
  }

  /* The session record, or null. sessionStorage first, then localStorage. */
  function get() {
    return readFrom(store('sessionStorage')) || readFrom(store('localStorage'));
  }

  /* opts: {token, expiresIn (seconds) | expiresAt (ms), email, role, remember}. A record without a token is valid
   * (old backend: it only carries email and role). Writes ONE storage and clears the other. */
  function set(opts) {
    opts = opts || {};
    var rec = { email: opts.email || '', role: opts.role === undefined ? null : opts.role };
    if (opts.token && typeof opts.token === 'string') {
      rec.token = opts.token;
      var secs = Number(opts.expiresIn);
      if (opts.expiresAt) rec.expiresAt = Number(opts.expiresAt);
      else if (isFinite(secs) && secs > 0) rec.expiresAt = Date.now() + secs * 1000;
    }
    var keep = store(opts.remember ? 'localStorage' : 'sessionStorage');
    var drop = store(opts.remember ? 'sessionStorage' : 'localStorage');
    removeFrom(drop);
    try { if (keep) keep.setItem(KEY, JSON.stringify(rec)); } catch (e) { /* storage blocked: the legacy header still works */ }
    return rec;
  }

  function clear() {
    removeFrom(store('sessionStorage'));
    removeFrom(store('localStorage'));
  }

  /* true when a token was stored and its expiresAt has passed */
  function isExpired() {
    var s = get();
    return !!(s && s.token && s.expiresAt && Date.now() >= s.expiresAt);
  }

  /* the token, only while it is still valid; '' otherwise */
  function token() {
    var s = get();
    if (!s || !s.token || isExpired()) return '';
    return s.token;
  }

  function lsGet(k) {
    try { return window.localStorage.getItem(k) || ''; } catch (e) { return ''; }
  }

  /* the operator e-mail: the session record, else what login/auth.js keep in localStorage while someone is signed in */
  function email() {
    var s = get();
    if (s && s.email) return s.email;
    return lsGet('gen_admin_id') ? lsGet('admin_email') : '';
  }

  /* ── notice shown by login.html after a forced sign-out ── */
  function setNotice(msg) {
    try { window.sessionStorage.setItem(NOTICE_KEY, msg); } catch (e) { /* ignore */ }
  }

  function takeNotice() {
    try {
      var s = window.sessionStorage;
      var m = s.getItem(NOTICE_KEY) || '';
      s.removeItem(NOTICE_KEY);
      return m;
    } catch (e) { return ''; }
  }

  function onLoginPage() {
    return /(^|\/)login\.html$/i.test(window.location.pathname || '');
  }

  /* End the session because the server (or the clock) says it is over. Safe to call many times. */
  function expire(msg) {
    clear();
    ['gen_admin_id', 'gen_admin_role', 'session_last_activity', 'gen_admin_profile'].forEach(function (k) {
      try { window.localStorage.removeItem(k); } catch (e) { /* ignore */ }
    });
    if (redirecting || onLoginPage()) return;
    redirecting = true;
    setNotice(msg || EXPIRED_MSG);
    var inPages = /\/pages\/[^\/]*$/i.test(window.location.pathname || '');
    window.location.replace(inPages ? LOGIN_PAGE : 'pages/' + LOGIN_PAGE);
  }

  /* ── fetch wrapper ── */
  function apiBase() {
    try { return typeof API_BASE === 'string' ? API_BASE.replace(/\/+$/, '') : ''; } catch (e) { return ''; }
  }

  function urlOf(input) {
    if (typeof input === 'string') return input;
    if (input && typeof input.url === 'string') return input.url;          /* Request */
    if (input && typeof input.href === 'string') return input.href;        /* URL */
    return '';
  }

  function isApiUrl(url) {
    var base = apiBase();
    if (!base || !url || url.indexOf(base) !== 0) return false;
    var next = url.charAt(base.length);
    return next === '' || next === '/' || next === '?' || next === '#';
  }

  function isLoginCall(url) {
    var path = url.slice(apiBase().length).split(/[?#]/)[0].replace(/\/+$/, '');
    return path === '/auth/admin-login' || path === '/auth/admin-login/verify-otp';
  }

  function expiredResponse() {
    try {
      return new Response(JSON.stringify({ detail: 'Token expired' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } });
    } catch (e) { return null; }
  }

  var nativeFetch = typeof window.fetch === 'function' ? window.fetch.bind(window) : null;

  function wrappedFetch(input, init) {
    var url = urlOf(input);
    if (!isApiUrl(url)) return nativeFetch(input, init);
    if (isLoginCall(url)) return nativeFetch(input, init);          /* no credential, never a session-expiry trigger */

    if (redirecting || isExpired()) {                               /* signed out / leaving for login: do not send it */
      var synth = expiredResponse();
      expire(EXPIRED_MSG);
      if (synth) return Promise.resolve(synth);
    }

    var tok = token();
    var mail = email();
    var args = init;
    try {
      var src = init && init.headers !== undefined ? init.headers
        : (typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined);
      var h = new Headers(src);
      if (tok && !h.has('Authorization')) h.set('Authorization', 'Bearer ' + tok);
      if (!tok && mail && !h.has('Authorization') && !h.has('x-admin-id')) h.set('x-admin-id', mail);
      args = {};
      if (init) for (var k in init) if (Object.prototype.hasOwnProperty.call(init, k)) args[k] = init[k];
      args.headers = h;
    } catch (e) { args = init; }                                      /* never block a request over a header problem */

    return nativeFetch(input, args).then(function (res) {
      if (res && res.status === 401) expire(EXPIRED_MSG);
      return res;
    });
  }

  if (nativeFetch) window.fetch = wrappedFetch;

  /* ws://… address for a socket path such as '/ws/support-ops'. '' when there is nothing to authenticate with. */
  function wsUrl(path) {
    var base = apiBase();
    if (!base) return '';
    var url = base.replace(/^http/i, 'ws') + (path.charAt(0) === '/' ? path : '/' + path);
    var sep = url.indexOf('?') >= 0 ? '&' : '?';
    var tok = token();
    if (tok) return url + sep + 'token=' + encodeURIComponent(tok);
    if (isExpired()) return '';
    var mail = email();
    return mail ? url + sep + 'admin_id=' + encodeURIComponent(mail) : '';
  }

  window.ClockynOperator = {
    get: get,
    set: set,
    clear: clear,
    token: token,
    email: email,
    isExpired: isExpired,
    expire: expire,
    wsUrl: wsUrl,
    takeNotice: takeNotice,
    EXPIRED_MESSAGE: EXPIRED_MSG
  };
})();
