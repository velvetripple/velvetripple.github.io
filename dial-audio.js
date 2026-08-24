/* VELVET RIPPLE · 108.0 — audio engine
   real stems, bar-aligned at 108 bpm. the five stations are 12-bar loops, FM-bandwidth mono
   (15 kHz, exactly what an FM broadcast is); the chorus is the mastered 16-bar stereo bounce —
   so the room goes mono → stereo at the lock, like a car radio catching a stereo pilot.
   static, heterodyne whistle and blips are synthesized; nothing else is.
   the one non-negotiable: every source shares one clock and enters ON A BAR BOUNDARY. */
window.VRAudio = (function () {
  const BPM = 108, BEAT = 60 / BPM, BAR = BEAT * 4;
  const LOOP = BAR * 12;          // the stems: 12 bars
  const CHORUS = BAR * 16;        // the chorus: 16 bars
  // loop points come from the bar math, never from buffer.duration — so a compressed
  // re-encode (m4a/opus, which pads) still loops sample-exact.
  const STEMS = {
    drums:        { file: 'stems/drums.wav',        trim: 1.00 },
    bass:         { file: 'stems/bass.wav',         trim: 2.00 },
    synths:       { file: 'stems/synths.wav',       trim: 3.40 },
    transmission: { file: 'stems/transmission.wav', trim: 3.40 },
    vocals:       { file: 'stems/vocals.wav',       trim: 1.05 }
  };
  const CHORUS_FILE = 'stems/chorus.wav';

  let ctx = null, master = null, stat = null, statLp = null, het = null, hetG = null;
  let stems = {}, chorusBuf = null, chorusG = null, chorusAn = null, chorusLoading = null;
  let chorusSrc = null, chorusPending = false;   // exactly one chorus may ever be running
  let lockCount = 0, t0 = 0, ready = false, vol = 0.72, onProgress = null;

  function noiseBuf(c, secs) {
    const b = c.createBuffer(1, Math.ceil(c.sampleRate * secs), c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  function hit(c, dest, t, f, dur, peak) {
    const s = c.createBufferSource(), bq = c.createBiquadFilter(), g = c.createGain();
    s.buffer = noiseBuf(c, dur + .05); bq.type = f.type; bq.frequency.value = f.f; bq.Q.value = f.q || 1;
    s.connect(bq); bq.connect(g); g.connect(dest);
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + .004);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    s.start(t); s.stop(t + dur + .05);
  }

  async function load(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(url + ' → ' + res.status);
    return ctx.decodeAudioData(await res.arrayBuffer());
  }
  function bus(buffer, trim, cut) {
    const src = ctx.createBufferSource(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = buffer; src.loop = true; src.loopStart = 0; src.loopEnd = LOOP;
    lp.type = 'lowpass'; lp.frequency.value = cut; lp.Q.value = .8;
    g.gain.value = 0;
    src.connect(lp); lp.connect(g); g.connect(master);
    src.start(t0);
    return { src, lp, g, trim, an: mkAn(g), locked: false };
  }
  // analysers: the array's beacons are driven by what the drums and bass are actually doing
  function mkAn(node) {
    const a = ctx.createAnalyser();
    a.fftSize = 256; a.smoothingTimeConstant = .12;
    node.connect(a);
    return { a, d: new Uint8Array(a.fftSize) };
  }
  function rms(x) {
    if (!x) return 0;
    x.a.getByteTimeDomainData(x.d);
    let s = 0;
    for (let i = 0; i < x.d.length; i += 2) { const v = (x.d[i] - 128) / 128; s += v * v; }
    return Math.sqrt(s / (x.d.length / 2));
  }
  function levels() {
    if (!ready) return { drums: 0, bass: 0, chorus: 0 };
    return { drums: rms(stems.drums && stems.drums.an), bass: rms(stems.bass && stems.bass.an),
      chorus: rms(chorusAn) };
  }

  function stopChorus() {
    if (!chorusSrc) return;
    try { chorusSrc.stop(); } catch (e) {}
    try { chorusSrc.disconnect(); } catch (e) {}
    if (chorusG) { try { chorusG.disconnect(); } catch (e) {} }
    chorusSrc = null; chorusG = null; chorusAn = null;
  }

  function loadChorus() {
    if (chorusBuf || chorusLoading) return chorusLoading;
    chorusLoading = load(CHORUS_FILE).then((b) => { chorusBuf = b; return b; })
      .catch((e) => { console.warn('chorus load failed', e); chorusLoading = null; });
    return chorusLoading;
  }

  async function unlock(progress) {
    onProgress = progress || onProgress;
    if (ctx) { if (ctx.state === 'suspended') await ctx.resume(); return ready; }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = vol; master.connect(ctx.destination);

    const ids = Object.keys(STEMS);
    let done = 0;
    const bufs = await Promise.all(ids.map((id) => load(STEMS[id].file).then((b) => {
      done++; if (onProgress) onProgress(done / ids.length);
      return b;
    })));

    t0 = ctx.currentTime + .12;
    ids.forEach((id, i) => { stems[id] = bus(bufs[i], STEMS[id].trim, 340); });

    // static bed — band-passed 300 hz–3 khz, the record's own comms chain
    const src = ctx.createBufferSource(), hp = ctx.createBiquadFilter();
    statLp = ctx.createBiquadFilter(); stat = ctx.createGain();
    src.buffer = noiseBuf(ctx, 3); src.loop = true;
    hp.type = 'highpass'; hp.frequency.value = 300;
    statLp.type = 'lowpass'; statLp.frequency.value = 3000; statLp.Q.value = .6;
    stat.gain.value = 0;
    src.connect(hp); hp.connect(statLp); statLp.connect(stat); stat.connect(master);
    src.start(t0);
    stat.gain.linearRampToValueAtTime(.17, t0 + 1.4);

    // heterodyne whistle — the pitch that descends as you close in
    het = ctx.createOscillator(); hetG = ctx.createGain();
    het.type = 'sine'; het.frequency.value = 2400; hetG.gain.value = 0;
    het.connect(hetG); hetG.connect(master); het.start(t0);

    ready = true;
    loadChorus();   // 5th lock needs it; fetch in the background while they hunt
    return true;
  }

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  function nextBar(lead) {
    if (!ctx) return 0;
    const el = ctx.currentTime - t0, n = Math.ceil((el + (lead || .06)) / BAR);
    return t0 + n * BAR;
  }

  // per-frame: nearest station distance drives static, bleed, whistle
  function tune(id, dist) {
    if (!ready) return;
    const t = ctx.currentTime;
    const near = clamp(1 - dist / 0.9, 0, 1), prox = near * near;
    const base = .17 * (1 - lockCount * .17);
    const swellK = 1 + .2 * Math.sin(t * .62) * Math.sin(t * .23);
    const duck = .3 + .7 * clamp(dist / .9, 0, 1);
    stat.gain.setTargetAtTime(base * swellK * duck, t, .09);
    Object.keys(stems).forEach((k) => {
      const s = stems[k];
      if (!s || s.locked) return;
      const on = k === id;
      s.g.gain.setTargetAtTime(on ? .34 * s.trim * prox : 0, t, .07);
      s.lp.frequency.setTargetAtTime(on ? 300 + 1700 * prox : 340, t, .1);
    });
    const whistle = dist > .06 && dist < .95 && id;
    hetG.gain.setTargetAtTime(whistle ? .022 * Math.pow(near, 1.4) : 0, t, .08);
    if (whistle) het.frequency.setTargetAtTime(380 + dist * 2700, t, .06);
  }

  // lock: the stem lands at full level on the next bar boundary
  function lock(id) {
    if (!ready || !stems[id]) return 0;
    const s = stems[id], at = nextBar(.05);
    s.locked = true;
    s.g.gain.setTargetAtTime(.9 * s.trim, at, .05);
    s.lp.frequency.setTargetAtTime(15000, at, .12);
    lockCount++;
    return Math.max(0, (at - ctx.currentTime) * 1000);
  }

  // a returning visitor: stations they already found come up already open, in sync
  function restoreLocks(ids) {
    if (!ready) return;
    const at = nextBar(.05);
    ids.forEach((id) => {
      const s = stems[id];
      if (!s || s.locked) return;
      s.locked = true; lockCount++;
      s.g.gain.setTargetAtTime(.9 * s.trim, at, .05);
      s.lp.frequency.setTargetAtTime(15000, at, .12);
    });
  }

  // the fifth lock: the stems fall away and the static climbs — a riser, not a fade
  function riser(dur) {
    if (!ready) return;
    const t = ctx.currentTime;
    Object.keys(stems).forEach((k) => stems[k].g.gain.setTargetAtTime(0, t, .45));
    stat.gain.cancelScheduledValues(t);
    stat.gain.setValueAtTime(Math.max(.03, stat.gain.value), t);
    stat.gain.linearRampToValueAtTime(.44, t + dur);
    statLp.frequency.cancelScheduledValues(t);
    statLp.frequency.setValueAtTime(Math.max(400, statLp.frequency.value), t);
    statLp.frequency.exponentialRampToValueAtTime(12000, t + dur);
    hetG.gain.cancelScheduledValues(t);
    hetG.gain.setValueAtTime(.001, t);
    hetG.gain.linearRampToValueAtTime(.045, t + dur * .96);
    het.frequency.cancelScheduledValues(t);
    het.frequency.setValueAtTime(200, t);
    het.frequency.exponentialRampToValueAtTime(2800, t + dur);
  }

  // the small riser each secret station gets (the chorus ducks under it)
  function swell(dur, peak) {
    if (!ready) return;
    const t = ctx.currentTime, p = peak || .3;
    stat.gain.cancelScheduledValues(t);
    stat.gain.setValueAtTime(Math.max(.0005, stat.gain.value), t);
    stat.gain.linearRampToValueAtTime(p, t + dur * .82);
    stat.gain.setTargetAtTime(.0001, t + dur, .3);
    statLp.frequency.cancelScheduledValues(t);
    statLp.frequency.setValueAtTime(1200, t);
    statLp.frequency.exponentialRampToValueAtTime(9000, t + dur * .9);
    hetG.gain.cancelScheduledValues(t);
    hetG.gain.setValueAtTime(.0005, t);
    hetG.gain.linearRampToValueAtTime(.028, t + dur * .85);
    hetG.gain.setTargetAtTime(0, t + dur, .22);
    het.frequency.cancelScheduledValues(t);
    het.frequency.setValueAtTime(300, t);
    het.frequency.exponentialRampToValueAtTime(2200, t + dur);
    if (chorusG) {
      chorusG.gain.cancelScheduledValues(t);
      chorusG.gain.setTargetAtTime(.42, t, .3);
      chorusG.gain.setTargetAtTime(.95, t + dur + .5, .5);
    }
  }

  function startChorus(skipCut) {
    // a suspend doesn't tear a source down, and a second call used to leave the first one
    // connected at full gain — so tear the old one out before building the new one
    stopChorus();
    const at = nextBar(.9);
    const src = ctx.createBufferSource(); chorusG = ctx.createGain();
    src.buffer = chorusBuf; src.loop = true; src.loopStart = 0; src.loopEnd = CHORUS;
    chorusG.gain.value = 0;
    src.connect(chorusG); chorusG.connect(master); src.start(at);
    chorusSrc = src;
    chorusAn = mkAn(chorusG);
    chorusG.gain.setTargetAtTime(.95, at, .08);
    // the a♭→a push: one beat of true silence, first pass only
    if (!skipCut) {
      const cut = at + BAR * 3;
      chorusG.gain.setValueAtTime(.95, cut - .01);
      chorusG.gain.linearRampToValueAtTime(0, cut);
      chorusG.gain.setValueAtTime(0, cut + BEAT - .02);
      chorusG.gain.linearRampToValueAtTime(.95, cut + BEAT);
    }
    return at;
  }

  // then it drops: static dies, the mastered chorus enters on the bar
  function finale(skipCut) {
    if (!ready) return { at: 0, delay: 300 };
    const t = ctx.currentTime;
    stat.gain.cancelScheduledValues(t);
    stat.gain.setValueAtTime(stat.gain.value, t);
    stat.gain.setTargetAtTime(0, t, .16);
    hetG.gain.cancelScheduledValues(t);
    hetG.gain.setValueAtTime(hetG.gain.value, t);
    hetG.gain.setTargetAtTime(0, t, .12);
    statLp.frequency.cancelScheduledValues(t);
    Object.keys(stems).forEach((k) => stems[k].g.gain.setTargetAtTime(0, t, .2));
    // already playing, or already queued to play — a power cycle or a second restore must
    // resume the chorus where it is, never stack another pass on top of it
    if (chorusSrc || chorusPending) return { at: 0, delay: 0, bar: BAR * 1000, beat: BEAT * 1000 };
    if (chorusBuf) {
      const at = startChorus(skipCut);
      return { at, delay: Math.max(0, (at - t) * 1000), bar: BAR * 1000, beat: BEAT * 1000 };
    }
    chorusPending = true;   // the file is still coming; don't let a second call queue a second start
    loadChorus().then(() => { chorusPending = false; if (chorusBuf) startChorus(skipCut); });
    return { at: 0, delay: 1200, bar: BAR * 1000, beat: BEAT * 1000 };
  }

  function blip() {
    if (!ready) return;
    hit(ctx, master, ctx.currentTime + .01, { type: 'bandpass', f: 900 + Math.random() * 1200, q: 2 }, .05, .06);
  }
  function setVol(v) { vol = clamp(v, 0, 1); if (master) master.gain.setTargetAtTime(vol, ctx.currentTime, .05); }
  function setTone(v) { if (statLp) statLp.frequency.setTargetAtTime(1100 + v * 3400, ctx.currentTime, .08); }
  function suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); }
  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }

  return { unlock, tune, lock, restoreLocks, riser, swell, finale, blip, levels, setVol, setTone, suspend, resume,
    BPM, BEAT, BAR, LOOP, get ready() { return ready; }, get locks() { return lockCount; } };
})();
