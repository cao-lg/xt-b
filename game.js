/* ============================================================
 * 放置修仙 · 逍遥道途 v2 —— 核心游戏逻辑
 * 状态、主循环、修炼产出、破境/渡劫、灵根、灵宠、秘境、
 * 悟道、飞升转生、奇遇、成就、离线收益与本地存档。
 * ============================================================ */

const Game = (function () {
  const SAVE_KEY = 'xiuxian_save_v2';

  /* ---------- 默认状态 ---------- */
  function defaultState() {
    const now = Date.now();
    return {
      version: 2,
      daoName: '无名散修',
      realmIndex: 0,
      layer: 0,
      xp: 0,
      stone: 0,
      techniques: {},
      abodes: {},
      pills: {},
      rootId: null,          // 灵根（首次选择）
      pets: {},              // 灵宠 id -> 等级
      materials: 0,          // 天材地宝
      insight: 0,            // 悟性点
      insightLv: {},         // 悟道 id -> 等级
      legacy: 0,             // 仙缘（飞升转生货币）
      seekCount: 0,          // 寻妖次数（成本递增）
      exploreCount: 0,       // 秘境探索次数
      realmCd: 0,            // 秘境探索冷却到期时间戳
      reincarnations: 0,     // 飞升次数
      /* ---- 战斗 / 法宝 ---- */
      treasures: {},         // tid -> { count, level }
      equipped: { weapon: null, armor: null, trinket: null },
      mapProgress: {},       // mapId -> 已通关最高关卡索引（-1 表示未通关任何关）
      battleCd: 0,           // 战斗冷却到期时间戳
      battles: 0,            // 累计出战次数
      bossKills: 0,          // 累计 BOSS 击杀数
      achievements: {},
      log: [],
      lastSave: now,
      nextEventAt: now + randInt(CONFIG.eventMinSec, CONFIG.eventMaxSec) * 1000,
      startTime: now,
      totalXp: 0,
      breaks: 0,
      sfx: false             // 战斗音效开关（默认关闭）
    };
  }

  let state = defaultState();

  /* ---------- 事件总线 ---------- */
  const listeners = {};
  function on(type, cb) { (listeners[type] = listeners[type] || []).push(cb); }
  function emit(type, data) { (listeners[type] || []).forEach(cb => cb(data)); }

  /* ---------- 倍率体系 ---------- */
  function getTotalLayers() { return state.realmIndex * LAYERS_PER_REALM + state.layer; }

  function techniqueMult() {
    let m = 1;
    TECHNIQUES.forEach(t => { const lv = state.techniques[t.id] || 0; if (lv > 0) m *= (1 + t.mult * lv); });
    return m;
  }
  function abodeBonus() {
    let b = 0;
    ABODES.forEach(a => { const lv = state.abodes[a.id] || 0; if (lv > 0) b += a.mult * lv; });
    return b;
  }
  function pillMult() {
    let m = 1;
    PILLS.forEach(p => { const left = state.pills[p.id] || 0; if (left > 0) m *= (1 + p.mult); });
    return m * rootMult('pill');
  }
  // 仙缘全局倍率
  function legacyMult() { return 1 + state.legacy * CONFIG.legacyPerPoint; }
  // 灵根对某类资源的倍率
  function rootMult(type) {
    const r = ROOTS.find(x => x.id === state.rootId);
    if (!r) return 1;
    if (r.type === 'all') return 1 + r.mult;
    if (r.type === type) return 1 + r.mult;
    return 1;
  }
  // 獬豸「全资源」加成（百分比）
  function petAllBonus() {
    let b = 0;
    PETS.forEach(p => { if (p.produce.type === 'all') { const lv = state.pets[p.id] || 0; if (lv > 0) b += p.produce.base * lv; } });
    return b;
  }
  // 悟道加成
  function insightSpeedMult() { return (state.insightLv.dao || 0) * INSIGHTS.find(i => i.id === 'dao').mult; }
  function insightStoneMult() { return (state.insightLv.cai || 0) * INSIGHTS.find(i => i.id === 'cai').mult; }
  function insightTribMult() { return (state.insightLv.jie || 0) * INSIGHTS.find(i => i.id === 'jie').mult; }

  // 综合修炼速度（修为/秒）
  function currentSpeed() {
    let speed = CONFIG.baseSpeed;
    speed *= Math.pow(CONFIG.growthPerLayer, state.layer);
    speed *= Math.pow(CONFIG.realmSpeedMult, state.realmIndex);
    const track = techniqueMult() * (1 + abodeBonus()) * pillMult() * rootMult('speed') * (1 + insightSpeedMult()) * (1 + petAllBonus());
    speed *= Math.min(track, CONFIG.speedCap);            // 封顶非转生加成，避免乘数复利失控
    speed *= Math.min(legacyMult(), CONFIG.legacyCap);    // 仙缘(转生)叠加上限
    return speed;
  }
  function stoneSpeed() {
    return currentSpeed() * CONFIG.stoneRatio * rootMult('stone') * Math.min(legacyMult(), CONFIG.legacyCap) * (1 + insightStoneMult()) * (1 + petAllBonus());
  }

  // 灵宠每秒产出（各类资源）
  function petOutPerSec(type) {
    let sum = 0;
    PETS.forEach(p => {
      const lv = state.pets[p.id] || 0;
      if (lv <= 0 || p.produce.type !== type) return;
      if (type === 'all') return; // 全资源加成已在公式内
      sum += p.produce.base * lv;
    });
    return sum * legacyMult() * (1 + petAllBonus());
  }

  // 渡劫成功率
  function tribChance() {
    let c = CONFIG.tribBase;
    c += insightTribMult();
    const r = ROOTS.find(x => x.id === state.rootId);
    if (r && r.type === 'trib') c += r.mult;
    if ((state.pills.bijie || 0) > 0) c = 1; // 避劫丹必成
    return Math.min(1, c);
  }

  /* ---------- 突破成本 ---------- */
  function breakCost() {
    let cost = CONFIG.baseCost
      * Math.pow(CONFIG.layerCostGrowth, state.layer)
      * Math.pow(CONFIG.realmCostGrowth, state.realmIndex);
    if (state.layer >= LAYERS_PER_REALM - 1) cost *= CONFIG.majorBreakMult;
    return cost;
  }
  function isMajorBreak() { return state.layer >= LAYERS_PER_REALM - 1; }
  function canBreak() { return state.xp >= breakCost(); }

  /* ---------- 格式化 ---------- */
  function formatNum(n) {
    if (!isFinite(n)) return '∞';
    if (n < 10000) return Math.floor(n).toLocaleString('zh-CN');
    const units = ['', '万', '亿', '兆', '京', '垓', '秭'];
    let u = 0, v = n;
    while (v >= 10000 && u < units.length - 1) { v /= 10000; u++; }
    return v.toFixed(2) + units[u];
  }
  function formatSpeed(n) { return n < 10000 ? n.toFixed(1) : formatNum(n); }
  function formatTime(sec) {
    sec = Math.floor(sec);
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    if (h > 0) return `${h}时${m}分`;
    if (m > 0) return `${m}分${s}秒`;
    return `${s}秒`;
  }

  /* ---------- 日志 ---------- */
  function pushLog(text, icon) {
    state.log.unshift({ text, icon: icon || '📜', t: Date.now() });
    if (state.log.length > 50) state.log.length = 50;
  }

  /* ---------- 主循环 ---------- */
  let lastTick = Date.now();
  function tick() {
    const now = Date.now();
    let dt = (now - lastTick) / 1000;
    lastTick = now;
    if (dt < 0) dt = 0;
    if (dt > 5) dt = 5;

    const spd = currentSpeed();
    const gain = spd * dt;
    state.xp += gain; state.totalXp += gain;
    state.stone += stoneSpeed() * dt;
    state.materials += petOutPerSec('mat') * dt;
    state.xp += petOutPerSec('xp') * dt;          // 灵宠修为产出
    state.totalXp += petOutPerSec('xp') * dt;
    state.stone += petOutPerSec('stone') * dt;    // 灵宠灵石产出

    PILLS.forEach(p => {
      const left = state.pills[p.id] || 0;
      if (left > 0) state.pills[p.id] = Math.max(0, left - dt);
    });

    if (now >= state.nextEventAt) { triggerEvent(); state.nextEventAt = now + randInt(CONFIG.eventMinSec, CONFIG.eventMaxSec) * 1000; }

    emit('tick', { dt, speed: spd, gain });
  }

  /* ---------- 破境 / 渡劫 ---------- */
  function doBreak() {
    if (!canBreak()) return false;
    const major = isMajorBreak();
    if (!major) {
      state.xp = 0; state.breaks++;
      state.layer++;
      checkAchievements();
      pushLog(`破境至${REALMS[state.realmIndex].name}第${CHINESE_LAYER[state.layer]}层`, '⚡');
      save(); emit('break', { major: false });
      return true;
    }
    // 大境界：渡劫判定
    const chance = tribChance();
    if (Math.random() < chance || (state.pills.bijie || 0) > 0) {
      state.xp = 0; state.breaks++;
      state.layer = 0; state.realmIndex++;
      const ins = CONFIG.insightPerMajor[state.realmIndex] || 0;
      if (ins > 0) { state.insight += ins; pushLog(`渡劫体悟，获悟性点 +${ins}`, '📿'); }
      checkAchievements();
      pushLog(`渡劫成功，晋入${REALMS[state.realmIndex].name}！`, '🌟');
      save(); emit('break', { major: true, realm: REALMS[state.realmIndex].name, success: true });
      return true;
    } else {
      const loss = state.xp * CONFIG.tribFailLoss;
      state.xp -= loss;
      pushLog(`渡劫失败！道心受创，损修为 ${formatNum(loss)}`, '💥');
      save(); emit('break', { major: true, success: false });
      return 'fail';
    }
  }

  /* ---------- 功法 / 洞府 / 丹药 ---------- */
  function techniquePrice(id) { const t = TECHNIQUES.find(x => x.id === id); return t.baseStone * Math.pow(t.priceGrowth, state.techniques[id] || 0); }
  function buyTechnique(id) {
    const t = TECHNIQUES.find(x => x.id === id); const lv = state.techniques[id] || 0;
    if (lv >= t.max) return false;
    const price = techniquePrice(id); if (state.stone < price) return false;
    state.stone -= price; state.techniques[id] = lv + 1;
    pushLog(`修习${t.name}至第${state.techniques[id]}层`, t.icon); save(); emit('buy'); return true;
  }
  function abodePrice(id) { const a = ABODES.find(x => x.id === id); return a.baseStone * Math.pow(a.priceGrowth, state.abodes[id] || 0); }
  function buyAbode(id) {
    const a = ABODES.find(x => x.id === id); const lv = state.abodes[id] || 0;
    if (lv >= a.max) return false;
    const price = abodePrice(id); if (state.stone < price) return false;
    state.stone -= price; state.abodes[id] = lv + 1;
    pushLog(`${a.name}拓至第${state.abodes[id]}重`, a.icon); save(); emit('buy'); return true;
  }
  function takePill(id) {
    const p = PILLS.find(x => x.id === id);
    if (state.stone < p.baseStone) return false;
    state.stone -= p.baseStone; state.pills[id] = (state.pills[id] || 0) + p.duration;
    pushLog(`服下${p.name}，灵力暴涨！`, p.icon); save(); emit('pills'); return true;
  }

  /* ---------- 灵根 ---------- */
  function setRoot(id) {
    if (state.rootId) return false;
    if (!ROOTS.find(r => r.id === id)) return false;
    state.rootId = id;
    pushLog(`觉醒${ROOTS.find(r => r.id === id).name}，道途既定。`, ROOTS.find(r => r.id === id).icon);
    save(); emit('root'); return true;
  }

  /* ---------- 灵宠 ---------- */
  function seekCost() { return Math.floor(CONFIG.seekCostBase * Math.pow(CONFIG.seekCostGrowth, state.seekCount)); }
  function seekPet() {
    const cost = seekCost();
    if (state.stone < cost) return false;
    state.stone -= cost; state.seekCount++;
    const totalW = PETS.reduce((s, p) => s + p.weight, 0);
    let r = Math.random() * totalW, pet = PETS[0];
    for (const p of PETS) { r -= p.weight; if (r <= 0) { pet = p; break; } }
    if (!state.pets[pet.id]) {
      state.pets[pet.id] = 1;
      pushLog(`寻妖得${pet.name}，收为灵宠！`, pet.icon);
      checkAchievements();
    } else {
      const m = randInt(2, 6); state.materials += m;
      pushLog(`再遇${pet.name}（已收服），赐下天材地宝 +${m}`, pet.icon);
    }
    save(); emit('pet'); return true;
  }
  function feedCost(id) { const lv = state.pets[id] || 0; return Math.floor(CONFIG.feedCostBase * Math.pow(CONFIG.feedCostGrowth, lv)); }
  function feedPet(id) {
    const pet = PETS.find(p => p.id === id); const lv = state.pets[id] || 0;
    if (!pet || lv <= 0) return false;
    const cost = feedCost(id); if (state.materials < cost) return false;
    state.materials -= cost; state.pets[id] = lv + 1;
    pushLog(`以天材地宝喂养${pet.name}，升至 ${state.pets[id]} 级`, pet.icon);
    save(); emit('pet'); return true;
  }

  /* ---------- 秘境历练 ---------- */
  function canExplore() { return Date.now() >= state.realmCd; }
  function explore(realmId) {
    const r = SECRET_REALMS.find(x => x.id === realmId);
    if (!r) return false;
    if (state.stone < r.cost) return false;
    if (!canExplore()) return false;
    state.stone -= r.cost; state.exploreCount++;
    state.realmCd = Date.now() + CONFIG.realmCooldown * 1000;
    const xp = randInt(r.xp[0], r.xp[1]);
    const stone = randInt(r.stone[0], r.stone[1]);
    const mat = randInt(r.mat[0], r.mat[1]);
    state.xp += xp; state.totalXp += xp; state.stone += stone; state.materials += mat;
    let parts = [`修为+${formatNum(xp)}`, `灵石+${formatNum(stone)}`, `天材地宝+${mat}`];
    if (Math.random() < r.risk) {
      const loss = state.xp * r.riskLoss;
      state.xp -= loss;
      pushLog(`⚠ 探${r.name}遇险，损修为 ${formatNum(loss)}（${parts.join('，')}）`, r.icon);
    } else {
      pushLog(`🌟 探${r.name}大有所得（${parts.join('，')}）`, r.icon);
    }
    checkAchievements();
    save(); emit('explore', r); return true;
  }

  /* ---------- 悟道 ---------- */
  function insightPrice(id) { const ins = INSIGHTS.find(x => x.id === id); return Math.floor(ins.base * Math.pow(ins.growth, state.insightLv[id] || 0)); }
  function comprehend(id) {
    const ins = INSIGHTS.find(x => x.id === id); const lv = state.insightLv[id] || 0;
    if (lv >= ins.max) return false;
    const price = insightPrice(id); if (state.insight < price) return false;
    state.insight -= price; state.insightLv[id] = lv + 1;
    pushLog(`参悟${ins.name}至第 ${state.insightLv[id]} 重`, ins.icon);
    checkAchievements();
    save(); emit('insight'); return true;
  }

  /* ---------- 飞升转生 ---------- */
  function legacyGain() { return Math.floor(Math.sqrt(state.totalXp / CONFIG.legacyGainBase)); }
  function canReincarnate() { return state.realmIndex >= REALMS.length - 1; }
  function reincarnate() {
    if (!canReincarnate()) return false;
    const gain = legacyGain();
    state.legacy += gain; state.reincarnations++;
    state.realmIndex = 0; state.layer = 0; state.xp = 0; state.stone = 0;
    state.techniques = {}; state.abodes = {}; state.pills = {};
    state.pets = {}; state.materials = 0; state.seekCount = 0; state.exploreCount = 0; state.breaks = 0;
    pushLog(`🔁 飞升转世！得仙缘 +${gain}（全局效率 +${Math.round(gain * CONFIG.legacyPerPoint * 100)}%）`, '🔁');
    checkAchievements();
    save(); emit('reincarnate', { gain }); return true;
  }

  /* ---------- 奇遇 ---------- */
  function triggerEvent() {
    const totalW = EVENTS.reduce((s, e) => s + e.weight, 0);
    let r = Math.random() * totalW, ev = EVENTS[0];
    for (const e of EVENTS) { r -= e.weight; if (r <= 0) { ev = e; break; } }
    const rw = ev.reward; const parts = [];
    if (rw.xp) { const g = rw.xp(); state.xp += g; state.totalXp += g; parts.push(`修为+${formatNum(g)}`); }
    if (rw.stone) { const g = rw.stone(); state.stone += g; parts.push(`灵石+${formatNum(g)}`); }
    if (rw.mat) { const g = rw.mat(); state.materials += g; parts.push(`天材地宝+${g}`); }
    if (rw.insight) { const g = rw.insight(); state.insight += g; parts.push(`悟性+${g}`); }
    pushLog(`${ev.icon} ${ev.name}：${ev.desc}（${parts.join('，')}）`, ev.icon);
    emit('event', ev);
  }

  /* ---------- 成就 ---------- */
  function checkAchievements() {
    const petCount = Object.keys(state.pets).filter(k => state.pets[k] > 0).length;
    const insTotal = Object.values(state.insightLv).reduce((s, v) => s + v, 0);
    ACHIEVEMENTS.forEach(a => {
      if (state.achievements[a.id]) return;
      let ok = false;
      if (a.realm !== undefined) ok = state.realmIndex >= a.realm;
      else if (a.pet !== undefined) ok = petCount >= a.pet;
      else if (a.explore !== undefined) ok = state.exploreCount >= a.explore;
      else if (a.insight !== undefined) ok = insTotal >= a.insight;
      else if (a.reincarnate !== undefined) ok = state.reincarnations >= a.reincarnate;
      else if (a.battle !== undefined) ok = state.battles >= a.battle;
      else if (a.boss !== undefined) ok = state.bossKills >= a.boss;
      else if (a.mapAll !== undefined) ok = MAPS.every(m => state.mapProgress[m.id] !== undefined && state.mapProgress[m.id] >= m.levels.length - 1);
      else if (a.treasure !== undefined) ok = Object.values(state.treasures).filter(x => x && x.count > 0).length >= a.treasure;
      else if (a.enhanceMax !== undefined) ok = Object.values(state.treasures).some(x => x && x.level >= CONFIG.treasure.maxLevel);
      if (ok) { state.achievements[a.id] = true; pushLog(`🏆 解锁成就「${a.name}」：${a.desc}`, '🏆'); emit('achievement', a); }
    });
  }

  /* ---------- 手动运转周天 ---------- */
  function clickCultivate() {
    const gain = Math.max(1, currentSpeed() * CONFIG.clickBase);
    state.xp += gain; state.totalXp += gain;
    let extra = '';
    if (Math.random() < CONFIG.clickStoneChance) { const g = randInt(1, Math.max(2, Math.floor(currentSpeed()))); state.stone += g; extra = `，灵石+${g}`; }
    emit('click', gain);
    return { gain, extra };
  }

  /* ---------- 战斗属性 / 法宝 ---------- */
  function rand(a, b) { return a + Math.random() * (b - a); }
  function qualityMult(tid) { const t = TREASURES.find(x => x.id === tid); return (QUALITY.find(q => q.id === t.quality) || QUALITY[0]).mult; }
  function treasureStats(tid) {
    const t = TREASURES.find(x => x.id === tid); if (!t) return null;
    const own = state.treasures[tid]; const lv = own ? own.level : 0;
    const scale = (1 + lv * 0.1) * qualityMult(tid);
    const out = {};
    for (const k in t.base) out[k] = t.base[k] * scale;
    return { id: tid, name: t.name, icon: t.icon, slot: t.slot, quality: t.quality, level: lv, attrs: out };
  }
  // 玩家战斗属性：境界 + 功法 + 仙缘 + 灵根 + 法宝
  function combatStats() {
    const r = state.realmIndex, l = state.layer;
    let atk = (r + 1) * 6 + l * 1.2;
    let def = (r + 1) * 3 + l * 0.6;
    let hp = 80 + (r + 1) * 60 + l * 12;
    let hit = CONFIG.combat.baseHit, dodge = CONFIG.combat.baseDodge, crit = CONFIG.combat.baseCrit;
    atk += (techniqueMult() - 1) * 6;                       // 功法小幅加成攻击
    const lm = legacyMult(); atk *= lm; def *= lm; hp *= lm; // 仙缘全局加成
    const root = ROOTS.find(x => x.id === state.rootId);
    if (root) {
      if (root.type === 'speed') atk *= 1.1;
      else if (root.type === 'stone') def *= 1.1;
      else if (root.type === 'trib') crit += 0.03;
      else if (root.type === 'pill') hp *= 1.1;
      else if (root.type === 'all') { atk *= 1.05; def *= 1.05; hp *= 1.05; }
    }
    ['weapon', 'armor', 'trinket'].forEach(slot => {
      const tid = state.equipped[slot]; if (!tid) return;
      const a = treasureStats(tid).attrs;
      if (a.atk) atk += a.atk; if (a.def) def += a.def; if (a.hp) hp += a.hp;
      if (a.hit) hit += a.hit; if (a.dodge) dodge += a.dodge; if (a.crit) crit += a.crit;
    });
    hit = Math.min(0.99, hit); dodge = Math.min(0.75, dodge); crit = Math.min(0.9, crit);
    const power = Math.floor(atk * 2 + def * 1.5 + hp * 0.25 + (hit + dodge + crit) * 120);
    return { atk: Math.floor(atk), def: Math.floor(def), hp: Math.floor(hp), hit, dodge, crit, power };
  }

  function canBattle() { return Date.now() >= state.battleCd; }
  function battleCooldownLeft() { return Math.max(0, Math.ceil((state.battleCd - Date.now()) / 1000)); }
  // 关卡解锁：首图默认开；同图需上一关已通关；非首图需上一张图 BOSS 已通关
  function isLevelUnlocked(mapId, idx) {
    const mi = MAPS.findIndex(m => m.id === mapId);
    if (mi > 0) { const prev = MAPS[mi - 1]; if (state.mapProgress[prev.id] === undefined || state.mapProgress[prev.id] < prev.levels.length - 1) return false; }
    if (idx === 0) return true;
    const cleared = state.mapProgress[mapId];
    return cleared !== undefined && cleared >= idx - 1;
  }
  // 回合制模拟战斗：命中/闪避/暴击/伤害浮动 全程 RNG
  function simulateCombat(enemy) {
    const p = combatStats(), e = enemy;
    let pHp = p.hp, eHp = e.hp, round = 0;
    const log = [];
    const v = CONFIG.combat.variance, cm = CONFIG.combat.critMult, dm = CONFIG.combat.defMit;
    while (pHp > 0 && eHp > 0 && round < CONFIG.combat.maxRounds) {
      round++;
      if (Math.random() < p.hit * (1 - e.dodge)) {
        let dmg = p.atk * rand(1 - v, 1 + v); const isCrit = Math.random() < p.crit;
        if (isCrit) dmg *= cm;
        dmg = Math.max(1, dmg - e.def * dm); eHp -= dmg;
        log.push({ side: 'p', miss: false, crit: isCrit, dmg: Math.floor(dmg) });
      } else log.push({ side: 'p', miss: true });
      if (eHp <= 0) break;
      if (Math.random() < e.hit * (1 - p.dodge)) {
        let dmg = e.atk * rand(1 - v, 1 + v); const isCrit = Math.random() < e.crit;
        if (isCrit) dmg *= cm;
        dmg = Math.max(1, dmg - p.def * dm); pHp -= dmg;
        log.push({ side: 'e', miss: false, crit: isCrit, dmg: Math.floor(dmg) });
      } else log.push({ side: 'e', miss: true });
    }
    return { win: eHp <= 0, rounds: round, pHp: Math.floor(pHp), eHp: Math.floor(eHp), log, player: p, enemy: e };
  }
  function fight(mapId, idx) {
    const map = MAPS.find(m => m.id === mapId); if (!map) return null;
    const lv = map.levels[idx]; if (!lv) return null;
    if (!isLevelUnlocked(mapId, idx)) return { error: 'locked' };
    if (!canBattle()) return { error: 'cd' };
    state.battleCd = Date.now() + CONFIG.combat.battleCd * 1000;
    state.battles++;
    const res = simulateCombat(lv);
    let reward = null, drop = null;
    if (res.win) {
      const stone = randInt(lv.reward.stone[0], lv.reward.stone[1]);
      const mat = randInt(lv.reward.mat[0], lv.reward.mat[1]);
      const xp = randInt(lv.reward.xp[0], lv.reward.xp[1]);
      state.stone += stone; state.materials += mat; state.xp += xp; state.totalXp += xp;
      reward = { stone, mat, xp };
      if (state.mapProgress[mapId] === undefined || state.mapProgress[mapId] < idx) state.mapProgress[mapId] = idx;
      if (lv.boss) state.bossKills++;
      if (Math.random() < (lv.drop.chance || 0) && lv.drop.pool && lv.drop.pool.length) {
        const tid = lv.drop.pool[Math.floor(Math.random() * lv.drop.pool.length)];
        const t = TREASURES.find(x => x.id === tid);
        if (t) {
          if (!state.treasures[tid]) state.treasures[tid] = { count: 0, level: 0 };
          state.treasures[tid].count++;
          drop = { id: tid, name: t.name, icon: t.icon, quality: t.quality, first: state.treasures[tid].count === 1 };
          checkAchievements();
        }
      }
      checkAchievements();
      pushLog(`⚔️ 战${lv.name}胜！灵石+${formatNum(stone)} 🌿+${mat} 修为+${formatNum(xp)}${drop ? '，得法宝' + drop.icon + drop.name : ''}`, lv.icon);
    } else {
      pushLog(`💀 战${lv.name}败，道行尚浅，再练练。`, lv.icon);
    }
    lv._mapId = mapId;
    save(); emit('battle', { res, reward, drop, level: lv, mapId, idx, win: res.win });
    return { res, reward, drop, win: res.win, level: lv };
  }

  function hasTreasure(tid) { return state.treasures[tid] && state.treasures[tid].count > 0; }
  function equipTreasure(tid) {
    const t = TREASURES.find(x => x.id === tid); if (!t || !hasTreasure(tid)) return false;
    state.equipped[t.slot] = tid;
    pushLog(`装备${t.icon}${t.name}`, t.icon); save(); emit('treasure'); return true;
  }
  function unequip(slot) {
    if (!state.equipped[slot]) return false;
    const tid = state.equipped[slot]; state.equipped[slot] = null;
    const t = TREASURES.find(x => x.id === tid);
    pushLog(`卸下${t ? t.name : slot}`, '💎'); save(); emit('treasure'); return true;
  }
  function enhanceCost(tid) {
    const t = TREASURES.find(x => x.id === tid); const own = state.treasures[tid]; if (!t || !own) return null;
    const lv = own.level, qm = qualityMult(tid);
    return {
      mat: Math.floor(CONFIG.treasure.enhanceMatBase * Math.pow(CONFIG.treasure.enhanceGrowth, lv) * qm),
      stone: Math.floor(CONFIG.treasure.enhanceStoneBase * Math.pow(CONFIG.treasure.enhanceGrowth, lv) * qm)
    };
  }
  function enhanceTreasure(tid) {
    const t = TREASURES.find(x => x.id === tid); const own = state.treasures[tid];
    if (!t || !own || own.level >= CONFIG.treasure.maxLevel) return false;
    const cost = enhanceCost(tid);
    if (state.materials < cost.mat || state.stone < cost.stone) return false;
    state.materials -= cost.mat; state.stone -= cost.stone; own.level++;
    if (own.level >= CONFIG.treasure.maxLevel) checkAchievements();
    pushLog(`🔨 ${t.name}强化至 ${own.level} 级`, t.icon); save(); emit('treasure'); return true;
  }
  function smeltTreasure(tid) {
    const t = TREASURES.find(x => x.id === tid); const own = state.treasures[tid];
    if (!t || !own || own.count < 2) return false;
    own.count--; const gain = CONFIG.treasure.smeltMatPerQuality * t.quality;
    state.materials += gain;
    pushLog(`🔥 熔炼${t.name}（盈余），得天材地宝 +${gain}`, t.icon); save(); emit('treasure'); return true;
  }

  /* ---------- 存档 / 读档 ---------- */
  function save() {
    state.lastSave = Date.now();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }
  function load() {
    let offline = null;
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        state = Object.assign(defaultState(), data);
        ['techniques', 'abodes', 'pills', 'pets', 'insightLv', 'achievements', 'log', 'treasures', 'equipped', 'mapProgress'].forEach(k => { state[k] = data[k] || (Array.isArray(data[k]) ? [] : {}); });
        const now = Date.now();
        let sec = (now - (data.lastSave || now)) / 1000;
        const cap = CONFIG.offlineCapHours * 3600;
        if (sec > cap) sec = cap;
        if (sec > 5) {
          const spd = currentSpeed();
          const xpGain = spd * sec * CONFIG.offlineEff;
          const stoneGain = stoneSpeed() * sec * CONFIG.offlineEff;
          state.xp += xpGain; state.totalXp += xpGain; state.stone += stoneGain;
          // 灵宠离线产出（近似）
          PETS.forEach(p => {
            const lv = state.pets[p.id] || 0; if (lv <= 0 || p.produce.type === 'all') return;
            const out = p.produce.base * lv * CONFIG.offlineEff * sec;
            if (p.produce.type === 'xp') { state.xp += out; state.totalXp += out; }
            else if (p.produce.type === 'stone') state.stone += out;
            else if (p.produce.type === 'mat') state.materials += out;
          });
          offline = { sec, xp: xpGain, stone: stoneGain };
          pushLog(`🧘 闭关${formatTime(sec)}，修为+${formatNum(xpGain)}，灵石+${formatNum(stoneGain)}`, '🧘');
        }
        if (now >= state.nextEventAt) state.nextEventAt = now + randInt(CONFIG.eventMinSec, CONFIG.eventMaxSec) * 1000;
      }
    } catch (e) { state = defaultState(); }
    checkAchievements();
    lastTick = Date.now();
    return offline;
  }
  function reset() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
    state = defaultState(); lastTick = Date.now();
    pushLog('道途重启，一切从头。', '🔄'); emit('reset');
  }
  function setDaoName(name) { state.daoName = (name || '').trim() || '无名散修'; save(); }

  /* ---------- 启动 ---------- */
  function start() {
    const offline = load();
    setInterval(tick, 100);
    setInterval(save, 10000);
    window.addEventListener('beforeunload', save);
    return offline;
  }

  /* ---------- 对外接口 ---------- */
  return {
    on, emit, start, save, load, reset, setDaoName, setRoot,
    doBreak, buyTechnique, buyAbode, takePill, clickCultivate, triggerEvent,
    seekPet, feedPet, explore, comprehend, reincarnate, checkAchievements,
    currentSpeed, stoneSpeed, breakCost, canBreak, isMajorBreak, tribChance,
    techniquePrice, abodePrice, seekCost, feedCost, insightPrice, legacyGain, canReincarnate, canExplore,
    techniqueMult, abodeBonus, pillMult, legacyMult, rootMult, petAllBonus, petOutPerSec, getTotalLayers,
    formatNum, formatSpeed, formatTime,
    combatStats, qualityMult, treasureStats, canBattle, battleCooldownLeft, isLevelUnlocked, fight, simulateCombat,
    hasTreasure, equipTreasure, unequip, enhanceCost, enhanceTreasure, smeltTreasure,
    get state() { return state; },
    get REALMS() { return REALMS; }, get ROOTS() { return ROOTS; }, get TECHNIQUES() { return TECHNIQUES; },
    get ABODES() { return ABODES; }, get PILLS() { return PILLS; }, get PETS() { return PETS; },
    get SECRET_REALMS() { return SECRET_REALMS; }, get INSIGHTS() { return INSIGHTS; },
    get EVENTS() { return EVENTS; }, get ACHIEVEMENTS() { return ACHIEVEMENTS; },
    get QUALITY() { return QUALITY; }, get TREASURES() { return TREASURES; }, get MAPS() { return MAPS; },
    LAYERS_PER_REALM, CHINESE_LAYER
  };
})();
