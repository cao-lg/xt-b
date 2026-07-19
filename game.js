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
      towerFloor: 0,         // 无尽试炼塔当前最高层
      achievements: {},
      log: [],
      lastSave: now,
      nextEventAt: now + randInt(CONFIG.eventMinSec, CONFIG.eventMaxSec) * 1000,
      startTime: now,
      totalXp: 0,
      breaks: 0,
      sfx: false,            // 战斗音效开关（默认关闭）
      /* ---- 反馈/爽点/生命周期（新增，纯表现+限时增益，不持久化 combo） ---- */
      goldenBuff: null,      // 天降机缘·当前生效的临时增益 {id,name,desc,mult,until,scope,color}
      nextGoldenAt: now + randInt(CONFIG.golden.minInterval, CONFIG.golden.maxInterval) * 1000, // 下次机缘出现时间
      lastGoldenAt: now,
      checkInDate: '',       // 上次签到日期（YYYY-MM-DD）
      checkInStreak: 0       // 连续签到天数
    };
  }

  let state = defaultState();

  /* ---------- 事件总线 ---------- */
  const listeners = {};
  function on(type, cb) { (listeners[type] = listeners[type] || []).push(cb); }
  function emit(type, data) { (listeners[type] || []).forEach(cb => cb(data)); }

  /* ---------- 倍率体系 ---------- */
  function getTotalLayers() { return state.realmIndex * LAYERS_PER_REALM + state.layer; }

  // 功法：普通档按固定值累加（修为/秒，不封顶）；仅「鸿蒙紫气诀」为比例倍率
  function techniqueFlat() {
    let f = 0;
    TECHNIQUES.forEach(t => { if (t.flat) { const lv = state.techniques[t.id] || 0; if (lv > 0) f += t.flat * lv; } });
    return f;
  }
  function techniqueTopRatio() {
    let r = 1;
    TECHNIQUES.forEach(t => { if (t.ratio) { const lv = state.techniques[t.id] || 0; if (lv > 0) r *= (1 + t.ratio * lv); } });
    return r;
  }
  // 洞府：普通档按固定值累加；仅「上古仙府」为比例倍率
  function abodeFlat() {
    let f = 0;
    ABODES.forEach(a => { if (a.flat) { const lv = state.abodes[a.id] || 0; if (lv > 0) f += a.flat * lv; } });
    return f;
  }
  function abodeTopRatio() {
    let r = 1;
    ABODES.forEach(a => { if (a.ratio) { const lv = state.abodes[a.id] || 0; if (lv > 0) r *= (1 + a.ratio * lv); } });
    return r;
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

  // 天降机缘（golden buff）临时增益倍率：仅作用于对应资源，到期返回 1
  function goldenSpeedMult() {
    const g = state.goldenBuff;
    if (!g || Date.now() >= g.until) return 1;
    return g.id === 'speed' ? g.mult : 1;   // 「灵机迸发」仅 boost 修炼速度（修为）
  }
  function goldenAllMult() {
    const g = state.goldenBuff;
    if (!g || Date.now() >= g.until) return 1;
    return g.id === 'all' ? g.mult : 1;      // 「万物滋长」boost 全资源（修为/灵石/材料/灵宠产出）
  }

  // 修炼核心速度（不含天降机缘，便于 stoneSpeed / 灵宠 / 瞬时爆发复用，避免重复乘）
  function coreSpeed() {
    const base = CONFIG.baseSpeed * Math.pow(CONFIG.growthPerLayer, state.layer);
    const flat = techniqueFlat() + abodeFlat();                                  // 固定值加法（不封顶）
    const ratio = techniqueTopRatio() * abodeTopRatio() * pillMult() * rootMult('speed')
      * (1 + insightSpeedMult()) * (1 + petAllBonus()) * legacyMult();           // 仅顶级比例 + 其余比例源
    const band = CONFIG.cultBandBase
      * Math.pow(CONFIG.cultBandMult, state.realmIndex)
      * (1 + state.layer * CONFIG.cultBandLayer);                                // 修炼带：固定值也随境界享受比例提升
    return (base + flat) * ratio * band;
  }
  // 综合修炼速度（修为/秒）= 核心速度 × 天降机缘（speed 仅修为 / all 全资源）
  function currentSpeed() {
    return coreSpeed() * goldenSpeedMult() * goldenAllMult();
  }
  function stoneSpeed() {
    return coreSpeed() * CONFIG.stoneRatio * rootMult('stone') * (1 + insightStoneMult()) * (1 + petAllBonus()) * goldenAllMult();
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
    return sum * legacyMult() * (1 + petAllBonus()) * goldenAllMult();
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
    const neg = n < 0; n = Math.abs(n);
    if (n < 10000) return (neg ? '-' : '') + Math.floor(n).toLocaleString('zh-CN');
    const units = ['', '万', '亿', '兆', '京', '垓', '秭'];
    let u = 0, v = n;
    while (v >= 10000 && u < units.length - 1) { v /= 10000; u++; }
    if (v >= 10000) {
      // 超出「秭」量级：改用科学计数法（如 1.23e12），避免溢出为 ∞
      const exp = Math.floor(Math.log10(n));
      const mant = (n / Math.pow(10, exp)).toFixed(2);
      return (neg ? '-' : '') + mant + 'e' + exp;
    }
    return (neg ? '-' : '') + v.toFixed(2) + units[u];
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

    // 天降机缘：宝光出现 + 临时增益到期自动清除
    if (state.goldenBuff && now >= state.goldenBuff.until) { state.goldenBuff = null; emit('golden', { expired: true }); }
    if (now >= (state.nextGoldenAt || 0)) spawnGolden();

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
      save(); emit('break', { major: false, realm: REALMS[state.realmIndex].name, layer: CHINESE_LAYER[state.layer] });
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
    pushLog(`修习${t.name}至第${state.techniques[id]}层`, t.icon); save(); emit('buy', { id, type: 'technique', maxed: state.techniques[id] >= t.max, name: t.name, lv: state.techniques[id] }); return true;
  }
  function abodePrice(id) { const a = ABODES.find(x => x.id === id); return a.baseStone * Math.pow(a.priceGrowth, state.abodes[id] || 0); }
  function buyAbode(id) {
    const a = ABODES.find(x => x.id === id); const lv = state.abodes[id] || 0;
    if (lv >= a.max) return false;
    const price = abodePrice(id); if (state.stone < price) return false;
    state.stone -= price; state.abodes[id] = lv + 1;
    pushLog(`${a.name}拓至第${state.abodes[id]}重`, a.icon); save(); emit('buy', { id, type: 'abode', maxed: state.abodes[id] >= a.max, name: a.name, lv: state.abodes[id] }); return true;
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
    const xp = Math.floor(currentSpeed() * rand(3, 8)); // 秘境修为 = 修炼速度×秒数，扣灵石后净效≤修炼
    const stone = Math.floor(randInt(r.stone[0], r.stone[1]) * 0.25);
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

  /* ---------- 天降机缘（Golden Buff） ---------- */
  function goldenActive() {
    return (state.goldenBuff && Date.now() < state.goldenBuff.until) ? state.goldenBuff : null;
  }
  function spawnGolden() {
    const cfg = CONFIG.golden; const now = Date.now();
    const buff = cfg.buffs[Math.floor(Math.random() * cfg.buffs.length)];
    let next = now + randInt(cfg.minInterval, cfg.maxInterval) * 1000;
    const last = state.lastGoldenAt || now;
    const cap = last + cfg.pity * 1000;          // 保底：距上次出场不超过 pity 秒
    if (next > cap) next = cap;
    state.lastGoldenAt = now; state.nextGoldenAt = next;
    emit('golden', { spawn: true, buff, life: cfg.orbLife });
  }
  // 玩家点击宝光时调用：限时增益写入 state.goldenBuff 并即时生效；burst 为瞬时修为爆发
  function applyGolden(buffId) {
    const cfg = CONFIG.golden; const buff = cfg.buffs.find(b => b.id === buffId);
    if (!buff) return false;
    const now = Date.now();
    if (buff.burst) {
      const g = Math.floor(currentSpeed() * buff.burst);   // 瞬时修为爆发 = 当前速度 × burst 秒
      state.xp += g; state.totalXp += g;
      pushLog(`🌟 天降洪福！瞬时修为 +${formatNum(g)}`, '✨');
      save(); emit('golden', { applied: true, buff, gain: g }); return true;
    }
    state.goldenBuff = { id: buff.id, name: buff.name, desc: buff.desc, mult: buff.mult, dur: buff.dur, scope: buff.scope, color: buff.color, until: now + buff.dur * 1000 };
    pushLog(`✨ 天降机缘·${buff.name}：${buff.desc}`, '✨');
    save(); emit('golden', { applied: true, buff }); return true;
  }

  /* ---------- 每日签到 ---------- */
  function dateStr(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function todayStr() { return dateStr(new Date()); }
  function yesterdayStr() { const d = new Date(); d.setDate(d.getDate() - 1); return dateStr(d); }
  function hasCheckedInToday() { return state.checkInDate === todayStr(); }
  // 连签中断判定：上次签到不是「今天」也不是「昨天」则归零
  function streakBroken() { return state.checkInDate && state.checkInDate !== yesterdayStr() && state.checkInDate !== todayStr(); }
  // 预览今天应得奖励（不发放），供签到弹窗展示
  function nextCheckInReward() {
    const streak = streakBroken() ? 0 : (state.checkInStreak || 0);
    return { streak, reward: CONFIG.checkIn.rewards[Math.min(streak, CONFIG.checkIn.rewards.length - 1)] };
  }
  function checkIn() {
    if (hasCheckedInToday()) return false;
    const streak = streakBroken() ? 0 : (state.checkInStreak || 0);
    const idx = Math.min(streak, CONFIG.checkIn.rewards.length - 1);
    const rw = CONFIG.checkIn.rewards[idx];
    state.stone += rw.stone; state.materials += rw.mat;
    state.checkInStreak = streak + 1;
    state.checkInDate = todayStr();
    pushLog(`📅 每日签到（第 ${state.checkInStreak} 天）：灵石+${rw.stone} 🌿+${rw.mat}`, '📅');
    save(); emit('checkin', { reward: rw, streak: state.checkInStreak }); return true;
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

  /* ---------- 手动运转周天（含 combo / 暴击） ---------- */
  let clickCombo = 0;          // 连续点击连击数（模块变量，不持久化）
  let lastClickTime = 0;
  function clickCultivate() {
    const now = Date.now();
    if (now - lastClickTime <= CONFIG.combo.window * 1000) clickCombo++;
    else clickCombo = 0;
    lastClickTime = now;
    const comboBonus = Math.min(clickCombo * CONFIG.combo.perStack, CONFIG.combo.max); // 封顶 +max（默认 +3.0 → ×4）
    const comboMult = 1 + comboBonus;
    let gain = Math.max(1, currentSpeed() * CONFIG.clickBase * comboMult);
    const isCrit = Math.random() < CONFIG.combo.critChance;
    if (isCrit) gain = Math.floor(gain * CONFIG.combo.critMult);
    state.xp += gain; state.totalXp += gain;
    let extra = '';
    if (Math.random() < CONFIG.clickStoneChance) { const g = randInt(1, Math.max(2, Math.floor(currentSpeed()))); state.stone += g; extra = `，灵石+${g}`; }
    emit('click', { gain, combo: clickCombo, comboMult, crit: isCrit, extra });
    return { gain, extra, combo: clickCombo, comboMult, crit: isCrit };
  }

  /* ---------- 战斗属性 / 法宝 ---------- */
  function rand(a, b) { return a + Math.random() * (b - a); }
  function qualityMult(tid) { const t = TREASURES.find(x => x.id === tid); return (QUALITY.find(q => q.id === t.quality) || QUALITY[0]).mult; }
  function affixLabel(type) { return { atk: '攻', def: '防', hp: '气血', crit: '暴击', dodge: '闪避', hit: '命中' }[type] || type; }
  function affixText(a, v) { return `${a.name}·${affixLabel(a.type)} +${(v * 100).toFixed(1)}%`; }
  function treasureStats(tid) {
    const t = TREASURES.find(x => x.id === tid); if (!t) return null;
    const own = state.treasures[tid]; const lv = own ? own.level : 0;
    const scale = (1 + lv * 0.1) * qualityMult(tid);
    const out = {};
    for (const k in t.base) out[k] = t.base[k] * scale;
    // 觉醒词缀（条数封顶）：攻/防/血 = 本法宝当前(已缩放)数值的 +pct%；暴击/闪避/命中 = 加性 +value
    const affixes = (own && own.affixes) || [];
    affixes.forEach(af => {
      if (af.kind === 'pct') { if (out[af.type] != null) out[af.type] = out[af.type] * (1 + af.value); }
      else { out[af.type] = (out[af.type] || 0) + af.value; }   // add：命中/闪避/暴击（纯加性）
    });
    return { id: tid, name: t.name, icon: t.icon, slot: t.slot, quality: t.quality, level: lv, attrs: out, affixes };
  }
  // 玩家战斗属性：境界 + 功法 + 洞府 + 丹药 + 悟道 + 灵宠 + 灵根 + 仙缘 + 法宝
  // —— 设计原则 ——
  //  攻/防/气血 以「固定值加法」为主（各养成系统每级/每层加固定值，不封顶），
  //  只有「悟道·大道」是比例倍率（唯一主力比例）；境界提供「战力带」缩放。
  //  命中/闪避/暴击 纯加法累加，不再软封顶（战斗判定时仅把概率夹到 [0,1]）。
  function softCap(raw, cap, k) { return cap * (1 - Math.exp(-raw / k)); } // 保留备用（已不被战斗使用）

  function combatStats() {
    const r = state.realmIndex, l = state.layer;
    // 境界战力带（修炼游戏固有缩放，非封顶）
    const band = CONFIG.combat.bandBase * Math.pow(CONFIG.combat.bandMult, r) * (1 + l * CONFIG.combat.bandLayer);
    // 各养成系统的「训练强度」汇总
    const techSum = TECHNIQUES.reduce((s, t) => s + (state.techniques[t.id] || 0) * t.mult, 0);
    const abodeSum = ABODES.reduce((s, a) => s + (state.abodes[a.id] || 0) * a.mult, 0);
    const pillBonus = pillMult() - 1;
    const petAll = petAllBonus();
    const il = state.insightLv || {};
    const legacy = state.legacy || 0;
    const root = ROOTS.find(x => x.id === state.rootId);
    const rc = root ? ROOT_COMBAT[root.id] : null;

    // —— 攻/防/气血：固定值加法（不封顶）——
    let atk = CONFIG.combat.flatAtk + techSum * CONFIG.combat.techAtk + pillBonus * CONFIG.combat.pillK + petAll * CONFIG.combat.petAllCombat + legacy * CONFIG.combat.legacyCombat;
    let def = CONFIG.combat.flatDef + abodeSum * CONFIG.combat.abodeDef + (il.jie || 0) * CONFIG.combat.insJieDef + pillBonus * CONFIG.combat.pillK + petAll * CONFIG.combat.petAllCombat + legacy * CONFIG.combat.legacyCombat;
    let hp  = CONFIG.combat.flatHp  + abodeSum * CONFIG.combat.abodeHp  + (il.cai || 0) * CONFIG.combat.insCaiHp + pillBonus * CONFIG.combat.pillK + petAll * CONFIG.combat.petAllCombat + legacy * CONFIG.combat.legacyCombat;
    // 功法额外分摊给 防/血
    const ts = techSum * CONFIG.combat.techAtk * CONFIG.combat.techShare;
    def += ts; hp += ts;
    // 灵宠个体（固定值/级）
    PETS.forEach(p => {
      const lv = state.pets[p.id] || 0; if (lv <= 0) return;
      const m = PET_COMBAT[p.id]; if (!m) return;
      if (m.atk) atk += m.atk * lv; if (m.def) def += m.def * lv; if (m.hp) hp += m.hp * lv;
    });
    // 灵根（固定值）
    if (rc) { if (rc.atk) atk += rc.atk; if (rc.def) def += rc.def; if (rc.hp) hp += rc.hp; }
    // 法宝（固定值）
    ['weapon', 'armor', 'trinket'].forEach(slot => {
      const tid = state.equipped[slot]; if (!tid) return;
      const a = treasureStats(tid).attrs;
      if (a.atk) atk += a.atk; if (a.def) def += a.def; if (a.hp) hp += a.hp;
    });
    // 悟道·大道：唯一主力比例倍率（不封顶）
    const daoRatio = 1 + (il.dao || 0) * CONFIG.combat.insDaoAtk;
    atk *= daoRatio; def *= daoRatio; hp *= daoRatio;
    // 境界战力带缩放
    atk *= band; def *= band; hp *= band;

    // —— 命中/闪避/暴击：纯加法，不封顶（combat 判定时夹 [0,1]）——
    let hit = CONFIG.combat.baseHit + r * CONFIG.combat.realmHit;
    let dodge = CONFIG.combat.baseDodge + r * CONFIG.combat.realmDodge;
    let crit = CONFIG.combat.baseCrit + r * CONFIG.combat.realmCrit;
    if (rc) { if (rc.hit) hit += rc.hit; if (rc.dodge) dodge += rc.dodge; if (rc.crit) crit += rc.crit; }
    PETS.forEach(p => {
      const lv = state.pets[p.id] || 0; if (lv <= 0) return;
      const m = PET_COMBAT[p.id]; if (!m) return;
      if (m.hit) hit += m.hit * lv; if (m.dodge) dodge += m.dodge * lv; if (m.crit) crit += m.crit * lv;
    });
    ['weapon', 'armor', 'trinket'].forEach(slot => {
      const tid = state.equipped[slot]; if (!tid) return;
      const a = treasureStats(tid).attrs;
      if (a.hit) hit += a.hit; if (a.dodge) dodge += a.dodge; if (a.crit) crit += a.crit;
    });
    dodge += (il.jie || 0) * CONFIG.combat.insJieDodge;
    crit += (il.dao || 0) * CONFIG.combat.insDaoCrit;

    const power = Math.floor(atk * 2 + def * 1.5 + hp * 0.25 + (hit + dodge + crit) * 120);
    return { atk: Math.floor(atk), def: Math.floor(def), hp: Math.floor(hp), hit, dodge, crit, power };
  }

  // 战斗属性计算过程（显示完整的攻/防/血/命中/闪避/暴击 计算链）
  function combatFormula() {
    const r = state.realmIndex, l = state.layer;
    const C2 = CONFIG.combat;
    const band = C2.bandBase * Math.pow(C2.bandMult, r) * (1 + l * C2.bandLayer);
    const techSum = TECHNIQUES.reduce((s, t) => s + (state.techniques[t.id] || 0) * t.mult, 0);
    const abodeSum = ABODES.reduce((s, a) => s + (state.abodes[a.id] || 0) * a.mult, 0);
    const pillBonus = pillMult() - 1;
    const petAll = petAllBonus();
    const il = state.insightLv || {};
    const legacy = state.legacy || 0;
    const root = ROOTS.find(x => x.id === state.rootId);
    const rc = root ? ROOT_COMBAT[root.id] : null;
    const final = combatStats();
    const techA = techSum * C2.techAtk;
    const ts = techA * C2.techShare;
    const pillF = pillBonus * C2.pillK;
    const paF = petAll * C2.petAllCombat;
    const legF = legacy * C2.legacyCombat;
    let treA = 0, treD = 0, treH = 0;
    ['weapon', 'armor', 'trinket'].forEach(s => { const tid = state.equipped[s]; if (!tid) return; const a = treasureStats(tid).attrs; if (a.atk) treA += a.atk; if (a.def) treD += a.def; if (a.hp) treH += a.hp; });
    let petA = 0, petD = 0, petH = 0;
    PETS.forEach(p => { const lv = state.pets[p.id] || 0; if (lv <= 0) return; const m = PET_COMBAT[p.id]; if (!m) return; if (m.atk) petA += m.atk * lv; if (m.def) petD += m.def * lv; if (m.hp) petH += m.hp * lv; });
    const rootA = rc && rc.atk ? rc.atk : 0, rootD = rc && rc.def ? rc.def : 0, rootH = rc && rc.hp ? rc.hp : 0;
    const jieDef = (il.jie || 0) * C2.insJieDef, caiHp = (il.cai || 0) * C2.insCaiHp;
    const daoRatio = 1 + (il.dao || 0) * C2.insDaoAtk;
    function contribs(list) { return list.filter(([_, v]) => v > 0.01).map(([n, v]) => `${n}+${Math.round(v)}`).join(' '); }
    const atkBracket = C2.flatAtk + techA + pillF + paF + legF + rootA + treA + petA;
    const defBracket = C2.flatDef + abodeSum * C2.abodeDef + jieDef + pillF + paF + legF + rootD + treD + petD + ts;
    const hpBracket = C2.flatHp + abodeSum * C2.abodeHp + caiHp + pillF + paF + legF + rootH + treH + petH + ts;
    function statLine(name, bracket, parts, fin) {
      return `<b>${name}</b> = (${parts}) = ${Math.round(bracket)} ，再 <b>×大道 ${daoRatio.toFixed(2)}</b> ×战力带 ${band.toFixed(2)} = <b>${fin}</b>`;
    }
    // === 命中/闪避/暴击：纯加法，不封顶 ===
    const hitParts = [], dodgeParts = [], critParts = [];
    function pAdd(arr, label, v) { if (v > 0.0001) arr.push(`${label}+${(v * 100).toFixed(1)}%`); }
    let hitPet = 0, dodgePet = 0, critPet = 0;
    PETS.forEach(p => { const lv = state.pets[p.id] || 0; if (lv <= 0) return; const m = PET_COMBAT[p.id]; if (!m) return; if (m.hit) hitPet += m.hit * lv; if (m.dodge) dodgePet += m.dodge * lv; if (m.crit) critPet += m.crit * lv; });
    let hitTre = 0, dodgeTre = 0, critTre = 0;
    ['weapon', 'armor', 'trinket'].forEach(s => { const tid = state.equipped[s]; if (!tid) return; const a = treasureStats(tid).attrs; if (a.hit) hitTre += a.hit; if (a.dodge) dodgeTre += a.dodge; if (a.crit) critTre += a.crit; });
    pAdd(hitParts, '基础', C2.baseHit); if (r > 0) pAdd(hitParts, '境界', r * C2.realmHit); if (hitPet > 0) pAdd(hitParts, '宠物', hitPet); if (rc && rc.hit) pAdd(hitParts, `灵根·${root.name}`, rc.hit); if (hitTre > 0) pAdd(hitParts, '法宝', hitTre);
    pAdd(dodgeParts, '基础', C2.baseDodge); if (r > 0) pAdd(dodgeParts, '境界', r * C2.realmDodge); if ((il.jie || 0) > 0) pAdd(dodgeParts, '悟道·渡劫', (il.jie || 0) * C2.insJieDodge); if (dodgePet > 0) pAdd(dodgeParts, '宠物', dodgePet); if (rc && rc.dodge) pAdd(dodgeParts, `灵根·${root.name}`, rc.dodge); if (dodgeTre > 0) pAdd(dodgeParts, '法宝', dodgeTre);
    pAdd(critParts, '基础', C2.baseCrit); if (r > 0) pAdd(critParts, '境界', r * C2.realmCrit); if ((il.dao || 0) > 0) pAdd(critParts, '悟道·大道', (il.dao || 0) * C2.insDaoCrit); if (critPet > 0) pAdd(critParts, '宠物', critPet); if (rc && rc.crit) pAdd(critParts, `灵根·${root.name}`, rc.crit); if (critTre > 0) pAdd(critParts, '法宝', critTre);
    return [
      statLine('攻', atkBracket, contribs([['基础', C2.flatAtk], ['功法', techA], ['灵宠全', paF], ['仙缘', legF], ['灵根', rootA], ['法宝', treA], ['灵宠', petA]]), final.atk),
      statLine('防', defBracket, contribs([['基础', C2.flatDef], ['洞府', abodeSum * C2.abodeDef], ['渡劫', jieDef], ['灵宠全', paF], ['仙缘', legF], ['灵根', rootD], ['法宝', treD], ['灵宠', petD], ['功法分摊', ts]]), final.def),
      statLine('血', hpBracket, contribs([['基础', C2.flatHp], ['洞府', abodeSum * C2.abodeHp], ['聚财', caiHp], ['灵宠全', paF], ['仙缘', legF], ['灵根', rootH], ['法宝', treH], ['灵宠', petH], ['功法分摊', ts]]), final.hp),
      '',
      `<b>命中</b>（加法·不封顶）= ${hitParts.join(' + ')} = <b>${(final.hit * 100).toFixed(1)}%</b>`,
      `<b>闪避</b>（加法·不封顶）= ${dodgeParts.join(' + ')} = <b>${(final.dodge * 100).toFixed(1)}%</b>（战斗按 dodge/(1+dodge) 折算有效闪避，永不满 100% 无敌）`,
      `<b>暴击</b>（加法·不封顶）= ${critParts.join(' + ')} = <b>${(final.crit * 100).toFixed(1)}%</b>`
    ];
  }

  // 战斗属性来源汇总（用于 UI 展示）—— 固定值加法视角
  function combatBreakdown() {
    const items = [];
    const r = state.realmIndex, l = state.layer;
    const C2 = CONFIG.combat;
    const techSum = TECHNIQUES.reduce((s, t) => s + (state.techniques[t.id] || 0) * t.mult, 0);
    const abodeSum = ABODES.reduce((s, a) => s + (state.abodes[a.id] || 0) * a.mult, 0);
    const pillBonus = pillMult() - 1;
    const petAll = petAllBonus();
    const il = state.insightLv || {};
    const legacy = state.legacy || 0;
    const root = ROOTS.find(x => x.id === state.rootId);
    function ab(s) { return s === 'atk' ? '攻' : s === 'def' ? '防' : s === 'hp' ? '气血' : s === 'hit' ? '命中' : s === 'dodge' ? '闪避' : '暴击'; }
    const band = C2.bandBase * Math.pow(C2.bandMult, r) * (1 + l * C2.bandLayer);
    if (r > 0 || l > 0) items.push({ icon: '🧘', name: '境界', desc: `战力带 ×${band.toFixed(2)}（攻/防/血随大境界放大，不封顶）` });
    if (techSum > 0) items.push({ icon: '📜', name: '功法', desc: `攻 +${Math.round(techSum * C2.techAtk)} ，防/血 +${Math.round(techSum * C2.techAtk * C2.techShare)}（固定值）` });
    if (abodeSum > 0) items.push({ icon: '⛰️', name: '洞府', desc: `防 +${Math.round(abodeSum * C2.abodeDef)} ，血 +${Math.round(abodeSum * C2.abodeHp)}（固定值）` });
    if (legacy > 0) items.push({ icon: '🔁', name: '仙缘', desc: `攻/防/血 +${Math.round(legacy * C2.legacyCombat)}（固定值）` });
    if (petAll > 0) items.push({ icon: '🦄', name: '灵宠·獬豸', desc: `攻/防/血 +${Math.round(petAll * C2.petAllCombat)}（固定值）` });
    PETS.forEach(p => { const lv = state.pets[p.id] || 0; if (lv <= 0) return; const m = PET_COMBAT[p.id]; if (!m) return; const e = []; for (const k in m) e.push(`${ab(k)}+${Math.round(m[k] * lv)}`); if (e.length) items.push({ icon: p.icon, name: '灵宠·' + p.name, desc: e.join(' ') }); });
    const d = il.dao || 0, j = il.jie || 0, c = il.cai || 0;
    if (d > 0) items.push({ icon: '☯️', name: '悟道·大道', desc: `攻 ×${(1 + d * C2.insDaoAtk).toFixed(2)}（比例，唯一主力），暴击 +${(d * C2.insDaoCrit * 100).toFixed(1)}%` });
    if (j > 0) items.push({ icon: '⚡', name: '悟道·渡劫', desc: `防 +${j * C2.insJieDef} ，闪避 +${(j * C2.insJieDodge * 100).toFixed(1)}%` });
    if (c > 0) items.push({ icon: '💰', name: '悟道·聚财', desc: `血 +${c * C2.insCaiHp}` });
    if (root) { const rc = ROOT_COMBAT[root.id]; if (rc) { const e = []; for (const k in rc) e.push(`${ab(k)}+${k === 'hit' || k === 'dodge' || k === 'crit' ? Math.round(rc[k] * 100) + '%' : Math.round(rc[k])}`); items.push({ icon: root.icon, name: '灵根·' + root.name, desc: e.join(' ') }); } }
    ['weapon', 'armor', 'trinket'].forEach(s => {
      const tid = state.equipped[s]; if (!tid) return;
      const ts = treasureStats(tid); if (!ts) return;
      const e = []; for (const k in ts.attrs) e.push(`${ab(k)}+${k === 'hit' || k === 'dodge' || k === 'crit' ? Math.round(ts.attrs[k] * 100) + '%' : Math.round(ts.attrs[k])}`);
      const aw = (ts.affixes && ts.affixes.length) ? ` · 觉醒×${ts.affixes.length}` : '';
      items.push({ icon: TREASURES.find(t => t.id === tid).icon, name: '法宝·' + ts.name + aw, desc: e.join(' ') });
    });
    return items;
  }

  function canBattle() { return Date.now() >= state.battleCd; }
  function battleCooldownLeft() { return Math.max(0, Math.ceil((state.battleCd - Date.now()) / 1000)); }
  // 关卡解锁：首图默认开；同图需上一关已通关；非首图需上一张图 BOSS 已通关；且需满足境界要求
  function isLevelUnlocked(mapId, idx) {
    const map = MAPS.find(m => m.id === mapId); if (!map) return false;
    const mi = MAPS.findIndex(m => m.id === mapId);
    if (map.realmReq !== undefined && state.realmIndex < map.realmReq) return false;
    if (mi > 0) { const prev = MAPS[mi - 1]; if (state.mapProgress[prev.id] === undefined || state.mapProgress[prev.id] < prev.levels.length - 1) return false; }
    if (idx === 0) return true;
    const cleared = state.mapProgress[mapId];
    return cleared !== undefined && cleared >= idx - 1;
  }
  // 回合制模拟战斗：命中/闪避/暴击/伤害浮动 全程 RNG
  // 闪避用软映射 dodge/(1+dodge)：数值可无限涨，有效闪避恒 <1（不会出现"永远打不中"的无敌态）
  function softDodge(x) { return x / (1 + x); }
  function simulateCombat(enemy) {
    const p = combatStats(), e = enemy;
    let pHp = p.hp, eHp = e.hp, round = 0;
    const log = [];
    const v = CONFIG.combat.variance, cm = CONFIG.combat.critMult, dm = CONFIG.combat.defMit;
    while (pHp > 0 && eHp > 0 && round < CONFIG.combat.maxRounds) {
      round++;
      if (Math.random() < Math.min(1, Math.max(0, p.hit * (1 - softDodge(e.dodge))))) {
        let dmg = p.atk * rand(1 - v, 1 + v); const isCrit = Math.random() < Math.min(1, p.crit);
        if (isCrit) dmg *= cm;
        dmg = Math.max(1, dmg - e.def * dm); eHp -= dmg;
        log.push({ side: 'p', miss: false, crit: isCrit, dmg: Math.floor(dmg) });
      } else log.push({ side: 'p', miss: true });
      if (eHp <= 0) break;
      if (Math.random() < Math.min(1, Math.max(0, e.hit * (1 - softDodge(p.dodge))))) {
        let dmg = e.atk * rand(1 - v, 1 + v); const isCrit = Math.random() < Math.min(1, e.crit);
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
      const stone = Math.floor(randInt(lv.reward.stone[0], lv.reward.stone[1]) * 0.45);
      const mat = randInt(lv.reward.mat[0], lv.reward.mat[1]);
      const xp = Math.floor(currentSpeed() * (lv.boss ? 18 : 6)); // 战利品修为 = 修炼速度×秒数，普怪持平修炼、BOSS三倍
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

  // ---------- 无尽试炼塔 ----------
  function towerEnemy(floor) {
    const p = combatStats();
    const d = CONFIG.combat.towerBase + floor * CONFIG.combat.towerStep;
    const isBoss = floor % 10 === 0;
    const icons = ['👁️', '🌑', '☠️', '🔥', '❄️', '⚡', '🌪️', '💀', '🐉', '👹'];
    const icon = isBoss ? '👑' : icons[(floor - 1) % icons.length];
    return {
      name: '试炼塔第 ' + floor + ' 层' + (isBoss ? '·守关者' : ''),
      icon: icon,
      boss: isBoss,
      atk: Math.floor(p.atk * d),
      def: Math.floor(p.def * d),
      hp: Math.floor(p.hp * d),
      hit: p.hit,                                  // 命中/闪避跟随玩家，不随层数失控
      dodge: p.dodge * 0.85,
      crit: Math.min(1, p.crit * 0.8),
      reward: {
        stone: [Math.floor(p.power * d * 0.2), Math.floor(p.power * d * 0.5)],
        mat: [Math.floor(floor * 0.3) + 1, Math.floor(floor * 0.5) + 3],
        xp: [1, 1]  // xp 由 towerFight 按当前速度动态计算
      },
      drop: { chance: 0.25 + Math.min(0.25, floor * 0.01), pool: TREASURES.map(t => t.id) }
    };
  }
  function towerFight(floor) {
    if (!canBattle()) return { error: 'cd' };
    if (floor > state.towerFloor + 1) return { error: 'locked' };
    state.battleCd = Date.now() + CONFIG.combat.battleCd * 1000;
    state.battles++;
    const lv = towerEnemy(floor);
    lv._mapId = 'tower';
    const res = simulateCombat(lv);
    let reward = null, drop = null;
    if (res.win) {
      const stone = Math.floor(randInt(lv.reward.stone[0], lv.reward.stone[1]) * 0.45);
      const mat = randInt(lv.reward.mat[0], lv.reward.mat[1]);
      const d = CONFIG.combat.towerBase + floor * CONFIG.combat.towerStep;
      const xp = Math.floor(currentSpeed() * (lv.boss ? 24 : 8) * d);
      state.stone += stone; state.materials += mat; state.xp += xp; state.totalXp += xp;
      reward = { stone, mat, xp };
      if (floor > state.towerFloor) state.towerFloor = floor;
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
      pushLog(`🗼 试炼塔第 ${floor} 层胜！灵石+${formatNum(stone)} 🌿+${mat} 修为+${formatNum(xp)}${drop ? '，得法宝' + drop.icon + drop.name : ''}`, lv.icon);
    } else {
      pushLog(`🗼 试炼塔第 ${floor} 层败，还需磨砺。`, lv.icon);
    }
    save(); emit('battle', { res, reward, drop, level: lv, mapId: 'tower', idx: floor, win: res.win });
    return { res, reward, drop, win: res.win, level: lv };
  }

  function hasTreasure(tid) { return state.treasures[tid] && state.treasures[tid].count > 0; }
  function equipTreasure(tid) {
    const t = TREASURES.find(x => x.id === tid); if (!t || !hasTreasure(tid)) return false;
    state.equipped[t.slot] = tid;
    pushLog(`装备${t.icon}${t.name}`, t.icon); save(); emit('treasure', { action: 'equip', tid }); return true;
  }
  function unequip(slot) {
    if (!state.equipped[slot]) return false;
    const tid = state.equipped[slot]; state.equipped[slot] = null;
    const t = TREASURES.find(x => x.id === tid);
    pushLog(`卸下${t ? t.name : slot}`, '💎'); save(); emit('treasure', { action: 'unequip', tid }); return true;
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
    pushLog(`🔨 ${t.name}强化至 ${own.level} 级`, t.icon); save(); emit('treasure', { action: 'enhance', tid, level: own.level }); return true;
  }
  // 熔炼：已装备件永不卸下；其余（多余）件一次性全部熔炼为天材地宝
  function smeltTreasure(tid) {
    const t = TREASURES.find(x => x.id === tid); const own = state.treasures[tid];
    if (!t || !own || own.count <= 0) return false;
    const equipped = state.equipped[t.slot] === tid;
    // 保护最后 1 件：当仅持有 1 件时（无论是否装备）一律保留，绝不直接删掉唯一法宝
    const keep = own.count <= 1 ? own.count : (equipped ? 1 : 0);
    const melt = own.count - keep;
    if (melt <= 0) return false;            // 仅剩 1 件，已为你保留，不熔
    own.count -= melt;
    const gain = CONFIG.treasure.smeltMatPerQuality * t.quality * melt;
    state.materials += gain;
    pushLog(`🔥 熔炼${t.name}（${melt} 件），得天材地宝 +${gain}`, t.icon); save(); emit('treasure', { action: 'smelt', tid, gain }); return true;
  }
  // 法宝觉醒：满级后方可觉醒，消耗天材地宝随机赋予词缀（条数封顶）；已满 3 条则「再觉醒=重 roll 全部」
  function awakenCost(tid) {
    const own = state.treasures[tid]; if (!own) return null;
    const n = (own.affixes || []).length;
    return Math.floor(CONFIG.awaken.costBase * Math.pow(CONFIG.awaken.costGrowth, n));
  }
  function rollAffix() {
    const pool = CONFIG.awaken.affixes;
    const a = pool[Math.floor(Math.random() * pool.length)];
    const value = a.min + Math.random() * (a.max - a.min);
    return { type: a.type, kind: a.kind, value: +value.toFixed(4), name: a.name };
  }
  function awakenTreasure(tid) {
    const t = TREASURES.find(x => x.id === tid); const own = state.treasures[tid];
    if (!t || !own || own.level < CONFIG.treasure.maxLevel) return false;
    const cost = awakenCost(tid);
    if (state.materials < cost) return false;
    state.materials -= cost;
    let affixes = own.affixes || [];
    let last;
    if (affixes.length >= CONFIG.awaken.maxAffixes) {
      affixes = [];
      for (let i = 0; i < CONFIG.awaken.maxAffixes; i++) affixes.push(rollAffix());   // 满 3 条 → 重 roll 全部
      last = affixes[affixes.length - 1];
      pushLog(`🌟 ${t.name}重铸觉醒：${affixText(last, last.value)} 等 ${affixes.length} 条`, t.icon);
    } else {
      last = rollAffix(); affixes.push(last);
      pushLog(`🌟 ${t.name}觉醒：${affixText(last, last.value)}`, t.icon);
    }
    own.affixes = affixes;
    save(); emit('treasure', { action: 'awaken', tid });
    return true;
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
        // 新字段兜底 + 天降机缘：清除可能过期的增益；离线收益不计入 goldenBuff
        state.goldenBuff = null;
        state.nextGoldenAt = (state.nextGoldenAt && state.nextGoldenAt > Date.now())
          ? state.nextGoldenAt : (Date.now() + randInt(CONFIG.golden.minInterval, CONFIG.golden.maxInterval) * 1000);
        if (state.lastGoldenAt === undefined || state.lastGoldenAt > Date.now()) state.lastGoldenAt = Date.now();
        if (state.checkInDate === undefined) state.checkInDate = '';
        if (state.checkInStreak === undefined) state.checkInStreak = 0;
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
    clickCombo = 0; lastClickTime = 0;   // combo 不持久化，载入即归零
    checkAchievements();
    lastTick = Date.now();
    return offline;
  }
  function reset() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
    state = defaultState(); lastTick = Date.now();
    clickCombo = 0; lastClickTime = 0;
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
    techniqueFlat, techniqueTopRatio, abodeFlat, abodeTopRatio, pillMult, legacyMult, rootMult, petAllBonus, petOutPerSec, getTotalLayers,
    formatNum, formatSpeed, formatTime,
    combatStats, currentSpeed, qualityMult, treasureStats, canBattle, battleCooldownLeft, isLevelUnlocked, fight, simulateCombat, towerEnemy, towerFight, softCap, combatBreakdown, combatFormula,
    hasTreasure, equipTreasure, unequip, enhanceCost, enhanceTreasure, smeltTreasure, awakenTreasure, awakenCost,
    applyGolden, goldenActive,
    checkIn, hasCheckedInToday, nextCheckInReward,
    get state() { return state; },
    get REALMS() { return REALMS; }, get ROOTS() { return ROOTS; }, get TECHNIQUES() { return TECHNIQUES; },
    get ABODES() { return ABODES; }, get PILLS() { return PILLS; }, get PETS() { return PETS; },
    get SECRET_REALMS() { return SECRET_REALMS; }, get INSIGHTS() { return INSIGHTS; },
    get EVENTS() { return EVENTS; }, get ACHIEVEMENTS() { return ACHIEVEMENTS; },
    get QUALITY() { return QUALITY; }, get TREASURES() { return TREASURES; }, get MAPS() { return MAPS; },
    LAYERS_PER_REALM, CHINESE_LAYER
  };
})();
