/* Clockyn console shell: ONE shared sidebar, the floating Live Chat button + chat panel and the working bell, on every page.
 *
 * A page declares the sidebar with a single empty element and loads this script right after it:
 *
 *   <aside class="sidebar" id="app-sidebar" data-active="videos"></aside>
 *   <script src="../js/layout.js"></script>
 *
 * `data-active` is one of: dashboard, organizations, users, subscriptions, payments, coupons, suggestions, tickets, videos,
 * clickstream, faqs, referrals, settings (live_chat has no sidebar item: it is the floating chat button). When it is missing the key
 * is derived from the file name; video_views is part of Video Hub, org_analytics of Organizations, delete_account of Users.
 * The markup is written synchronously (no flash) and before auth.js runs its DOMContentLoaded handler, so auth.js
 * finds the ids/classes it fills: .sidebar-logo-img, #sidebar-avatar, #sidebar-user-name, #sidebar-user-mobile,
 * #sidebar-user-role, .nav-users-badge, .nav-suggestion-badge.
 * Icons are the exact Lucide icons the Clockyn app uses (stroke = currentColor, so they follow the theme).
 *
 * Live Chat: js/live-chat-notify.js (socket, unread badge, tab title, chime, browser notifications) is loaded on every page with the
 * sidebar. Its badge class `.nav-livechat-badge` now sits on the floating chat button (bottom right; not on live_chat.html itself).
 * The button opens a panel with live_chat.html?embed=1 in an iframe (created on first open, kept alive when closed).
 * window.ClockynLiveChatPanel = { open(orgId?), close(restoreFocus?), toggle(), isOpen() } exists on every page except live_chat.html.
 * Inside that iframe this script starts NO second notifier: window.ClockynLiveChat, the open-conversation marker and the
 * clockyn-livechat* events are taken from the parent page.
 *
 * Bell: every `.icon-btn[aria-label="Notifications"]` in a topbar opens a "Needs your attention" list built from data the shell already
 * loads (unread chats, account deletion requests = .nav-users-badge, feature suggestions = .nav-suggestion-badge); the red dot shows
 * only while something needs attention.
 */
