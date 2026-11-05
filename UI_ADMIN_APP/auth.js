// Session duration: 30 minutes
const SESSION_DURATION = 30 * 60 * 1000;
const LAST_ACTIVITY_KEY = 'session_last_activity';
const PROFILE_CACHE_KEY = 'gen_admin_profile';

// Apply logo URL from config to all sidebar logo images
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.sidebar-logo-img').forEach(function(img) {
    img.src = LOGO_URL;
  });
  // Apply cached profile immediately (sync) before async fetch
  var cached = localStorage.getItem(PROFILE_CACHE_KEY);
  if (cached) {
    try {
      var p = JSON.parse(cached);
      populateUserProfile(p);
      applyRolePermissions(p);
    } catch(e) {}
  }
  loadAndPopulateProfile();
});

function getInitials(name) {
  if (!name) return 'SA';
  return name.trim().split(/\s+/).map(function(w) { return w[0]; }).join('').substring(0, 2).toUpperCase();
}

function applyRolePermissions(profile) {
  // Show Add User button only for role_id=1 (Admin), hide for role_id=2 (Staff)
  var addUserBtn = document.getElementById('add-user-btn');
  if (addUserBtn) {
    addUserBtn.style.display = (profile.role === 'Admin') ? '' : 'none';
  }
}

function populateUserProfile(profile) {
  var initials = getInitials(profile.name);
  // Sidebar footer
  var sbAvatar = document.getElementById('sidebar-avatar');
  var sbName   = document.getElementById('sidebar-user-name');
  var sbMobile = document.getElementById('sidebar-user-mobile');
  var sbRole   = document.getElementById('sidebar-user-role');
  if (sbAvatar) sbAvatar.textContent = initials;
  if (sbName)   sbName.textContent   = profile.name;
  if (sbMobile) sbMobile.textContent = profile.email || '';
  if (sbRole)   sbRole.textContent   = profile.role;
  // Topbar
  var tbAvatar = document.getElementById('topbar-avatar');
  var tbName   = document.getElementById('topbar-user-name');
  var tbRole   = document.getElementById('topbar-user-role');
  if (tbAvatar) tbAvatar.textContent = initials;
  if (tbName)   tbName.textContent   = profile.name;
  if (tbRole)   tbRole.textContent   = profile.role;
  // Dispatch event for page-specific handlers
  document.dispatchEvent(new CustomEvent('profileLoaded', { detail: profile }));
}

async function loadAndPopulateProfile() {
  var adminId = localStorage.getItem('admin_email');
  if (!adminId) return;
  try {
    var res = await fetch(API_BASE + '/gen-dashboard/me?email=' + encodeURIComponent(adminId));
    if (!res.ok) return;
    var profile = await res.json();
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
    populateUserProfile(profile);
    applyRolePermissions(profile);
  } catch(e) { /* silently fail — cached data already shown */ }
}

function logout() {
  localStorage.removeItem('gen_admin_id');
  localStorage.removeItem('gen_admin_role');
  localStorage.removeItem('admin_email');
  localStorage.removeItem(LAST_ACTIVITY_KEY);
  localStorage.removeItem('remember_me');
  localStorage.removeItem(PROFILE_CACHE_KEY);
  window.location.href = 'login.html';
}

function checkSession() {
  const adminId = localStorage.getItem('gen_admin_id');
  if (!adminId) return logout();

  // Skip timeout if remember me is enabled
  if (localStorage.getItem('remember_me') === '1') return;

  const last = parseInt(localStorage.getItem(LAST_ACTIVITY_KEY) || '0', 10);
  if (Date.now() - last > SESSION_DURATION) return logout();

  // Refresh activity timestamp
  localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
}

// Reset timer on any user interaction
['click', 'keydown', 'mousemove', 'touchstart'].forEach(evt =>
  document.addEventListener(evt, () => {
    if (localStorage.getItem('remember_me') !== '1') {
      localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
    }
  }, { passive: true })
);

// Check on load, then every minute
checkSession();
setInterval(checkSession, 60 * 1000);

// Deletion request badge — runs on every page
(function loadDelReqBadge() {
  fetch(API_BASE + '/company/deletion-requests', { cache: 'no-store' })
    .then(function(r){ return r.json(); })
    .then(function(rows) {
      var count = Array.isArray(rows) ? rows.length : 0;
      document.querySelectorAll('.nav-users-badge').forEach(function(el) {
        el.textContent = count;
        el.style.display = count > 0 ? '' : 'none';
      });
    })
    .catch(function(){});
})();

// Suggestions badge — runs on every page
(function loadSuggestionBadge() {
  fetch(API_BASE + '/company/suggest-feature', { cache: 'no-store' })
    .then(function(r){ return r.json(); })
    .then(function(data) {
      var count = Array.isArray(data) ? data.length : (data.data ? data.data.length : 0);
      document.querySelectorAll('.nav-suggestion-badge').forEach(function(el) {
        el.textContent = count > 99 ? '99+' : count;
        el.style.display = count > 0 ? 'inline' : 'none';
      });
    })
    .catch(function(){});
})();
