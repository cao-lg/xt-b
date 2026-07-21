/* ============================================================
 * 放置修仙 · 逍遥道途 v2 —— 界面渲染与交互
 * ============================================================ */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const view = $('#view');
  const modalLayer = $('#modal-layer');
  const toastLayer = $('#toast-layer');
  // 反馈特效引擎（fx.js）；若未加载则降级为空操作，避免报错
  const FX = window.FX || { floatText() {}, burst() {}, shake() {}, flash() {}, banner() {}, confetti() {}, layer() { return document.body; } };

  let goldenOrbEl = null;     // 当前屏上的天降机缘宝光
  let comboMeterEl = null;    // combo 连击表

  // 境界突破卡·道韵文案
  const REALM_FLAVOR = {
    lianqi: '一缕清气萌于丹田，凡躯初闻道音。',
    zhuji: '灵台清明，根基如磐石初立。',
    jindan: '金丹在炉，万法自此有归依。',
    yuanying: '元婴离体，神游八荒观天地。',
    huashen: '炼神返虚，一念可化山川形。',
    lianxu: '虚空可触，法则于指间流转。',
    heti: '身神相合，气象万千纳于一身。',
    dasheng: '大乘将满，已见仙门一线光。',
    dujie: '天雷淬体，劫后余生方为真。',
    zhenxian: '功成圆满，证得无量真仙果位。'
  };
  const GOLDEN_ICON = { speed: '🌀', all: '🌿', burst: '💥' };
  const AL = { atk: '攻', def: '防', hp: '气血', crit: '暴击', dodge: '闪避', hit: '命中' };
  function affixChipText(af) { return `${af.name}·${AL[af.type] || ''} +${(af.value * 100).toFixed(1)}%`; }

  const REALM_AVATAR = ['🧘', '🧘', '⚪', '👶', '🌌', '🌠', '🔗', '🚀', '⚡', '✨'];
  let currentTab = 'cultivate';
  let currentMap = 'yaolin';
  let currentLevel = 0;
  let battleMode = 'map'; // 'map' | 'tower'

  // 自动跳到最后通过的关卡：找到最后一个有进度的地图
  function autoSelectLastCleared() {
    const s = Game.state;
    let lastMap = null;
    for (let i = Game.MAPS.length - 1; i >= 0; i--) {
      const m = Game.MAPS[i];
      if (s.mapProgress[m.id] !== undefined) { lastMap = m; break; }
    }
    if (lastMap) {
      currentMap = lastMap.id;
      currentLevel = Math.max(0, s.mapProgress[lastMap.id] || 0);
    }
  }

  // 难度评级（基于玩家战力与敌人推荐战力对比）
  function difficultyRating(enemy, playerPower) {
    const ep = Math.floor(enemy.atk * 2 + enemy.def * 1.5 + enemy.hp * 0.25);
    if (playerPower <= 0) return { text: '?', cls: 'diff-unk' };
    const ratio = playerPower / ep;
    if (ratio >= 20) return { text: '碾', cls: 'diff-easy' };
    if (ratio >= 8) return { text: '简', cls: 'diff-easy' };
    if (ratio >= 3) return { text: '普', cls: 'diff-norm' };
    if (ratio >= 1.5) return { text: '难', cls: 'diff-hard' };
    if (ratio >= 0.8) return { text: '险', cls: 'diff-hard' };
    if (ratio >= 0.4) return { text: '绝', cls: 'diff-dead' };
    return { text: '死', cls: 'diff-dead' };
  }

  /* ---------------- 工具 ---------------- */
  function relTime(t) {
    const s = Math.floor((Date.now() - t) / 1000);
    if (s < 60) return '刚刚';
    if (s < 3600) return Math.floor(s / 60) + '分前';
    if (s < 86400) return Math.floor(s / 3600) + '时前';
    return Math.floor(s / 86400) + '天前';
  }
  function toast(msg, gold) {
    const el = document.createElement('div');
    el.className = 'toast' + (gold ? ' gold' : '');
    el.textContent = msg;
    toastLayer.appendChild(el);
    setTimeout(() => el.remove(), 2700);
  }
  function floatNum(text, x, y) {
    const el = document.createElement('div');
    el.className = 'float-num'; el.textContent = text;
    el.style.left = x + 'px'; el.style.top = y + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 950);
  }
  // combo 连击表：连续点击时显示连击数与倍率，超时（窗口外无点击）自动隐藏
  function updateComboMeter(r) {
    if (!comboMeterEl) {
      comboMeterEl = document.createElement('div');
      comboMeterEl.className = 'combo-meter';
      document.body.appendChild(comboMeterEl);
    }
    if (r.combo > 0) {
      comboMeterEl.innerHTML = `<div class="cv">${r.combo} 连击</div><div class="cmult">修为 ×${r.comboMult.toFixed(2)}</div>`;
      comboMeterEl.classList.add('on');
      clearTimeout(comboMeterEl._t);
      comboMeterEl._t = setTimeout(() => comboMeterEl.classList.remove('on'), CONFIG.combo.window * 1000);
    } else {
      comboMeterEl.classList.remove('on');
    }
  }
  function modal(html, cls) {
    const mask = document.createElement('div');
    mask.className = 'modal-mask' + (cls ? ' ' + cls : '');
    mask.innerHTML = `<div class="modal">${html}</div>`;
    modalLayer.appendChild(mask);
    return mask;
  }
  function closeModal(mask) { mask.remove(); }

  /* ---------------- 顶栏 / 动态数值 ---------------- */
  function updateTopbar() {
    const s = Game.state;
    const realm = Game.REALMS[s.realmIndex];
    $('#realm-emoji').textContent = REALM_AVATAR[s.realmIndex] || '🧘';
    $('#dao-name').textContent = s.daoName;
    $('#realm-name').textContent = `${realm.name} · ${Game.CHINESE_LAYER[s.layer]}层`;
    const cost = Game.breakCost();
    const ratio = cost > 0 ? s.xp / cost : 0;
    $('#xp-val').textContent = Game.formatNum(s.xp);
    $('#xp-need').textContent = Game.formatNum(cost);
    $('#stone-val').textContent = Game.formatNum(s.stone);
    {
      const spd = Game.currentSpeed();
      const px = Game.petOutPerSec('xp');
      const tf = Game.techniqueFlat();
      const af = Game.abodeFlat();
      const pf = Game.pillFlat();
      const pa = Game.petAllBonus();
      const flatTotal = tf + af + pf;
      const petInfo = px > 0 ? ` · 🐲<span class="spd-px">+${Game.formatSpeed(px)}</span>` : '';
      const xiezhiInfo = pa > 0 ? ` · 🦄<span class="spd-xz">+${(pa*100).toFixed(0)}%</span>` : '';
      const flatInfo = flatTotal > 0 ? ` · 📜<span class="spd-ft">${Game.formatNum(tf)}</span> ⛰️<span class="spd-ft">${Game.formatNum(af)}</span> 💊<span class="spd-ft">${Game.formatNum(pf)}</span>` : '';
      $('#speed-val').innerHTML = `<span class="spd-main">${Game.formatSpeed(spd)}</span>${petInfo}${xiezhiInfo}${flatInfo}`;
    }
    $('#progress-bar').style.width = Math.min(100, ratio * 100) + '%';
    $('#progress-pct').textContent = Math.min(100, Math.floor(ratio * 100)) + '%';
    const ci = $('#btn-checkin'), cid = $('#ci-day');
    if (ci) {
      if (Game.hasCheckedInToday()) { ci.classList.add('done'); if (cid) cid.textContent = '✓'; }
      else { ci.classList.remove('done'); if (cid) cid.textContent = '第' + (Game.state.checkInStreak + 1) + '天'; }
    }
    const bb = $('#btn-break');
    if (bb) { const ready = Game.canBreak(); bb.classList.toggle('ready', ready); bb.disabled = !ready; }
    const bl = $('#buff-line'); if (bl) bl.innerHTML = buildBuffLine();
  }

  // 灵气/秒 公式分解面板（点击顶栏灵气/秒展开）
  let speedDetailOpen = false;
  function renderSpeedDetail() {
    const b = Game.speedBreakdown();
    const s = Game.state;
    const fmt = (n) => n < 10000 ? n.toFixed(2) : Game.formatNum(n);
    const pct = (n) => (n > 0 ? '+' : '') + Math.round(n * 100) + '%';
    // 各比例因子的独立贡献
    const cb = b.afterBand;                                     // base×band
    const dRoot  = b.afterRoot - b.afterBand;                   // 灵根贡献
    const dIns   = b.afterInsight - b.afterRoot;                 // 悟道贡献
    const dLeg   = b.afterInsight * (b.lMult - 1);              // 仙缘贡献
    const dBless = (b.afterInsight + dLeg) * (b.bMult - 1);     // 祝福贡献
    const dPa    = (b.afterInsight + dLeg + dBless) * b.paBonus; // 獬豸贡献
    const dGold  = (b.afterInsight + dLeg + dBless + dPa) * (b.golden - 1); // 宝光贡献
    const core  = b.afterGlobal;
    // 分类标题
    const fmtRow = (label, value, delta, unit) => {
      const abs = value < 0 ? value.toFixed(2) : fmt(value);
      const d = delta !== undefined && delta !== 0 ? `<span class="d">(+${fmt(delta)}</span>` : '';
      return `<div class="row"><span>${label}</span><span class="v">${abs} ${unit||''} ${d}</span></div>`;
    };
    // 灵宠明细
    const pets = Game.PETS.filter(p => (s.pets[p.id]||0) > 0);
    const petRows = pets.map(p => {
      const lv = s.pets[p.id]||0;
      if (p.produce.type === 'all') return { id: p.id, label: p.name + '·全资源', val: (lv * p.produce.base * 100).toFixed(0) + '%', unit: '' };
      if (p.produce.type === 'xp')  return { id: p.id, label: p.name + '·修为', val: fmt(p.produce.base * lv * b.lMult * (1 + b.paBonus) * b.golden), unit: '/秒' };
      if (p.produce.type === 'stone') return { id: p.id, label: p.name + '·灵石', val: fmt(p.produce.base * lv * b.lMult * (1 + b.paBonus) * b.golden), unit: '/秒' };
      if (p.produce.type === 'mat')  return { id: p.id, label: p.name + '·材料', val: fmt(p.produce.base * lv * b.lMult * (1 + b.paBonus) * b.golden), unit: '/秒' };
      return null;
    }).filter(Boolean);
    const petTotal = pets.reduce((sum, p) => {
      const lv = s.pets[p.id]||0;
      if (p.produce.type === 'all') return sum;
      const base = p.produce.base * lv * b.lMult * (1 + b.paBonus) * b.golden;
      if (p.produce.type === 'xp') return { xp: (sum.xp||0) + base, stone: sum.stone||0, mat: sum.mat||0 };
      if (p.produce.type === 'stone') return { xp: sum.xp||0, stone: (sum.stone||0) + base, mat: sum.mat||0 };
      if (p.produce.type === 'mat') return { xp: sum.xp||0, stone: sum.stone||0, mat: (sum.mat||0) + base };
      return sum;
    }, { xp: 0, stone: 0, mat: 0 });
    const hasPet = petTotal.xp > 0 || petTotal.stone > 0 || petTotal.mat > 0;
    // 灵根名称
    const rootName = Game.ROOTS.find(r => r.id === s.rootId)?.name || '无';
    const html = `
      <div class="formula">灵气/秒 = 天道核心(base×band×比例乘区) + 玩家固定值(功法+洞府+丹药)</div>
      <!-- 天道核心 -->
      <div class="section sec-core">🏛 天道核心（享受境界缩放+灵根/悟道/仙缘/祝福/獬豸/宝光）</div>
      <div class="row"><span>base（天道基础）</span><span class="v">${b.base.toFixed(2)}</span></div>
      <div class="row"><span>× band（境界修炼带 ×${b.band.toFixed(2)}）</span><span class="v">${cb.toFixed(2)}</span></div>
      <div class="row"><span>× 灵根·${rootName}（${pct(b.rMult-1)}）</span><span class="v">${b.afterRoot.toFixed(2)}</span></div>
      <div class="row dim"><span style="padding-left:16px">· 灵根贡献</span><span class="v">+${fmt(dRoot)} /秒</span></div>
      <div class="row"><span>× 悟道（${Game.REALMS[s.realmIndex]&&(s.insightLv.dao||0)*4}%）</span><span class="v">${b.afterInsight.toFixed(2)}</span></div>
      <div class="row dim"><span style="padding-left:16px">· 悟道贡献</span><span class="v">+${fmt(dIns)} /秒</span></div>
      <div class="row"><span>× 仙缘（×${b.lMult.toFixed(2)}）</span><span class="v">${(b.afterInsight * b.lMult).toFixed(2)}</span></div>
      <div class="row dim"><span style="padding-left:16px">· 仙缘贡献</span><span class="v">+${fmt(dLeg)} /秒</span></div>
      <div class="row"><span>× 仙缘殿·长春（×${b.bMult.toFixed(2)}）</span><span class="v">${(b.afterInsight * b.lMult * b.bMult).toFixed(2)}</span></div>
      <div class="row dim"><span style="padding-left:16px">· 祝福贡献</span><span class="v">+${fmt(dBless)} /秒</span></div>
      <div class="row"><span>× (1+獬豸 ${(b.paBonus*100).toFixed(0)}%)</span><span class="v">${(b.afterInsight * b.lMult * b.bMult * (1+b.paBonus)).toFixed(2)}</span></div>
      <div class="row dim"><span style="padding-left:16px">· 獬豸贡献</span><span class="v">+${fmt(dPa)} /秒</span></div>
      <div class="row"><span>× 天降机缘（×${b.golden.toFixed(2)}）</span><span class="v">${b.afterGolden.toFixed(2)}</span></div>
      <div class="row dim"><span style="padding-left:16px">· 宝光贡献</span><span class="v">+${fmt(dGold)} /秒</span></div>
      <div class="sep"></div>
      <div class="row total"><span>🏛 天道核心 合计</span><span class="v">${b.corePart.toFixed(2)} /秒</span></div>
      <!-- 玩家固定值 -->
      <div class="section sec-flat">🔧 玩家固定值（加在最后·不享受任何比例缩放）</div>
      <div class="row"><span>📜 功法 flat（累计 ${b.techFlat.toFixed(1)}）</span><span class="v">+${b.techFlat.toFixed(2)} /秒</span></div>
      <div class="row"><span>⛰️ 洞府 flat（累计 ${b.abodeFlat.toFixed(1)}）</span><span class="v">+${b.abodeFlat.toFixed(2)} /秒</span></div>
      <div class="row"><span>💊 丹药 flat（累计 ${b.pillFlat.toFixed(1)}）</span><span class="v">+${b.pillFlat.toFixed(2)} /秒</span></div>
      <div class="sep"></div>
      <div class="row total"><span>🔧 玩家固定值 合计</span><span class="v">+${b.purchasedFlat.toFixed(2)} /秒</span></div>
      <!-- 总 -->
      <div class="sep"></div>
      <div class="row" style="font-size:16px;font-weight:900;color:#ffe9a8">
        <span>⚡ 灵气/秒（${b.corePart.toFixed(2)} + ${b.purchasedFlat.toFixed(2)}）</span>
        <span class="v" style="color:#ffe9a8">${b.currentSpeed.toFixed(2)} /秒</span>
      </div>
      <!-- 灵宠独立产出 -->
      ${hasPet ? `<div class="section sec-pet">🐲 灵宠独立产出（直接加资源池，不计入灵气/秒）</div>
      ${petRows.map(r => `<div class="row"><span style="padding-left:8px">${r.label}</span><span class="v dim">+${r.val}${r.unit||''}</span></div>`).join('')}
      ${petTotal.xp > 0 ? `<div class="row total dim"><span style="padding-left:8px">小计·修为</span><span class="v">+${fmt(petTotal.xp)} /秒</span></div>` : ''}
      ${petTotal.stone > 0 ? `<div class="row total dim"><span style="padding-left:8px">小计·灵石</span><span class="v">+${fmt(petTotal.stone)} /秒</span></div>` : ''}
      ${petTotal.mat > 0 ? `<div class="row total dim"><span style="padding-left:8px">小计·材料</span><span class="v">+${fmt(petTotal.mat)} /秒</span></div>` : ''}
      ` : ''}
      <div class="note">💡 公式说明：天道核心 = base×band×灵根×悟道×仙缘×祝福×(1+獬豸)×宝光；玩家固定值 = 功法+洞府+丹药 flat（不乘任何比例）</div>
    `;
    const el = $('#speed-detail'); if (el) { el.innerHTML = html; el.hidden = false; }
    const stat = $('#stat-speed'); if (stat) stat.classList.add('open');
    speedDetailOpen = true;
  }
  function closeSpeedDetail() {
    const el = $('#speed-detail'); if (el) { el.hidden = true; }
    const stat = $('#stat-speed'); if (stat) stat.classList.remove('open');
    speedDetailOpen = false;
  }
  function toggleSpeedDetail() {
    if (speedDetailOpen) closeSpeedDetail(); else renderSpeedDetail();
  }

  function buildBuffLine() {
    const s = Game.state;
    let html = '';
    Game.PILLS.forEach(p => { const left = s.pills[p.id] || 0; if (left > 0) html += `<span class="pill-tag" title="${p.desc}，剩余 ${Game.formatTime(left)}">${p.icon} ${p.name} ${Game.formatTime(left)}</span>`; });
    const tf = Game.techniqueFlat(), af = Game.abodeFlat(), pf = Game.pillFlat(), pa = Game.petAllBonus();
    const hmLv = s.techniques.hongmeng || 0, xfLv = s.abodes.xianfu || 0;
    const hmFlat = hmLv > 0 ? (Game.TECHNIQUES.find(t=>t.id==='hongmeng').flat || 0) * hmLv : 0;
    const xfFlat = xfLv > 0 ? (Game.ABODES.find(a=>a.id==='xianfu').flat || 0) * xfLv : 0;
    if (tf > 0) html += `<span class="pill-tag" title="功法（普通档）合计：修炼速度 +${tf.toFixed(1)} 修为/秒（固定值·不封顶）">📜 功法 +${tf.toFixed(1)}/秒</span>`;
    if (hmLv > 0) html += `<span class="pill-tag" title="鸿蒙紫气诀（顶级）：修炼速度 +${hmFlat.toFixed(1)} 修为/秒（固定值·不封顶）">🟣 鸿蒙 +${hmFlat.toFixed(1)}/秒</span>`;
    if (af > 0) html += `<span class="pill-tag" title="洞府（普通档）合计：灵气浓度 +${af.toFixed(1)} 修为/秒（固定值·不封顶）">⛰️ 洞府 +${af.toFixed(1)}/秒</span>`;
    if (xfLv > 0) html += `<span class="pill-tag" title="上古仙府（顶级）：修炼速度 +${xfFlat.toFixed(1)} 修为/秒（固定值·不封顶）">🏯 仙府 +${xfFlat.toFixed(1)}/秒</span>`;
    if (pa > 0) html += `<span class="pill-tag" title="獬豸全资源加成：修炼 +${Math.round(pa * 100)}%（战斗：攻/防/血 ×${(1 + pa * CONFIG.combat.petAllCombat).toFixed(2)}）">🦄 灵宠 +${Math.round(pa * 100)}%</span>`;
    if (s.legacy > 0) html += `<span class="pill-tag" title="仙缘倍率（飞升转生，不封顶）：全局全效率 ×${Game.legacyMult().toFixed(2)}">🔁 仙缘 ×${Game.legacyMult().toFixed(2)}</span>`;
    const g = Game.goldenActive && Game.goldenActive();
    if (g) { const sec = Math.max(0, Math.ceil((g.until - Date.now()) / 1000)); html += `<span class="pill-tag" style="border-color:#ffd76f;color:#ffe9a8" title="${g.desc}">${g.name} ${sec}s</span>`; }
    return html || '<span style="color:var(--text-dim)">运转周天，静心修炼……</span>';
  }

  /* ---------------- 修炼页 ---------------- */
  function renderCultivate() {
    const s = Game.state;
    const major = Game.isMajorBreak();
    const breakTxt = major ? '⚡ 渡劫飞升' : '🌀 破境晋升';
    const trib = major ? `<div class="cd-text" style="color:var(--jade);margin-top:8px">渡劫成功率 ${Math.round(Game.tribChance() * 100)}%${s.pills.bijie > 0 ? '（避劫丹·必成）' : ''}</div>` : '';
    view.innerHTML = `
      <div class="cultivate-stage">
        <div class="avatar-glow"><div class="avatar">${REALM_AVATAR[s.realmIndex] || '🧘'}</div></div>
        <div class="buff-line" id="buff-line">${buildBuffLine()}</div>
        <button class="btn" id="btn-cultivate">🧘 运转周天（手动修炼）</button>
        <button class="btn btn-break" id="btn-break">${breakTxt}</button>
        ${trib}
        <div class="hint">
          修为攒满即可<b>破境</b>；跨大境界需<b>渡劫飞升</b>，有成功率与风险。<br/>
          功法/洞府/灵宠永久加成，丹药限时暴涨，秘境/悟道拓展道途，飞升转世得仙缘。
        </div>
      </div>`;
    $('#btn-cultivate').addEventListener('click', (e) => {
      const r = Game.clickCultivate();
      const rect = e.currentTarget.getBoundingClientRect();
      const x = rect.left + rect.width / 2, y = rect.top - 8;
      if (r.crit) {
        FX.floatText('暴击! +' + Game.formatNum(r.gain), { x, y, kind: 'crit', size: 26 });
        FX.burst(x, y, '#ff7a7a', 14); FX.shake(1.5);
      } else {
        FX.floatText('+' + Game.formatNum(r.gain) + ' 修为', { x, y, kind: 'good' });
      }
      updateComboMeter(r);
    });
    $('#btn-break').addEventListener('click', () => { if (Game.canBreak()) Game.doBreak(); });
  }

  /* ---------------- 功法 / 洞府 / 丹药 ---------------- */
  function renderTechniques() {
    const s = Game.state;
    const cards = Game.TECHNIQUES.map(t => {
      const lv = s.techniques[t.id] || 0, maxed = lv >= t.max, price = Game.techniquePrice(t.id), afford = s.stone >= price && !maxed;
      const bonus = lv > 0
        ? (t.flat ? `当前 +${(t.flat * lv).toFixed(1)} 修为/秒（固定值）` : `当前 ×${(1 + t.ratio * lv).toFixed(2)}（比例）`)
        : '尚未修习';
      const btn = maxed ? `<button class="buy-btn maxed" disabled>圆满</button>`
        : `<button class="buy-btn" data-buy="technique" data-id="${t.id}" ${afford ? '' : 'disabled'}>修习<div class="price">${Game.formatNum(price)} 💎</div></button>`;
      return `<div class="card"><div class="icon">${t.icon}</div><div class="body"><div class="name">${t.name} <span class="lv">${lv}/${t.max} 层</span></div><div class="desc">${t.desc}</div><div class="sub">${bonus}</div></div>${btn}</div>`;
    }).join('');
    view.innerHTML = `<div class="section-title">📜 功法 <small>消耗灵石提升修炼速度（所有功法加固定值，不享受境界缩放）</small></div><div class="list">${cards}</div>`;
    bindBuy('technique');
  }
  function renderAbodes() {
    const s = Game.state;
    const cards = Game.ABODES.map(a => {
      const lv = s.abodes[a.id] || 0, maxed = lv >= a.max, price = Game.abodePrice(a.id), afford = s.stone >= price && !maxed;
      const bonus = lv > 0
        ? (a.flat ? `灵气浓度 +${(a.flat * lv).toFixed(1)}/秒（固定值）` : `灵气浓度 ×${(1 + a.ratio * lv).toFixed(2)}（比例）`)
        : '未开拓';
      const btn = maxed ? `<button class="buy-btn maxed" disabled>圆满</button>`
        : `<button class="buy-btn" data-buy="abode" data-id="${a.id}" ${afford ? '' : 'disabled'}>拓建<div class="price">${Game.formatNum(price)} 💎</div></button>`;
      return `<div class="card"><div class="icon">${a.icon}</div><div class="body"><div class="name">${a.name} <span class="lv">${lv}/${a.max} 重</span></div><div class="desc">${a.desc}</div><div class="sub">${bonus}</div></div>${btn}</div>`;
    }).join('');
    view.innerHTML = `<div class="section-title">⛰️ 洞府 <small>提升灵气浓度（所有洞府加固定值，不享受境界缩放）</small></div><div class="list">${cards}</div>`;
    bindBuy('abode');
  }
  function renderPills() {
    const s = Game.state;
    const cards = Game.PILLS.map(p => {
      const left = s.pills[p.id] || 0, afford = s.stone >= p.baseStone;
      const status = left > 0 ? `<div class="sub">生效中 · 剩余 ${Game.formatTime(left)}</div>` : '';
      const btn = `<button class="buy-btn" data-buy="pill" data-id="${p.id}" ${afford ? '' : 'disabled'}>服用<div class="price">${Game.formatNum(p.baseStone)} 💎</div></button>`;
      return `<div class="card"><div class="icon">${p.icon}</div><div class="body"><div class="name">${p.name}</div><div class="desc">${p.desc}</div>${status}</div>${btn}</div>`;
    }).join('');
    view.innerHTML = `<div class="section-title">💊 丹药 <small>服下后限时暴涨修炼速度</small></div><div class="list">${cards}</div>`;
    bindBuy('pill');
  }

  /* ---------------- 灵宠 ---------------- */
  function renderPet() {
    const s = Game.state;
    const seek = Game.seekCost();
    const seekAfford = s.stone >= seek;
    const seekBtn = `<button class="btn" id="btn-seek" ${seekAfford ? '' : 'disabled'}>🐾 寻妖（${Game.formatNum(seek)} 💎）</button>`;
    // 计算獬豸对灵气/秒的实际贡献（用于卡片展示）
    let xiezhiSpeedStr = '';
    try {
      const sb = Game.speedBreakdown();
      if (sb.paBonus > 0) {
        const xiezhiContrib = sb.afterGlobal - (sb.afterGlobal / (1 + sb.paBonus));
        xiezhiSpeedStr = ` → 灵气速度 +${xiezhiContrib.toFixed(2)}/秒`;
      }
    } catch(e) {}
    const cards = Game.PETS.map(p => {
      const lv = s.pets[p.id] || 0;
      const perLv = p.produce.base * lv;          // 该灵宠本等级基础产率
      const perSec = perLv * Game.legacyMult() * (1 + Game.petAllBonus()); // 计入仙缘 / 全资源加成后的真实每秒产出
      const out = (p.produce.type === 'all')
        ? `全资源加成 +${Math.round(perLv * 100)}%${xiezhiSpeedStr}`
        : `产出 ${fmtAmt(perSec)} ${typeUnit(p.produce.type)}/秒`;
      const feed = Game.feedCost(p.id), fAfford = lv > 0 && s.materials >= feed;
      const fbtn = lv <= 0 ? `<span class="sub">尚未收服</span>`
        : `<button class="buy-btn" data-feed="${p.id}" ${fAfford ? '' : 'disabled'}>喂养<div class="price">${feed} 🌿</div></button>`;
      return `<div class="card"><div class="icon">${p.icon}</div><div class="body"><div class="name">${p.name} <span class="lv">${lv} 级</span></div><div class="desc">${p.desc}</div><div class="sub">${out}</div></div>${fbtn}</div>`;
    }).join('');
    view.innerHTML = `
      <div class="section-title">🐾 灵宠 <small>寻妖收服，喂养升级，自动产出</small></div>
      <div class="res-bar"><div class="res-chip mat"><div class="l">天材地宝</div><div class="v">🌿 ${Game.formatNum(s.materials)}</div></div></div>
      <div class="hint">🌿 <b>天材地宝</b>：喂养灵宠、强化法宝的核心素材。寻妖（重复收服赠予）、秘境、奇遇、战斗、熔炼盈余法宝皆可得。</div>
      ${seekBtn}
      <div class="list" style="margin-top:12px">${cards}</div>`;
    $('#btn-seek').addEventListener('click', () => { if (Game.seekPet()) renderCurrent(); else toast('灵石不足'); });
    view.querySelectorAll('[data-feed]').forEach(b => b.addEventListener('click', () => { if (Game.feedPet(b.dataset.feed)) renderCurrent(); else toast('天材地宝不足'); }));
  }
  function typeUnit(t) { return t === 'xp' ? '修为' : t === 'stone' ? '灵石' : '🌿'; }
  // 小数安全的数值格式：小于 1 时保留两位小数（避免 formatNum 直接取整为 0）
  function fmtAmt(v) { return v < 1 ? (+v).toFixed(2) : Game.formatNum(v); }

  /* ---------------- 战斗 / 法宝 辅助 ---------------- */
  function qName(q) { const Q = Game.QUALITY.find(x => x.id === q); return Q ? Q.name : ''; }
  function qColor(q) { const Q = Game.QUALITY.find(x => x.id === q); return Q ? Q.color : '#fff'; }
  function slotName(slot) { return slot === 'weapon' ? '攻伐' : slot === 'armor' ? '守护' : '辅助'; }
  function attrText(a) {
    const m = { atk: '攻', def: '防', hp: '气血', hit: '命中', dodge: '闪避', crit: '暴击' };
    const parts = [];
    for (const k in a) {
      if (k === 'hit' || k === 'dodge' || k === 'crit') parts.push(`${m[k]}+${Math.round(a[k] * 100)}%`);
      else parts.push(`${m[k]}+${Math.round(a[k])}`);
    }
    return parts.join(' · ');
  }
  function isMapUnlocked(mapId) {
    const mi = Game.MAPS.findIndex(m => m.id === mapId);
    if (mi === 0) return true;
    const prev = Game.MAPS[mi - 1];
    const pc = Game.state.mapProgress[prev.id];
    return pc !== undefined && pc >= prev.levels.length - 1;
  }

  /* ---------------- 秘境（爽文故事「凡人逆天录」） ---------------- */
  let _selectedRisk = 1; // 0=低,1=中,2=高,3=极限
  let _selectedChoice = 1; // 0~2 对应策略
  function renderSecret() {
    const s = Game.state;
    const cd = !Game.canExplore();
    const cdText = cd ? `<div class="cd-text">秘境冷却中……</div>` : '';
    const selectedRisk = _selectedRisk;
    const selectedChoice = _selectedChoice;

    // 找出当前可探索的章节（境界达标 + 故事未完成）
    const unlocked = Game.SECRET_REALMS.filter(r => s.realmIndex >= r.realmReq);
    const currentChapter = unlocked[unlocked.length - 1]; // 最新的可解锁章节
    // 找出正在读的章节（故事未读完的当前章节）
    const activeChapter = Game.SECRET_REALMS.find(r => {
      const prog = s.storyProgress[r.id] || 0;
      return r.realmReq <= s.realmIndex && prog < r.storyChapters.length;
    });
    const chapter = activeChapter || currentChapter || Game.SECRET_REALMS[0];
    const prog = s.storyProgress[chapter?.id] || 0;
    const storyDone = chapter && prog >= chapter.storyChapters.length;

    // 收益预览
    const riskLabels = ['低·10%', '中·100%', '高·200%', '极限·300%'];
    const baseLoss = chapter ? (chapter.riskRange[0] + (selectedRisk/3)*(chapter.riskRange[1]-chapter.riskRange[0])) : 0.1;
    const riskMult = 1 + baseLoss;
    const rMultStr = riskMult.toFixed(1) + '×';

    // 风险选项按钮
    const riskBtns = [0,1,2,3].map(i => {
      const mult = (1 + (chapter ? (chapter.riskRange[0] + (i/3)*(chapter.riskRange[1]-chapter.riskRange[0])) : 0.1)).toFixed(1);
      const sel = i === selectedRisk ? 'sel' : '';
      return `<button class="risk-btn ${sel}" data-risk="${i}">${riskLabels[i]}<span class="mult">×${mult}</span></button>`;
    }).join('');

    // 策略选择
    let choiceHtml = '';
    if (chapter && chapter.choices) {
      const choiceBtns = chapter.choices.map((c, i) => {
        const sel = i === selectedChoice ? 'sel' : '';
        const cr = (1 + baseLoss) * c.rewardMult;
        return `<button class="choice-btn ${sel}" data-choice="${i}">
          <span class="cb-label">${c.text}</span>
          <span class="cb-desc">${c.desc}</span>
          <span class="cb-mult">×${cr.toFixed(1)}</span>
        </button>`;
      }).join('');
      choiceHtml = `
        <div class="choice-selector">
          <div class="choice-label">🎯 探索策略</div>
          <div class="choice-btns">${choiceBtns}</div>
        </div>
      `;
    }

    let storyHtml = '';
    if (chapter) {
      // 故事标题 + 正文
      const storyProgHtml = chapter.storyChapters.map((text, i) => {
        const read = i < prog ? 'read' : '';
        const cur = i === prog ? ' current' : '';
        return `<div class="story-line ${read}${cur}"><span class="idx">${i+1}</span><span>${text}</span></div>`;
      }).join('');
      storyHtml = `
        <div class="story-card">
          <div class="story-title">${chapter.storyTitle}</div>
          <div class="story-text">${chapter.storyText}</div>
          <div class="story-progress">${storyProgHtml}</div>
          ${storyDone ? `<div class="story-done">✅ 故事已读完，可继续探索获取资源</div>` : `<div class="story-hint">📖 探索成功可推进故事（${prog}/${chapter.storyChapters.length}）</div>`}
        </div>
      `;
    }

    // 探索按钮
    const aff = chapter && s.stone >= chapter.cost;
    const exploreBtn = chapter
      ? `<button class="buy-btn explore-btn" data-explore="${chapter.id}" ${aff && !cd ? '' : 'disabled'}>
          探索「${chapter.name}」
          <div class="price">${Game.formatNum(chapter.cost)} 💎 ×${rMultStr}</div>
        </button>`
      : '';

    // 章节一览
    const chapterListHtml = Game.SECRET_REALMS.map(r => {
      const unlockedNow = s.realmIndex >= r.realmReq;
      const chapProg = s.storyProgress[r.id] || 0;
      const done = chapProg >= (r.storyChapters.length);
      const status = unlockedNow ? (done ? '✅' : `📖${chapProg}/${r.storyChapters.length}`) : `🔒 ${Game.REALMS[r.realmReq].name}解锁`;
      return `<div class="chap-item ${unlockedNow ? 'unlocked' : 'locked'}"><span class="chap-icon">${r.icon}</span><span class="chap-name">${r.name}</span><span class="chap-status">${status}</span></div>`;
    }).join('');

    view.innerHTML = `
      <div class="section-title">🗺️ 秘境历练 <small>爽文故事「凡人逆天录」·选择策略与风险</small></div>
      ${cdText}
      ${storyHtml}
      ${choiceHtml}
      <div class="risk-selector">
        <div class="risk-label">⚡ 风险强度（倍率 ×${rMultStr}）</div>
        <div class="risk-btns">${riskBtns}</div>
      </div>
      <div class="explore-area">${exploreBtn}</div>
      <div class="sep"></div>
      <div class="chapter-list">
        <div class="list-title">📚 故事篇章</div>
        ${chapterListHtml}
      </div>
    `;

    // 绑定事件
    view.querySelectorAll('[data-risk]').forEach(b => b.addEventListener('click', () => {
      _selectedRisk = parseInt(b.dataset.risk);
      renderCurrent();
    }));
    view.querySelectorAll('[data-choice]').forEach(b => b.addEventListener('click', () => {
      _selectedChoice = parseInt(b.dataset.choice);
      renderCurrent();
    }));
    view.querySelectorAll('[data-explore]').forEach(b => b.addEventListener('click', () => {
      const ok = Game.explore(b.dataset.explore, _selectedRisk, _selectedChoice);
      if (ok) renderCurrent(); else toast('灵石不足或冷却中');
    }));
  }

  /* ---------------- 悟道 ---------------- */
  function renderInsight() {
    const s = Game.state;
    const sb = Game.speedBreakdown();
    const daoEffect = sb.afterInsight - sb.afterRoot; // 悟道·大道对灵气/秒的贡献
    const cards = Game.INSIGHTS.map(i => {
      const lv = s.insightLv[i.id] || 0, maxed = lv >= i.max, price = Game.insightPrice(i.id), afford = s.insight >= price && !maxed;
      let effectText = '';
      if (lv > 0 && i.id === 'dao') effectText = ` → 灵气/秒 +${daoEffect.toFixed(2)}`;
      else if (lv > 0 && i.id === 'jie') effectText = ` → 渡劫成功率 +${lv * 4}%`;
      else if (lv > 0 && i.id === 'cai') {
        // 估算灵石贡献: corePart*stoneRatio * (当前cai加成 vs 无cai)
        const caiBonus = 1 + lv * i.mult;
        const caiContrib = sb.afterGlobal * CONFIG.stoneRatio * (caiBonus - 1);
        effectText = ` → 灵石/秒 ≈ +${caiContrib.toFixed(2)}`;
      }
      const bonus = lv > 0 ? `当前 +${Math.round(i.mult * lv * 100)}%${effectText}` : '未参悟';
      const btn = maxed ? `<button class="buy-btn maxed" disabled>圆满</button>`
        : `<button class="buy-btn" data-insight="${i.id}" ${afford ? '' : 'disabled'}>参悟<div class="price">${price} 📿</div></button>`;
      return `<div class="card"><div class="icon">${i.icon}</div><div class="body"><div class="name">${i.name} <span class="lv">${lv}/${i.max} 重</span></div><div class="desc">${i.desc}</div><div class="sub">${bonus}</div></div>${btn}</div>`;
    }).join('');
    view.innerHTML = `
      <div class="section-title">📿 悟道 <small>以悟性点参悟，永久提升</small></div>
      <div class="res-bar"><div class="res-chip insight"><div class="l">悟性点</div><div class="v">📿 ${Game.formatNum(s.insight)}</div></div></div>
      <div class="list">${cards}</div>`;
    view.querySelectorAll('[data-insight]').forEach(b => b.addEventListener('click', () => { if (Game.comprehend(b.dataset.insight)) renderCurrent(); else toast('悟性点不足'); }));
  }

  /* ---------------- 飞升转生 ---------------- */
  function renderFly() {
    const s = Game.state;
    const can = Game.canReincarnate();
    const gain = Game.legacyGain();
    const hero = can
      ? `<div class="fly-hero"><div class="big">🔁 可飞升转世</div><div class="sub">飞升后将重置修为/境界/功法/洞府/灵宠，<br/>但<b>灵根·悟道·仙缘</b>永久保留。<br/>本次可得仙缘 <b>+${gain}</b>（全局效率 +${Math.round(gain * CONFIG.legacyPerPoint * 100)}%）。<br/>已飞升 ${s.reincarnations} 次。</div>
         <button class="btn btn-fly ready" id="btn-fly">飞升转世</button></div>`
      : `<div class="fly-hero"><div class="big">🔒 尚未圆满</div><div class="sub">需先证得<b>真仙</b>（当前 ${Game.REALMS[s.realmIndex].name}）。<br/>飞升后可携仙缘重入轮回，愈发强盛。</div></div>`;
    view.innerHTML = `
      <div class="res-bar">
        <div class="res-chip legacy"><div class="l">仙缘</div><div class="v">🔁 ${Game.formatNum(s.legacy)}</div></div>
        <div class="res-chip legacy"><div class="l">全局加成</div><div class="v">+${Math.round(s.legacy * CONFIG.legacyPerPoint * 100)}%</div></div>
      </div>
      ${hero}`;
    const bf = $('#btn-fly');
    if (bf) bf.addEventListener('click', () => { if (Game.reincarnate()) renderCurrent(); });
  }

  /* ---------------- 仙缘殿·永久道韵 ---------------- */
  function renderBless() {
    const s = Game.state;
    const jade = s.jade || 0;
    const cards = Game.BLESSINGS.map(b => {
      const lv = (s.blessings && s.blessings[b.id]) || 0;
      const maxed = lv >= b.max;
      const cost = Game.blessCost(b.id);
      const afford = jade >= cost;
      const effNow = (b.effect * lv * 100).toFixed(0);
      const effNext = (b.effect * (lv + 1) * 100).toFixed(0);
      return `<div class="card bless-card">
        <div class="icon">${b.icon}</div>
        <div class="body">
          <div class="name">${b.name} <span class="lv">${'●'.repeat(lv)}${'○'.repeat(b.max - lv)}</span></div>
          <div class="desc">${b.desc}</div>
          <div class="sub">当前 +${effNow}% ${lv < b.max ? '→ 下重 +' + effNext + '%' : '（已圆满）'}</div>
        </div>
        <button class="buy-btn" data-bless="${b.id}" ${maxed || !afford ? 'disabled' : ''}>${maxed ? '圆满' : '修习<div class="price">' + Game.formatNum(cost) + ' 🔮</div>'}</button>
      </div>`;
    }).join('');
    view.innerHTML = `
      <div class="res-bar">
        <div class="res-chip jade"><div class="l">仙玉</div><div class="v">🔮 ${Game.formatNum(jade)}</div></div>
        <div class="res-chip legacy"><div class="l">仙缘</div><div class="v">🔁 ${Game.formatNum(s.legacy)}</div></div>
      </div>
      <div class="section-title">🔮 仙缘殿 <small>消耗仙玉修习永久道韵，跨轮回永驻</small></div>
      <div class="hint">仙玉于每次飞升转世时与仙缘同额赠予；道韵加持永不随轮回消散，越往后收益越厚。</div>
      <div class="list">${cards}</div>`;
    view.querySelectorAll('[data-bless]').forEach(b => b.addEventListener('click', () => {
      if (Game.buyBlessing(b.dataset.bless)) renderBless();
      else toast('仙玉不足');
    }));
  }

  /* ---------------- 奇遇 / 成就 / 设置 ---------------- */
  function renderEvents() {
    const s = Game.state;
    if (!s.log.length) { view.innerHTML = `<div class="section-title">📖 奇遇</div><div class="empty">尚无功法缘法，静待机缘……</div>`; return; }
    const items = s.log.map(l => `<div class="log-item"><div class="icon">${l.icon || '📜'}</div><div><div>${l.text}</div><div class="time">${relTime(l.t)}</div></div></div>`).join('');
    view.innerHTML = `<div class="section-title">📖 修行情缘 <small>历练中偶遇的机缘</small></div><div class="list">${items}</div>`;
  }
  function renderAchievements() {
    const s = Game.state;
    const cards = Game.ACHIEVEMENTS.map(a => {
      const unlocked = !!s.achievements[a.id];
      return `<div class="card achv-card ${unlocked ? 'unlocked' : ''}"><div class="icon">${unlocked ? a.icon : '🔒'}</div><div class="body"><div class="name">${a.name}</div><div class="desc">${a.desc}</div><div class="sub">${unlocked ? '已达成' : '未达成'}</div></div></div>`;
    }).join('');
    const got = Object.keys(s.achievements).length;
    view.innerHTML = `<div class="section-title">🏆 成就 <small>${got}/${Game.ACHIEVEMENTS.length} 已解锁</small></div><div class="list">${cards}</div>`;
  }
  function renderSettings() {
    const s = Game.state;
    const playSec = (Date.now() - s.startTime) / 1000;
    view.innerHTML = `
      <div class="section-title">⚙️ 设置</div>
      <div class="setting-block"><h3>道号</h3><div class="field"><input id="dao-input" maxlength="12" value="${s.daoName}" /><button class="btn-sm" id="dao-save">保存</button></div></div>
      <div class="setting-block"><h3>道途纪要</h3><div class="stat-grid">
        <div class="cell"><b>${Game.formatNum(s.totalXp)}</b><span>累计修为</span></div>
        <div class="cell"><b>${s.breaks}</b><span>破境次数</span></div>
        <div class="cell"><b>${Game.formatTime(playSec)}</b><span>修行时长</span></div>
        <div class="cell"><b>${s.reincarnations}</b><span>飞升次数</span></div>
        <div class="cell"><b>${Game.formatNum(Game.combatStats().power)}</b><span>战力</span></div>
        <div class="cell"><b>${s.bossKills}</b><span>伏魔数</span></div>
        <div class="cell"><b>${Game.formatNum(s.legacy)}</b><span>仙缘</span></div>
        <div class="cell"><b>${Game.formatNum(s.insight)}</b><span>悟性点</span></div>
      </div></div>
      <div class="setting-block"><h3>存档</h3><div class="field" style="margin-bottom:10px"><button class="btn-sm" id="manual-save" style="flex:1;padding:10px">立即存档</button></div>
        <div class="hint" style="text-align:left">游戏自动存档于本地浏览器，关闭网页亦不丢失；离线期间仍以半数效率修行（封顶 ${CONFIG.offlineCapHours} 时辰）。</div></div>
      <div class="setting-block"><h3>战斗音效</h3>
        <div class="field"><label style="display:flex;align-items:center;gap:8px;cursor:pointer">
          <input type="checkbox" id="sfx-tgl" ${s.sfx?'checked':''} onchange="Game.state.sfx=this.checked;Game.save();SFX.setEnabled(this.checked)"/>
          <span>启用回合制战斗音效（Web Audio 合成，无音频文件）</span>
        </label></div></div>
      <div class="setting-block"><h3>重入轮回</h3><button class="btn-danger" id="btn-reset">抹去此世修行记录</button>
        <div class="hint" style="text-align:left;margin-top:8px">此举将清空全部进度，且不可恢复。</div></div>`;
    $('#dao-save').addEventListener('click', () => { Game.setDaoName($('#dao-input').value); toast('道号已更易', true); });
    $('#manual-save').addEventListener('click', () => { Game.save(); toast('已存档'); });
    $('#btn-reset').addEventListener('click', () => {
      const m = modal(`<h2>⚠ 重入轮回</h2><p>此操作将抹去全部道途，确定否？</p>
        <button class="btn btn-danger" id="confirm-reset" style="margin-top:8px">斩断因果</button>
        <button class="btn" id="cancel-reset" style="margin-top:10px;background:rgba(120,140,190,0.2);color:#fff;box-shadow:none">再思量</button>`, 'tribulation');
      $('#confirm-reset').addEventListener('click', () => { Game.reset(); closeModal(m); switchTab('cultivate'); toast('道途重启'); });
      $('#cancel-reset').addEventListener('click', () => closeModal(m));
    });
  }

  /* ---------------- 战斗（历练） ---------------- */
  function renderBattle() {
    const s = Game.state;
    // 首次进入（或没手动选过）时跳到最后通关的关卡
    if (!s._battleUserSelected) autoSelectLastCleared();
    const st = Game.combatStats();
    const cd = !Game.canBattle();
    const maps = Game.MAPS;
    const mapTabs = maps.map(m => {
      const unlocked = isMapUnlocked(m.id);
      const cleared = s.mapProgress[m.id] !== undefined && s.mapProgress[m.id] >= m.levels.length - 1;
      return `<button class="map-tab ${battleMode === 'map' && m.id === currentMap ? 'active' : ''} ${unlocked ? '' : 'locked'}" data-map="${m.id}" ${unlocked ? '' : 'disabled'}>${unlocked ? m.icon : '🔒'} ${m.name}${cleared ? ' ✓' : ''}</button>`;
    }).join('');
    const towerTab = `<button class="map-tab ${battleMode === 'tower' ? 'active' : ''}" data-mode="tower">🗼 无尽塔</button>`;
    const cdText = cd ? `<div class="cd-text">⏳ 调息中… 还需 ${Game.battleCooldownLeft()} 秒</div>` : '';
    let body = '';
    if (battleMode === 'tower') {
      const next = s.towerFloor + 1;
      const d = (CONFIG.combat.towerBase + next * CONFIG.combat.towerStep).toFixed(2);
      const preview = Game.towerEnemy(next);
      const xp = Math.floor((Game.currentSpeed ? Game.currentSpeed() : 0) * (preview.boss ? 24 : 8) * (CONFIG.combat.towerBase + next * CONFIG.combat.towerStep));
      const ep = Math.floor(preview.atk * 2 + preview.def * 1.5 + preview.hp * 0.25);
      const diff = difficultyRating(preview, st.power);
      body = `
        <div class="tower-view">
          <div class="tower-info">位阶 <b class="tower-title">${Game.towerTitle().icon} ${Game.towerTitle().title}</b> · 当前最高层 <b>${s.towerFloor}</b> · 下一层 <b>${next}</b> · 难度 ×${d} · 推荐战力 <b>${Game.formatNum(ep)}</b> · 难度 <span class="${diff.cls}">${diff.text}</span></div>
          <div class="level-row">
            <div class="level-idx">🗼</div>
            <div class="level-body">
              <div class="name">${preview.icon} ${preview.name} ${preview.boss ? '<span class="boss-tag">BOSS</span>' : ''}</div>
              <div class="enemy-stats">攻${Game.formatNum(preview.atk)} 防${Game.formatNum(preview.def)} 气血${Game.formatNum(preview.hp)} 命中${Math.round(preview.hit * 100)}% 闪避${Math.round(preview.dodge * 100)}% 暴击${Math.round(preview.crit * 100)}%</div>
              <div class="reward-line">奖励 灵石${Game.formatNum(preview.reward.stone[0])}~${Game.formatNum(preview.reward.stone[1])} · 🌿${preview.reward.mat[0]}~${preview.reward.mat[1]} · 修为 ≈ ${Game.formatNum(xp)} · 法宝${Math.round(preview.drop.chance * 100)}% 武学≈10% 招式≈8%</div>
            </div>
            <button class="buy-btn fight-btn" data-tower="${next}" ${cd ? 'disabled' : ''}>挑战</button>
          </div>
        </div>`;
    } else {
      const map = maps.find(m => m.id === currentMap);
      const levels = map.levels.map((lv, i) => {
        const unlocked = Game.isLevelUnlocked(map.id, i);
        const cleared = s.mapProgress[map.id] !== undefined && s.mapProgress[map.id] >= i;
        const isCurrent = i === currentLevel;
        const lockText = (map.realmReq !== undefined && s.realmIndex < map.realmReq) ? '需' + Game.REALMS[map.realmReq].name : '🔒 未解锁';
        const btn = unlocked
          ? `<button class="buy-btn fight-btn" data-fight="${map.id}:${i}" ${cd ? 'disabled' : ''}>${cleared ? '再战' : '挑战'}</button>`
          : `<button class="buy-btn" disabled>${lockText}</button>`;
        const ep = Math.floor(lv.atk * 2 + lv.def * 1.5 + lv.hp * 0.25);
        const diff = difficultyRating(lv, st.power);
        // 敌人装备武学预览
        const eDeck = (Game.genEnemyDeck ? Game.genEnemyDeck(lv) : []).map(id => Game.MARTIAL_ARTS.find(m => m.id === id)).filter(Boolean);
        const eGradeColors = { '根基': '#9fb0c0', '进阶': '#6fb1ff', '绝学': '#ffd76f', '稀有': '#c79fff', '绝世': '#ff6b6b' };
        const eDeckHtml = eDeck.length ? eDeck.map(m => `<span class="e-ma-chip" style="border-color:${eGradeColors[m.grade]||'var(--border)'}">${m.icon}<span>${m.name}</span></span>`).join('') : '<span style="color:var(--text-dim)">无</span>';
        return `<div class="level-row ${cleared ? 'cleared' : ''} ${unlocked ? '' : 'locked'} ${isCurrent ? 'current' : ''}">
          <div class="level-idx">${i + 1}</div>
          <div class="level-body">
            <div class="name">${lv.icon} ${lv.name} ${lv.boss ? '<span class="boss-tag">BOSS</span>' : ''} ${cleared ? '<span class="cleared-tag">已通关</span>' : ''} <span class="${diff.cls}" title="推荐战力 ${Game.formatNum(ep)} / 你的战力 ${Game.formatNum(st.power)}">难度 ${diff.text}</span></div>
            <div class="enemy-stats">攻${lv.atk} 防${lv.def} 气血${lv.hp} 命中${Math.round(lv.hit * 100)}% 闪避${Math.round(lv.dodge * 100)}% 暴击${Math.round(lv.crit * 100)}% · 推荐战力 ${Game.formatNum(ep)}</div>
            <div class="e-deck-line">敌方装备：${eDeckHtml}</div>
            <div class="reward-line">奖励 灵石${Game.formatNum(lv.reward.stone[0])}~${Game.formatNum(lv.reward.stone[1])} · 🌿${lv.reward.mat[0]}~${lv.reward.mat[1]} · 修为 ≈ ${Game.formatNum(Math.floor((Game.currentSpeed ? Game.currentSpeed() : 0) * (lv.boss ? 18 : 6)))}${lv.drop && lv.drop.chance ? ` · 法宝${Math.round(lv.drop.chance * 100)}%` : ''} · 武学≈10% 招式≈8%</div>
          </div>${btn}</div>`;
      }).join('');
      body = `<div class="map-desc">${map.desc}</div>${cdText}<div class="level-path">${levels}</div>`;
    }
    view.innerHTML = `
      <div class="section-title">⚔️ 历练 · 战斗 <small>外功轮流+内功轻功每轮全触发 · 阳克阴/阴克调/调克阳</small></div>
      <div class="player-panel">
        <div class="pp-head">🧘 自身战力 <b>${Game.formatNum(st.power)}</b></div>
        <div class="pp-stats">
          <span>攻 ${st.atk}</span><span>防 ${st.def}</span><span>气血 ${st.hp}</span>
          <span>命中 ${Math.round(st.hit * 100)}%</span><span>闪避 ${Math.round(st.dodge * 100)}%</span><span>暴击 ${Math.round(st.crit * 100)}%</span>
        </div>
        <div class="pp-speed">⚡ 轻功影响武学出手频率（装备轻功每轮全触发）</div>
        <div class="hint" style="margin-top:8px">攻/防/气血/命中/闪避/暴击 受功法、洞府、丹药、悟道、灵宠、灵根、仙缘、法宝共同影响。</div>
        <details class="breakdown" style="margin-top:8px;font-size:12px;color:var(--text-dim)">
          <summary>📊 各系统战斗属性贡献详情</summary>
          <div style="padding:8px 0 4px 8px;line-height:1.7;color:var(--gold-soft)">${Game.combatFormula().map(l=>`<div>${l}</div>`).join('')}</div>
          <div style="padding:4px 0 4px 8px;line-height:1.7;border-top:1px dashed rgba(120,140,190,0.2);margin-top:6px">${Game.combatBreakdown().map(i => `<div title="${i.desc}"><span>${i.icon} ${i.name}</span><span style="float:right;color:var(--text)">${i.desc}</span></div>`).join('')}</div>
        </details>
        <details class="breakdown" style="margin-top:8px;font-size:12px;color:var(--text-dim)">
          <summary>⚡ 战斗机制</summary>
          <div style="padding:8px 0 4px 8px;line-height:1.8;color:var(--text)">
            · 每轮<b>外功</b>（御剑/刀法/拳掌/奇门）轮流行动，一轮一门<br>
            · 每轮所有<b>内功</b>和<b>轻功</b>都会触发<br>
            · 外功循环顺序：按你装备的武学排列顺序轮流<br>
            · 每门武学的所有招式（天赋+配招）逐项按<b>火率</b>判定<br>
            · 火率判定成功则发动招式，失败则该招式本回合跳过<br>
            · 内息克制（三循环）：<span style="color:#c79aff">阳→阴+15%</span> <span style="color:#7fd1c1">阴→调+15%</span> <span style="color:#ffd76f">调→阳+15%</span>
          </div>
        </details>
      </div>
      <div class="map-tabs">${mapTabs}${towerTab}</div>
      ${body}`;
    view.querySelectorAll('[data-map]').forEach(b => b.addEventListener('click', () => { if (!b.disabled) { battleMode = 'map'; currentMap = b.dataset.map; currentLevel = 0; Game.state._battleUserSelected = true; renderBattle(); } }));
    view.querySelectorAll('[data-mode="tower"]').forEach(b => b.addEventListener('click', () => { battleMode = 'tower'; Game.state._battleUserSelected = true; renderBattle(); }));
    view.querySelectorAll('[data-fight]').forEach(b => b.addEventListener('click', () => {
      const [mid, idx] = b.dataset.fight.split(':');
      currentLevel = parseInt(idx, 10);
      Game.state._battleUserSelected = true;
      const r = Game.fight(mid, currentLevel);
      if (!r) return;
      if (r.error === 'locked') { toast('关卡尚未解锁'); return; }
      if (r.error === 'cd') { toast('调息中，稍后再战'); return; }
      showCombat(r); renderBattle();
    }));
    view.querySelectorAll('[data-tower]').forEach(b => b.addEventListener('click', () => {
      Game.state._battleUserSelected = true;
      const floor = parseInt(b.dataset.tower, 10);
      const r = Game.towerFight(floor);
      if (!r) return;
      if (r.error === 'locked') { toast('塔层尚未解锁'); return; }
      if (r.error === 'cd') { toast('调息中，稍后再战'); return; }
      showCombat(r); renderBattle();
    }));
    // 滚到最后通过的关卡
    setTimeout(() => {
      const cur = view.querySelector('.level-row.current');
      if (cur) cur.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 50);
  }
  // 取玩家等级最高的功法作为「本命功法」，决定施法光环色
  const TECH_ELEMENT = { tuna: '#6fcf97', yinqi: '#56ccf2', zhoutian: '#aab7ff', wuxing: '#f2c94c', taiyi: '#f2994a', hongmeng: '#bb6bd9' };
  function topTechnique() {
    const techs = Game.state.techniques || {}; let best = null, bestLv = 0;
    Game.TECHNIQUES.forEach(t => { const lv = techs[t.id] || 0; if (lv > bestLv) { bestLv = lv; best = t; } });
    return best;
  }
  function showCombat(r) {
    var A = window.ART; if (!A) { toast('美术资源未加载'); return; }
    var lv = r.level, res = r.res;
    var pHp0 = res.player.hp, eHp0 = res.enemy.hp;
    var tech = topTechnique();
    var aura = tech ? (TECH_ELEMENT[tech.id] || '#9fd0ff') : '#9fd0ff';
    var techName = tech ? tech.icon + tech.name : '🌀 道法';
    var techEl = tech ? (A.elementOf(tech.id) || 'cycle') : 'cycle';  // 玩家本命功法对应的施法元素
    var th = A.theme(lv._mapId || currentMap);
    var pPow = res.player.power, ePow = Math.floor(lv.atk * 2 + lv.def * 1.5 + lv.hp * 0.25);
    var totalPow = Math.max(1, pPow + ePow), pPct = (pPow / totalPow * 100).toFixed(1), ePct = (ePow / totalPow * 100).toFixed(1);
    var lines = res.log.slice(0, 18).map(function(e) {
      if (e.miss) return '<div class="cl '+e.side+'">'+(e.side==='p'?'你':'敌')+' 落空/被闪避…</div>';
      var skl = (e.skill && e.skill!=='普攻' && e.skill!=='攻击') ? ' <span style="color:#c79aff">['+e.skill+']</span>' : '';
      return '<div class="cl '+e.side+'">'+(e.side==='p'?'你':'敌')+' 造成 '+e.dmg+(e.crit?' 💥暴击':'')+skl+'</div>';
    }).join('');
    var more = res.log.length>18 ? '<div class="cl">…共 '+res.log.length+' 回合</div>' : '';
    var rewardHtml = '';
    if (r.win&&r.reward) rewardHtml='<div class="reward">战利品：灵石+'+Game.formatNum(r.reward.stone)+' 🌿+'+r.reward.mat+' 修为+'+Game.formatNum(r.reward.xp)+'</div>';
    if (r.win&&r.drop) rewardHtml+='<div class="reward drop">获得法宝 '+r.drop.icon+r.drop.name+' <span style="color:'+qColor(r.drop.quality)+'">'+qName(r.drop.quality)+'</span>'+(r.drop.first?'（新）':'')+'</div>';
    if (r.win&&r.maDrop) rewardHtml+='<div class="reward drop" style="color:var(--gold-soft)">📖 获得武学 '+r.maDrop.icon+r.maDrop.name+'</div>';
    if (r.win&&r.skDrop) rewardHtml+='<div class="reward drop" style="color:var(--jade)">📜 获得招式 '+r.skDrop.name+'</div>';
    var m = modal(
      '<h2 class="'+(r.win?'win':'lose')+'">'+lv.icon+' '+(r.win?'胜！':'败')+'</h2>'+
      '<div class="battle-stage" style="--aura:'+aura+';--accent:'+th.accent+';--fig:'+th.fig+';--fig2:'+th.fig2+';--particle:'+th.particle+';--bg:'+th.bg+';--ground:'+th.ground+'">'+
        '<div class="scene-bg"></div>'+
        '<div class="vs-intro"><span>VS</span></div>'+
        '<div class="bars">'+
          '<div class="hpbar p"><div class="hp-fill p" style="width:100%"></div><span class="hp-label" data-plabel>气血 '+Game.formatNum(pHp0)+'</span></div>'+
          '<div class="hpbar e"><div class="hp-fill e" style="width:100%"></div><span class="hp-label" data-elabel>'+lv.name+' '+Game.formatNum(eHp0)+'</span></div>'+
        '</div>'+
        '<div class="powerbar"><span class="pw-p">战力 '+Game.formatNum(pPow)+'</span><div class="pw-track"><div class="pw-fill p" style="width:'+pPct+'%"></div><div class="pw-fill e" style="width:'+ePct+'%"></div></div><span class="pw-e">强度 '+Game.formatNum(ePow)+'</span></div>'+
        '<div class="arena">'+
          '<div class="fighter p">'+A.playerSVG()+'<div class="aura"></div><div class="fname">你</div></div>'+
          '<div class="fighter e'+(lv.boss?' boss':'')+'">'+A.monsterSVG(lv._mapId||currentMap,!!lv.boss)+(lv.boss?'<div class="crown-tag">👑</div>':'')+'<div class="fname">'+lv.name+'</div></div>'+
        '</div>'+
        '<div class="skill-banner">施放 · '+techName+'</div>'+
        '<div class="fx-layer"></div>'+
        '<div class="seal '+(r.win?'win':'lose')+'" style="display:none"><span>'+(r.win?'胜':'败')+'</span></div>'+
      '</div>'+
      '<div class="combat-sub">'+lv.name+' · 聚气 '+res.rounds+' 轮 · 你剩余气血 <span data-pend>'+Game.formatNum(pHp0)+'</span></div>'+
      '<div class="combat-log">'+lines+more+'</div>'+
      '<div class="combat-reward" style="display:none">'+rewardHtml+'</div>'+
      '<div style="display:flex;gap:8px;justify-content:center"><button class="btn" id="cb-report">📜 查看战报</button><button class="btn" id="cb-ok" style="display:none">收剑</button></div>', 'combat');
    $('#cb-ok').addEventListener('click',function(){
      if (r.win) { closeModal(m); setTimeout(() => showBlindBox(), 200); }
      else { closeModal(m); }
    });
    $('#cb-report').addEventListener('click', () => { closeModal(m); showBattleReport(r, lv); });
    playBattle(res,lv,m,aura,techEl);
    return m;
  }
  // 战报：显示双方准备/聚气/出手顺序/伤害公式拆解
  function showBattleReport(r, lv) {
    const rep = r.report;
    if (!rep) { toast('战报数据缺失'); return; }
    const pName = Game.state.daoName || '你';
    const eName = lv.name;
    const pStats = (r.res || r).player, eStats = (r.res || r).enemy;
    // 出手顺序时间线（分离玩家/敌方的节点）
    const pTimeline = rep.actions.filter(a => a.side === 'p').map(a =>
      `<span class="tl-node p" title="第${a.seq}手 · ${pName} · ${a.skill} · ${a.dmg}伤害">${a.seq}</span>`
    ).join('');
    const eTimeline = rep.actions.filter(a => a.side === 'e').map(a =>
      `<span class="tl-node e" title="第${a.seq}手 · ${eName} · ${a.skill} · ${a.dmg}伤害">${a.seq}</span>`
    ).join('');
    const playerActions = rep.actions.filter(a => a.side==='p');
    const enemyActions = rep.actions.filter(a => a.side==='e');
    // 每轮行动汇总（替代旧的聚气表）
    const roundSummaries = rep.rounds.map(rd => {
      const pCount = rd.pGain, eCount = rd.eGain;
      return `<tr><td>${rd.round}</td><td>${pCount}</td><td>${eCount}</td></tr>`;
    }).join('');
    // 全部出手详情（不限制16）
    const actList = rep.actions.map(a => {
      const isP = a.side==='p';
      const fired = a.fired ? '✅' : '❌';
      const affTxt = a.affMod > 1 ? ` <span style="color:#7fd1c1">【${a.pAff||'-'}克${a.eAff||'-'}+15%】</span>` : '';
      const critTxt = a.crit ? ' 💥暴击' : '';
      return `<div class="rep-act ${isP?'p':'e'}">
        <span class="rep-seq">R${a.round}·${a.seq}</span>
        <span class="rep-who">${isP?pName:eName}</span>
        <span class="rep-ma">${a.ma||''}</span>
        <span class="rep-skill">${fired} ${a.skName||''}${affTxt}${critTxt}</span>
        <span class="rep-dmg">-${a.dmg}</span>
        <span class="rep-hp">我 ${a.pHp} / 敌 ${a.eHp}</span>
      </div>`;
    }).join('');
    // 按武学装备顺序统计（玩家方）
    const deck = Array.isArray(Game.state.martialDeck) ? Game.state.martialDeck : [];
    const martialStats = {};
    playerActions.forEach(a => {
      if (a.ma && a.skName) {
        if (!martialStats[a.ma]) martialStats[a.ma] = { total: 0, fired: 0, dmg: 0, skills: {} };
        martialStats[a.ma].total++;
        if (!martialStats[a.ma].skills[a.skName]) martialStats[a.ma].skills[a.skName] = { count: 0, dmg: 0, fired: 0 };
        martialStats[a.ma].skills[a.skName].count++;
        if (a.fired) {
          martialStats[a.ma].fired++;
          martialStats[a.ma].dmg += a.dmg;
          martialStats[a.ma].skills[a.skName].fired++;
          martialStats[a.ma].skills[a.skName].dmg += a.dmg;
        }
      }
    });
    // 按装备顺序显示每个武学
    const deckMaHtml = deck.map(maId => {
      const ma = Game.MARTIAL_ARTS.find(m => m.id === maId);
      if (!ma) return '';
      const skillList = Game.martialSkillList(maId);
      const stats = martialStats[ma.name] || { total: 0, fired: 0, dmg: 0, skills: {} };
      const skillRows = skillList.map(sk => {
        const s = stats.skills[sk.name] || { count: 0, fired: 0, dmg: 0 };
        const lvDmgMult = 1 + (Game.state.martialLevels[maId] || 0) * 0.05;
        const skillLv = Game.state.skillLevels && Game.state.skillLevels[sk.id] || 0;
        const realFire = Math.round(sk.fireRate * (1 + skillLv * 0.03));
        const hitRate = s.count > 0 ? Math.round(s.fired / s.count * 100) : 0;
        const status = s.fired > 0
          ? `<span style="color:#7fd1c1">✅${s.fired}/${s.count}次 伤${s.dmg}</span>`
          : `<span style="color:var(--text-dim)">❌未触发 (0/${s.count}次)</span>`;
        return `<div class="rep-m-skill">
          <span class="rep-m-sname">${sk.innate?'⭐':'🔧'} ${sk.name}（${sk.type}）</span>
          <span class="rep-m-srate">火率${realFire}%</span>
          <span class="rep-m-sstate">${status}${hitRate>0?' ('+hitRate+'%)':''}</span>
        </div>`;
      }).join('');
      const fireRate = stats.total > 0 ? Math.round(stats.fired / stats.total * 100) : 0;
      return `<div class="rep-m-card">
        <div class="rep-m-head">
          <span class="rep-m-icon">${ma.icon}</span>
          <span class="rep-m-name">${ma.name}</span>
          <span class="rep-m-grade">${ma.grade}</span>
          <span class="rep-m-stat">被选中 ${stats.total} 次 · 触发 ${stats.fired} 次 (${fireRate}%) · 造成 ${stats.dmg} 伤害</span>
        </div>
        <div class="rep-m-skills">${skillRows || '<div class="hint">该武学本场未被选中</div>'}</div>
      </div>`;
    }).join('') || '<div class="hint">未装备武学</div>';
    // 准备阶段
    const prepHtml = `
      <div class="rep-section">
        <div class="rep-section-title">📋 准备阶段</div>
        <div class="rep-prep">
          <div class="rep-prep-side p">
            <div class="rep-prep-name">🧘 ${pName}（玩家）</div>
            <div class="rep-prep-stats">攻 ${Game.formatNum(pStats.atk)} · 防 ${Game.formatNum(pStats.def)} · 气血 ${Game.formatNum(pStats.hp)} · 命中 ${Math.round(pStats.hit*100)}% · 闪避 ${Math.round(pStats.dodge*100)}% · 暴击 ${Math.round(pStats.crit*100)}%</div>
            <div class="rep-prep-stats">⚡ 速度 ${rep.pSpeed}（基础50 + 武学${rep.pSpeed-50}）</div>
          </div>
          <div class="rep-prep-side e">
            <div class="rep-prep-name">${lv.icon} ${eName}（${lv.boss?'BOSS':'敌方'}）</div>
            <div class="rep-prep-stats">攻 ${eStats.atk} · 防 ${eStats.def} · 气血 ${Game.formatNum(eStats.hp)} · 命中 ${Math.round(eStats.hit*100)}% · 闪避 ${Math.round(eStats.dodge*100)}% · 暴击 ${Math.round(eStats.crit*100)}%</div>
            <div class="rep-prep-stats">⚡ 速度 ${rep.eSpeed}（基础30 + 境界${rep.eSpeed-30}）</div>
          </div>
        </div>
      </div>
    `;
    // ATB 聚气过程表
    const qiRows = rep.rounds.slice(0, 10).map(r => {
      const pAct = r.pAct ? "\u2694" : "";
      const eAct = r.eAct ? "\u2694" : "";
      return "<tr><td>"+r.round+"</td><td>"+r.pGain+"</td><td>"+r.pQi+"</td><td>"+pAct+"</td><td>"+r.eGain+"</td><td>"+r.eQi+"</td><td>"+eAct+"</td></tr>";
    }).join("");
    const qiHtml = `
      <div class="rep-section">
        <div class="rep-section-title">\u26a1 ATB\u805a\u6c14</div>
        <div class="rep-hint">每轮聚气 qi += 34 + 0.05\u00d7(速度-平均速度) | qi\u2265100 行动\u2192归零 | 速度快先出手</div>
        <div class="rep-qi-table-wrap"><table class="rep-qi-table">
          <thead><tr><th>轮</th><th>我方+</th><th>累计</th><th></th><th>敌方+</th><th>累计</th><th></th></tr></thead>
          <tbody>${qiRows}
            ${rep.rounds.length > 10 ? `<tr><td colspan="7" style="color:var(--text-dim)">还有${rep.rounds.length-10}轮\u2026</td></tr>` : ""}
          </tbody>
        </table></div>
      </div>`
    // 出手顺序时间线
    const timelineHtml = `
      <div class="rep-section">
        <div class="rep-section-title">🕐 出手顺序（${rep.actions.length}次行动）</div>
        <div class="rep-timeline">
          <div class="rep-timeline-row p">
            <span class="rep-tl-label">${pName}</span>
            <span class="rep-tl-nodes">${pTimeline}</span>
          </div>
          <div class="rep-timeline-row e">
            <span class="rep-tl-label">${eName}</span>
            <span class="rep-tl-nodes">${eTimeline}</span>
          </div>
        </div>
      </div>
    `;
    // 按武学分组统计（按装备顺序）
    const deckSection = `
      <div class="rep-section">
        <div class="rep-section-title">📚 按武学统计（装备顺序）</div>
        <div class="rep-m-list">${deckMaHtml}</div>
      </div>
    `;
    // 全部出手详情（滚动列表）
    // 按回合筛选按钮 + 全部行动详情
    const allRounds = [...new Set(rep.actions.map(a => a.round))].sort((a,b) => a-b);
    const roundBtns = `<button class="bb-btn-cancel rep-round-btn sel" data-round="all">全部(${rep.actions.length})</button>` + allRounds.map(r => {
      const count = rep.actions.filter(a => a.round === r).length;
      return `<button class="bb-btn-cancel rep-round-btn" data-round="${r}">R${r}(${count})</button>`;
    }).join('');
    const actHtml = `
      <div class="rep-section">
        <div class="rep-section-title">⚔ 出手详情（点击回合筛选）</div>
        <div class="rep-round-bar">${roundBtns}</div>
        <div class="rep-act-list" id="rep-act-list">${actList}</div>
      </div>
    `;
    // 伤害公式说明
    const dmgFormulaHtml = `
      <div class="rep-section">
        <div class="rep-section-title">📐 伤害公式</div>
        <div class="rep-formula">base = atk²÷(atk+5×def)，dmg = base×(dmgRate%×克制) + dmgFlat，×浮动(±15%)，×暴击(×${(CONFIG.combat.critMult).toFixed(1)})</div>
      </div>
    `;
    // 内息克制说明
    const affHtml = `
      <div class="rep-section">
        <div class="rep-section-title">🌀 内息克制（三循环）</div>
        <div class="rep-aff-text"><span style="color:#c79aff">阳→阴</span> <span style="color:#7fd1c1">阴→调</span> <span style="color:#ffd76f">调→阳</span> 各 +15% · 反之被克制方 -15%</div>
        <div class="rep-aff-text">玩家装备武学的内息偏向 = ${getPlayerAff() || '调'} · 每次攻击自动判定克制关系</div>
      </div>
    `;
    // 汇总统计
    const pSkillHits = playerActions.filter(a => a.fired).length;
    const pCrits = playerActions.filter(a => a.crit).length;
    const eSkillHits = enemyActions.filter(a => a.fired).length;
    const eCrits = enemyActions.filter(a => a.crit).length;
    const pTotalDmg = playerActions.reduce((s,a) => s + a.dmg, 0);
    const eTotalDmg = enemyActions.reduce((s,a) => s + a.dmg, 0);
    const summaryHtml = `
      <div class="rep-section">
        <div class="rep-section-title">📊 战斗汇总</div>
        <div class="rep-summary">
          <div>我方出手 <b>${playerActions.length}</b> 次 · 触发招式 <b style="color:#7fd1c1">${pSkillHits}</b> 次 · 暴击 <b style="color:#ff7a7a">${pCrits}</b> 次 · 总伤 <b>${pTotalDmg}</b></div>
          <div>敌方出手 <b>${enemyActions.length}</b> 次 · 触发招式 <b style="color:#7fd1c1">${eSkillHits}</b> 次 · 暴击 <b style="color:#ff7a7a">${eCrits}</b> 次 · 总伤 <b>${eTotalDmg}</b></div>
          <div>总回合 <b>${r.rounds}</b> · 总行动 <b>${rep.actions.length}</b></div>
        </div>
      </div>
    `;
    const fullHtml = `
      <div class="battle-report">
        <div class="rep-header">📜 战报 · ${pName} vs ${eName}</div>
        ${prepHtml}
        ${qiHtml}
        ${timelineHtml}
        ${deckSection}
        ${actHtml}
        ${dmgFormulaHtml}
        ${affHtml}
        ${summaryHtml}
        <div style="text-align:center;margin-top:10px;display:flex;gap:8px;justify-content:center;align-items:center;flex-wrap:wrap">
          <span style="font-size:10px;color:var(--text-dim)">💡 一次出手=外功1门+所有内功+所有轻功的全部招式判定</span><br>
          <button class="bb-btn-cancel" data-copy-report>📋 复制</button>
          <button class="bb-btn-cancel" data-close>关闭</button>
        </div>
      </div>
    `;
    const m = modal(fullHtml, 'battle-report');
    // 回合筛选按钮
    m.querySelectorAll('[data-round]').forEach(btn => btn.addEventListener('click', () => {
      const r = btn.dataset.round;
      m.querySelectorAll('[data-round]').forEach(b => b.classList.toggle('sel', b.dataset.round === r));
      const list = m.querySelector('#rep-act-list');
      list.querySelectorAll('.rep-act').forEach(act => {
        const round = act.querySelector('.rep-round')?.textContent;
        act.style.display = (r === 'all' || round === r) ? '' : 'none';
      });
    }));
    m.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => closeModal(m)));
    // 复制战报
    m.querySelectorAll('[data-copy-report]').forEach(b => b.addEventListener('click', () => {
      let txt = `📜 战报 · ${pName} vs ${eName}\n`;
      txt += `═`.repeat(30) + `\n`;
      txt += `胜负：${r.win ? '✅玩家胜' : '❌玩家败'} · 回合 ${r.rounds} · 行动 ${rep.actions.length}\n`;
      txt += `玩家：攻${pStats.atk} 防${pStats.def} 血${pStats.hp} 速度${rep.pSpeed}\n`;
      txt += `敌人：攻${eStats.atk} 防${eStats.def} 血${eStats.hp} 速度${rep.eSpeed}\n`;
      txt += `═`.repeat(30) + `\n`;
      txt += `【聚气过程】\n`;
      rep.rounds.forEach(r => { txt += `R${r.round}: 玩家qi+${r.pGain}=${r.pQi} ${r.pAct?'⚔️':''} | 敌人qi+${r.eGain}=${r.eQi} ${r.eAct?'⚔️':''}\n`; });
      txt += `═`.repeat(30) + `\n`;
      txt += `【行动详情】\n`;
      rep.actions.forEach(a => {
        const who = a.side === 'p' ? pName : eName;
        const status = a.fired ? '✅' : '❌';
        const aff = a.affMod > 1 ? `${a.pAff}克${a.eAff}` : '';
        const crit = a.crit ? '💥' : '';
        txt += `R${a.round}·#${a.seq} ${who} ${a.ma||''} ${status}${a.skName||''}${aff?'['+aff+']':''}${crit} -${a.dmg} 我${a.pHp}/敌${a.eHp}\n`;
      });
      txt += `═`.repeat(30) + `\n`;
      txt += `总伤：玩家${playerActions.reduce((s,a)=>s+a.dmg,0)} / 敌人${enemyActions.reduce((s,a)=>s+a.dmg,0)}\n`;
      try { navigator.clipboard.writeText(txt).then(() => toast('战报已复制')).catch(() => { const t = document.createElement('textarea'); t.value = txt; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); toast('战报已复制'); }); } catch(e) { toast('复制失败'); }
    }));
  }
  function getPlayerAff() {
    const s = Game.state;
    const deck = Array.isArray(s.martialDeck) ? s.martialDeck : [];
    if (deck.length === 0) return '调';
    const counts = { '阴':0, '阳':0, '调':0 };
    deck.forEach(id => { const m = Game.MARTIAL_ARTS.find(x => x.id === id); if (m) counts[Game.martialAffinity(m)]++; });
    return Object.keys(counts).reduce((a,b) => counts[a] > counts[b] ? a : b);
  }
  // 逐回合回放战斗 log，驱动 SVG 卡通演出：弹道 / 粒子 / BOSS 二阶段 / 胜负印章 / 音效
  function playBattle(res, lv, m, aura, techEl) {
    var A=window.ART, S=window.SFX, stage=m.querySelector('.battle-stage');
    var pFill=stage.querySelector('.hp-fill.p'), eFill=stage.querySelector('.hp-fill.e');
    var pLabel=stage.querySelector('[data-plabel]'), eLabel=stage.querySelector('[data-elabel]');
    var pFighter=stage.querySelector('.fighter.p'), eFighter=stage.querySelector('.fighter.e');
    var fx=stage.querySelector('.fx-layer'), banner=stage.querySelector('.skill-banner');
    var pAura=pFighter.querySelector('.aura'), seal=stage.querySelector('.seal');
    var log=res.log, pHp0=res.player.hp, eHp0=res.enemy.hp;
    var pHp=pHp0, eHp=eHp0, i=0, phased=false, castCount=0;
    var delay=Math.max(110,Math.min(400,6500/Math.max(1,log.length)));
    function sh(){pFill.style.width=Math.max(0,pHp/pHp0*100)+'%';eFill.style.width=Math.max(0,eHp/eHp0*100)+'%';pLabel.textContent='气血 '+Game.formatNum(Math.max(0,pHp));eLabel.textContent=lv.name+' '+Game.formatNum(Math.max(0,eHp));var pe=m.querySelector('[data-pend]');if(pe)pe.textContent=Game.formatNum(Math.max(0,pHp));}
    function lunge(w){var f=w==='p'?pFighter:eFighter,c=w==='p'?'lunge-p':'lunge-e';f.classList.remove(c);void f.offsetWidth;f.classList.add(c);}
    function hitR(f){f.classList.remove('hit');void f.offsetWidth;f.classList.add('hit');setTimeout(function(){f.classList.remove('hit')},320);}
    function ft(target,text,cls){var s=fx.getBoundingClientRect(),t=target.getBoundingClientRect();var el=document.createElement('div');el.className='dmg-num '+cls;el.textContent=text;el.style.left=(t.left-s.left+t.width/2)+'px';el.style.top=(t.top-s.top+t.height*.18)+'px';fx.appendChild(el);setTimeout(function(){el.remove()},950);}
    function spawnParticles(target,n){var s=fx.getBoundingClientRect(),t=target.getBoundingClientRect(),cx=t.left-s.left+t.width/2,cy=t.top-s.top+t.height/2;for(var j=0;j<n;j++){var el=document.createElement('div');el.className='particle';var a=Math.random()*Math.PI*2,d=20+Math.random()*36;el.style.left=cx+'px';el.style.top=cy+'px';el.style.setProperty('--tx',Math.cos(a)*d+'px');el.style.setProperty('--ty',Math.sin(a)*d+'px');fx.appendChild(el);setTimeout(function(){el.remove()},650);}}
    function castSkill(){castCount++;pAura.classList.add('on');banner.classList.remove('show');void banner.offsetWidth;banner.classList.add('show');if(S&&S.getEnabled())S.play('skill');var s=fx.getBoundingClientRect(),tp=pFighter.getBoundingClientRect(),te=eFighter.getBoundingClientRect();var cx=tp.left-s.left+tp.width/2,cy=tp.top-s.top+tp.height*.4;var dx=te.left-s.left+te.width/2-cx,dy=te.top-s.top+te.height*.4-cy;var el=document.createElement('div');el.className='projectile';el.style.left=cx+'px';el.style.top=cy+'px';el.style.setProperty('--dx',dx+'px');el.style.setProperty('--dy',dy+'px');el.style.setProperty('--proj',aura);el.innerHTML=A.projectileSVG(techEl);fx.appendChild(el);el.classList.add('go');el.addEventListener('animationend',function(){el.remove();var im=document.createElement('div');im.className='impact';im.style.left=(cx+dx)+'px';im.style.top=(cy+dy)+'px';im.style.setProperty('--proj',aura);fx.appendChild(im);setTimeout(function(){im.remove()},400);});setTimeout(function(){pAura.classList.remove('on')},1100);}
    function finish(){pHp=res.pHp;eHp=res.eHp;sh();var rw=m.querySelector('.combat-reward');if(rw)rw.style.display='';var ok=m.querySelector('#cb-ok');if(ok)ok.style.display='';if(seal){seal.style.display='';void seal.offsetWidth;seal.querySelector('span').style.animation='none';void seal.querySelector('span').offsetWidth;seal.querySelector('span').style.animation='sealStamp .5s cubic-bezier(.2,1.4,.4,1) forwards';}if(S&&S.getEnabled())S.play(res.win?'win':'lose');}
    function step(){if(!stage.isConnected)return;if(i>=log.length){finish();return}var e=log[i];if(e.side==='p'&&(i===0||i%6===5))castSkill();if(!phased&&lv.boss&&eHp/eHp0<=.5){phased=true;stage.classList.add('phase2');banner.textContent='【二阶段】· 暴怒';banner.classList.remove('show');void banner.offsetWidth;banner.classList.add('show');setTimeout(function(){banner.textContent='施放 · 暴怒';},1200);if(S&&S.getEnabled())S.play('skill');}
    if(e.side==='p'){if(e.miss){ft(eFighter,'闪避','miss');lunge('p');}else{eHp=Math.max(0,eHp-e.dmg);sh();lunge('p');hitR(eFighter);ft(eFighter,'-'+Game.formatNum(e.dmg)+(e.crit?' 暴击!':''),e.crit?'crit':'dmg');spawnParticles(eFighter,e.crit?12:7);if(e.crit){stage.classList.remove('crit');void stage.offsetWidth;stage.classList.add('crit');if(S&&S.getEnabled())S.play('crit');}else if(S&&S.getEnabled())S.play('hit');}}
    else{if(e.miss){ft(pFighter,'闪避','miss');lunge('e');}else{pHp=Math.max(0,pHp-e.dmg);sh();lunge('e');hitR(pFighter);ft(pFighter,'-'+Game.formatNum(e.dmg)+(e.crit?' 暴击!':''),e.crit?'crit':'dmg');spawnParticles(pFighter,e.crit?12:7);if(e.crit){stage.classList.remove('crit');void stage.offsetWidth;stage.classList.add('crit');if(S&&S.getEnabled())S.play('crit');}else if(S&&S.getEnabled())S.play('hit');}}
    i++;setTimeout(step,delay);}
    setTimeout(step,250);
  }

  /* ---------------- 法宝 ---------------- */
  function renderTreasure() {
    const s = Game.state;
    const slots = [
      { key: 'weapon', name: '本命法宝', icon: '🗡️' },
      { key: 'armor', name: '护身法宝', icon: '🛡️' },
      { key: 'trinket', name: '辅助法宝', icon: '💍' }
    ];
    const slotHtml = slots.map(sl => {
      const tid = s.equipped[sl.key];
      if (tid) {
        const t = Game.TREASURES.find(x => x.id === tid); const ts = Game.treasureStats(tid);
        return `<div class="slot filled">${t.icon}<div class="sl"><div class="sn">${t.name} <span class="q" style="color:${qColor(t.quality)}">${qName(t.quality)}</span></div><div class="sd">${attrText(ts.attrs)} · ${ts.level}级</div></div></div>`;
      }
      return `<div class="slot empty">${sl.icon}<div class="sl"><div class="sn">${sl.name}</div><div class="sd">未装备</div></div></div>`;
    }).join('');
    const inv = Game.TREASURES.map(t => {
      const own = s.treasures[t.id]; const owned = own && own.count > 0;
      if (!owned) return `<div class="tcard locked"><div class="ti">❔</div><div class="tn">未获得</div><div class="td">${slotName(t.slot)}</div></div>`;
      const ts = Game.treasureStats(t.id); const cost = Game.enhanceCost(t.id);
      const maxed = own.level >= CONFIG.treasure.maxLevel;
      const enhAfford = !maxed && s.materials >= cost.mat && s.stone >= cost.stone;
      const equipped = s.equipped[t.slot] === t.id;
      // 与 game.js 保持一致：仅剩 1 件时无论如何保留，绝不直接删掉唯一法宝
      const keep = own.count <= 1 ? own.count : (equipped ? 1 : 0);
      const surplus = own.count - keep;           // 多余件（仅剩 1 件时 surplus=0，不熔）
      const smeltAfford = surplus > 0;
      const enhBtn = maxed ? `<button class="buy-btn maxed" disabled>圆满</button>`
        : `<button class="buy-btn" data-enh="${t.id}" ${enhAfford ? '' : 'disabled'}>强化<div class="price">${cost.copy}件 ${cost.mat}🌿 ${Game.formatNum(cost.stone)}💎</div></button>`;
      const resetTreBtn = own.level > 0 ? `<button class="buy-btn smelt" data-reset-tr="${t.id}">🔄重置</button>` : '';
      const eqBtn = equipped ? `<button class="buy-btn eq" data-unequip="${t.slot}">卸下</button>`
        : `<button class="buy-btn" data-equip="${t.id}">装备</button>`;
      const smeltLabel = equipped ? `熔炼多余(${surplus})` : `熔炼(${surplus})`;
      const smeltBtn = smeltAfford ? `<button class="buy-btn smelt" data-smelt="${t.id}">${smeltLabel}<div class="price">+${CONFIG.treasure.smeltMatPerQuality * t.quality * surplus}🌿</div></button>` : '';
      // 觉醒（满级解锁）：消耗天材地宝随机赋予词缀；满 3 条则为「重铸觉醒」
      const affixes = own.affixes || [];
      const awakenCost = Game.awakenCost(t.id);
      const canAwaken = maxed && s.materials >= awakenCost && affixes.length < CONFIG.awaken.maxAffixes;
      const awakenBtn = maxed ? `<button class="buy-btn awaken" data-awaken="${t.id}" ${canAwaken ? '' : 'disabled'}>${affixes.length >= CONFIG.awaken.maxAffixes ? '重铸觉醒' : '觉醒'}<div class="price">${awakenCost}🌿</div></button>` : '';
      const affixHtml = affixes.length ? `<div class="affix-wrap">${affixes.map(af => `<span class="affix-chip">${affixChipText(af)}</span>`).join('')}</div>` : '';
      return `<div class="tcard">
        <div class="ti" style="color:${qColor(t.quality)}">${t.icon}</div>
        <div class="tn">${t.name} <span class="q" style="color:${qColor(t.quality)}">${qName(t.quality)}</span></div>
        <div class="td">${t.desc}</div>
        <div class="tattrs">${attrText(ts.attrs)}</div>
        ${affixHtml}
        <div class="tsub">持有 ${own.count} · ${own.level}级${maxed ? ' · 已满级' : ''}</div>
        <div class="tactions">${eqBtn}${enhBtn}${resetTreBtn}${smeltBtn}${awakenBtn}</div>
      </div>`;
    }).join('');
    view.innerHTML = `
      <div class="section-title">💎 法宝 <small>获取/装备/强化/熔炼，撑起战力</small></div>
      <div class="hint">觉醒随机赋予词条；连续 ${CONFIG.awaken.pity} 次加成型词条后，下次必出「攻/血 百分比」词条（保底）。</div>
      <div class="res-bar"><div class="res-chip mat"><div class="l">天材地宝</div><div class="v">🌿 ${Game.formatNum(s.materials)}</div></div><div class="res-chip"><div class="l">灵石</div><div class="v">💎 ${Game.formatNum(s.stone)}</div></div></div>
      <div class="battle-meta"><details><summary>🧘 强化后战斗属性预览 (点击展开)</summary>
        <div class="player-panel" style="margin-top:8px">
          <div class="pp-head">🧘 自身战力 <b>${Game.formatNum(Game.combatStats().power)}</b></div>
          <div class="pp-stats">
            <span>攻 ${Game.formatNum(Game.combatStats().atk)}</span><span>防 ${Game.formatNum(Game.combatStats().def)}</span><span>气血 ${Game.formatNum(Game.combatStats().hp)}</span>
            <span>命中 ${Math.round(Game.combatStats().hit * 100)}%</span><span>闪避 ${Math.round(Game.combatStats().dodge * 100)}%</span><span>暴击 ${Math.round(Game.combatStats().crit * 100)}%</span>
          </div>
        </div></details>
      </div>
      <div class="hint">🌿 <b>天材地宝</b>：强化法宝（每件耗 🌿+💎，随等级与品质递增）、喂养灵宠的必需素材；盈余法宝可<b>熔炼</b>返还天材地宝。掉落于战斗/秘境/奇遇，寻妖重复收服亦赠。</div>
      <div class="slot-row">${slotHtml}</div>
      <div class="section-title sub">法宝囊</div>
      <div class="treasure-grid">${inv}</div>`;
    view.querySelectorAll('[data-equip]').forEach(b => b.addEventListener('click', () => { if (Game.equipTreasure(b.dataset.equip)) renderTreasure(); else toast('无法装备'); }));
    view.querySelectorAll('[data-unequip]').forEach(b => b.addEventListener('click', () => { Game.unequip(b.dataset.unequip); renderTreasure(); }));
    view.querySelectorAll('[data-enh]').forEach(b => b.addEventListener('click', () => { if (Game.enhanceTreasure(b.dataset.enh)) renderTreasure(); else toast('材料或灵石不足'); }));
    view.querySelectorAll('[data-reset-tr]').forEach(b => b.addEventListener('click', () => { if (Game.resetTreasure(b.dataset.resetTr)) renderTreasure(); else toast('重置失败'); }));
    view.querySelectorAll('[data-smelt]').forEach(b => b.addEventListener('click', () => { if (Game.smeltTreasure(b.dataset.smelt)) renderTreasure(); else toast('仅剩 1 件，已为你保留（不会误熔唯一法宝）'); }));
    view.querySelectorAll('[data-awaken]').forEach(b => b.addEventListener('click', () => { if (Game.awakenTreasure(b.dataset.awaken)) renderTreasure(); else toast('天材地宝不足'); }));
  }

  /* ---------------- 购买委托 ---------------- */
  function bindBuy(type) {
    view.querySelectorAll('[data-buy]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id; let ok = false;
        if (type === 'technique') ok = Game.buyTechnique(id);
        else if (type === 'abode') ok = Game.buyAbode(id);
        else if (type === 'pill') ok = Game.takePill(id);
        if (ok) renderCurrent(); else toast('灵石不足');
      });
    });
  }

  /* ---------------- 武学（背包格子式布局） ---------------- */
  let _martialFilter = '全部';
  function renderMartial() {
    const s = Game.state;
    const deck = Array.isArray(s.martialDeck) ? s.martialDeck : [];
    const ownedIds = Object.keys(s.martialArts || {});
    const stats = Game.martialStats();
    const maxDeck = Game.MAX_MARTIAL_DECK || 12;
    const gradeColors = { '根基': '#9fb0c0', '进阶': '#6fb1ff', '绝学': '#ffd76f', '稀有': '#c79fff', '绝世': '#ff6b6b' };
    const gradeIcons = { '根基': '🟤', '进阶': '🔵', '绝学': '🟡', '稀有': '🟣', '绝世': '🔴' };
    const slotMult = (idx) => { if (idx < 6) return 1; if (idx === 7 || idx === 10) return 1; return 0.5; };

    // 两排装备槽
    function makeSlot(i) {
      const id = deck[i];
      if (!id) return `<div class="ma-slot ma-empty" data-slot="${i}"><span class="ma-slot-num">${i+1}</span>${i===7?'<span class="ma-slot-label">主</span>':i===10?'<span class="ma-slot-label">主</span>':''}</div>`;
      const m = Game.MARTIAL_ARTS.find(x => x.id === id);
      if (!m) return `<div class="ma-slot ma-empty" data-slot="${i}"><span class="ma-slot-num">${i+1}</span></div>`;
      const lv = s.martialLevels[id] || 0;
      const mult = slotMult(i);
      const lbl = i===7?'<span class="ma-slot-label">主</span>':i===10?'<span class="ma-slot-label">主</span>':mult<1?'<span class="ma-slot-label" style="color:var(--text-dim)">副</span>':'';
      return `<div class="ma-slot ma-equipped" data-ma="${id}" style="border-color:${gradeColors[m.grade]||'var(--border)'}">
        <span class="ma-slot-icon">${m.icon}</span>
        <span class="ma-slot-lv">Lv${lv}</span>${lbl}
        <span class="ma-slot-name">${m.name}</span>
        <span class="ma-slot-title">${i<6?'外功':i<9?'内功':'轻功'}</span>
      </div>`;
    }
    // 第一行：6外功
    const row1 = Array.from({length:6}, (_,i) => `<div class="ma-slot-wrap">${i===0?'<div class="ma-row-label">外功</div>':''}${makeSlot(i)}</div>`).join('');
    // 第二行前半：3内功 + 后半：3轻功
    const row2a = Array.from({length:3}, (_,i) => makeSlot(6+i)).join('');
    const row2b = Array.from({length:3}, (_,i) => makeSlot(9+i)).join('');
    const equipHtml = `
      <div class="ma-equip-area">
        <div class="ma-equip-row">${row1}</div>
        <div class="ma-equip-row" style="margin-top:2px">
          <div class="ma-sub-row"><span class="ma-row-label ${deck[7]?'active':''}">内功</span>${row2a}</div>
          <div class="ma-sub-row"><span class="ma-row-label ${deck[10]?'active':''}">轻功</span>${row2b}</div>
        </div>
      </div>`;

    // 筛选标签
    const types = ['全部', '御剑', '刀法', '拳掌', '奇门', '内功', '轻功'];
    const typeIcons = { '全部':'📚', '御剑':'🗡️', '刀法':'🔪', '拳掌':'👊', '奇门':'🔔', '内功':'🟣', '轻功':'🕊️' };
    const filterTabs = types.map(t =>
      `<button class="ma-filter ${t === _martialFilter ? 'sel' : ''}" data-filter="${t}">${typeIcons[t]||''} ${t}</button>`
    ).join('');

    // 武学背包网格
    const allMA = Game.MARTIAL_ARTS.filter(m => _martialFilter === '全部' || m.type === _martialFilter);
    const gridSlots = allMA.map(m => {
      const owned = ownedIds.includes(m.id);
      const equipped = deck.includes(m.id);
      const lv = s.martialLevels[m.id] || 0;
      const borderColor = equipped ? '#ffd76f' : owned ? gradeColors[m.grade]||'var(--border)' : 'var(--border)';
      const opacity = owned ? 1 : 0.4;
      const badge = equipped ? '⚔️' : owned ? gradeIcons[m.grade]||'' : '❔';
      return `<div class="ma-slot ma-grid-slot ${owned?'owned':''} ${equipped?'eq':''}"
        data-ma="${m.id}" style="border-color:${borderColor};opacity:${opacity}"
        title="${m.name} · ${m.type}/${m.grade}${equipped?' [已装备]':''}">
        <span class="ma-slot-icon">${owned ? m.icon : '❔'}</span>
        <span class="ma-slot-badge">${badge}</span>
        <span class="ma-slot-name">${owned ? m.name : '???'}</span>
      </div>`;
    }).join('');

    view.innerHTML = `
      <div class="section-title">📖 武学 <small>装配武学·外功轮流+内功轻功全触发</small></div>
      <div class="res-bar">
        <div class="res-chip"><div class="l">攻 +${stats.atk}</div></div>
        <div class="res-chip"><div class="l">防 +${stats.def}</div></div>
        <div class="res-chip"><div class="l">气血 +${stats.hp}</div></div>
        <div class="res-chip"><div class="l">速度 +${stats.speed}</div></div>
      </div>
      ${equipHtml}
      <div style="font-size:10px;color:var(--text-dim);margin:4px 0">💡 主内功/主轻功100%属性，副内功/副轻功50% · 外功每轮轮流出手</div>
      <div class="ma-filter-bar">${filterTabs}</div>
      <div class="ma-grid">${gridSlots}</div>
      <div class="hint" style="margin-top:6px">💡 点击武学格子查看详情 · 品质：🟤根基 🔵进阶 🟡绝学 🟣稀有 🔴绝世 · 战斗胜利有概率掉落⚠</div>
      <div class="section-title" style="margin-top:12px">📜 招式库 <small>装配到武学配招槽·战斗中触发</small></div>
      <div class="allskills-grid">${renderSkillGrid()}</div>
    `;

    // 事件绑定
    view.querySelectorAll('[data-ma]').forEach(el => el.addEventListener('click', () => {
      const id = el.dataset.ma;
      const m = Game.MARTIAL_ARTS.find(x => x.id === id);
      if (!m) return;
      const owned = ownedIds.includes(m.id);
      const equipped = deck.includes(m.id);
      const lv = s.martialLevels[id] || 0;
      const lvMult = 1 + lv * 0.10;
      // 弹出详情面板
      const cost = Game.upgradeMartialCost(id);
      const upgBtn = owned && cost
        ? `<button class="btn" data-upgrade="${id}" ${s.martialArts[id]>=cost.copy&&s.materials>=cost.mat&&s.stone>=cost.stone?'':'disabled'}>升级 ${lv}/20 (${cost.copy}本 ${cost.mat}🌿 ${Game.formatNum(cost.stone)}💎)</button>`
        : (owned ? `<span style="color:var(--jade)">已满级</span>` : '');
      const eqBtn = owned && !equipped && deckCount < maxDeck
        ? `<button class="btn" data-martial-eq="${id}">⚔️ 装备</button>`
        : (owned && equipped ? `<button class="btn smelt" data-martial-ueq="${id}">卸下</button>` : '');
      const resetBtn = owned && lv > 0 ? `<button class="btn smelt" data-reset-ma="${id}">🔄重置</button>` : '';
      const skills = Game.martialSkillList(id);
      // 招式槽位显示
      const slotCount = m.extraSlots;
      const extraSlots = skills.filter(sk => !sk.innate);
      let skillSlotsHtml = '';
      if (owned) {
        // 天赋槽
        skillSlotsHtml += `<div class="ma-slots"><div class="ma-slot-title">⚔ 天赋招式</div>`;
        const inn = skills.find(sk => sk.innate);
        if (inn) skillSlotsHtml += `<div class="ma-skill-tag innate">⭐ ${inn.name}（${inn.fireRate}%触发·${Math.round(inn.dmgRate)}%伤害）${inn.healPct?' 回血'+inn.healPct+'%':''}</div>`;
        // 额外槽
        skillSlotsHtml += `<div class="ma-slot-title" style="margin-top:6px">🔧 配招槽（${extraSlots.length}/${slotCount}）</div>`;
        for (let i = 0; i < slotCount; i++) {
          const sk = extraSlots[i];
          if (sk) {
            skillSlotsHtml += `<div class="ma-skill-tag extra">🔧 ${sk.name}（${sk.fireRate}%触发·${Math.round(sk.dmgRate)}%伤害）${sk.healPct?' 回血'+sk.healPct+'%':''} <span class="spd-ft" data-uskill="${id}:${i}" style="cursor:pointer">[卸下]</span></div>`;
          } else {
            skillSlotsHtml += `<div class="ma-skill-slot" data-addskill="${id}:${i}"><span class="ma-skill-plus">+</span> 装配招式</div>`;
          }
        }
        skillSlotsHtml += `</div>`;
      }
      const modalHtml = `
        <div class="ma-detail">
          <div class="ma-dt-icon">${m.icon}</div>
          <div class="ma-dt-name">${m.name} <span style="color:${gradeColors[m.grade]||'#fff'}">${m.grade}</span></div>
          <div class="ma-dt-type">${m.type} · 阴${m.yin}阳${m.yang}调${m.tiao} · ${owned?'已拥有':'未获得'}</div>
          <div class="ma-dt-stats">攻+${Math.round(m.atk*lvMult)} 防+${Math.round(m.def*lvMult)} 气血+${Math.round(m.hp*lvMult)} 速度+${Math.round(m.speed*lvMult)}</div>
          ${owned ? skillSlotsHtml : `<div class="ma-dt-source">获取：${m.source}</div>`}
          <div style="display:flex;gap:8px;justify-content:center;margin-top:10px">${eqBtn}${upgBtn}${resetBtn}</div>
          <div style="text-align:center;margin-top:8px"><button class="bb-btn-cancel" data-close>关闭</button></div>
        </div>`;
      const modalEl = modal(modalHtml);
      modalEl.querySelectorAll('[data-martial-ueq]').forEach(b => b.addEventListener('click', () => {
        Game.unequipMartial(b.dataset.martialUeq); closeModal(modalEl); renderCurrent();
      }));
      modalEl.querySelectorAll('[data-upgrade]').forEach(b => b.addEventListener('click', () => {
        if (Game.upgradeMartial(b.dataset.upgrade)) { closeModal(modalEl); renderCurrent(); } else toast('材料不足');
      }));
      modalEl.querySelectorAll('[data-reset-ma]').forEach(b => b.addEventListener('click', () => {
        if (Game.resetMartial(b.dataset.resetMa)) { closeModal(modalEl); renderCurrent(); } else toast('重置失败');
      }));
      modalEl.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => closeModal(modalEl)));
      // 招式装配/卸下
      modalEl.querySelectorAll('[data-addskill]').forEach(b => b.addEventListener('click', () => {
        const [maId, slotIdx] = b.dataset.addskill.split(':');
        const ownedSkills = Game.SKILLS.filter(sk => (s.skills[sk.id] || 0) > 0 && !(s.martialSkills[maId] || []).includes(sk.id));
        if (ownedSkills.length === 0) { toast('没有可装配的招式（战斗胜利掉落）'); return; }
        const skillList = ownedSkills.map(sk => 
          `<div class="sk-pick-item" data-skill="${maId}:${slotIdx}:${sk.id}">
            <span class="sk-pick-name">${sk.name}</span>
            <span class="sk-pick-info">${sk.fireRate}%触发·${sk.dmgRate}%伤害·${sk.type}</span>
          </div>`
        ).join('');
        closeModal(modalEl);
        const picker = modal(`<div class="ma-detail"><div class="ma-dt-name">🔧 装配招式</div><div class="ma-dt-type">可选 ${ownedSkills.length} 个</div><div class="sk-pick-list">${skillList}</div><div style="text-align:center;margin-top:8px"><button class="bb-btn-cancel" data-close>取消</button></div></div>`);
        picker.querySelectorAll('[data-skill]').forEach(el => {
          const [maId2, idx2, skId] = el.dataset.skill.split(':');
          el.addEventListener('click', () => { Game.equipSkill(maId2, skId, parseInt(idx2)); closeModal(picker); renderCurrent(); });
        });
        picker.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', () => closeModal(picker)));
      }));
      modalEl.querySelectorAll('[data-uskill]').forEach(b => b.addEventListener('click', () => {
        const [maId, idx] = b.dataset.uskill.split(':');
        Game.unequipSkill(maId, parseInt(idx)); closeModal(modalEl); renderCurrent();
      }));
    }));
    view.querySelectorAll('[data-filter]').forEach(b => b.addEventListener('click', () => {
      _martialFilter = b.dataset.filter;
      renderCurrent();
    }));
    // 招式升级
    view.querySelectorAll('[data-skill-upgrade]').forEach(b => b.addEventListener('click', () => {
      if (Game.upgradeSkill(b.dataset.skillUpgrade)) renderCurrent(); else toast('天材地宝不足');
    }));
    view.querySelectorAll('[data-reset-sk]').forEach(b => b.addEventListener('click', () => {
      if (Game.resetSkill(b.dataset.resetSk)) renderCurrent(); else toast('重置失败');
    }));
  }
  // 招式背包（显示全部12招式，已拥有可升级、未获得灰色）
  function renderSkillGrid() {
    const s = Game.state;
    const ownedSkills = Object.keys(s.skills||{}).filter(k => s.skills[k] > 0);
    return Game.SKILLS.map(sk => {
      const owned = ownedSkills.includes(sk.id);
      const lv = s.skillLevels[sk.id] || 0;
      const cost = Game.upgradeSkillCost(sk.id);
      const mult = 1 + lv * 0.05;
      const fireRate = Math.round(sk.fireRate * (1 + lv * 0.03));
      const dmgRate = Math.round(sk.dmgRate * mult);
      const resetSkBtn = owned && lv > 0 ? `<span class="spd-ft" data-reset-sk="${sk.id}" style="cursor:pointer;margin-left:4px">🔄</span>` : '';
      const upgBtn = owned && cost
        ? `<button class="btn small" data-skill-upgrade="${sk.id}" ${s.materials>=cost?'':'disabled'}>Lv.${lv}/10 ↑</button>`
        : (owned ? `<span style="color:var(--jade);font-size:11px">满级</span>` : '');
      return `<div class="allskill-item ${owned?'':'locked'}">
        <div class="allskill-icon">${owned ? '📜' : '🔒'}</div>
        <div class="allskill-body">
          <div class="allskill-name">${sk.name} ${owned?`<span class="lv">Lv.${lv}</span>`:'<span style="color:var(--text-dim)">??</span>'}</div>
          <div class="allskill-info">${sk.type} · ${owned ? `${fireRate}%触发·${dmgRate}%伤害${sk.healPct?' 回血'+Math.round(sk.healPct*(1+lv*0.03))+'%':''}` : sk.desc.substring(0,20)}</div>
        </div>
        <div class="allskill-upg">${upgBtn}${resetSkBtn}</div>
      </div>`;
    }).join('');
  }
  function renderCurrent() {
    switch (currentTab) {
      case 'cultivate': renderCultivate(); break;
      case 'technique': renderTechniques(); break;
      case 'abode': renderAbodes(); break;
      case 'pill': renderPills(); break;
      case 'pet': renderPet(); break;
      case 'secret': renderSecret(); break;
      case 'insight': renderInsight(); break;
      case 'fly': renderFly(); break;
      case 'bless': renderBless(); break;
      case 'battle': renderBattle(); break;
      case 'treasure': renderTreasure(); break;
      case 'martial': renderMartial(); break;
      case 'event': renderEvents(); break;
      case 'achv': renderAchievements(); break;
      case 'setting': renderSettings(); break;
    }
  }
  function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    renderCurrent(); view.scrollTop = 0;
  }

  /* ---------------- 弹窗 ---------------- */
  function showTribulation(realmName, success) {
    const m = modal(`
      <div class="trib-glow"></div>
      <div class="trib">${success ? '⚡' : '💥'}</div>
      <h2>${success ? '渡劫飞升' : '渡劫失败'}</h2>
      <p>${success ? `天雷滚滚，道心如铁……` : `道心受创，修为折损。`}</p>
      <p class="big">${success ? `晋入 ${realmName}！` : '再凝道果，卷土重来'}</p>
      <button class="btn" id="trib-ok">顺应天命</button>`, 'tribulation');
    const close = () => closeModal(m);
    $('#trib-ok').addEventListener('click', close);
    setTimeout(close, success ? 2600 : 2000);
  }
  function showOffline(off) {
    modal(`<h2>🧘 出关</h2><p>你闭关 <b>${Game.formatTime(off.sec)}</b>，灵机未断。</p>
      <p>修为 +<span class="big">${Game.formatNum(off.xp)}</span></p>
      <p>灵石 +<span class="big">${Game.formatNum(off.stone)}</span></p>
      <button class="btn" id="off-ok">检阅道果</button>`);
    $('#off-ok').addEventListener('click', () => closeModal($('#modal-layer .modal-mask')));
  }
  function showRootPicker() {
    const grid = Game.ROOTS.map(r => `<div class="root-card" data-root="${r.id}"><div class="ic">${r.icon}</div><div class="nm">${r.name}</div><div class="ds">${r.desc}</div></div>`).join('');
    const m = modal(`<h2>🌟 觉醒灵根</h2><p>灵根既定，影响一身道途，慎重抉择（永久）。</p><div class="root-grid" style="margin-top:14px">${grid}</div>`, 'tribulation');
    m.querySelectorAll('[data-root]').forEach(c => c.addEventListener('click', () => {
      Game.setRoot(c.dataset.root); closeModal(m);
      const r = Game.ROOTS.find(x => x.id === c.dataset.root);
      toast(`觉醒${r.name}！`, true);
    }));
  }
  function showReincarnate(gain) {
    modal(`<h2>🔁 飞升转世</h2><p>你斩断此世因果，重入轮回。</p><p>得仙缘 <span class="big">+${gain}</span></p><p>全局效率 +${Math.round(gain * CONFIG.legacyPerPoint * 100)}%，翌世愈发强盛。</p><button class="btn" id="ri-ok">再启道途</button>`);
    $('#ri-ok').addEventListener('click', () => closeModal($('#modal-layer .modal-mask')));
  }
  // 境界突破卡（叙事化里程碑）
  function showRealmCard(realmIndex) {
    const R = Game.REALMS[realmIndex];
    const power = Game.combatStats().power;
    const m = modal(`<div class="realm-card">
      <div class="rc-emoji" style="color:${R.color}">${REALM_AVATAR[realmIndex] || '✨'}</div>
      <div class="rc-name" style="color:${R.color}">晋入 · ${R.name}</div>
      <div class="rc-power">当前战力 ${Game.formatNum(power)}</div>
      <div class="rc-flavor">「${REALM_FLAVOR[R.id] || '道无止境，唯进不退。'}」</div>
      <button class="btn" id="rc-ok">收入道心</button>
    </div>`, 'tribulation');
    $('#rc-ok').addEventListener('click', () => closeModal(m));
  }
  // 每日签到弹窗
  function showCheckIn() {
    const hasToday = Game.hasCheckedInToday();
    const info = Game.nextCheckInReward();
    const doneDays = hasToday ? Game.state.checkInStreak : info.streak;
    const days = [];
    for (let i = 1; i <= 7; i++) {
      const cls = i <= doneDays ? 'done' : (i === doneDays + 1 && !hasToday ? 'today' : '');
      days.push(`<div class="ci-day ${cls}">第${i}天<br/>${CONFIG.checkIn.rewards[Math.min(i - 1, 6)].stone}💎</div>`);
    }
    const m = modal(`<div class="checkin">
      <h2>📅 每日签到</h2>
      <div class="ci-grid">${days.join('')}</div>
      ${hasToday
        ? `<div class="ci-reward">今日已签到 ✅</div><button class="btn" id="ci-ok">收下</button>`
        : `<div class="ci-reward">今日可领：💎 ${info.reward.stone} · 🌿 ${info.reward.mat}</div><button class="btn" id="ci-ok">签到领奖</button>`}
    </div>`);
    $('#ci-ok').addEventListener('click', () => {
      if (!hasToday && Game.checkIn()) { FX.confetti(); FX.banner('签到成功！', { kind: 'gold' }); }
      closeModal(m);
      if (['cultivate', 'treasure', 'pet', 'secret'].includes(currentTab)) renderCurrent();
    });
  }
  // 天降机缘·可点击宝光
  function spawnGoldenOrb(buff) {
    if (goldenOrbEl) { goldenOrbEl.remove(); goldenOrbEl = null; }
    const el = document.createElement('div');
    el.className = 'golden-orb';
    el.innerHTML = `<div class="orb-ring"></div><div class="orb-ring orb-ring2"></div><div class="orb-tip">${buff.name}</div><div class="orb-cta">点击收取</div>${GOLDEN_ICON[buff.id] || '✨'}`;
    const w = window.innerWidth, h = window.innerHeight;
    const x = 60 + Math.random() * Math.max(10, w - 120);
    const y = 170 + Math.random() * Math.max(10, h - 300);
    el.style.left = x + 'px'; el.style.top = y + 'px';
    el.addEventListener('click', () => {
      Game.applyGolden(buff.id);
      el.remove(); goldenOrbEl = null;
    });
    document.body.appendChild(el);
    goldenOrbEl = el;
    // 屏上提示：让挂机玩家也能注意到机缘降临
    FX.banner(`✨ 天降机缘 · ${buff.name}（点击宝光收取）`, { kind: 'gold', dur: 2000 });
    const life = (buff.life || 20) * 1000;
    setTimeout(() => { if (goldenOrbEl === el) { el.remove(); goldenOrbEl = null; } }, life);
  }

  /* ---------------- 事件订阅（全系统反馈接线） ---------------- */
  Game.on('break', (d) => {
    if (d.major) {
      if (d.success) {
        showTribulation(d.realm, true);
        showRealmCard(Game.state.realmIndex);
        FX.flash('#ffe9a8'); FX.confetti(['#ffd76f', '#fff2a8', '#ff9f1a']);
        FX.banner(`晋入 ${d.realm}！`, { kind: 'gold', dur: 2200 }); FX.shake(2);
      } else {
        showTribulation(d.realm, false);
        FX.flash('#ff6b6b'); FX.shake(2.2);
      }
    } else {
      FX.flash('#7fd1c1'); FX.shake(1); FX.banner('突破！', { kind: 'jade', dur: 1200 });
      toast('破境成功，修为更进', true);
    }
    renderCurrent();
  });
  Game.on('buy', (d) => {
    if (d.maxed) {
      FX.confetti(); FX.banner(`${d.name} 圆满！`, { kind: 'gold', dur: 1800 });
      toast(`🌟 ${d.name} 圆满！`, true);
    }
  });
  Game.on('pills', () => {
    FX.flash('#ffd76f'); FX.floatText('灵力暴涨！', { kind: 'gold', y: window.innerHeight * 0.45 });
    if (currentTab === 'cultivate' || currentTab === 'pill') renderCurrent();
  });
  Game.on('event', (ev) => {
    FX.banner(ev.name, { kind: 'gold', dur: 1600 });
    if (currentTab === 'event') renderEvents();
  });
  Game.on('achievement', (a) => {
    FX.confetti(); FX.banner(`🏆 ${a.name}`, { kind: 'gold', dur: 2000 });
    toast(`🏆 解锁成就：${a.name}`, true);
    if (currentTab === 'achv') renderAchievements();
  });
  Game.on('treasure', (d) => {
    const t = d.tid ? Game.TREASURES.find(x => x.id === d.tid) : null;
    if (d.action === 'equip') { FX.floatText(`装备 ${t ? t.icon + t.name : ''}`, { kind: 'good' }); }
    else if (d.action === 'enhance') { const x = window.innerWidth / 2, y = window.innerHeight * 0.4; FX.burst(x, y, '#ffd76f', 10); FX.floatText('强化 +1级', { kind: 'gold' }); }
    else if (d.action === 'smelt') { FX.floatText(`熔炼 +🌿${d.gain || ''}`, { kind: 'good' }); }
    else if (d.action === 'awaken') {
      const x = window.innerWidth / 2, y = window.innerHeight * 0.4;
      FX.burst(x, y, '#c79fff', 18); FX.confetti(['#c79fff', '#7a5cff', '#ffd76f']);
      FX.banner(`${t ? t.name : '法宝'} 觉醒！`, { kind: 'jade', dur: 2000 });
    }
    if (currentTab === 'treasure') renderTreasure();
  });
  Game.on('battle', (d) => {
    if (d.win) {
      FX.floatText('胜！', { kind: 'good', y: window.innerHeight * 0.38, size: 30 });
      // 盲盒由战斗弹窗的「收剑」按钮触发（showCombat 内 cb-ok）
    } else { FX.flash('#ff6b6b'); FX.shake(1.6); }
  });

  let _bbResolve = null;
  let _bbResource = null;
  const BB_BET_LABELS = ['小注', '中注', '大注', '豪注'];
  // 盲盒通用：关闭按钮HTML + 关闭重置
  const BB_CLOSE = '<button class="bb-close" data-bb-close>×</button>';
  function bbReset() { _bbResource = null; _bbResolve = null; }
  function bbClose(m) { closeModal(m); bbReset(); }
  function showBlindBox() {
    if (_bbResolve) return;
    const s = Game.state;
    const hasBuff = Game.goldenActive() != null;
    const buffTip = hasBuff ? '<div class="bb-buff">✨ 天降祥瑞 · 高倍率概率提升！</div>' : '';
    // 如果还没选资源，显示资源选择
    if (!_bbResource) {
      const m = modal(`
        <div class="blind-box">
          ${BB_CLOSE}
          <div class="bb-merchant">🧳 仙界行商</div>
          <div class="bb-title">🎰 战利品盲盒</div>
          <div class="bb-desc">选一种资源投注（扣除本金），搏 0.3×~10×！亏本或翻盘！${hasBuff ? '✨天降祥瑞高倍率↑' : ''}</div>
          ${buffTip}
          <div class="bb-btns">
            <button class="bb-btn" data-bb="xp">📜 修为</button>
            <button class="bb-btn" data-bb="stone">💎 灵石</button>
            <button class="bb-btn" data-bb="mat">🌿 天材地宝</button>
          </div>
          <div class="bb-cancel"><button class="bb-btn-cancel">关闭</button></div>
        </div>
      `);
      m.querySelectorAll('.bb-btn').forEach(btn => btn.addEventListener('click', () => {
        _bbResource = btn.dataset.bb;
        _bbResolve = null;
        closeModal(m);
        showBlindBox();
      }));
      m.querySelectorAll('[data-bb-close], .bb-btn-cancel').forEach(btn => btn.addEventListener('click', () => bbClose(m)));
      _bbResolve = m;
      return;
    }
    // 选投注额
    const rName = _bbResource === 'xp' ? '修为' : _bbResource === 'stone' ? '灵石' : '天材地宝';
    const bets = Game.blindBoxBets(_bbResource);
    const betBtns = bets.map((amt, i) => {
      const aff = amt > 0
        && (_bbResource === 'xp' ? amt <= s.xp
          : _bbResource === 'stone' ? amt <= s.stone
          : amt <= s.materials);
      return `<button class="bb-bet-btn" data-bet="${i}" ${aff ? '' : 'disabled'}>
        <span class="bb-bet-label">${BB_BET_LABELS[i]}</span>
        <span class="bb-bet-amt">${_bbResource === 'xp' ? Game.formatSpeed(amt) : Game.formatNum(amt)}</span>
        <span class="bb-bet-pct">(-${Math.round(amt / Math.max(1, bets[3]) * 100)}%)</span>
      </button>`;
    }).join('');
    const m = modal(`
      <div class="blind-box">
        ${BB_CLOSE}
        <div class="bb-merchant">🧳 仙界行商</div>
        <div class="bb-title">🎰 ${rName} · 投注</div>
        <div class="bb-desc">扣除投注额，掷 0.3×~10×！亏本或翻盘！${hasBuff ? '✨天降祥瑞高倍率↑' : ''}</div>
        <div class="bb-bet-grid">${betBtns}</div>
        <div class="bb-cancel"><button class="bb-btn-cancel">关闭</button></div>
      </div>
    `);
    m.querySelectorAll('.bb-bet-btn').forEach(btn => btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.bet);
      const betAmt = bets[idx];
      if (betAmt <= 0) return;
      if (_bbResource === 'xp' && betAmt > s.xp) return;
      if (_bbResource === 'stone' && betAmt > s.stone) return;
      if (_bbResource === 'mat' && betAmt > s.materials) return;
      _bbResolve = null; closeModal(m);
      showBlindBoxRoll(_bbResource, betAmt);
      _bbResource = null;
    }));
    m.querySelectorAll('[data-bb-close], .bb-btn-cancel').forEach(btn => btn.addEventListener('click', () => { _bbResource = null; bbClose(m); }));
    _bbResolve = m;
  }
  function showBlindBoxRoll(resourceType, betAmt) {
    const rName = resourceType === 'xp' ? '修为' : resourceType === 'stone' ? '灵石' : '天材地宝';
    const m = modal(`
      <div class="blind-box">
        ${BB_CLOSE}
        <div class="bb-merchant">🧳 仙界行商</div>
        <div class="bb-title">🎰 开奖中……</div>
        <div class="bb-result">
          <div class="bb-rolling">🎲 -${resourceType === 'xp' ? Game.formatSpeed(betAmt) : Game.formatNum(betAmt)} ${rName} → 搏倍率</div>
          <div class="bb-number">×?</div>
        </div>
      </div>
    `);
    _bbResolve = m;
    m.querySelectorAll('[data-bb-close]').forEach(btn => btn.addEventListener('click', () => {
      clearInterval(ival); bbClose(m);
    }));
    const numEl = m.querySelector('.bb-number');
    const rollEl = m.querySelector('.bb-rolling');
    // 滚动动画
    const mults = [0.3, 0.6, 0.9, 1.2, 1.5, 2.0, 3.0, 5.0, 8.0, 10.0];
    let i = 0;
    const ival = setInterval(() => { i = Math.floor(Math.random() * 10); numEl.textContent = '×' + mults[i].toFixed(1); }, 80);
    const result = Game.rollBlindBox(resourceType, betAmt);
    setTimeout(() => {
      clearInterval(ival);
      numEl.textContent = '×' + result.mult.toFixed(1);
      const isWin = result.netChange >= 0;
      rollEl.textContent = isWin ? `🎉 净赚 +${resourceType === 'xp' ? Game.formatSpeed(result.netChange) : Game.formatNum(result.netChange)} ${rName}！` : `💸 净亏 ${resourceType === 'xp' ? Game.formatSpeed(-result.netChange) : Game.formatNum(-result.netChange)} ${rName}……`;
      numEl.style.color = isWin ? '#ffd76f' : '#ff6b6b';
      if (isWin && result.mult >= 8) numEl.style.color = '#c79fff';
      const amtEl = document.createElement('div');
      amtEl.className = 'bb-amount';
      amtEl.textContent = isWin ? `${result.mult.toFixed(1)}× → ${resourceType === 'xp' ? Game.formatSpeed(result.amount) : Game.formatNum(result.amount)}` : `惨，${result.mult.toFixed(1)}× 只收回 ${resourceType === 'xp' ? Game.formatSpeed(result.amount) : Game.formatNum(result.amount)}`;
      amtEl.style.color = isWin ? 'var(--jade)' : 'var(--danger)';
      m.querySelector('.bb-result').appendChild(amtEl);
      const hasBuff = result.hasBuff;
      if (isWin) FX.confetti(result.mult >= 5 ? ['#ffd76f','#ff9f9f','#c79fff'] : ['#ffd76f']);
      if (result.netChange <= 0) FX.shake(1.2);
      // 自动关闭
      setTimeout(() => { closeModal(m); _bbResolve = null; }, 3000);
    }, 600 + Math.random() * 400);
  }
  Game.on('pet', () => { if (currentTab === 'pet') renderCurrent(); });
  Game.on('martial', () => { if (currentTab === 'martial') renderCurrent(); });
  Game.on('explore', () => { if (currentTab === 'secret') renderCurrent(); });
  Game.on('insight', () => { if (currentTab === 'insight') renderCurrent(); });
  Game.on('reincarnate', (d) => {
    showReincarnate(d.gain);
    FX.flash('#c79fff'); FX.confetti(['#c79fff', '#9ff0ff', '#ffd76f']); FX.banner('飞升转世！', { kind: 'jade', dur: 2200 });
    renderCurrent();
  });
  Game.on('golden', (d) => {
    if (d.spawn) { spawnGoldenOrb(d.buff); }
    else if (d.applied) {
      FX.flash(d.buff.color || '#ffe9a8');
      FX.floatText(d.buff.name + (d.gain ? ' +' + Game.formatNum(d.gain) : ''), { kind: 'gold', size: 22 });
      FX.burst(window.innerWidth / 2, window.innerHeight * 0.4, d.buff.color || '#ffd24d', 16);
      if (goldenOrbEl) { goldenOrbEl.remove(); goldenOrbEl = null; }
      if (currentTab === 'cultivate') renderCurrent();
    }
  });
  Game.on('checkin', (d) => {
    FX.flash('#ffd76f'); FX.floatText(`签到 +💎${d.reward.stone} 🌿${d.reward.mat}`, { kind: 'gold' });
    if (['cultivate', 'treasure', 'pet', 'secret'].includes(currentTab)) renderCurrent();
  });
  Game.on('reset', () => { updateTopbar(); });

  /* ---------------- 启动 ---------------- */
  function init() {
    const offline = Game.start();
    if (window.SFX) window.SFX.setEnabled(!!Game.state.sfx);
    document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));
    switchTab('cultivate');
    updateTopbar();
    if (offline) showOffline(offline);
    if (!Game.state.rootId) showRootPicker();
    // 签到摩擦优化：开屏自动领取（非阻塞 banner 反馈），不再强制弹窗；手动查看请点顶栏📅
    if (!Game.hasCheckedInToday()) Game.checkIn();
    const bci = $('#btn-checkin'); if (bci) bci.addEventListener('click', showCheckIn);
    const ss = $('#stat-speed'); if (ss) ss.addEventListener('click', toggleSpeedDetail);
    function loop() { updateTopbar(); requestAnimationFrame(loop); }
    requestAnimationFrame(loop);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
