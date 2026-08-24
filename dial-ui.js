/* VELVET RIPPLE · 108.0 — the dial
   slide-rule car-radio tuner + the tower array. the needle drifts off-station on its own:
   the whole point is that almost never sticks. */
(() => {
  const FMIN = 88, FMAX = 108.3, END = 107.9, TOP = 108.0;
  const STATIONS = [
    { id: 'drums', f: 88.5, label: 'drums', h: 62 },
    { id: 'bass',  f: 91.7, label: 'bass',  h: 71 },
    { id: 'synths', f: 96.1, label: 'synths', h: 80 },
    { id: 'transmission', f: 99.3, label: 'transmission', h: 74 },
    { id: 'vocals', f: 107.9, label: 'voice', h: 92 }
  ];
  const STRAYS = [88.9, 89.4, 90.6, 92.5, 93.2, 94.8, 95.6, 97.7, 98.4, 100.2, 101.0,
    102.4, 103.6, 104.4, 105.2, 106.4, 107.2, 107.6];
  const BLEED = 0.9, CAPTURE = 0.3, DRIFT = 0.4, HOLD = 0.9;
  // the six secret stations — one line per song on the ep, in the narrator's voice.
  // five shuffle; the sixth is always track six, which cuts off mid-breath and then completes.
  const SECRET_F = [90.6, 93.2, 94.8, 100.2, 103.6, 106.4];
  const HINTS = [
    'what if i open my mouth and the room goes quiet.',
    'almost is where i’ve always been.',
    'the door that was open all along.',
    'i’ve been singing the whole time. just so quiet nobody noticed. including me.',
    'other people’s lives are other people’s lives.'
  ];
  const CUT_LINE = 'not the loud one. not the brave one. just—';
  // the title COMPLETES the cut-off sentence rather than starting a new one — "just—" … "quieter
  // than i thought." reads as one broken line finishing itself, and names the record in the same
  // breath. (an earlier "and it’s quieter…" left "just—" dangling with nothing to resolve it.)
  const NAME_LINE = 'quieter than i thought.';
  const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'];
  const FRAGMENTS = ['…say again, you\u2019re breaking up.', '…we have you weak but clear.',
    '…standing by.', '…that\u2019s affirmative, over.', '…nothing on this channel.'];
  const SEED = [
    ['04 18 22 51', 'CAPCOM', 'how do you read?', 'capcom'],
    ['04 18 22 58', 'VR-0117', 'found this from a story with no caption.', ''],
    ['04 19 01 04', 'CAPCOM', 'we\u2019re showing you weak but clear.', 'capcom'],
    ['04 19 06 32', 'VR-0288', 'held 96.1 for a full minute before it took.', ''],    ['04 19 11 09', 'VR-0341', 'the one at the top of the dial keeps sliding off me.', ''],
    ['04 19 18 47', 'CAPCOM', 'copy that. it does that.', 'capcom'],
    ['04 19 24 15', 'VR-0402', 'listened to the static for ten minutes first. worth it.', ''],
    ['04 19 31 55', 'VR-0455', 'drums, then bass, then i just sat there.', ''],
    ['04 19 40 02', 'CAPCOM', 'loss of signal in twenty seconds.', 'capcom'],
    ['04 19 44 38', 'VR-0512', 'the beat of silence got me.', ''],
    ['04 19 52 20', 'VR-0587', 'kingman. 9:41 pm. all five in.', '']
  ];

  const $ = (s) => document.querySelector(s);
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const pct = (f) => 2.6 + (f - FMIN) / (FMAX - FMIN) * 94.8;
  const body = document.body;
  const glass = $('#glass'), needle = $('#needle'), read = $('#read'), holdBar = $('#hold');
  const scale = $('#scale'), masts = $('#masts'), vu = $('#vufill'), hail = $('#hail'), ghost = $('#ghost');
  const clog = $('#clog'), cinput = $('#cinput'), csend = $('#csend'), cspent = $('#cspent'), you = $('#you');
  const claim = $('#claim'), cv = $('#bands'), cx2 = cv.getContext('2d');

  let needleF = 92.4, held = 0, dragging = false, lastX = 0, powered = false, tone = .5, vol = .72;
  let locked = {}, presets = new Array(5), finished = false, finaleQueued = false, post = false, fragT = 0, fragOn = false;
  let statLevel = 0, prox = 0, courted = null, rings = [], bands = [], last = performance.now();
  let poolT = -1, pulseT = 0, beatT = 0, flash = 0, pulseN = 0;
  let secretsOn = false, revealing = false, secrets = [], nearT = 0, topT = 0;
  const stampEls = [];
  const beacons = [];
  let beatOn = false, prevK = 0, prevB = 0, kRef = 0, bRef = 0, kN = 0, bN = 0;
  let W = 0, H = 0, dpr = 1;
  const ptr = { x: -999, y: -999 };
  const INKS = ['217,162,75', '224,85,72', '239,231,214', '43,69,73'];
  const store = readStore();

  // ---------- persistence ----------
  function readStore() {
    try { return JSON.parse(localStorage.getItem('vr.dial.v1')) || {}; } catch (e) { return {}; }
  }
  function save() {
    try { localStorage.setItem('vr.dial.v1', JSON.stringify(store)); } catch (e) {}
  }
  if (!store.callsign) { store.callsign = 'VR-' + String(600 + Math.floor(Math.random() * 3400)).padStart(4, '0'); save(); }
  you.textContent = 'callsign · ' + store.callsign;

  // ---------- the scale ----------
  (function buildScale() {
    let html = '';
    for (let f = FMIN; f <= END + .001; f += 0.1) {
      const maj = Math.abs(f % 2) < .01 || Math.abs(f % 2 - 2) < .01;
      const mid = Math.abs(f % 1) < .01;
      html += `<span class="tick ${maj ? 'maj' : mid ? '' : 'min'}" style="left:${pct(f)}%"></span>`;
      if (maj) html += `<span class="numl" style="left:${pct(f)}%">${f.toFixed(0)}</span>`;
    }
    html += `<span class="endmark" style="left:${pct(END)}%"></span>`;
    html += `<span class="past" id="past" style="left:${pct(TOP)}%">108.0</span>`;
    scale.innerHTML = html;
  })();

  // ---------- the array ----------
  (function buildArray() {
    const frag = document.createDocumentFragment();
    STRAYS.forEach((f, i) => {
      const h = 14 + ((i * 37) % 34);
      const far = h < 26;
      const el = mast({ f, h, w: far ? 4 : 6, station: false, per: 1.4 + (i % 7) * .18,
        del: (i % 5) * .37, dim: far ? .5 : .78 });
      if (SECRET_F.indexOf(f) >= 0) { el.classList.add('secret'); secrets.push({ f, el, found: false }); }
      frag.appendChild(el);
    });
    STATIONS.forEach((s, i) => {
      const el = mast({ f: s.f, h: s.h, w: 9, station: true, per: 1.9 + i * .21, del: i * .43 });
      el.dataset.id = s.id; s.el = el;
      const st = document.createElement('span');
      st.className = 'stamp mono'; st.style.left = clamp(pct(s.f), 7.5, 92.5) + '%';
      st.dataset.pct = clamp(pct(s.f), 4, 96).toFixed(2);
      stampEls.push(st);
      st.textContent = s.f.toFixed(1) + ' · ' + s.label;
      s.stamp = st; frag.appendChild(st);
      frag.appendChild(el);
    });
    masts.appendChild(frag);
    // every mast gets a beat slot, left to right — a hit lights one slot, never the whole array
    Array.prototype.slice.call(masts.querySelectorAll('.mast'))
      .sort((a, b) => parseFloat(a.style.left) - parseFloat(b.style.left))
      .forEach((el, i) => {
        el.dataset.grp = i % 4;
        Array.prototype.forEach.call(el.querySelectorAll('.beacon'), (bc) => beacons.push({ bc, grp: i % 4, lit: 0 }));
      });
  })();
  function mast({ f, h, w, station, per, del, dim }) {
    const el = document.createElement('div');
    el.className = 'mast' + (station ? ' station' : '');
    el.style.cssText = `left:${pct(f)}%;translate:-50% 0;width:${w}px;height:calc((100% - 96px) * ${(h / 100).toFixed(3)});--per:${per}s;--del:${del}s` +
      (dim ? `;opacity:${dim}` : '');
    el.innerHTML = `<span class="wire w1"></span><span class="wire w2"></span><div class="truss"></div>
      <span class="beacon top" style="top:-3px"></span>${h > 30 ? '<span class="beacon" style="top:42%;--per:' + (per * 1.3).toFixed(2) + 's"></span>' : ''}`;
    return el;
  }

  // ---------- comms ----------
  function logLine(ts, who, text, cls) {
    const el = document.createElement('div');
    el.className = 'line ' + (cls || '');
    el.innerHTML = `<span class="ts">${ts}</span><span class="body">${who ? '<span class="cs">' + who + '</span> · ' : ''}${text}</span>`;
    clog.appendChild(el);
    clog.scrollTop = clog.scrollHeight;
    return el;
  }
  SEED.forEach(([ts, who, text, cls]) => logLine(ts, who, text, cls));
  if (store.msg) logLine(store.ts || stamp(), store.callsign, store.msg, 'mine');
  $('#tuned').textContent = 'logbook · ' + clog.children.length + ' lines';
  function stamp() {
    const d = new Date();
    return ['04', String(d.getDate()).padStart(2, '0'), String(d.getHours()).padStart(2, '0'), String(d.getMinutes()).padStart(2, '0')].join(' ');
  }
  function transmit() {
    const v = cinput.value.trim();
    if (!v || store.msg) return;
    store.msg = v.slice(0, 80); store.ts = stamp(); save();
    logLine(store.ts, store.callsign, store.msg, 'mine');
    cinput.value = ''; lockInput();
    $('#tuned').textContent = 'logbook · ' + clog.children.length + ' lines';
  }
  function lockInput() {
    if (!store.msg) return;
    cinput.disabled = true; cinput.placeholder = 'one line, once.';
    csend.style.display = 'none';
    cspent.textContent = 'logged · ' + store.callsign;
  }
  csend.addEventListener('click', transmit);
  cinput.addEventListener('keydown', (e) => { if (e.key === 'Enter') transmit(); });
  lockInput();
  $('#commstab').addEventListener('click', () => {
    body.dataset.comms = body.dataset.comms === 'open' ? 'closed' : 'open';
  });

  // ---------- knobs ----------
  // ---------- knobs — the whole knob turns; the honey led rides around with it ----------
  function knob(el, get, set, label) {
    let sy = 0, sx = 0, sv = 0, down = false;
    const face = el.querySelector('.face');
    const paint = () => { face.style.setProperty('--rot', (-140 + get() * 280).toFixed(1) + 'deg'); };
    el.addEventListener('pointerdown', (e) => {
      down = true; sy = e.clientY; sx = e.clientX; sv = get(); delete el.dataset.moved;
      try { el.setPointerCapture(e.pointerId); } catch (err) {}
    });
    el.addEventListener('pointermove', (e) => {
      if (!down) return;
      if (Math.abs(e.clientY - sy) + Math.abs(e.clientX - sx) > 3) el.dataset.moved = '1';
      set(clamp(sv + ((sy - e.clientY) + (e.clientX - sx)) / 190, 0, 1)); paint();
      if (label) label.textContent = Math.round(get() * 100) + '';
    });
    el.addEventListener('pointerup', () => { down = false; });
    paint();
    return paint;
  }
  const paintTone = knob($('#knobTone'), () => tone, (v) => { tone = v; VRAudio.setTone(v); });
  const powerLabel = $('#powerLabel');
  const paintPower = knob($('#knobPower'), () => vol, (v) => { if (powered) { vol = v; VRAudio.setVol(v); } });
  $('#knobPower').addEventListener('click', async (ev) => {
    if ($('#knobPower').dataset.moved === '1') return;
    if (powered) { powered = false; VRAudio.suspend(); $('#knobPower').classList.add('off'); powerLabel.textContent = 'off'; return; }
    powerLabel.textContent = '…';
    await VRAudio.unlock((k) => { powerLabel.textContent = k < 1 ? Math.round(k * 100) + '%' : '…'; });
    VRAudio.setVol(vol); VRAudio.setTone(tone); VRAudio.resume();
    const found = Object.keys(locked);
    if (found.length) VRAudio.restoreLocks(found);
    if (finished) VRAudio.finale(true);
    powered = true; $('#knobPower').classList.remove('off'); powerLabel.textContent = 'on';
    setTimeout(() => { hail.style.opacity = '0'; }, 8000);
  });

  // ---------- tuning ----------
  function move(dx) {
    const px = glass.getBoundingClientRect().width / (FMAX - FMIN);
    needleF = clamp(needleF + dx / px, FMIN - .05, finished ? TOP : 107.98);
  }
  glass.addEventListener('pointerdown', (e) => {
    dragging = true; lastX = e.clientX;
    try { glass.setPointerCapture(e.pointerId); } catch (err) {}
    if (!powered) $('#knobPower').click();
  });
  glass.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    move(e.clientX - lastX); lastX = e.clientX;
  });
  ['pointerup', 'pointercancel'].forEach((t) => glass.addEventListener(t, () => { dragging = false; }));
  glass.addEventListener('wheel', (e) => { e.preventDefault(); move(-e.deltaY * .35); }, { passive: false });
  addEventListener('keydown', (e) => {
    const step = e.shiftKey ? .02 : .1;
    if (e.key === 'ArrowLeft') { needleF = clamp(needleF - step, FMIN, finished ? TOP : 107.98); e.preventDefault(); }
    if (e.key === 'ArrowRight') { needleF = clamp(needleF + step, FMIN, finished ? TOP : 107.98); e.preventDefault(); }
  });

  // ---------- presets: a car radio memorizes what you found ----------
  const preBtns = Array.from(document.querySelectorAll('.pre'));
  preBtns.forEach((b) => b.addEventListener('click', () => {
    const i = +b.dataset.i;
    if (!presets[i]) return;
    needleF = presets[i]; held = 0;
  }));
  function memorize(f) {
    const i = presets.findIndex((p) => p === undefined);
    if (i < 0) return;
    presets[i] = f;
    preBtns[i].textContent = f.toFixed(1);
    preBtns[i].classList.add('set');
  }

  // station stamps are packed the same way the etched lines are — nowrap copy at 96.1 and 99.3
  // sits close enough to collide otherwise
  function layoutStamps() {
    const aw = masts.getBoundingClientRect().width, pad = 26;
    const items = stampEls.filter((el) => el.classList.contains('on')).map((el) => {
      el.classList.add('placed');
      return { el, w: el.getBoundingClientRect().width, want: (+el.dataset.pct / 100) * aw };
    }).sort((a, b) => a.want - b.want);
    if (!items.length) return;
    let cursor = 14;
    items.forEach((it) => { it.x = Math.max(cursor, it.want - it.w / 2); cursor = it.x + it.w + pad; });
    // backward pass clamps each stamp to its right neighbour and the right edge — pulling in
    // only what actually overflows, so gaps that were already fine stay fine
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i], next = items[i + 1];
      const maxX = next ? next.x - it.w - pad : aw - 14 - it.w;
      it.x = Math.max(14, Math.min(it.x, maxX));
    }
    items.forEach((it) => { it.el.style.left = Math.round(it.x) + 'px'; });
  }
  // ---------- lock ----------
  function doLock(s) {
    if (locked[s.id]) return;
    locked[s.id] = true; held = 0;
    const delay = powered ? VRAudio.lock(s.id) : 0;
    setTimeout(() => {
      s.el.classList.add('locked');
      s.stamp.classList.add('on');
      layoutStamps();
      memorize(s.f);
      logLine(stamp(), '', s.f.toFixed(1) + ' · ' + s.label + ' · acquired', 'acq');
      (store.locks = store.locks || []).indexOf(s.id) < 0 && store.locks.push(s.id); save();
      $('#tuned').textContent = 'logbook · ' + clog.children.length + ' lines';
      burst(s, 5);
      if (Object.keys(locked).length === STATIONS.length && !finaleQueued) { finaleQueued = true; setTimeout(finale, 7600); }
    }, delay);
  }

  // ---------- the finale: riser → the word → pooling ripple → the record ----------
  function finale() {
    finished = true;
    body.dataset.sync = 'on';
    hail.style.opacity = '0';
    read.style.left = '50%';
    $('#past').classList.add('on');
    logLine(stamp(), '', '108.0 · signal locked', 'acq');
    if (powered) VRAudio.riser(3);

    const from = needleF, t0 = performance.now();
    (function glide(now) {
      const k = clamp((now - t0) / 1600, 0, 1), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      needleF = from + (TOP - from) * e;
      if (k < 1) requestAnimationFrame(glide);
    })(t0);

    // the riser: static climbs, the room says it once
    const risen = $('#risen');
    risen.style.bottom = Math.round(document.querySelector('.set').getBoundingClientRect().height + 34) + 'px';
    setTimeout(() => { risen.classList.add('on'); }, 900);
    setTimeout(() => {
      const info = powered ? VRAudio.finale() : { delay: 300 };
      poolT = 0;
      setTimeout(() => { risen.classList.remove('on'); }, 1500);
      setTimeout(showCard, (info.delay || 0) + 2100);
    }, 3000);
    store.claimed = true; save();
  }
  $('#btnKeep').addEventListener('click', () => {
    claim.classList.remove('on');
    store.kept = true; save();          // the recall line is earned by choosing to stay
    openAfter();
  });
  $('#btnClaim').addEventListener('click', (e) => {
    // → the ditto pre-save. opens in a new tab so the room is never destroyed behind them:
    // the needle, the locks and the found strays are all still here when they come back.
    const url = e.currentTarget.dataset.href;
    logLine(stamp(), '', 'transmission claimed · sept 4', 'acq');
    store.claimedLink = true; save();
    if (url) window.open(url, '_blank', 'noopener');
    claim.classList.remove('on'); openAfter();
  });

  function showCard() {
    const card = claim.querySelector('.card'), cov = claim.querySelector('.cover');
    const cr = card.getBoundingClientRect();
    const b = cr.bottom - cov.getBoundingClientRect().bottom;
    const room = Math.max(0, H - 6 - cr.bottom);
    card.style.setProperty('--shift', Math.min(b / 2, room).toFixed(1) + 'px');
    claim.classList.add('on');
  }
  // ---------- after the card: the room comes back, and the strays start waking ----------
  function openAfter(nudge) {
    post = true; secretsOn = true;
    body.dataset.after = 'on';
    hail.style.opacity = '0';
    fitReveal();
    // step off the station so 108.0 stays somewhere you can tune back to
    if (nudge !== false) { needleF = TOP - .55; topT = 0; }
    // 108.0 is a door you can walk back through — but only someone who chose to keep
    // searching is told so. it must never pre-empt the record or the pre-save.
    const rc = $('#recall');
    if (store.kept) setTimeout(() => rc.classList.add('on'), nudge === false ? 400 : 1200);
    if (!store.order) { store.order = [0, 1, 2, 3, 4].sort(() => Math.random() - .5); save(); }
  }
  function nearestSecret(x, y, within) {
    let best = null, bd = within;
    secrets.forEach((s) => {
      if (s.found) return;
      const b = s.el.getBoundingClientRect();
      const d = Math.hypot(x - (b.left + b.width / 2), y - b.top);
      if (d < bd) { bd = d; best = s; }
    });
    return best;
  }
  function setH() { return document.querySelector('.set').getBoundingClientRect().height; }
  function fitReveal() {
    const r = $('#reveal');
    const vh = H || innerHeight;
    r.style.bottom = Math.round(setH() + 34) + 'px';
    return vh - setH() - 34;
  }
  const hintEls = [];
  // etched lines pack along the ridge, nudged sideways so they never stack — and the band
  // is clamped to the ridge, so no line climbs into the array
  function layoutHints() {
    const pad = 14, mr = masts.getBoundingClientRect(), aw = mr.width;
    const ridgeTop = document.querySelector('.ridge').getBoundingClientRect().top - mr.top;
    const items = hintEls.map((el) => {
      el.style.bottom = '84px';
      const b = el.getBoundingClientRect();
      return { el, w: b.width, h: b.height, want: (+el.dataset.pct / 100) * aw };
    }).sort((a, b) => a.want - b.want);
    if (!items.length) return;
    const total = items.reduce((s, i) => s + i.w + pad, 0) - pad;
    // six lyric lines never fit one row — split into as many rows as the width needs,
    // then clamp the band so it can't climb past the ridge into the sky
    const perRow = Math.max(1, Math.min(items.length, Math.floor((aw - 10) / (items.reduce((s, i) => s + i.w, 0) / items.length + pad))));
    const nRows = Math.ceil(items.length / perRow);
    const rows = [];
    for (let r = 0; r < nRows; r++) rows.push(items.filter((_, i) => i % nRows === r));
    let base = 84;
    rows.forEach((row) => {
      let cursor = 6;
      row.forEach((it) => { it.x = Math.max(cursor, it.want - it.w / 2); cursor = it.x + it.w + pad; });
      for (let i = row.length - 1; i >= 0; i--) {
        const it = row[i], next = row[i + 1];
        const maxX = next ? next.x - it.w - pad : aw - 6 - it.w;
        it.x = Math.max(6, Math.min(it.x, maxX));
      }
      row.forEach((it) => { it.el.style.left = Math.round(it.x) + 'px'; it.el.style.bottom = base + 'px'; });
      base += Math.max.apply(null, row.map((it) => it.h)) + pad;
    });
    // each etched line carries its own scrim, so the lattice reads behind it, not through it
    // keep the dead-air ghost clear of the etched band
    const tops = hintEls.map((el) => el.getBoundingClientRect().top);
    const bandTop = Math.min.apply(null, tops) - masts.getBoundingClientRect().top;
    if (bandTop - 34 < 22) ghost.dataset.blocked = '1';
    else { delete ghost.dataset.blocked; ghost.style.top = Math.round(bandTop - 34) + 'px'; }
  }
  function hintStamp(s, line, q) {
    const st = document.createElement('span');
    st.className = 'stamp hint mono on';
    st.dataset.pct = clamp(pct(s.f), 9, 91).toFixed(2);
    // each etched line is quieter than the one before it
    st.style.setProperty('--qa', Math.pow(q || 1, 1.6).toFixed(3));
    st.style.fontSize = (10.5 * (.55 + (q || 1) * .45)).toFixed(2) + 'px';
    st.textContent = line;
    masts.appendChild(st);
    hintEls.push(st);
    layoutHints();
  }
  function reveal(s) {
    if (revealing || s.found) return;
    revealing = true; s.found = true; nearT = 0;
    // persisted records are the truth — in-memory flags can drift and hand out `last` twice
    if (store.secrets && store.secrets.some((r) => r.f === s.f)) { revealing = false; return; }
    const n = ((store.secrets && store.secrets.length) || 0) + 1, last = n >= 6;
    const line = last ? CUT_LINE : HINTS[store.order[(n - 1) % 5]];
    const keep = last ? NAME_LINE : line;
    // diminishing volume: every message renders smaller and dimmer than the last,
    // bottoming out at the cut-off — then the title comes back up, legible.
    const q = last ? .58 : Math.max(.68, 1 - (n - 1) * .08);
    clearCall();
    const b = s.el.querySelector('.beacon.top').getBoundingClientRect();
    const sp = document.createElement('div');
    sp.className = 'spark';
    sp.style.left = (b.left + b.width / 2) + 'px'; sp.style.top = (b.top + b.height / 2) + 'px';
    document.body.appendChild(sp);
    const boxH = fitReveal();
    requestAnimationFrame(() => {
      sp.style.left = (W / 2) + 'px'; sp.style.top = (boxH * .34) + 'px';
      sp.style.width = '13px'; sp.style.height = '13px'; sp.style.margin = '-6.5px 0 0 -6.5px';
    });
    // full riser on the first and the last; a short swell between
    const heavy = last || n === 1, dur = heavy ? 2 : .9;
    if (powered) setTimeout(() => VRAudio.swell(dur, heavy ? .42 : .26), 550);
    const rv = $('#reveal');
    setTimeout(() => {
      rv.style.setProperty('--q', q.toFixed(3));
      rv.style.setProperty('--qa', q.toFixed(3));
      $('#rcount').textContent = last ? 'sixth station.' : ORDINAL[n - 1] + ' station. still not the one.';
      $('#rline').textContent = line;
      rv.classList.add('on');
    }, 900);
    // the sixth completes the breath it just cut off — the title emerges from the lyric
    if (last) setTimeout(() => {
      rv.style.setProperty('--q', '.9'); rv.style.setProperty('--qa', '1');
      $('#rcount').textContent = '';
      $('#rline').textContent = NAME_LINE;
    }, 3700);
    const outAt = last ? 8200 : 900 + (heavy ? 4200 : 3300);
    setTimeout(() => {
      $('#reveal').classList.remove('on');
      sp.style.left = (b.left + b.width / 2) + 'px'; sp.style.top = (b.top + b.height / 2) + 'px';
      sp.style.width = '6px'; sp.style.height = '6px'; sp.style.margin = '-3px 0 0 -3px';
    }, outAt);
    setTimeout(() => {
      sp.style.opacity = '0';
      setTimeout(() => sp.remove(), 600);
      s.el.classList.add('found');
      hintStamp(s, keep, q);
      logLine(stamp(), '', s.f.toFixed(1) + ' · stray · logged', 'acq');
      $('#tuned').textContent = 'logbook · ' + clog.children.length + ' lines';
      (store.secrets = store.secrets || []).push({ f: s.f, q }); save();
      revealing = false;
    }, outAt + 1100);
  }
  // the hunt survives a refresh — and a room that was already locked stays locked
  if (store.locks && store.locks.length) store.locks.forEach((id) => {
    const s = STATIONS.filter((x) => x.id === id)[0];
    if (!s || locked[id]) return;
    locked[id] = true; s.el.classList.add('locked'); s.stamp.classList.add('on'); memorize(s.f);
  });
  layoutStamps();
  if (store.claimed) {
    finished = true; finaleQueued = true;
    body.dataset.sync = 'on';
    hail.style.opacity = '0';
    read.style.left = '50%';
    $('#past').classList.add('on');
    needleF = TOP - .55;
    openAfter(false);
    poolT = 1.6; pulseT = 9;
  }
  // found stays found (guard against duplicate records)
  if (store.secrets && store.secrets.length) {
    const seen = {};
    store.secrets = store.secrets.filter((r) => (seen[r.f] ? false : (seen[r.f] = 1)));
    openAfter(false);
    store.secrets.forEach((rec, i) => {
      const s = secrets.filter((x) => x.f === rec.f)[0];
      if (!s) return;
      // recompute the line from the CURRENT constants instead of trusting rec.line — found is
      // permanent, so a stored string would outlive every copy edit. secrets is the ordered find
      // array and store.order is persisted, so find i's line is deterministic.
      const line = i >= 5 ? NAME_LINE : HINTS[store.order[i % 5]];
      s.found = true; s.el.classList.add('found'); hintStamp(s, line, rec.q);
    });
  }
  let lastMove = performance.now(), calling = null;
  function clearCall() { if (calling) { calling.el.classList.remove('calling'); calling = null; } }
  addEventListener('pointermove', (e) => {
    ptr.x = e.clientX; ptr.y = e.clientY; lastMove = performance.now(); clearCall();
  }, { passive: true });
  $('#array').addEventListener('pointerdown', (e) => {
    if (!secretsOn || revealing) return;
    const s = nearestSecret(e.clientX, e.clientY, 150);
    if (s) reveal(s);
  });

  // ---------- canvas: interference bands + rings ----------
  function resize() {
    dpr = Math.min(2, devicePixelRatio || 1);
    W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    cx2.setTransform(dpr, 0, 0, dpr, 0, 0);
    bands = Array.from({ length: 26 }, () => newBand(Math.random() * H));
  }
  function newBand(y) {
    return { y, x: Math.random() * W, w: 40 + Math.random() * 380, h: 1 + Math.random() * 2, v: 12 + Math.random() * 42, a: .1 + Math.random() * .5 };
  }
  function towerPos(s) {
    const r = s.el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + 2 };
  }
  // the eye of the ripple is dead center of the room — the cover sits in it
  function ripCenter() { return { x: W / 2, y: H / 2 }; }
  function burst(s, n) {
    const p = towerPos(s);
    for (let i = 0; i < n; i++) rings.push({ x: p.x, y: p.y, r: 6 + i * 14, dr: 46, a: .5, mode: 'out', c: '224,85,72' });
  }
  addEventListener('resize', () => { resize(); layoutStamps(); if (hintEls.length) layoutHints(); if (secretsOn) fitReveal(); });
  // stamps are packed from measured text widths — remeasure once the real fonts swap in,
  // otherwise the first layout is computed in fallback metrics and the copy collides
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => {
    layoutStamps(); if (hintEls.length) layoutHints();
  });
  resize();

  function draw(dt) {
    cx2.clearRect(0, 0, W, H);
    // interference bands — density tied to the audible static
    if (statLevel > .01) {
      cx2.save();
      bands.forEach((b) => {
        b.y += b.v * dt * (.4 + statLevel);
        if (b.y > H) Object.assign(b, newBand(-6));
        cx2.fillStyle = `rgba(239,231,214,${(b.a * statLevel * .1).toFixed(3)})`;
        cx2.fillRect(b.x, b.y, b.w, b.h);
      });
      cx2.restore();
    }
    // rings
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      if (r.mode === 'out') { r.r += r.dr * dt; r.a -= dt * (r.fade || .34); }
      else { r.t = (r.t || 0) + dt / 1.5; r.x += (r.cx - r.x) * dt * 1.6; r.y += (r.cy - r.y) * dt * 1.6; r.r *= (1 - dt * .9); r.a = .55 * (1 - r.t); }
      if (r.a <= .01 || r.r <= 1) { rings.splice(i, 1); continue; }
      cx2.beginPath(); cx2.arc(r.x, r.y, r.r, 0, 6.2832);
      cx2.strokeStyle = `rgba(${r.c},${r.a.toFixed(3)})`; cx2.lineWidth = r.w || 1; cx2.stroke();
    }
    // the takeover flash — the room briefly floods when the fifth lands
    if (flash > .002) {
      const c = ripCenter();
      const g = cx2.createRadialGradient(c.x, c.y, 0, c.x, c.y, Math.max(W, H) * .8);
      g.addColorStop(0, `rgba(239,231,214,${(flash * .3).toFixed(3)})`);
      g.addColorStop(.35, `rgba(217,162,75,${(flash * .18).toFixed(3)})`);
      g.addColorStop(1, 'rgba(16,14,12,0)');
      cx2.fillStyle = g; cx2.fillRect(0, 0, W, H);
      flash -= dt * .55;
    }
  }

  // ---------- frame ----------
  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;

    // mechanical wander — dt-scaled (same on any refresh rate), and the parked needle doesn't wander
    if (!finished) needleF += Math.sin(now / 1700) * .021 * dt;
    else if (needleF > TOP) needleF = TOP;

    // nearest station
    let near = null, dist = 99;
    STATIONS.forEach((s) => { const d = Math.abs(needleF - s.f); if (d < dist) { dist = d; near = s; } });
    courted = near && dist < BLEED && !finished ? near : null;

    // the drift — the station will not hold itself
    if (near && !locked[near.id] && dist <= CAPTURE && !finished) {
      const dir = needleF === near.f ? (Math.random() < .5 ? -1 : 1) : Math.sign(needleF - near.f);
      needleF = clamp(needleF + dir * DRIFT * dt, FMIN, 107.98);
      dist = Math.abs(needleF - near.f);
      held += dt;
      if (held >= HOLD) doLock(near);
    } else held = 0;

    prox = near && !finished ? clamp(1 - dist / BLEED, 0, 1) : 0;
    statLevel = finished ? Math.max(0, statLevel - dt * .5) : (.28 + .72 * clamp(dist / BLEED, 0, 1)) * (1 - VRAudio.locks * .13);

    if (powered && !finished) VRAudio.tune(near && !locked[near.id] ? near.id : null, dist, dragging);

    // paint the set
    needle.style.left = pct(needleF) + '%';
    if (!finished) read.style.left = clamp(pct(needleF), 10, 90) + '%';
    if (finished) read.textContent = 'velvet ripple — frequency';
    else {
      const flick = prox > .55 && Math.random() < .12 ? near.f : needleF;
      read.textContent = flick.toFixed(1);
    }
    holdBar.style.left = pct(needleF) + '%';
    holdBar.style.width = (held / HOLD * 46).toFixed(1) + 'px';
    holdBar.style.translate = '-50% 0';
    vu.style.width = (finished ? 100 : Math.min(100, prox * 96 + Math.random() * 6 * prox)) + '%';
    STATIONS.forEach((s) => {
      if (locked[s.id]) return;
      const g = clamp(1 - Math.abs(needleF - s.f) / BLEED, 0, 1);
      s.el.style.setProperty('--glow', (g * g).toFixed(3));
    });

    // rings while courting — waves visibly interfering
    if (courted && prox > .25 && Math.random() < prox * .22) {
      const p = towerPos(courted);
      rings.push({ x: p.x, y: p.y, r: 4, dr: 30 + 40 * prox, a: .12 + .3 * prox, mode: 'out', c: '239,231,214' });
    }

    // the pooling: every tower's ripple drawn into one, then the room floods
    if (poolT >= 0) {
      const was = poolT; poolT += dt;
      const c = ripCenter();
      if (was === 0) STATIONS.forEach((s) => {
        const p = towerPos(s);
        rings.push({ x: p.x, y: p.y, cx: c.x, cy: c.y, r: 170, a: .6, mode: 'in', c: '217,162,75', t: 0, w: 1.5 });
      });
      // the trigger: one massive brand-ink ripple off the pooled center
      if (was < 1.5 && poolT >= 1.5) {
        flash = 1;
        for (let i = 0; i < 7; i++) rings.push({ x: c.x, y: c.y, r: 4 + i * 24, dr: 210 - i * 16,
          a: .8 - i * .07, fade: .1, mode: 'out', c: INKS[i % INKS.length], w: 3.4 - i * .32 });
      }
      if (poolT > 1.5) {
        // it never stops — the room is the ripple now: heavy rings on the bar, thin ones on the beat
        pulseT += dt; beatT += dt;
        if (pulseT > VRAudio.BAR) {
          pulseT = 0; pulseN++;
          const k = post ? .45 : 1;
          for (let i = 0; i < 3; i++) rings.push({ x: c.x, y: c.y, r: 8 + i * 16, dr: 165 - i * 34,
            a: (.62 - i * .13) * k, fade: .105, mode: 'out', c: INKS[(pulseN + i) % INKS.length], w: 2.6 - i * .6 });
        }
        if (beatT > VRAudio.BEAT) {
          beatT = 0;
          rings.push({ x: c.x, y: c.y, r: 6, dr: 96, a: post ? .12 : .26, fade: .12, mode: 'out', c: INKS[(pulseN + 2) % INKS.length], w: 1 });
        }
      }
    }

    // dead air — one fragment at a time, never two
    if (!finished) {
      if (dist > 1.6) {
        fragT += dt;
        if (fragT > 5 && !fragOn) {
          fragOn = true; fragT = 0;
          ghost.textContent = FRAGMENTS[Math.floor(Math.random() * FRAGMENTS.length)];
          ghost.classList.add('on');
          if (powered) VRAudio.blip();
          setTimeout(() => { ghost.classList.remove('on'); fragOn = false; fragT = -2; }, 3600);
        }
      } else fragT = 0;
    } else if (post) {
      // after the lock: two things that were never there before
      const far = ghost.dataset.blocked ? '' : needleF > 107.93 ? '…ycneuqerf eht rof gnikool' : needleF < 88.25 ? '…this channel was never assigned.' : '';
      if (far && !fragOn) { ghost.textContent = far; ghost.classList.add('on'); fragOn = true; }
      else if (!far && fragOn) { ghost.classList.remove('on'); fragOn = false; }
    }

    // the array runs on the record: kick and bass onsets light beat slots, never all at once
    if (powered && VRAudio.ready) {
      const L = VRAudio.levels();
      const k = Math.max(L.drums, L.chorus * .8), b = L.bass;
      if (!beatOn && (k > .012 || b > .012)) { beatOn = true; body.dataset.beat = 'on'; }
      if (beatOn) {
        kRef -= dt; bRef -= dt;
        if (k > .022 && k > prevK * 1.28 && kRef <= 0) {
          kRef = .1; kN++;
          const g = kN % 4;
          beacons.forEach((o) => { if (o.grp === g) o.lit = 1; });
        }
        if (b > .018 && b > prevB * 1.3 && bRef <= 0) {
          bRef = .13; bN++;
          const g = (bN * 3 + 2) % 4;
          beacons.forEach((o) => { if (o.grp === g) o.lit = Math.max(o.lit, .62); });
        }
        prevK = k; prevB = b;
        beacons.forEach((o) => {
          o.lit = Math.max(0, o.lit - dt * 2.6);
          // a mast you've already taken never goes fully dark — it breathes above a floor
          const m = o.bc.parentNode;
          const floor = (m.classList.contains('locked') || m.classList.contains('found')) ? .5 : .1;
          o.bc.style.opacity = (floor + o.lit * (1 - floor)).toFixed(3);
        });
      }
    }

    // 108.0 stays a place: tune back onto it and the record comes back up
    if (finished && post) {
      const atTop = needleF >= TOP - .04;
      if (atTop) {
        topT += dt;
        if (topT > .6 && !revealing && !claim.classList.contains('on')) { showCard(); $('#recall').classList.remove('on'); }
      } else {
        topT = 0;
        if (needleF < TOP - .14 && claim.classList.contains('on')) { claim.classList.remove('on'); if (store.kept) $('#recall').classList.add('on'); }
      }
    }

    // the strays: they glint when you come near, and give up a line when you stay
    if (secretsOn && !revealing) {
      let best = null, bd = 999;
      secrets.forEach((s) => {
        if (s.found) { s.el.style.setProperty('--glow', '1'); return; }
        const b = s.el.getBoundingClientRect();
        const d = Math.hypot(ptr.x - (b.left + b.width / 2), ptr.y - b.top);
        s.el.style.setProperty('--glow', clamp(1 - d / 170, 0, 1).toFixed(3));
        if (d < bd) { bd = d; best = s; }
      });
      if (best && bd < 95) { nearT += dt; if (nearT > .55) reveal(best); } else nearT = 0;
      // reward staying, not hunting: sit still long enough and one of them calls
      if (!calling && now - lastMove > 170000) {
        const dark = secrets.filter((x) => !x.found);
        if (dark.length) { calling = dark[Math.floor(Math.random() * dark.length)]; calling.el.classList.add('calling'); }
      }
    }

    draw(dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // dev handle — drive the mechanic without a hand on the dial
  window.VRDial = { stations: STATIONS, lock: doLock, finale, secrets, reveal, openAfter, hint: hintStamp,
    get needle() { return needleF; }, set needle(v) { needleF = v; held = 0; },
    get rings() { return rings.map((r) => ({ x: Math.round(r.x), y: Math.round(r.y), r: Math.round(r.r), m: r.mode })); },
    get state() { return { locked: Object.keys(locked), finished, powered, statLevel: +statLevel.toFixed(2), W, H }; } };
})();
