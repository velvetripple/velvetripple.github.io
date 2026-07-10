/* ============================================================
   VELVET RIPPLE — liquid scroll engine
   calm at rest · liquefies with scroll velocity · climate descent
   listens for `vr-tweaks` CustomEvents from the Tweaks panel
   ============================================================ */
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // defaults — kept in sync with site-tweaks.jsx / site-tweaks-v2.jsx
  // v2 analog knobs are harmless no-ops on the v1 page
  const T = { motion: 6, distortion: 35, grain: 55, drift: true,
              paper: 55, dust: 40, misreg: 45, vignette: 35, tape: true };
  const root = document.documentElement;

  function applyStatic() {
    root.style.setProperty('--grain-o', (T.grain / 100).toFixed(3));
    root.style.setProperty('--clim-dur', T.drift ? '1.4s' : '0.25s');
    // v2 analog plates
    root.style.setProperty('--paper-o', (T.paper / 100 * 0.17).toFixed(3));
    root.style.setProperty('--dust-o', (T.dust / 100 * 0.9).toFixed(3));
    root.style.setProperty('--misx', (T.misreg / 100 * 2.6).toFixed(2) + 'px');
    root.style.setProperty('--vig-o', (T.vignette / 100 * 0.30).toFixed(3));
    document.body.dataset.tape = T.tape ? 'on' : 'off';
  }
  window.addEventListener('vr-tweaks', (e) => {
    Object.assign(T, e.detail);
    applyStatic();
  });
  applyStatic();

  // --- reveals -------------------------------------------------
  const io = new IntersectionObserver(
    (entries) => entries.forEach((en) => {
      if (en.isIntersecting) en.target.classList.add('in');
    }),
    { threshold: 0.18 }
  );
  document.querySelectorAll('.rv').forEach((el) => io.observe(el));

  // --- liquid + climate + parallax loop ------------------------
  const turb = document.getElementById('vr-turb');
  const disp = document.getElementById('vr-disp');
  const secs = Array.from(document.querySelectorAll('section[data-climate]'));
  const plx = Array.from(document.querySelectorAll('[data-plx]'));

  let lastY = window.scrollY;
  let vel = 0;
  const t0 = performance.now();
  const tapeEl = document.getElementById('vr-count'); // v2 tape counter (absent on v1)

  function frame(now) {
    const t = (now - t0) / 1000;
    const y = window.scrollY;
    vel += (y - lastY - vel) * 0.1; // smoothed velocity, px/frame
    lastY = y;

    // tape wow: baseFrequency drifts slowly; scroll velocity melts harder
    if (!reduced && turb && disp) {
      const wow = 0.006 + Math.sin(t * 0.31) * 0.0011 + Math.sin(t * 0.11 + 2) * 0.0007;
      turb.setAttribute('baseFrequency', wow.toFixed(4) + ' ' + (wow * 1.7).toFixed(4));
      const rest = (T.distortion / 100) * 7;
      const kick = Math.min(70, Math.abs(vel) * (T.motion / 6));
      disp.setAttribute('scale', (rest + kick).toFixed(1));
    }

    // climate: section under the viewport center owns the ground
    const mid = window.innerHeight * 0.5;
    for (const s of secs) {
      const r = s.getBoundingClientRect();
      if (r.top <= mid && r.bottom > mid) {
        const c = s.dataset.climate;
        if (document.body.dataset.climate !== c) document.body.dataset.climate = c;
        break;
      }
    }

    // parallax drift
    if (!reduced) {
      const amp = T.motion / 6;
      for (const el of plx) {
        const r = el.getBoundingClientRect();
        const d = (r.top + r.height / 2 - mid) / window.innerHeight;
        el.style.transform =
          'translateY(' + (d * parseFloat(el.dataset.plx || '24') * amp).toFixed(1) + 'px)';
      }
    }

    // tape counter — reel position from scroll depth
    if (tapeEl) {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const n = Math.max(0, Math.min(999, Math.round((max > 0 ? y / max : 0) * 999)));
      const s = String(n).padStart(3, '0');
      if (tapeEl.textContent !== s) tapeEl.textContent = s;
    }

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
