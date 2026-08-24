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
    /* only the FOREGROUND (type, rules, photo grade) still eases on this.
       the ground is scroll-linked, so a long duration here just left the
       text lagging behind the colour it sits on. */
    root.style.setProperty('--clim-dur', T.drift ? '0.45s' : '0.16s');
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

  /* --- the ground ----------------------------------------------
     one solid pane per climate, stacked in document order and
     crossfaded by opacity alone (compositor-only — no viewport
     repaint, so the blended plates above never re-rasterize).
     `bands` merges neighbouring sections that share a climate, so
     hero+thesis are one bone band rather than two. */
  let bands = [], panes = [], ground = null, lastOp = [];

  /* CIE L* — perceptual lightness, 0..100. we need this because a
     crossfade's midpoint is only a problem if you can SEE it. */
  function lstar(css) {
    const m = String(css).match(/[\d.]+/g);
    if (!m) return 0;
    const f = (v) => { const c = v / 255;
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const Y = 0.2126 * f(+m[0]) + 0.7152 * f(+m[1]) + 0.0722 * f(+m[2]);
    return Y > 0.008856 ? 116 * Math.cbrt(Y) - 16 : 903.3 * Y;
  }

  function buildTrack() {
    bands = [];
    for (let i = 0; i < secs.length; i++) {
      const last = bands[bands.length - 1];
      if (last && last.c === secs[i].c) last.bot = secs[i].bot;
      else bands.push({ c: secs[i].c, top: secs[i].top, bot: secs[i].bot });
    }
    // rebuild the panes only when the climate order actually changed
    const key = bands.map((b) => b.c).join(',');
    if (!ground || ground.dataset.key !== key) {
      if (ground) ground.remove();
      ground = document.createElement('div');
      ground.className = 'ground';
      ground.dataset.key = key;
      ground.setAttribute('aria-hidden', 'true');
      ground.innerHTML = bands.map((b) => '<i class="g-' + b.c + '"></i>').join('');
      body.insertBefore(ground, body.firstChild);
      panes = Array.from(ground.children);
      lastOp = panes.map(() => '');
      if (panes[0]) { panes[0].style.opacity = '1'; lastOp[0] = '1'; }
    }

    /* per-boundary tuning — bands was just rebuilt, so always re-derive.

       a crossfade's midpoint is a blend of the two grounds. between two
       dark climates (teal→ink, ~21 L*) that blend is indistinguishable
       from either end, so it can be long and lazy. between bone and teal
       (~64 L*) it is a muddy sage that reads as neither colour — so the
       further apart the two grounds are, the LESS scroll we should spend
       in between them:
         span — length of the fade, in viewport heights
         lin  — how far to pull the curve from smoothstep toward linear.
                smoothstep has zero slope at both ends, which on a
                high-contrast pair reads as "stuck on beige, then a rush".
                linear starts moving the instant you do. */
    const lum = panes.map((el) => lstar(getComputedStyle(el).backgroundColor));
    for (let i = 1; i < bands.length; i++) {
      const d = Math.min(1, Math.abs(lum[i] - lum[i - 1]) / 100);
      bands[i].span = Math.max(0.24, 0.62 - 0.58 * Math.pow(d, 1.5));
      bands[i].lin = d;
    }
  }

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
    buildTrack();
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

    /* climate — a CONTINUOUS position along the band track rather than a
       flip at the boundary. `p` is a float band index: 1.5 means halfway
       from band 1 into band 2. the crossfade is spread over `half`px of
       scroll either side of the boundary and smoothstepped, so the ground
       moves with your finger and there is nothing left to lag. */
    const mid = y + vh * 0.5;
    if (bands.length) {
      let p = 0;
      for (let i = 0; i < bands.length; i++) if (mid >= bands[i].top) p = i;
      for (let i = 1; i < bands.length; i++) {
        const w = vh * bands[i].span;          // fade length, in px of scroll
        const d = mid - bands[i].top;
        if (d > -w * 0.5 && d < w * 0.5) {
          const u = d / w + 0.5;
          const sm = u * u * (3 - 2 * u);
          p = (i - 1) + sm + (u - sm) * bands[i].lin;
          break;
        }
      }
      // pane 0 stays opaque; each later pane wipes in over the ones below it
      for (let i = 1; i < panes.length; i++) {
        const o = (p - i + 1 <= 0) ? '0'
                : (p - i + 1 >= 1) ? '1'
                : (p - i + 1).toFixed(3);
        if (o !== lastOp[i]) { panes[i].style.opacity = o; lastOp[i] = o; }
      }
      // the foreground (type, rules, photo grade) still swaps discretely,
      // at the midpoint of the ground's crossfade
      const c = bands[Math.min(bands.length - 1, Math.round(p))].c;
      if (body.dataset.climate !== c) body.dataset.climate = c;
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