(function () {
  'use strict';

  /* [tag, attributes] node lists copied from lucide-react-native (same files the Clockyn app maps). */
  var ICONS = {
    dashboard: [["rect",{"width":"7","height":"9","x":"3","y":"3","rx":"1"}],["rect",{"width":"7","height":"5","x":"14","y":"3","rx":"1"}],["rect",{"width":"7","height":"9","x":"14","y":"12","rx":"1"}],["rect",{"width":"7","height":"5","x":"3","y":"16","rx":"1"}]],
    organizations: [["path",{"d":"M10 12h4"}],["path",{"d":"M10 8h4"}],["path",{"d":"M14 21v-3a2 2 0 0 0-4 0v3"}],["path",{"d":"M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2"}],["path",{"d":"M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"}]],
    users: [["path",{"d":"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"}],["path",{"d":"M16 3.128a4 4 0 0 1 0 7.744"}],["path",{"d":"M22 21v-2a4 4 0 0 0-3-3.87"}],["circle",{"cx":"9","cy":"7","r":"4"}]],
    subscriptions: [["rect",{"width":"8","height":"4","x":"8","y":"2","rx":"1","ry":"1"}],["path",{"d":"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"}],["path",{"d":"M12 11h4"}],["path",{"d":"M12 16h4"}],["path",{"d":"M8 11h.01"}],["path",{"d":"M8 16h.01"}]],
    referrals: [["rect",{"x":"3","y":"8","width":"18","height":"4","rx":"1"}],["path",{"d":"M12 8v13"}],["path",{"d":"M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"}],["path",{"d":"M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"}]],
    payments: [["rect",{"width":"20","height":"14","x":"2","y":"5","rx":"2"}],["line",{"x1":"2","x2":"22","y1":"10","y2":"10"}],["path",{"d":"M6 14h2"}]],
    coupons: [["path",{"d":"M2 9a3 3 0 1 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 1 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"}],["path",{"d":"M9 9h.01"}],["path",{"d":"m15 9-6 6"}],["path",{"d":"M15 15h.01"}]],
    suggestions: [["path",{"d":"M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"}],["path",{"d":"M9 18h6"}],["path",{"d":"M10 22h4"}]],
    tickets: [["circle",{"cx":"12","cy":"12","r":"10"}],["path",{"d":"m4.93 4.93 4.24 4.24"}],["path",{"d":"m14.83 9.17 4.24-4.24"}],["path",{"d":"m14.83 14.83 4.24 4.24"}],["path",{"d":"m9.17 14.83-4.24 4.24"}],["circle",{"cx":"12","cy":"12","r":"4"}]],
    live_chat: [["path",{"d":"M16 10a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 14.286V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"}],["path",{"d":"M20 9a2 2 0 0 1 2 2v10.286a.71.71 0 0 1-1.212.502l-2.202-2.202A2 2 0 0 0 17.172 19H10a2 2 0 0 1-2-2v-1"}]],
    videos: [["path",{"d":"M9 9.003a1 1 0 0 1 1.517-.859l4.997 2.997a1 1 0 0 1 0 1.718l-4.997 2.997A1 1 0 0 1 9 14.996z"}],["circle",{"cx":"12","cy":"12","r":"10"}]],
    clickstream: [["path",{"d":"M14 4.1 12 6"}],["path",{"d":"m5.1 8-2.9-.8"}],["path",{"d":"m6 12-1.9 2"}],["path",{"d":"M7.2 2.2 8 5.1"}],["path",{"d":"M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074z"}]],
    faqs: [["circle",{"cx":"12","cy":"12","r":"10"}],["path",{"d":"M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"}],["path",{"d":"M12 17h.01"}]],
    settings: [["path",{"d":"M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"}],["circle",{"cx":"12","cy":"12","r":"3"}]],
    check: [["path",{"d":"M20 6 9 17l-5-5"}]],
    close: [["path",{"d":"M18 6 6 18"}],["path",{"d":"m6 6 12 12"}]],
    external: [["path",{"d":"M15 3h6v6"}],["path",{"d":"M10 14 21 3"}],["path",{"d":"M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"}]],
    trash: [["path",{"d":"M3 6h18"}],["path",{"d":"M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"}],["path",{"d":"M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"}],["line",{"x1":"10","x2":"10","y1":"11","y2":"17"}],["line",{"x1":"14","x2":"14","y1":"11","y2":"17"}]],
    logout: [["path",{"d":"m16 17 5-5-5-5"}],["path",{"d":"M21 12H9"}],["path",{"d":"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"}]]
  };

  var NAV = [
    { section: 'Overview', items: [
      { key: 'dashboard', label: 'Dashboard', href: 'dashboard.html' }
    ] },
    { section: 'Management', items: [
      { key: 'organizations', label: 'Organizations', href: 'organizations.html' },
      { key: 'users', label: 'Users', href: 'users.html', badge: 'nav-badge nav-users-badge', badgeDisplay: 'none' },
      { key: 'subscriptions', label: 'Subscriptions', href: 'subscriptions.html' },
      { key: 'referrals', label: 'Referrals', href: 'referrals.html' },
      { key: 'payments', label: 'Payments', href: 'payments.html' },
      { key: 'coupons', label: 'Coupons', href: 'coupons.html' },
      { key: 'suggestions', label: 'Suggestions', href: 'suggestions.html', badge: 'nav-badge nav-suggestion-badge', badgeDisplay: 'none' },
      { key: 'tickets', label: 'Ticketing & Bugs', href: 'tickets.html' },
      { key: 'videos', label: 'Video Hub', href: 'videos.html' },
      { key: 'clickstream', label: 'Clickstream', href: 'clickstream.html' },
      { key: 'faqs', label: 'FAQ Hub', href: 'faqs.html' }
    ] },
    { section: 'System', items: [
      { key: 'settings', label: 'Settings', href: 'settings.html' }
    ] }
  ];

  /* Pages that belong to another nav item. */
  var ACTIVE_BY_FILE = { org_analytics: 'organizations', delete_account: 'users', video_views: 'videos' };

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function icon(name, size) {
    var nodes = ICONS[name] || [];
    var inner = nodes.map(function (n) {
      var attrs = Object.keys(n[1]).map(function (k) { return ' ' + k + '="' + esc(n[1][k]) + '"'; }).join('');
      return '<' + n[0] + attrs + '/>';
    }).join('');
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="none"' +
      ' stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      inner + '</svg>';
  }

  function activeKey(aside) {
    var declared = aside.getAttribute('data-active');
    if (declared) return declared;
    var file = (location.pathname.split('/').pop() || '').replace(/\.html?$/, '');
    return ACTIVE_BY_FILE[file] || file;
  }

  function render(aside) {
    var active = activeKey(aside);
    var nav = NAV.map(function (group) {
      var items = group.items.map(function (it) {
        var on = it.key === active;
        var badge = it.badge ? ' <span class="' + it.badge + '" style="display:' + it.badgeDisplay + ';"></span>' : '';
        return '<a class="nav-item' + (on ? ' active' : '') + '" href="' + it.href + '"' + (on ? ' aria-current="page"' : '') + '>' +
          '<span class="nav-icon nav-icon-svg">' + icon(it.key, 20) + '</span>' +
          '<span class="nav-label">' + esc(it.label) + '</span>' + badge + '</a>';
      }).join('');
      return '<div class="nav-section-label">' + esc(group.section) + '</div>' + items;
    }).join('');

    aside.setAttribute('aria-label', 'Sidebar');
    aside.innerHTML =
      '<div class="sidebar-logo">' +
        '<img src="../assets/images/clockyn-logo.png" alt="" class="sidebar-logo-img" />' +
        '<div class="sidebar-logo-name">Clockyn</div>' +
      '</div>' +
      '<nav class="sidebar-nav" aria-label="Main">' + nav + '</nav>' +
      '<div class="sidebar-footer">' +
        '<div class="avatar" id="sidebar-avatar">SA</div>' +
        '<div class="user-info">' +
          '<div class="user-name" id="sidebar-user-name">Super Admin</div>' +
          '<div class="user-mobile" id="sidebar-user-mobile"></div>' +
          '<div class="user-role" id="sidebar-user-role">System Administrator</div>' +
          /* settings.html writes its role label into #sidebar-role; kept so that page script keeps working */
          '<span id="sidebar-name" hidden></span><span id="sidebar-role" hidden></span>' +
        '</div>' +
        '<button type="button" class="logout-btn" id="sidebar-logout" title="Logout" aria-label="Log out">' + icon('logout', 18) + '</button>' +
      '</div>';

    aside.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      if (t.closest('#sidebar-logout')) {
        if (typeof window.showLogoutModal === 'function') window.showLogoutModal();
        else if (typeof window.handleLogout === 'function') window.handleLogout();
        else if (typeof window.logout === 'function') window.logout();
        return;
      }
      if (t.closest('a.nav-item') && typeof window.closeSidebar === 'function') window.closeSidebar();
    });
  }

  var aside = document.getElementById('app-sidebar');
  if (aside) render(aside);

  var me = document.currentScript;
  var active = aside ? activeKey(aside) : '';
  var onChatPage = active === 'live_chat' || /live_chat(\.html?)?$/.test(location.pathname);

  /* ══════════ Embedded in the chat panel of the parent page (live_chat.html?embed=1) ══════════
   * The parent owns the live-chat notifier (one WebSocket, one chime, one unread count). Here we only borrow it:
   *  - window.ClockynLiveChat is the parent's object,
   *  - window.__clockynLiveChatActiveOrg (the open conversation, read by the parent notifier to decide whether a message is "being
   *    looked at") is stored on the parent,
   *  - the notifier's events on the parent document are re-dispatched on this document, which is where live_chat.html listens,
   *  - Escape closes the panel. */
  var PARENT = null;
  try {
    if (window.self !== window.top && /[?&]embed=1(&|$)/.test(location.search) && window.parent && window.parent.document) PARENT = window.parent;
  } catch (e) { PARENT = null; }

  if (PARENT) {
    try {
      Object.defineProperty(window, 'ClockynLiveChat', { configurable: true, get: function () { return PARENT.ClockynLiveChat; }, set: function () {} });
      Object.defineProperty(window, '__clockynLiveChatActiveOrg', {
        configurable: true,
        get: function () { return PARENT.__clockynLiveChatActiveOrg || ''; },
        set: function (v) { PARENT.__clockynLiveChatActiveOrg = v; }
      });
      ['clockyn-livechat', 'clockyn-livechat-state', 'clockyn-livechat-open'].forEach(function (name) {
        var forward = function (ev) { try { document.dispatchEvent(new CustomEvent(name, { detail: ev.detail })); } catch (e) { /* old browser */ } };
        PARENT.document.addEventListener(name, forward);
        window.addEventListener('pagehide', function () { try { PARENT.document.removeEventListener(name, forward); } catch (e) { /* parent gone */ } });
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && !e.defaultPrevented && PARENT.ClockynLiveChatPanel) PARENT.ClockynLiveChatPanel.close(true);
      });
    } catch (e) { PARENT = null; }
  }

  /* Live Chat notifier (socket, unread badge, tab title, chime, browser notifications) on every page with the sidebar,
   * except inside the chat panel (the parent page already runs it). */
  if (aside && me && me.src && !PARENT && !window.ClockynLiveChat && !window.__clockynLiveChatLoading) {
    window.__clockynLiveChatLoading = true;
    var notifier = document.createElement('script');
    notifier.src = me.src.replace(/layout\.js(\?.*)?$/, 'live-chat-notify.js');
    notifier.async = true;
    document.head.appendChild(notifier);
  }

  /* ══════════ Shared styles (floating chat button, chat panel, bell list). Console CSS variables: light and dark follow the theme. ══════════ */
  function addStyles() {
    if (document.getElementById('ck-shell-style')) return;
    var st = document.createElement('style');
    st.id = 'ck-shell-style';
    st.textContent =
      /* floating chat button */
      '.ck-chat-fab{position:fixed;right:max(16px,env(safe-area-inset-right));bottom:max(16px,env(safe-area-inset-bottom));width:56px;height:56px;' +
        'border-radius:50%;border:0;padding:0;cursor:pointer;background:var(--primary);color:var(--on-primary);display:flex;align-items:center;' +
        'justify-content:center;box-shadow:var(--shadow-lg);z-index:900;transition:transform .15s ease,box-shadow .15s ease}' +
      '.ck-chat-fab:hover{transform:translateY(-2px)}.ck-chat-fab:active{transform:scale(.96)}' +
      '.ck-chat-fab:focus-visible{outline:3px solid var(--accent);outline-offset:3px}' +
      '.ck-chat-fab[aria-expanded="true"]{box-shadow:var(--shadow-md)}' +
      '.ck-chat-badge{position:absolute;top:-4px;right:-4px;min-width:22px;height:22px;padding:0 6px;border-radius:999px;background:var(--danger);' +
        'color:var(--on-danger);font-size:11px;font-weight:700;line-height:1;align-items:center;justify-content:center;border:2px solid var(--background);box-sizing:border-box}' +
      '.ck-chat-badge:not([style*="display: none"]):not([style*="display:none"]){display:flex}' +
      /* room under the page content so the button never sits on the last row / pagination */
      'body.ck-has-chat-fab .content{padding-bottom:96px}' +
      /* chat panel */
      '.ck-chat-panel{position:fixed;right:max(16px,env(safe-area-inset-right));bottom:calc(max(16px,env(safe-area-inset-bottom)) + 68px);' +
        'width:min(400px,calc(100vw - 32px));height:min(620px,calc(100vh - 120px));height:min(620px,calc(100dvh - 120px));display:none;flex-direction:column;' +
        'background:var(--surface);color:var(--text);border:1px solid var(--border);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);overflow:hidden;z-index:901}' +
      '.ck-chat-panel.open{display:flex}' +
      '.ck-chat-head{display:flex;align-items:center;gap:8px;padding:10px 10px 10px 16px;border-bottom:1px solid var(--border);background:var(--surface);flex:none}' +
      '.ck-chat-title{font-size:14.5px;font-weight:700}' +
      '.ck-chat-live{font-size:11.5px;font-weight:600;color:var(--text-muted);display:inline-flex;align-items:center;gap:5px;margin-right:auto}' +
      '.ck-chat-live:before{content:"";width:8px;height:8px;border-radius:50%;background:var(--text-muted)}' +
      '.ck-chat-live.on:before{background:var(--success)}.ck-chat-live.off:before{background:var(--warning)}' +
      '.ck-chat-full,.ck-chat-close{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:34px;border-radius:999px;border:1px solid var(--border);' +
        'background:var(--surface);color:var(--text-secondary);font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;text-decoration:none;padding:0 12px}' +
      '.ck-chat-close{width:34px;padding:0}' +
      '.ck-chat-full:hover,.ck-chat-close:hover{background:var(--surface-muted);color:var(--text)}' +
      '.ck-chat-full:focus-visible,.ck-chat-close:focus-visible{outline:2px solid var(--accent);outline-offset:2px}' +
      '.ck-chat-full svg,.ck-chat-close svg{width:16px;height:16px;display:block}' +
      '.ck-chat-body{flex:1;min-height:0;display:flex}' +
      '.ck-chat-frame{flex:1;width:100%;height:100%;border:0;background:var(--surface);display:block}' +
      '@media (max-width:640px){.ck-chat-panel{top:0;left:0;right:0;bottom:0;width:100%;height:100vh;height:100dvh;border:0;border-radius:0;box-shadow:none}' +
        '.ck-chat-head{padding-top:max(10px,env(safe-area-inset-top))}}' +
      /* bell */
      '.icon-btn[aria-label="Notifications"] .dot{display:none}.icon-btn[aria-label="Notifications"].ck-has-alerts .dot{display:block}' +
      '.ck-bell-menu{position:fixed;display:none;width:min(340px,calc(100vw - 16px));background:var(--surface);color:var(--text);border:1px solid var(--border);' +
        'border-radius:var(--radius-md);box-shadow:var(--shadow-lg);z-index:905;overflow:hidden}' +
      '.ck-bell-menu.open{display:block}' +
      '.ck-bell-title{padding:12px 16px 10px;font-size:13px;font-weight:700;border-bottom:1px solid var(--border)}' +
      '.ck-bell-row{display:flex;align-items:center;gap:12px;padding:12px 16px;color:var(--text);text-decoration:none;border-bottom:1px solid var(--border)}' +
      '.ck-bell-row:last-child{border-bottom:0}' +
      '.ck-bell-row:hover,.ck-bell-row:focus-visible{background:var(--surface-muted);outline:0}' +
      '.ck-bell-row .ck-ico{width:34px;height:34px;border-radius:50%;background:var(--surface-muted);display:flex;align-items:center;justify-content:center;flex:none;color:var(--text-secondary)}' +
      '.ck-bell-row svg,.ck-bell-empty svg{width:17px;height:17px;display:block}' +
      '.ck-bell-text{flex:1;min-width:0}.ck-bell-text b{display:block;font-size:13.5px}.ck-bell-text span{display:block;font-size:12px;color:var(--text-muted)}' +
      '.ck-bell-count{flex:none;min-width:22px;padding:2px 8px;border-radius:999px;background:var(--danger);color:var(--on-danger);font-size:11.5px;font-weight:700;text-align:center}' +
      '.ck-bell-empty{display:flex;flex-direction:column;align-items:center;gap:8px;padding:26px 16px;color:var(--text-muted);font-size:13px;font-weight:600}' +
      '.ck-bell-empty .ck-ico{width:38px;height:38px;border-radius:50%;background:var(--success-soft);color:var(--success);display:flex;align-items:center;justify-content:center}' +
      '@media print{.ck-chat-fab,.ck-chat-panel,.ck-bell-menu{display:none!important}}' +
      '@media (prefers-reduced-motion:reduce){.ck-chat-fab{transition:none}}';
    document.head.appendChild(st);
  }

  function label99(n, plus) { return plus || n > 99 ? '99+' : String(n); }

  /* ══════════ Floating chat button + panel (not on live_chat.html, not inside the panel itself) ══════════ */
  var panelApi = null;
  if (aside && !PARENT && !onChatPage && window.self === window.top) {
    (function () {
      addStyles();
      var panelOpen = false;
      var panelOrg = '';
      var fab = null;
      var panel = null;
      var frame = null;
      var liveEl = null;
      var pageUrl = me && me.src ? me.src.replace(/js\/layout\.js(\?.*)?$/, 'pages/live_chat.html') : 'live_chat.html';

      /* the open conversation counts as "being looked at" only while the panel is visible: a message that arrives for it while the
       * panel is closed is an unread message with a chime (js/live-chat-notify.js reads this property) */
      Object.defineProperty(window, '__clockynLiveChatActiveOrg', {
        configurable: true,
        get: function () { return panelOpen ? panelOrg : ''; },
        set: function (v) { panelOrg = v || ''; }
      });

      function buildFab() {
        fab = document.createElement('button');
        fab.type = 'button';
        fab.id = 'ck-chat-fab';
        fab.className = 'ck-chat-fab';
        fab.setAttribute('aria-label', 'Open live chat');
        fab.setAttribute('aria-expanded', 'false');
        fab.setAttribute('aria-controls', 'ck-chat-panel');
        fab.setAttribute('aria-haspopup', 'dialog');
        fab.setAttribute('aria-describedby', 'ck-chat-fab-badge');
        fab.innerHTML = icon('live_chat', 26) + '<span class="nav-livechat-badge ck-chat-badge" id="ck-chat-fab-badge" style="display:none;"></span>';
        fab.addEventListener('click', function () { api.toggle(); });
        document.body.appendChild(fab);
        document.body.classList.add('ck-has-chat-fab');
      }

      function buildPanel() {
        panel = document.createElement('div');
        panel.id = 'ck-chat-panel';
        panel.className = 'ck-chat-panel';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', 'Live chat');
        panel.innerHTML =
          '<div class="ck-chat-head">' +
            '<span class="ck-chat-title">Live Chat</span>' +
            '<span class="ck-chat-live" id="ck-chat-live" role="status"></span>' +
            '<a class="ck-chat-full" href="' + esc(pageUrl) + '" title="Open the full Live Chat page">' + icon('external', 16) + '<span>Open full page</span></a>' +
            '<button type="button" class="ck-chat-close" aria-label="Close live chat" title="Close">' + icon('close', 16) + '</button>' +
          '</div>' +
          '<div class="ck-chat-body" id="ck-chat-body"></div>';
        panel.querySelector('.ck-chat-close').addEventListener('click', function () { api.close(true); });
        document.body.appendChild(panel);
        liveEl = panel.querySelector('#ck-chat-live');
        renderLive();
      }

      function renderLive() {
        if (!liveEl) return;
        var lc = window.ClockynLiveChat;
        var cls = 'ck-chat-live', text = 'Connecting...';
        if (lc && lc.isConnected()) { cls += ' on'; text = 'Live'; }
        else if (lc) { cls += ' off'; text = 'Reconnecting'; }
        liveEl.className = cls;
        liveEl.textContent = text;
      }

      function focusFrame() {
        try { if (frame && frame.contentWindow) frame.contentWindow.focus(); } catch (e) { /* not reachable */ }
      }

      function ensureFrame(orgId) {
        var body = panel.querySelector('#ck-chat-body');
        frame = document.createElement('iframe');
        frame.className = 'ck-chat-frame';
        frame.title = 'Live chat conversations';
        frame.src = pageUrl + '?embed=1' + (orgId ? '&org_id=' + encodeURIComponent(orgId) : '');
        frame.addEventListener('load', focusFrame);
        body.appendChild(frame);
      }

      var api = {
        isOpen: function () { return panelOpen; },
        open: function (orgId) {
          if (!panel) buildPanel();
          panel.classList.add('open');
          fab.setAttribute('aria-expanded', 'true');
          panelOpen = true;
          if (!frame) ensureFrame(orgId);
          else {
            if (orgId) {
              try {
                var w = frame.contentWindow;
                w.document.dispatchEvent(new w.CustomEvent('clockyn-livechat-open', { detail: { org_id: orgId } }));
              } catch (e) { /* the conversation list stays as it is */ }
            }
            setTimeout(focusFrame, 0);
          }
          renderLive();
        },
        close: function (restoreFocus) {
          if (!panelOpen) return;
          panelOpen = false;
          panel.classList.remove('open');
          fab.setAttribute('aria-expanded', 'false');
          if (restoreFocus && fab) { try { fab.focus(); } catch (e) { /* ignore */ } }
        },
        toggle: function () { if (panelOpen) api.close(true); else api.open(); }
      };
      panelApi = api;
      window.ClockynLiveChatPanel = api;

      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && panelOpen && !e.defaultPrevented) api.close(true);
      });
      document.addEventListener('clockyn-livechat-state', renderLive);
      buildFab();
    })();
  }

  /* ══════════ Bell: "Needs your attention" ══════════ */
  function initBell() {
    var buttons = document.querySelectorAll('.icon-btn[aria-label="Notifications"]');
    if (!buttons.length) return;
    addStyles();

    var menu = null;
    var openFor = null;
    var ROWS = [
      { key: 'chat', icon: 'live_chat', title: 'Live chat', unit: 'unread', href: 'live_chat.html' },
      { key: 'deletions', icon: 'trash', title: 'Account deletion requests', unit: 'waiting', href: 'delete_account.html' },
      { key: 'suggestions', icon: 'suggestions', title: 'Feature suggestions', unit: 'new', href: 'suggestions.html' }
    ];

    /* a sidebar badge is "shown" when it is displayed and holds a number ('99+' counts as 99 and keeps its plus) */
    function fromBadges(selector) {
      var out = { n: 0, plus: false };
      var els = document.querySelectorAll(selector);
      for (var i = 0; i < els.length; i++) {
        if (els[i].style.display === 'none') continue;
        var t = (els[i].textContent || '').trim();
        var v = parseInt(t, 10) || 0;
        if (v > out.n) { out.n = v; out.plus = /\+$/.test(t); }
      }
      return out;
    }

    function counts() {
      var lc = window.ClockynLiveChat;
      var chat = lc && typeof lc.unread === 'function' ? lc.unread() : 0;
      return {
        chat: { n: chat, plus: false },
        deletions: fromBadges('.nav-users-badge'),
        suggestions: fromBadges('.nav-suggestion-badge')
      };
    }

    function total(c) { return c.chat.n + c.deletions.n + c.suggestions.n; }

    function ensureDots() {
      for (var i = 0; i < buttons.length; i++) {
        var b = buttons[i];
        b.setAttribute('aria-haspopup', 'true');
        if (!b.hasAttribute('aria-expanded')) b.setAttribute('aria-expanded', 'false');
        if (!b.querySelector('.dot')) {
          var d = document.createElement('span');
          d.className = 'dot';
          d.setAttribute('aria-hidden', 'true');
          b.appendChild(d);
        }
      }
    }

    function renderMenu(c) {
      if (!menu) return;
      var rows = ROWS.filter(function (r) { return c[r.key].n > 0; });
      var html = '<div class="ck-bell-title">Needs your attention</div>';
      if (!rows.length) {
        html += '<div class="ck-bell-empty"><span class="ck-ico">' + icon('check', 20) + '</span>You\'re all caught up</div>';
      } else {
        html += rows.map(function (r) {
          var cnt = label99(c[r.key].n, c[r.key].plus);
          return '<a class="ck-bell-row" href="' + esc(r.href) + '" data-key="' + r.key + '">' +
            '<span class="ck-ico">' + icon(r.icon, 17) + '</span>' +
            '<span class="ck-bell-text"><b>' + esc(r.title) + '</b><span>' + esc(cnt + ' ' + r.unit) + '</span></span>' +
            '<span class="ck-bell-count">' + esc(cnt) + '</span></a>';
        }).join('');
      }
      menu.innerHTML = html;
    }

    function refresh() {
      var c = counts();
      var n = total(c);
      for (var i = 0; i < buttons.length; i++) {
        buttons[i].classList.toggle('ck-has-alerts', n > 0);
        buttons[i].title = n > 0 ? 'Notifications (' + label99(n, c.chat.plus || c.deletions.plus || c.suggestions.plus) + ')' : 'Notifications';
      }
      renderMenu(c);
    }

    function position() {
      if (!menu || !openFor) return;
      var r = openFor.getBoundingClientRect();
      var w = menu.offsetWidth || 340;
      /* right edge under the bell, but always fully inside the screen (a phone bell sits far from the right edge) */
      var left = Math.min(Math.max(8, Math.round(r.right - w)), Math.max(8, window.innerWidth - w - 8));
      menu.style.top = Math.round(r.bottom + 8) + 'px';
      menu.style.left = left + 'px';
      menu.style.right = 'auto';
    }

    function closeMenu(restoreFocus) {
      if (!menu || !openFor) return;
      menu.classList.remove('open');
      openFor.setAttribute('aria-expanded', 'false');
      var b = openFor;
      openFor = null;
      if (restoreFocus) { try { b.focus(); } catch (e) { /* ignore */ } }
    }

    function openMenu(btn) {
      if (!menu) {
        menu = document.createElement('div');
        menu.id = 'ck-bell-menu';
        menu.className = 'ck-bell-menu';
        menu.setAttribute('role', 'dialog');
        menu.setAttribute('aria-label', 'Notifications');
        menu.tabIndex = -1;
        menu.addEventListener('click', function (e) {
          var a = e.target.closest ? e.target.closest('a.ck-bell-row') : null;
          if (!a) return;
          if (a.getAttribute('data-key') === 'chat' && panelApi) { e.preventDefault(); closeMenu(false); panelApi.open(); }
          else if (a.getAttribute('data-key') === 'chat' && onChatPage) { e.preventDefault(); closeMenu(true); }
          else closeMenu(false);
        });
        document.body.appendChild(menu);
      }
      openFor = btn;
      refresh();
      btn.setAttribute('aria-expanded', 'true');
      menu.classList.add('open');
      position();
      var first = menu.querySelector('a.ck-bell-row');
      try { (first || menu).focus(); } catch (e) { /* ignore */ }
    }

    ensureDots();
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener('click', function (e) {
        e.stopPropagation();
        if (openFor === this) closeMenu(true);
        else { closeMenu(false); openMenu(this); }
      });
    }
    document.addEventListener('pointerdown', function (e) {
      if (!openFor) return;
      var t = e.target;
      if (menu && menu.contains(t)) return;
      for (var i = 0; i < buttons.length; i++) if (buttons[i].contains(t)) return;
      closeMenu(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && openFor) { e.preventDefault(); closeMenu(true); }
    });
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, { passive: true });

    /* live updates: the notifier broadcasts the chat count; auth.js rewrites the other two sidebar badges */
    document.addEventListener('clockyn-livechat-state', refresh);
    if (window.MutationObserver) {
      var obs = new MutationObserver(refresh);
      var watch = document.querySelectorAll('.nav-users-badge, .nav-suggestion-badge');
      for (var j = 0; j < watch.length; j++) obs.observe(watch[j], { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['style'] });
    }
    refresh();
  }

  if (!PARENT) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initBell);
    else initBell();
  }
})();
