/* VELVET RIPPLE · 645 · the pane
   one window between you and the lit room. one passage of the song — the breath into chorus one through
   the instrumental — plays ONCE, the way music sounds through glass.
   wipe → you see more and hear less (the clearer it gets, the further away it sounds).
   hold → two hands on the glass: a print, the sound opens a little, nothing cracks.
   stop → the fog comes back; when it closes, the sound comes close for a breath, the bridge prints,
          and the fog ends it. what is left is one link: listen. the room is a door, not the player.
   6:45 local, every day → the glass clears on its own for 6:33.
   prints are shared through the same supabase project as the logbook (table pane_prints);
   with no backend they persist in this browser only. real prints only — never seeded.      */
(() => {
const CFGEL = document.getElementById('pane-config'); let USER = {};
try { USER = JSON.parse(CFGEL ? CFGEL.textContent : '{}'); } catch (e) { console.error('645: pane-config is not valid json', e); }
const AUDIO = USER.audio || (document.currentScript && document.currentScript.dataset.audio) || 'audio/glass-walls-pane.wav';
const cfg = Object.assign({ regrow: 55, brush: .085, fog: [185,180,166], tint: .42, closeHold: 2.4, fadeOut: 4, printDays: 4, maxPrints: 240, songLen: 393.7, lyricIn: 1.6, lyricHold: 6, lyricFade: 26, offset: 79.607, nameMax: 24 }, USER);
/* lyric times are MASTER times (read them off logic); offset = where the audio file starts in the master. */
const LYRICS = (USER.lyrics || [[82.06, 'i see it all so clearly'], [91.86, 'through the glass, through the glass'], [101.65, 'every detail sharp and gleaming'], [111.45, 'but the sharpness doesn’t let me pass']]).map(([t, l]) => [t - cfg.offset, l]);
const $ = s => document.querySelector(s);
const room = $('#room'), glass = $('#glass'), hint = $('#hint'), clock = $('#clock'), body = document.body;
/* the fog lives on small canvases that share the viewport's aspect, so a hand is a hand on a phone too */
let W = innerWidth, H = innerHeight, FW = 384, FH = Math.max(96, Math.round(FW * H / W)), booted = false;
const handS = () => .062 * Math.min(FW, FH), brushR = () => .15 * Math.min(FW, FH);
const mk = () => { const c = document.createElement('canvas'); c.width = FW; c.height = FH; return c; };
const fog = mk(), etch = mk(), mask = mk();
const fx = fog.getContext('2d'), ex = etch.getContext('2d'), mx = mask.getContext('2d');
const gx = glass.getContext('2d');
const lyr = document.createElement('canvas'), lx = lyr.getContext('2d');   // the words, written in the condensation
if (document.fonts && document.fonts.load) document.fonts.load('32px Gloock').catch(() => {});
let blurImg = null, rs = 1.02, t0 = 0, everWiped = false;
let clarity = 0, pressed = false, pointer = null, pressPos = null, pressT = 0, printed = false;
let lastMove = performance.now(), said = false, broadcast = false, ready = false, started = false, finishing = false, ended = false;

/* ---------- glass ---------- */
function size() {
  const dpr = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight;
  glass.width = W * dpr; glass.height = H * dpr; glass.style.width = W + 'px'; glass.style.height = H + 'px';
  gx.setTransform(dpr, 0, 0, dpr, 0, 0);
  lyr.width = W * dpr; lyr.height = H * dpr; lx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (booted) fit();
}
function fit() {                                                 // viewport aspect changed: keep the fog, re-etch the prints
  const nh = Math.max(96, Math.round(FW * H / W)); if (nh === FH) return;
  const keep = document.createElement('canvas'); keep.width = FW; keep.height = FH; keep.getContext('2d').drawImage(fog, 0, 0);
  FH = nh; [fog, etch, mask].forEach(c => { c.width = FW; c.height = FH; });
  fx.drawImage(keep, 0, 0, FW, FH); redrawEtch();
}
addEventListener('resize', size); size();
const fogCss = a => `rgba(${cfg.fog[0]},${cfg.fog[1]},${cfg.fog[2]},${a})`;
fx.fillStyle = fogCss(1); fx.fillRect(0, 0, FW, FH);            // it starts fogged over

function prepRoom() {                                            // a hard downscale, upscaled soft = the blur behind the fog
  const c = document.createElement('canvas'), s = Math.max(1, room.naturalWidth / 44);
  c.width = Math.max(8, Math.round(room.naturalWidth / s)); c.height = Math.max(8, Math.round(room.naturalHeight / s));
  c.getContext('2d').drawImage(room, 0, 0, c.width, c.height); blurImg = c;
}
if (room.complete && room.naturalWidth) prepRoom(); else room.addEventListener('load', prepRoom);
function coverRect() {
  const iw = room.naturalWidth || 900, ih = room.naturalHeight || 1125, s = Math.max(W / iw, H / ih), w = iw * s, h = ih * s;
  return [(W - w) / 2, (H - h) / 2, w, h];
}
function wipe(x, y, r, a) {
  fx.globalCompositeOperation = 'destination-out';
  const g = fx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(.55, `rgba(0,0,0,${a * .7})`); g.addColorStop(1, 'rgba(0,0,0,0)');
  fx.fillStyle = g; fx.beginPath(); fx.arc(x, y, r, 0, Math.PI * 2); fx.fill();
  fx.globalCompositeOperation = 'source-over';
}
/* a hand: palm, heel, four splayed fingers and a thumb that points toward the middle of the glass.
   alpha is all that matters — it is a mask; the soft edge comes from the upscale. */
function drawHand(ctx, nx, ny, rot, a) {
  const x = nx * FW, y = ny * FH, s = handS(), h = nx < .5 ? 1 : -1;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(h, 1);
  ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.strokeStyle = `rgba(0,0,0,${a})`; ctx.lineCap = 'round';
  const ell = (ox, oy, rx, ry) => { ctx.beginPath(); ctx.ellipse(ox, oy, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); };
  ell(0, 0, s * 1.02, s * .9);
  ell(0, .78 * s, s * .84, s * .6);
  const finger = (bx, by, ang, len, r) => { ctx.lineWidth = 2 * r * s; ctx.beginPath(); ctx.moveTo(bx * s, by * s); ctx.lineTo(bx * s + Math.sin(ang) * len * s, by * s - Math.cos(ang) * len * s); ctx.stroke(); };
  finger(-.66, -.7, -.1, 2.3, .25);
  finger(-.22, -.82, -.03, 2.65, .26);
  finger(.24, -.8, .05, 2.45, .25);
  finger(.68, -.62, .18, 1.9, .22);
  finger(1.02, .12, 1.1, 1.7, .3);
  ctx.restore();
}

/* ---------- prints (shared) ---------- */
const KEY = 'vr.pane.v1.prints';
let prints = [];
const comms = window.VR_COMMS && window.VR_COMMS.url && window.VR_COMMS.key ? window.VR_COMMS : null;
const hdr = () => ({ apikey: comms.key, Authorization: 'Bearer ' + comms.key, 'Content-Type': 'application/json' });
function redrawEtch() {
  ex.clearRect(0, 0, FW, FH); const now = Date.now();
  prints.forEach(p => { const age = (now - p.t) / 864e5; const a = Math.max(.07, .85 * (1 - age / cfg.printDays)); if (age < cfg.printDays * 2) drawHand(ex, p.x, p.y, p.r, a); });
}
async function loadPrints() {
  try { prints = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { prints = []; }
  redrawEtch();
  if (!comms) return;
  try {
    const r = await fetch(`${comms.url}/rest/v1/pane_prints?select=x,y,r,t,name&order=t.desc&limit=${cfg.maxPrints}`, { headers: hdr() });
    if (r.ok) { prints = await r.json(); redrawEtch(); }
  } catch (e) {}
}
function savePrint(p) {
  prints.push(p); if (prints.length > cfg.maxPrints) prints.shift();
  try { localStorage.setItem(KEY, JSON.stringify(prints.slice(-60))); } catch (e) {}
  if (comms) fetch(`${comms.url}/rest/v1/pane_prints`, { method: 'POST', headers: { ...hdr(), Prefer: 'return=minimal' }, body: JSON.stringify(p) }).catch(() => {});
}
function stamp(px, py) {
  const p = { x: +(px / W).toFixed(4), y: +(py / H).toFixed(4), r: +((Math.random() - .5) * .5).toFixed(3), t: Date.now(), name: null };
  fx.globalCompositeOperation = 'destination-out'; drawHand(fx, p.x, p.y, p.r, 1); fx.globalCompositeOperation = 'source-over';
  drawHand(ex, p.x, p.y, p.r, .85); openNamer(p, px, py);
}
/* a name for the hand — optional, one line. the print is saved either way; with a name it means something. */
const namer = $('#namer'), namerIn = $('#namer-in'); let pending = null, pendingTimer = 0;
const clean = v => v.replace(/https?:\/\/\S+|[<>@#]/g, '').replace(/\s+/g, ' ').trim().slice(0, cfg.nameMax);
function openNamer(p, px, py) {
  closeNamer(); pending = p; namerIn.value = ''; namerIn.maxLength = cfg.nameMax;
  namer.style.left = Math.min(W - 250, Math.max(12, px - 110)) + 'px'; namer.style.top = Math.min(H - 70, py + Math.max(70, W * .085)) + 'px';
  namer.classList.add('on'); setTimeout(() => namerIn.focus({ preventScroll: true }), 60);
  pendingTimer = setTimeout(closeNamer, 16000);
}
function closeNamer() { clearTimeout(pendingTimer); if (pending) { savePrint(pending); pending = null; } namer.classList.remove('on'); namerIn.blur(); }
if (namer) {
  namer.addEventListener('submit', e => { e.preventDefault(); if (pending) { const n = clean(namerIn.value); if (n) pending.name = n; } closeNamer(); });
  namerIn.addEventListener('keydown', e => { if (e.key === 'Escape') closeNamer(); });
}
loadPrints(); setInterval(redrawEtch, 3e5); booted = true;

/* ---------- audio: the song through glass ---------- */
let actx, src, lp, gain, wet, dry, conv, buf;
async function load() {
  try {
    const res = await fetch(AUDIO); const total = +res.headers.get('content-length') || 0;
    const reader = res.body.getReader(), chunks = []; let got = 0;
    for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); got += value.length; if (total) hint.textContent = `the room is loading · ${Math.round(got / total * 100)}%`; }
    actx = new (window.AudioContext || window.webkitAudioContext)();
    buf = await actx.decodeAudioData(await new Blob(chunks).arrayBuffer());
    ready = true; body.dataset.ready = 'yes'; hint.textContent = 'touch the glass.';
  } catch (e) { hint.textContent = 'the room is quiet tonight.'; console.error('645:', e); }
}
function impulse(sec) {
  const n = Math.floor(actx.sampleRate * sec), b = actx.createBuffer(2, n, actx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.6); }
  return b;
}
function start() {
  started = true; body.dataset.started = 'yes'; actx.resume(); t0 = actx.currentTime;
  src = actx.createBufferSource(); src.buffer = buf; src.loop = false;
  src.onended = () => { if (!finishing && !ended) finish('ended'); };
  lp = actx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = .6; lp.frequency.value = 12000;
  conv = actx.createConvolver(); conv.buffer = impulse(2.8);
  gain = actx.createGain(); wet = actx.createGain(); dry = actx.createGain(); wet.gain.value = .1;
  src.connect(lp); lp.connect(dry); lp.connect(conv); conv.connect(wet); dry.connect(gain); wet.connect(gain); gain.connect(actx.destination);
  src.start(); audioUpdate();
}
function audioUpdate() {
  if (!started || finishing || ended) return;
  let f = 1 - clarity; if (pressed) f *= .45; if (broadcast) f = 0;      // fog muffles; hands on the glass open it; 6:45 opens all of it
  const t = actx.currentTime, k = .5;
  lp.frequency.setTargetAtTime(12000 * Math.pow(650 / 12000, f), t, k);
  gain.gain.setTargetAtTime(1 - .55 * f, t, k);
  wet.gain.setTargetAtTime(.08 + .5 * f, t, k);
  dry.gain.setTargetAtTime(1 - .3 * f, t, k);
}
/* the end. 'fog': the glass has closed — the sound comes all the way in for a breath, the bridge prints,
   then the fog takes it. 'ended': the passage ran out on its own — the bridge prints over the quiet. */
function finish(reason) {
  if (finishing || ended) return; finishing = true; said = true; body.dataset.said = 'on';
  if (reason === 'fog') {
    const t = actx.currentTime;
    lp.frequency.setTargetAtTime(12000, t, .6); gain.gain.setTargetAtTime(1, t, .6); wet.gain.setTargetAtTime(.08, t, .6); dry.gain.setTargetAtTime(1, t, .6);
    gain.gain.setTargetAtTime(0, t + cfg.closeHold, cfg.fadeOut / 3);
    setTimeout(() => { try { src.stop(); } catch (e) {} end(); }, (cfg.closeHold + cfg.fadeOut) * 1000);
  } else end();
}
function end() { ended = true; finishing = false; body.dataset.ended = 'on'; }
load();

/* ---------- pointer ---------- */
const toFog = (px, py) => [px / W * FW, py / H * FH];
const unsay = () => { if (said && !finishing && !ended) { said = false; body.dataset.said = ''; } };
glass.addEventListener('pointermove', e => {
  if (!ready) return; lastMove = performance.now(); unsay();
  const [x, y] = toFog(e.clientX, e.clientY), r = brushR();
  if (pointer) { const n = Math.ceil(Math.hypot(x - pointer[0], y - pointer[1]) / 2) || 1; for (let i = 1; i <= n; i++) wipe(pointer[0] + (x - pointer[0]) * i / n, pointer[1] + (y - pointer[1]) * i / n, r, .35); }
  else wipe(x, y, r, .35);
  pointer = [x, y];
  if (pressed && pressPos && Math.hypot(e.clientX - pressPos[0], e.clientY - pressPos[1]) > 10) { pressPos = [e.clientX, e.clientY]; pressT = performance.now(); printed = false; }
});
glass.addEventListener('pointerleave', () => { pointer = null; });
glass.addEventListener('pointerdown', e => {
  if (!ready) return;
  if (pending) closeNamer();
  if (!started && !ended) start();
  try { glass.setPointerCapture(e.pointerId); } catch (err) {}
  pressed = true; body.dataset.press = 'on'; pressT = performance.now(); pressPos = [e.clientX, e.clientY]; printed = false; lastMove = pressT; unsay(); audioUpdate();
});
const up = () => { pressed = false; body.dataset.press = ''; pressPos = null; audioUpdate(); };
glass.addEventListener('pointerup', up); glass.addEventListener('pointercancel', up);

/* ---------- the frame loop ---------- */
let last = performance.now(), fogAcc = 0;
function frame(now) {
  const dt = Math.min(.1, (now - last) / 1000); last = now;
  /* the fog comes back in steps the canvas can actually hold (≥ 2/255 alpha), added linearly ('lighter'),
     so it closes completely in ~regrow seconds instead of creeping toward never */
  if (!broadcast) { fogAcc += dt / cfg.regrow; if (fogAcc >= 4 / 255) { fx.globalCompositeOperation = 'lighter'; fx.fillStyle = fogCss(Math.min(1, fogAcc)); fx.fillRect(0, 0, FW, FH); fx.globalCompositeOperation = 'source-over'; fogAcc = 0; } }
  if (pressed && !printed && pressPos && now - pressT > 350) { printed = true; stamp(pressPos[0], pressPos[1]); }
  mx.globalCompositeOperation = 'source-over'; mx.clearRect(0, 0, FW, FH); mx.drawImage(fog, 0, 0);
  mx.globalCompositeOperation = 'destination-out'; mx.drawImage(etch, 0, 0);
  /* the fog breathes: two slow thin patches drift across it, so the glass is never still */
  const breath = (px, py, r, a) => { const g = mx.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)'); mx.fillStyle = g; mx.fillRect(0, 0, FW, FH); };
  breath(FW * (.5 + .36 * Math.sin(now * .00011)), FH * (.5 + .3 * Math.cos(now * .00007)), FW * .42, .13);
  breath(FW * (.5 + .3 * Math.cos(now * .00009 + 2)), FH * (.5 + .34 * Math.sin(now * .00013 + 1)), FW * .36, .1);
  rs += ((pressed ? 1.035 : 1.02) - rs) * Math.min(1, dt * 2.2); room.style.transform = `scale(${rs.toFixed(4)})`;
  gx.globalCompositeOperation = 'source-over'; gx.clearRect(0, 0, W, H);
  if (blurImg) { const [x, y, w, h] = coverRect(), cx = W / 2, cy = H / 2; gx.imageSmoothingEnabled = true; gx.drawImage(blurImg, cx - (cx - x) * rs, cy - (cy - y) * rs, w * rs, h * rs); }
  gx.globalCompositeOperation = 'source-atop'; gx.fillStyle = fogCss(cfg.tint); gx.fillRect(0, 0, W, H);
  gx.globalCompositeOperation = 'destination-in'; gx.drawImage(mask, 0, 0, W, H);
  /* the words, written into the condensation as the passage reaches them, and the names on the prints you come near */
  lx.clearRect(0, 0, W, H); let any = false;
  if (started && !ended) {
    const t = actx.currentTime - t0, fs = Math.max(26, Math.min(W * .042, 56));
    lx.font = `400 ${fs}px Gloock, serif`; lx.textBaseline = 'alphabetic'; lx.textAlign = 'left'; lx.shadowColor = 'rgba(0,0,0,1)'; lx.shadowBlur = fs * .2;
    LYRICS.forEach(([at, line], i) => {
      const dt2 = t - at; if (dt2 < 0) return;
      const a = Math.min(1, dt2 / cfg.lyricIn) * Math.max(0, 1 - Math.max(0, dt2 - cfg.lyricHold) / cfg.lyricFade);
      if (a <= 0) return; any = true;
      const x = W * .08, y = H * .2 + i * fs * 1.38, wdt = lx.measureText(line).width;
      lx.save(); lx.beginPath(); lx.rect(x - fs, y - fs * 1.2, Math.min(1, dt2 / cfg.lyricIn) * (wdt + fs * 2), fs * 1.8); lx.clip();
      lx.fillStyle = `rgba(0,0,0,${a * .88})`; lx.fillText(line, x, y); lx.restore();
    });
  }
  if (pointer) {
    const s = handS(), fs2 = Math.max(11, Math.min(W * .012, 14));
    lx.font = `400 ${fs2}px "Geist Mono", monospace`; lx.shadowColor = 'rgba(0,0,0,1)'; lx.shadowBlur = fs2 * .35; lx.textAlign = 'center'; lx.letterSpacing = '0.18em';
    prints.forEach(p => {
      if (!p.name) return; const d = Math.hypot(p.x * FW - pointer[0], p.y * FH - pointer[1]); if (d > s * 2.6) return;
      const a = Math.min(1, (s * 2.6 - d) / (s * .9)); any = true;
      lx.fillStyle = `rgba(0,0,0,${a * .85})`; lx.fillText(p.name, p.x * W, p.y * H + (s / FW) * W * 2.1);
    });
    lx.textAlign = 'left'; lx.letterSpacing = '0px';
  }
  if (any) { gx.globalCompositeOperation = 'destination-out'; gx.drawImage(lyr, 0, 0, W, H); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* ---------- clarity · stillness · 6:45 ---------- */
setInterval(() => {
  /* clarity is read from the fog itself, not the mask — old prints stay visible but don't keep the glass 'open' */
  const d = fx.getImageData(0, 0, FW, FH).data; let s = 0; for (let i = 3; i < d.length; i += 4) s += d[i];
  clarity = broadcast ? 1 : 1 - s / (255 * FW * FH);
  if (clarity > .2) everWiped = true;
  audioUpdate();
  const idle = (performance.now() - lastMove) / 1000;
  if (started && everWiped && !finishing && !ended && !broadcast && clarity < .07 && idle > 4) finish('fog');
}, 250);
function tick() {
  const d = new Date(), h = d.getHours(), m = d.getMinutes();
  clock.textContent = `${(h % 12) || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
  const since = h * 3600 + m * 60 + d.getSeconds() - (18 * 3600 + 45 * 60);
  const live = since >= 0 && since < cfg.songLen;
  if (live && !broadcast) fx.clearRect(0, 0, FW, FH);
  broadcast = live; clock.classList.toggle('live', live); audioUpdate();
}
tick(); setInterval(tick, 1000);
window.VRPane = { get clarity() { return clarity; }, get prints() { return prints; }, get ended() { return ended; }, stamp, finish };
})();
