/* Clockyn admin shell: ONE shared sidebar for every page.
 *
 * A page declares the sidebar with a single empty element and loads this script right after it:
 *
 *   <aside class="sidebar" id="app-sidebar" data-active="videos"></aside>
 *   <script src="../js/layout.js"></script>
 *
 * `data-active` is one of: dashboard, organizations, users, subscriptions, payments, coupons, suggestions,
 * tickets, live_chat, videos, video_views, clickstream, faqs, referrals, activity, settings. When it is missing the key is derived from the file name.
 * The markup is written synchronously (no flash) and before auth.js runs its DOMContentLoaded handler, so auth.js
 * finds the ids/classes it fills: .sidebar-logo-img, #sidebar-avatar, #sidebar-user-name, #sidebar-user-mobile,
 * #sidebar-user-role, .nav-users-badge, .nav-suggestion-badge, .nav-livechat-badge (filled by js/live-chat-notify.js, which
 * this script loads on every page that has the sidebar).
 * Icons are the exact Lucide icons the Clockyn app uses (stroke = currentColor, so they follow the theme).
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
    video_views: [["path",{"d":"M3 3v16a2 2 0 0 0 2 2h16"}],["path",{"d":"M18 17V9"}],["path",{"d":"M13 17V5"}],["path",{"d":"M8 17v-3"}]],
    clickstream: [["path",{"d":"M14 4.1 12 6"}],["path",{"d":"m5.1 8-2.9-.8"}],["path",{"d":"m6 12-1.9 2"}],["path",{"d":"M7.2 2.2 8 5.1"}],["path",{"d":"M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074z"}]],
    faqs: [["circle",{"cx":"12","cy":"12","r":"10"}],["path",{"d":"M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"}],["path",{"d":"M12 17h.01"}]],
    activity: [["path",{"d":"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"}],["path",{"d":"M3 3v5h5"}],["path",{"d":"M12 7v5l4 2"}]],
    settings: [["path",{"d":"M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"}],["circle",{"cx":"12","cy":"12","r":"3"}]],
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
      { key: 'live_chat', label: 'Live Chat', href: 'live_chat.html', badge: 'nav-badge nav-livechat-badge', badgeDisplay: 'none' },
      { key: 'videos', label: 'Video Hub', href: 'videos.html' },
      { key: 'video_views', label: 'Video Views', href: 'video_views.html' },
      { key: 'clickstream', label: 'Clickstream', href: 'clickstream.html' },
      { key: 'faqs', label: 'FAQ Hub', href: 'faqs.html' }
    ] },
    { section: 'System', items: [
      { key: 'activity', label: 'Activity Logs', href: '#activity' },
      { key: 'settings', label: 'Settings', href: 'settings.html' }
    ] }
  ];

  /* Pages that belong to another nav item. */
  var ACTIVE_BY_FILE = { org_analytics: 'organizations', delete_account: 'users' };

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

  /* Live Chat notifier (socket, sidebar badge, tab title, chime, browser notifications) on every page with the sidebar. */
  var self = document.currentScript;
  if (aside && self && self.src && !window.ClockynLiveChat && !window.__clockynLiveChatLoading) {
    window.__clockynLiveChatLoading = true;
    var notifier = document.createElement('script');
    notifier.src = self.src.replace(/layout\.js(\?.*)?$/, 'live-chat-notify.js');
    notifier.async = true;
    document.head.appendChild(notifier);
  }
})();
