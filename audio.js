/* ============================================================
 * 战斗音效（Web Audio 实时合成，零音频文件，默认关闭）
 * 暴露 window.SFX：setEnabled / getEnabled / play(type)
 * type: hit | slash | skill | crit | win | lose
 * 仅在 enabled 且浏览器支持 Web Audio 时发声；无用户手势时静默。
 * ============================================================ */
window.SFX = (function () {
  let ctx = null, master = null, enabled = false;

  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.22;
      master.connect(ctx.destination);
    } catch (e) { ctx = null; }
    return ctx;
  }
  function setEnabled(v) {
    enabled = !!v;
    if (enabled) { const c = ensure(); if (c && c.state === 'suspended') c.resume(); }
  }
  function getEnabled() { return enabled; }

  function tone(freq, dur, type, vol, slideTo, delay) {
    if (!enabled || !ensure()) return;
    const t0 = ctx.currentTime + (delay || 0);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol || 0.3, t0);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function noise(dur, vol, hp) {
    if (!enabled || !ensure()) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g = ctx.createGain(); g.gain.value = vol || 0.3;
    let node = src;
    if (hp) { const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp; src.connect(f); node = f; }
    node.connect(g); g.connect(master);
    src.start();
  }

  function play(type) {
    if (!enabled || !ensure()) return;
    switch (type) {
      case 'hit':  noise(0.12, 0.35, 700); tone(150, 0.12, 'square', 0.22, 80); break;
      case 'slash': noise(0.18, 0.22, 1400); break;
      case 'skill': tone(420, 0.26, 'sine', 0.22, 900); break;
      case 'crit': tone(680, 0.3, 'sawtooth', 0.26, 1360); noise(0.16, 0.28, 600); break;
      case 'win':  [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.26, 'triangle', 0.26, null, i * 0.09)); break;
      case 'lose': [392, 330, 262].forEach((f, i) => tone(f, 0.3, 'sine', 0.26, null, i * 0.12)); break;
    }
  }

  return { setEnabled, getEnabled, play };
})();
