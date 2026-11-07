/* Clockyn admin theme: light | dark | system. Loaded in <head> BEFORE the stylesheet so the page never flashes the wrong theme.
   Saved choice: localStorage['clockyn-admin-theme']. The resolved theme is always written to <html data-theme="light|dark">
   (data-theme-mode keeps the saved choice). API: window.ClockynTheme = { get, set, toggle, resolved }. */
(function () {
  var KEY = 'clockyn-admin-theme';
  var root = document.documentElement;
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function read() {
    try {
      var v = localStorage.getItem(KEY);
      return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
    } catch (e) {
      return 'system';
    }
  }

  function resolve(mode) {
    if (mode === 'light' || mode === 'dark') return mode;
    return mq && mq.matches ? 'dark' : 'light';
  }

  function apply(mode) {
    var theme = resolve(mode);
    root.setAttribute('data-theme', theme);
    root.setAttribute('data-theme-mode', mode);
    root.style.colorScheme = theme;
    try {
      document.dispatchEvent(new CustomEvent('clockyn-theme', { detail: { mode: mode, theme: theme } }));
    } catch (e) { /* old browsers: no event */ }
  }

  function set(mode) {
    if (mode !== 'light' && mode !== 'dark' && mode !== 'system') mode = 'system';
    try { localStorage.setItem(KEY, mode); } catch (e) { /* private mode: applies for this page only */ }
    apply(mode);
  }

  function toggle() {
    set(resolve(read()) === 'dark' ? 'light' : 'dark');
  }

  apply(read());

  if (mq) {
    var onChange = function () { if (read() === 'system') apply('system'); };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }

  /* another tab changed the theme */
  window.addEventListener('storage', function (e) { if (e.key === KEY) apply(read()); });

  window.ClockynTheme = {
    get: read,
    set: set,
    toggle: toggle,
    resolved: function () { return resolve(read()); }
  };
})();
