/* ============================================================
   VELVET RIPPLE — liquid scroll engine · v4 (fluid)
   calm at rest · liquefies with scroll velocity · climate descent

   perf contract:
   · geometry is MEASURED ONCE (load/resize) — the frame loop reads
     only window.scrollY, so it never forces a layout.
   · the loop SHUTS OFF when settled and restarts on scroll — at rest
     the page costs literally zero.
   · the SVG melt filter drives THREE small type blocks only. photos
     move on transforms (compositor) — never re-rasterized.
   · every write is deduped against its last value.
   listens for `vr-tweaks` CustomEvents from the Tweaks panel
   ============================================================ */
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // defaults — kept in sync with site-tweaks-v2.jsx
  const T = { motion: 6, distortion: 35, grain: 55, drift: true,
              paper: 55, dust: 40, misreg: 45, vignette: 35, tape: true,
              oil: 55, rings: true, warp: 45, hue: true, nap: 55 };

  const root = document.documentElement;
  const body = document.body;
  const disp = document.getElementById('vr-disp');
  const warpDisp = document.getElementById('vr-warp-disp');
  const tapeEl = document.getElementById('vr-count');

  let restScale = 0;
  let lastScaleStr = null;

  function applyStatic() {
    root.style.setProperty('--grain-o', (T.grain / 100).toFixed(3));
    root.style.setProperty('--clim-dur', T.drift ? '1.4s' : '0.25s');
    root.style.setProperty('--paper-o', (T.paper / 100 * 0.62).toFixed(3));
    root.style.setProperty('--dust-o', (T.dust / 100 * 0.7).toFixed(3));
    root.style.setProperty('--misx', (T.misreg / 100 * 2.6).toFixed(2) + 'px');
    root.style.setProperty('--vig-o', (T.vignette / 100 * 0.30).toFixed(3));
    root.style.setProperty('--oil-o', (T.oil / 100 * 0.62).toFixed(3));
    root.style.setProperty('--nap-o', (T.nap / 100 * 0.85).toFixed(3));
    body.dataset.tape = T.tape ? 'on' : 'off';
    body.dataset.rings = T.rings ? 'on' : 'off';
    body.dataset.hue = T.hue ? 'on' : 'off';
    if (warpDisp) warpDisp.setAttribute('scale', (T.warp / 100 * 7).toFixed(1));
    restScale = reduced ? 0 : (T.distortion / 100) * 4.2;
    lastScaleStr = null; // force one re-apply of the rest melt
    kick();
  }

  // --- reveals -------------------------------------------------
  const io = new IntersectionObserver(
    (entries) => entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    }),
    { threshold: 0.18 }
  );
  document.querySelectorAll('.rv').forEach((el) => io.observe(el));

  /* --- geometry, measured once ---------------------------------
     absolute document offsets so the frame loop never touches the
     layout engine. re-measured on resize and after images land. */
  let secs = [], plx = [], vh = 1, maxY = 1;

  function measure() {
    vh = window.innerHeight;
    maxY = Math.max(1, root.scrollHeight - vh);
    const sy = window.scrollY;
    secs = Array.from(document.querySelectorAll('[data-climate]'))
      .filter((el) => el !== body)
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { c: el.dataset.climate, top: r.top + sy, bot: r.top + sy + r.height };
      });
    plx = Array.from(document.querySelectorAll('[data-plx]')).map((el) => {
      const r = el.getBoundingClientRect();
      return { el, amt: parseFloat(el.dataset.plx || '24'),
               mid: r.top + sy + r.height / 2, last: '' };
    });
  }

  // --- the loop: runs only while there is something to move -----
  let running = false, idle = 0;
  let lastY = window.scrollY, vel = 0, cur = -1, flip = false;

  function kick() {
    idle = 0;
    if (!running) { running = true; requestAnimationFrame(frame); }
  }

  function frame() {
    const y = window.scrollY;                 // the only read. no layout.
    vel += (y - lastY - vel) * 0.16;          // smoothed velocity, px/frame
    lastY = y;
    if (Math.abs(vel) < 0.05) vel = 0;

    let quiet = vel === 0;

    // melt — type only; quantized, every other frame, silent once settled
    flip = !flip;
    if (!reduced && disp) {
      const target = quiet ? restScale
        : restScale + Math.min(34, Math.abs(vel) * (T.motion / 6) * 0.95);
      let next = cur < 0 ? target : cur + (target - cur) * 0.18;
      if (Math.abs(next - target) < 0.05) next = target; else quiet = false;
      cur = next;
      if (flip || lastScaleStr === null) {
        const s = (Math.round(next * 4) / 4).toFixed(2);
        if (s !== lastScaleStr) { disp.setAttribute('scale', s); lastScaleStr = s; }
      }
    }

    // climate: whichever band owns the viewport center
    const mid = y + vh * 0.5;
    for (let i = 0; i < secs.length; i++) {
      const s = secs[i];
      if (mid >= s.top && mid < s.bot) {
        if (body.dataset.climate !== s.c) body.dataset.climate = s.c;
        break;
      }
    }

    /* parallax + tape stretch — pure transform, so photos are moved by
       the compositor and never re-painted or re-filtered */
    const stretch = reduced ? 0 : Math.min(0.02, Math.abs(vel) * 0.0009);
    const skew = reduced ? 0 : Math.max(-0.5, Math.min(0.5, vel * 0.014));
    for (let i = 0; i < plx.length; i++) {
      const p = plx[i];
      const ty = ((p.mid - mid) / vh) * p.amt * (T.motion / 6);
      const t = 'translate3d(0,' + ty.toFixed(1) + 'px,0) scaleY(' +
                (1 + stretch).toFixed(4) + ') skewY(' + skew.toFixed(2) + 'deg)';
      if (t !== p.last) { p.el.style.transform = t; p.last = t; }
    }

    // tape counter — reel position from scroll depth
    if (tapeEl) {
      const n = Math.max(0, Math.min(999, Math.round((y / maxY) * 999)));
      const s = String(n).padStart(3, '0');
      if (tapeEl.textContent !== s) tapeEl.textContent = s;
    }

    if (quiet && ++idle > 6) { running = false; return; }  // sleep
    requestAnimationFrame(frame);
  }

  // --- wiring ---------------------------------------------------
  addEventListener('scroll', kick, { passive: true });
  addEventListener('resize', () => { measure(); kick(); }, { passive: true });
  addEventListener('vr-tweaks', (e) => { Object.assign(T, e.detail); applyStatic(); });
  addEventListener('load', () => { measure(); kick(); });

  applyStatic();
  measure();
  kick();
})();
