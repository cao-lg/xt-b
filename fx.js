/* ============================================================
 * 反馈特效引擎（FX）
 * 暴露 window.FX：floatText / burst / shake / flash / banner / confetti
 * 零依赖，移动端友好；所有特效挂在全屏 #fx-layer 上（pointer-events:none）。
 * 纯表现层，不触动任何游戏数值。
 * ============================================================ */
window.FX = (function () {
  function layer() {
    let el = document.getElementById('fx-layer');
    if (!el) { el = document.createElement('div'); el.id = 'fx-layer'; document.body.appendChild(el); }
    return el;
  }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  // 跳字：floatText(text, {x,y,kind,color,size})
  // kind: 'crit' | 'gold' | 'big' | 'good' | 'bad'
  function floatText(text, opts) {
    opts = opts || {};
    const el = document.createElement('div');
    let cls = 'fx-float';
    if (opts.kind) cls += ' ' + opts.kind;
    el.className = cls;
    el.textContent = text;
    if (opts.color) el.style.color = opts.color;
    if (opts.size) el.style.fontSize = opts.size + 'px';
    const L = layer();
    let x = opts.x == null ? window.innerWidth / 2 + rnd(-40, 40) : opts.x;
    let y = opts.y == null ? window.innerHeight * 0.42 + rnd(-24, 24) : opts.y;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    L.appendChild(el);
    setTimeout(function () { el.remove(); }, 1150);
    return el;
  }

  // 粒子爆发：burst(x,y,color,count)
  function burst(x, y, color, count) {
    const L = layer();
    const cx = x == null ? window.innerWidth / 2 : x;
    const cy = y == null ? window.innerHeight * 0.42 : y;
    const n = count || 10;
    for (let i = 0; i < n; i++) {
      const p = document.createElement('div');
      p.className = 'fx-particle';
      if (color) p.style.background = color;
      const a = Math.random() * Math.PI * 2, d = rnd(26, 74);
      p.style.left = cx + 'px'; p.style.top = cy + 'px';
      p.style.setProperty('--tx', Math.cos(a) * d + 'px');
      p.style.setProperty('--ty', Math.sin(a) * d + 'px');
      L.appendChild(p);
      setTimeout(function () { p.remove(); }, 720);
    }
  }

  // 震屏：shake(power) —— power 越大越剧烈
  function shake(power) {
    const app = document.getElementById('app') || document.body;
    app.style.setProperty('--shake', (power || 1));
    app.classList.remove('fx-shake'); void app.offsetWidth; app.classList.add('fx-shake');
    setTimeout(function () { app.classList.remove('fx-shake'); }, 500);
  }

  // 全屏闪光：flash(color)
  function flash(color) {
    const L = layer();
    const f = document.createElement('div');
    f.className = 'fx-flash';
    if (color) f.style.background = color;
    L.appendChild(f);
    setTimeout(function () { f.remove(); }, 440);
  }

  // 横幅：banner(text, {kind,dur})
  function banner(text, opts) {
    opts = opts || {};
    const L = layer();
    const b = document.createElement('div');
    b.className = 'fx-banner' + (opts.kind ? ' ' + opts.kind : '');
    b.innerHTML = '<span>' + text + '</span>';
    L.appendChild(b);
    setTimeout(function () { b.classList.add('show'); }, 12);
    const dur = opts.dur || 1500;
    setTimeout(function () { b.classList.remove('show'); b.classList.add('hide'); }, dur);
    setTimeout(function () { b.remove(); }, dur + 520);
  }

  // 礼花：confetti([colors])
  function confetti(colors) {
    const L = layer();
    const cols = colors || ['#f0c674', '#7fd1c1', '#ff9f9f', '#c79fff', '#8affc1', '#ffd76f'];
    for (let i = 0; i < 40; i++) {
      const p = document.createElement('div');
      p.className = 'fx-confetti';
      p.style.background = cols[i % cols.length];
      p.style.left = rnd(0, window.innerWidth) + 'px';
      p.style.setProperty('--tx', rnd(-70, 70) + 'px');
      p.style.setProperty('--rot', rnd(360, 1080) + 'deg');
      p.style.animationDelay = rnd(0, 260) + 'ms';
      L.appendChild(p);
      setTimeout(function () { p.remove(); }, 1700);
    }
  }

  return { layer: layer, floatText: floatText, burst: burst, shake: shake, flash: flash, banner: banner, confetti: confetti };
})();
