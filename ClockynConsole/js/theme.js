/* Clockyn admin theme: light | dark | system. Loaded in <head> BEFORE the stylesheet so the page never flashes the wrong theme.
   Saved choice: localStorage['clockyn-admin-theme']. The resolved theme is always written to <html data-theme="light|dark">
   (data-theme-mode keeps the saved choice). API: window.ClockynTheme = { get, set, toggle, resolved }.
   A switch made by the user (toggle button, Settings, login page) plays a short rain shower while the colours fade to the
   new theme. Page load, other-tab and OS-theme changes stay instant, and so does everything under prefers-reduced-motion.
   `set(mode, { animate: false })` skips the effect. */
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

  /* ---------- rain transition ---------- */
  var APPLY_AT = 260;     /* ms into the shower when the colours start to change */
  var SPAWN_MS = 1150;    /* new drops fall for this long, then the last ones finish */
  var HARD_STOP_MS = 2600;
  var FADE_CSS_MS = 900;  /* how long the colour-fade rule stays on <html> */
  var rain = null;        /* the running shower: { stop } */
  var applyTimer = 0;
  var fadeTimer = 0;
  var fadeStyle = null;

  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function ensureFadeRule() {
    if (fadeStyle) return;
    fadeStyle = document.createElement('style');
    fadeStyle.textContent =
      'html.ck-theme-anim, html.ck-theme-anim *, html.ck-theme-anim *::before, html.ck-theme-anim *::after {' +
      'transition: background-color .7s ease, border-color .7s ease, color .7s ease, fill .7s ease, stroke .7s ease,' +
      'box-shadow .7s ease, outline-color .7s ease !important; }';
    document.head.appendChild(fadeStyle);
  }

  function startRain() {
    if (rain) rain.stop(true);
    var canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;z-index:2147483000;pointer-events:none;opacity:1;transition:opacity .35s ease';
    var ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx) return null;
    document.body.appendChild(canvas);

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0;
    function size() {
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    size();
    window.addEventListener('resize', size);

    var drops = [], splashes = [];
    var t0 = performance.now(), last = t0, raf = 0, finished = false;
    var density = Math.max(70, Math.min(280, Math.round(W / 5.5)));  /* drops on screen at the peak */
    var WIND = -0.16;                                               /* sideways speed as a share of fall speed */

    function addDrop() {
      var speed = 1150 + Math.random() * 950;
      drops.push({
        x: Math.random() * (W + H * 0.3) - H * 0.05,
        y: -30 - Math.random() * 60,
        vy: speed, vx: speed * WIND,
        len: 14 + Math.random() * 22,
        w: 0.9 + Math.random() * 0.9,
        a: 0.35 + Math.random() * 0.4
      });
    }

    function splash(x) {
      if (splashes.length > 260) return;
      for (var i = 0; i < 3; i++) {
        splashes.push({ x: x, y: H - 1, vx: (Math.random() - 0.5) * 160, vy: -(70 + Math.random() * 150), r: 0.7 + Math.random() * 1, life: 1 });
      }
    }

    function frame(now) {
      if (finished) return;
      var dt = Math.min(0.05, (now - last) / 1000);
      var t = now - t0;
      last = now;

      if (t < SPAWN_MS) {
        var want = Math.round(density * Math.min(1, t / 300));
        var guard = 0;
        while (drops.length < want && guard++ < 30) addDrop();
      }

      ctx.clearRect(0, 0, W, H);
      ctx.lineCap = 'round';
      var i, d, norm;
      for (i = drops.length - 1; i >= 0; i--) {
        d = drops[i];
        d.x += d.vx * dt; d.y += d.vy * dt;
        if (d.y >= H) { if (Math.random() < 0.55) splash(d.x); drops.splice(i, 1); continue; }
        norm = Math.sqrt(d.vx * d.vx + d.vy * d.vy);
        var tx = d.x - (d.vx / norm) * d.len, ty = d.y - (d.vy / norm) * d.len;
        var g = ctx.createLinearGradient(tx, ty, d.x, d.y);
        g.addColorStop(0, 'rgba(122,156,224,0)');
        g.addColorStop(1, 'rgba(122,156,224,' + d.a + ')');
        ctx.strokeStyle = g; ctx.lineWidth = d.w;
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(d.x, d.y); ctx.stroke();
      }
      for (i = splashes.length - 1; i >= 0; i--) {
        var p = splashes[i];
        p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt * 2.6;
        if (p.life <= 0) { splashes.splice(i, 1); continue; }
        ctx.fillStyle = 'rgba(122,156,224,' + (p.life * 0.6) + ')';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832); ctx.fill();
      }

      if ((t > SPAWN_MS && !drops.length && !splashes.length) || t > HARD_STOP_MS) return stop(false);
      raf = requestAnimationFrame(frame);
    }

    function stop(immediately) {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', size);
      if (rain === handle) rain = null;
      if (immediately) { if (canvas.parentNode) canvas.parentNode.removeChild(canvas); return; }
      canvas.style.opacity = '0';
      setTimeout(function () { if (canvas.parentNode) canvas.parentNode.removeChild(canvas); }, 380);
    }

    var handle = { stop: stop };
    rain = handle;
    raf = requestAnimationFrame(frame);
    return handle;
  }

  function applyWithRain(mode) {
    ensureFadeRule();
    clearTimeout(applyTimer);
    clearTimeout(fadeTimer);
    startRain();
    applyTimer = setTimeout(function () {
      root.classList.add('ck-theme-anim');
      apply(mode);
      fadeTimer = setTimeout(function () { root.classList.remove('ck-theme-anim'); }, FADE_CSS_MS);
    }, APPLY_AT);
  }

  function set(mode, opts) {
    if (mode !== 'light' && mode !== 'dark' && mode !== 'system') mode = 'system';
    try { localStorage.setItem(KEY, mode); } catch (e) { /* private mode: applies for this page only */ }
    var animate = !(opts && opts.animate === false);
    var changes = resolve(mode) !== root.getAttribute('data-theme');
    if (!animate || !changes || reducedMotion() || document.hidden || !document.body) {
      clearTimeout(applyTimer);
      apply(mode);
      return;
    }
    applyWithRain(mode);
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
