/* ============================================================
 * 放置修仙 · 材料经济模拟 (tools/material_sim.js)
 * ------------------------------------------------------------
 * 在 tools/balance_sim.js 的事件驱动成长循环之上，加入「材料经济」闭环：
 *   - 成长(修炼/破境) 被动推进（与 balance_sim 一致）
 *   - 战斗：每 battleCd 秒可战一次，farm 当前可胜的最高关，获得 天材地宝 + 法宝掉落
 *   - 法宝：掉落→装备最优→(满级后)觉醒；多余件熔炼为材料
 *   - 灵宠：寻妖捕捉 + 喂养（材料）
 *   - 材料分配策略：贪婪「每材料战力增量最大化」= 在 强化/觉醒/喂宠 中选性价比最高者
 *   - 终局校验：用「经济可负担的真实装备」重跑战斗胜率矩阵，确认 大乘遗迹/天道台 可达
 *
 * 用法：
 *   node tools/material_sim.js                 # 默认：12 种子，战斗为主，不探秘境
 *   OVERRIDE="cultBandMult=2.2" node tools/material_sim.js
 *   EXPLORE=0.2 node tools/material_sim.js     # 额外把 20% 灵石净收入用于探秘境补材料
 * ============================================================ */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data.js');
const GAME = path.join(ROOT, 'game.js');

/* ---------- 可控 RNG (mulberry32) ---------- */
let _seed = 123456789;
function seedRNG(s) { _seed = s >>> 0; }
function rng() {
  _seed |= 0; _seed = (_seed + 0x6D2B79F5) | 0;
  let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
Math.random = rng;

const EXPLORE_FRAC = Number(process.env.EXPLORE || 0);

function parseOverrides() {
  const ov = {};
  const raw = process.env.OVERRIDE || '';
  raw.split(',').map(s => s.trim()).filter(Boolean).forEach(pair => {
    const [k, v] = pair.split('=');
    if (k && v !== undefined) ov[k.trim()] = Number(v);
  });
  return ov;
}
const OVERRIDES = parseOverrides();

function makeGame() {
  let dataSrc = fs.readFileSync(DATA, 'utf8');
  for (const [k, v] of Object.entries(OVERRIDES)) {
    const re = new RegExp('(\\b' + k + '\\b\\s*:\\s*)([0-9.eE+\\-]+)(,)');
    if (!re.test(dataSrc)) throw new Error('override 键不存在: ' + k);
    dataSrc = dataSrc.replace(re, '$1' + v + '$3');
  }
  const gameSrc = fs.readFileSync(GAME, 'utf8');
  global.localStorage = { _d: {}, getItem(k){return this._d[k]!==undefined?this._d[k]:null;}, setItem(k,v){this._d[k]=String(v);}, removeItem(k){delete this._d[k];} };
  global.window = { addEventListener(){} };
  return (new Function(dataSrc + '\n' + gameSrc + '\nreturn Game;'))();
}

function advance(g, dt) {
  const s = g.state;
  const sp = g.currentSpeed();
  const gain = sp * dt; s.xp += gain; s.totalXp += gain;
  s.stone += g.stoneSpeed() * dt;
  s.xp += g.petOutPerSec('xp') * dt; s.totalXp += g.petOutPerSec('xp') * dt;
  s.stone += g.petOutPerSec('stone') * dt;
  s.materials += g.petOutPerSec('mat') * dt;
}
// 与 advance 同步，并把灵宠材料产出记入 rec（避免漏记）
function advanceAndTrack(g, dt, rec) {
  advance(g, dt);
  if (rec) rec.mat.pet += g.petOutPerSec('mat') * dt;
}

function combatPower(g) { return g.combatStats().power; }

/* ---------- 战斗胜率采样 ---------- */
function winRate(g, enemy, trials) {
  let w = 0;
  for (let i = 0; i < trials; i++) if (g.simulateCombat(enemy).win) w++;
  return w / trials;
}

/* ---------- 寻找当前可 farm 的最高关 ---------- */
function bestFarmTarget(g, cache) {
  let best = null;
  const maps = g.MAPS;
  for (let mi = 0; mi < maps.length; mi++) {
    const map = maps[mi];
    if (map.realmReq > g.state.realmIndex) continue;
    if (mi > 0) { const prev = maps[mi - 1]; if ((g.state.mapProgress[prev.id] || -1) < prev.levels.length - 1) continue; }
    let topWinnable = -1, topWr = 0;
    for (let idx = map.levels.length - 1; idx >= 0; idx--) {
      if (idx > 0 && (g.state.mapProgress[map.id] || -1) < idx - 1) continue;
      const key = mi + ':' + idx;
      let wr;
      if (cache && cache.has(key)) wr = cache.get(key);
      else { wr = winRate(g, map.levels[idx], 20); if (cache) cache.set(key, wr); }
      if (wr >= 0.30) { topWinnable = idx; topWr = wr; break; }
    }
    if (topWinnable >= 0 && (!best || mi > best.mi)) best = { mi, map, idx: topWinnable, lv: map.levels[topWinnable], wr: topWr };
  }
  return best;
}

/* ---------- 应用 farm 收益（nFights 已是折算好的战斗次数） ---------- */
function applyFarm(g, target, nFights, rec) {
  const s = g.state;
  if (!target || nFights <= 0) return 0;
  const lv = target.lv;
  const wins = nFights * target.wr;
  const avgMat = (lv.reward.mat[0] + lv.reward.mat[1]) / 2;
  const avgStone = (lv.reward.stone[0] + lv.reward.stone[1]) / 2 * 0.45;
  const xpGain = g.currentSpeed() * (lv.boss ? 18 : 6) * wins;
  s.materials += avgMat * wins; s.stone += avgStone * wins; s.xp += xpGain; s.totalXp += xpGain;
  rec.mat.combat += avgMat * wins;
  const dropChance = (lv.drop.chance || 0);
  for (let f = 0; f < nFights; f++) {
    if (Math.random() < target.wr * dropChance) {
      const pool = lv.drop.pool; const tid = pool[Math.floor(Math.random() * pool.length)];
      if (!s.treasures[tid]) s.treasures[tid] = { count: 0, level: 0, affixes: [] };
      s.treasures[tid].count++;
    }
  }
  s.mapProgress[target.map.id] = Math.max(s.mapProgress[target.map.id] || -1, target.idx);
  if (lv.boss) s.bossKills += Math.floor(wins);
  s.battles += nFights;
  return nFights;
}

/* ---------- 装备每槽最优 + 熔炼多余 ---------- */
function equipAndSmelt(g, rec) {
  const s = g.state;
  for (const slot of ['weapon', 'armor', 'trinket']) {
    let bestTid = null, bestQ = -1;
    for (const tid in s.treasures) {
      const t = g.TREASURES.find(x => x.id === tid); if (!t || t.slot !== slot) continue;
      if (s.treasures[tid].count <= 0) continue;
      if (t.quality > bestQ) { bestQ = t.quality; bestTid = tid; }
    }
    if (bestTid) {
      s.equipped[slot] = bestTid;
      // 熔炼该槽其余所有件（保留已装备最优件）
      for (const tid in s.treasures) {
        const t = g.TREASURES.find(x => x.id === tid); if (!t || t.slot !== slot) continue;
        if (tid === bestTid) continue;
        if (s.treasures[tid].count > 0) { const before = s.materials; g.smeltTreasure(tid); if (rec) rec.mat.smelt += (s.materials - before); }
      }
    }
  }
}

/* ---------- 贪婪材料分配：每材料战力增量最大化 ---------- */
function spendMaterials(g, rec) {
  const s = g.state;
  const MAX_STEPS = 4000;
  let steps = 0;
  while (steps++ < MAX_STEPS) {
    if (s.materials < 1) break;
    let best = null; // {kind, id?, dPow, cost, need}
    // 候选：装备中的法宝强化
    for (const slot of ['weapon', 'armor', 'trinket']) {
      const tid = s.equipped[slot]; if (!tid) continue;
      const own = s.treasures[tid]; if (!own || own.level >= CONFIG_TREASURE_MAX) continue;
      const cost = g.enhanceCost(tid);
      if (s.materials < cost.mat || s.stone < cost.stone) continue;
      const p0 = combatPower(g);
      g.enhanceTreasure(tid); const p1 = combatPower(g); g.state.treasures[tid].level--;
      const d = (p1 - p0) / cost.mat;
      if (!best || d > best.d) best = { kind: 'enhance', id: tid, d, cost: cost.mat };
    }
    // 候选：满级法宝觉醒
    for (const slot of ['weapon', 'armor', 'trinket']) {
      const tid = s.equipped[slot]; if (!tid) continue;
      const own = s.treasures[tid]; if (!own || own.level < CONFIG_TREASURE_MAX) continue;
      if ((own.affixes || []).length >= CONFIG_AWAKEN_MAX) continue;
      const cost = g.awakenCost(tid);
      if (s.materials < cost) continue;
      const p0 = combatPower(g);
      // 模拟觉醒（复制状态计算增量）
      const aff = own.affixes || [];
      const p1 = combatPowerWithAffix(g, tid, aff);
      const d = (p1 - p0) / cost;
      if (!best || d > best.d) best = { kind: 'awaken', id: tid, d, cost };
    }
    // 候选：喂养灵宠
    for (const p of g.PETS) {
      const lv = s.pets[p.id] || 0; if (lv <= 0 || lv >= p.max) continue;
      const cost = g.feedCost(p.id);
      if (s.materials < cost) continue;
      const p0 = combatPower(g);
      s.pets[p.id] = lv + 1; const p1 = combatPower(g); s.pets[p.id] = lv;
      const d = (p1 - p0) / cost;
      if (!best || d > best.d) best = { kind: 'feed', id: p.id, d, cost };
    }
    if (!best) break;
    // 执行
    if (best.kind === 'enhance') { g.enhanceTreasure(best.id); rec.mat.spentEnh += best.cost; }
    else if (best.kind === 'awaken') { g.awakenTreasure(best.id); rec.mat.spentAwk += best.cost; }
    else if (best.kind === 'feed') { g.feedPet(best.id); rec.mat.spentFeed += best.cost; }
  }
}

// 模拟「给某法宝追加一条随机高价值词缀」后的战力（用于觉醒性价比；取池内均值近似）
function combatPowerWithAffix(g, tid, aff) {
  // 用池内最大 pct 词缀（+18%）近似觉醒一次性收益，作为性价比上界参考
  const own = g.state.treasures[tid];
  const saved = own.affixes;
  own.affixes = (aff || []).concat([{ type: 'atk', kind: 'pct', value: 0.18 }]);
  const p = g.combatStats().power;
  own.affixes = saved;
  return p;
}

/* ---------- 主成长+材料 闭环 ---------- */
let CONFIG_BATTLE_CD = 6, CONFIG_TREASURE_MAX = 20, CONFIG_AWAKEN_MAX = 3, CONFIG_CHECKIN_LEN = 7;
let CONFIG_CHECKIN = [];
function simProgression(rootId, seed, maxT, opts) {
  opts = opts || {};
  const speedBoost = opts.speedBoost !== false;    // 默认 true：避劫丹常驻 → 修炼速度 +flat（限时常驻，与必成解耦；v5 丹药已改固定值）
  const guarantee  = opts.guarantee !== false;      // 默认 true：大境界必成（试炼/平衡基线）；false → 真实掷骰
  const mercy = opts.mercy || null;                // 保底：{ guarantee: N } 连续失败 N 次后下次必成
  seedRNG(seed);
  const g = makeGame(); const s = g.state;
  g.setRoot(rootId); s.pills.bijie = speedBoost ? 1e9 : 0;
  const fails = { total: 0, byRealm: {}, maxStreak: 0, curStreak: 0, forced: 0 };
  let t = 0, guard = 0, prevRealm = 0, fightAccum = 0;
  const realmEnterT = {}, realmMatAtEnter = {}, realmGearAtEnter = {}, realmPetAtEnter = {};
  const rec = { mat: { combat: 0, explore: 0, event: 0, checkin: 0, pet: 0, seek: 0, smelt: 0,
                       spentEnh: 0, spentAwk: 0, spentFeed: 0 } };
  const exploreCostCache = {};

  function recRealm() {
    if (s.realmIndex !== prevRealm) {
      realmEnterT[s.realmIndex] = t;
      realmMatAtEnter[s.realmIndex] = s.materials;
      realmGearAtEnter[s.realmIndex] = gearSnapshot(g);
      realmPetAtEnter[s.realmIndex] = Object.assign({}, s.pets);
      prevRealm = s.realmIndex;
      if (process.env.DEBUG) {
        const dbt = bestFarmTarget(g, new Map());
        const cs = g.combatStats();
        console.error(`  [DBG] realm=${s.realmIndex} t=${(t/86400).toFixed(2)}d mat=${Math.round(s.materials)} atk=${cs.atk} def=${cs.def} hp=${cs.hp} fightCap=${Math.floor(t/CONFIG_BATTLE_CD)} fightDone=${fightAccum} target=${dbt?dbt.map.name+'#'+dbt.idx+' wr='+dbt.wr.toFixed(2):'NULL'}`);
      }
    }
  }
  recRealm();

  // 渡劫逻辑：speedBoost 仅控制 bijie 的 flat 速度加成；guarantee 控制必成；二者解耦以便隔离「失败」本身的节奏影响
  function tryBreak() {
    if (!g.isMajorBreak()) { g.doBreak(); return; }
    if (guarantee) { const old = s.pills.bijie; s.pills.bijie = 1e9; g.doBreak(); s.pills.bijie = old; return; }
    if (mercy && fails.curStreak >= mercy.guarantee) {
      const old = s.pills.bijie; s.pills.bijie = 1e9; g.doBreak(); s.pills.bijie = old;
      fails.forced++; fails.curStreak = 0; return;
    }
    const old = s.pills.bijie; s.pills.bijie = 0; const r = g.doBreak(); s.pills.bijie = old;
    if (r === 'fail') {
      fails.curStreak++; fails.total++;
      fails.byRealm[s.realmIndex] = (fails.byRealm[s.realmIndex] || 0) + 1;
      if (fails.curStreak > fails.maxStreak) fails.maxStreak = fails.curStreak;
    } else fails.curStreak = 0;
  }

  let lastTarget = null, lastTargetRealm = -1;
  while (t < maxT && guard < 6000000) {
    guard++;
    if (process.env.DEBUG && guard % 2000 === 0) console.error(`[DBG-TOP] g=${guard} r=${s.realmIndex} l=${s.layer} canBr=${g.canBreak()} fa=${fightAccum} t=${(t/86400).toFixed(3)}d mat=${Math.round(s.materials)}`);
    // 计算下一步修炼决策
    const sp = g.currentSpeed(), sr = g.stoneSpeed(), xr = sp + g.petOutPerSec('xp');
    const tB = (g.breakCost() - s.xp) / xr;
    let best = null;
    for (const td of g.TECHNIQUES) { const lv = s.techniques[td.id] || 0; if (lv >= td.max) continue; const p = g.techniquePrice(td.id); const n = p - s.stone; const tm = n > 0 ? n / sr : 0; if (!best || tm < best.time) best = { time: tm, kind: 'tech', id: td.id }; }
    for (const ad of g.ABODES) { const lv = s.abodes[ad.id] || 0; if (lv >= ad.max) continue; const p = g.abodePrice(ad.id); const n = p - s.stone; const tm = n > 0 ? n / sr : 0; if (!best || tm < best.time) best = { time: tm, kind: 'abode', id: ad.id }; }
    const dl = s.insightLv.dao || 0; if (dl < 50 && s.insight >= g.insightPrice('dao')) best = { time: 0, kind: 'ins', id: 'dao' };
    const nt = Math.min(tB, best ? best.time : Infinity);

    // 时间步长：破境即时；否则取「下次购买等待」与最小步长 1 秒（买得起也推进真实时间并 farm）
    let dt;
    if (!isFinite(nt)) dt = 60;
    else if (nt < 1e-6) dt = 1;
    else dt = nt;

    // —— 每 epoch 必做：推进真实时间 + 战斗farm + 材料分配 ——
    advanceAndTrack(g, dt, rec); t += dt;

    // 寻妖捕捉（未集齐 4 宠且灵石充裕）
    const caught = g.PETS.filter(p => (s.pets[p.id] || 0) > 0).length;
    if (caught < g.PETS.length && s.stone > g.seekCost() * 2) { if (g.seekPet()) rec.mat.seek += 1; }

    // 探秘境（可选，补充材料；净亏灵石换材料）
    if (EXPLORE_FRAC > 0) {
      let rid = null, rc = 1e18;
      for (const r of g.SECRET_REALMS) { if (s.stone > r.cost * 2 && r.cost < rc) { rc = r.cost; rid = r; } }
      if (rid) {
        let nE = Math.floor((s.stone * EXPLORE_FRAC) / rid.cost);
        nE = Math.min(nE, Math.floor(dt / 3));
        const spd = g.currentSpeed();
        for (let i = 0; i < nE; i++) {
          const xp = Math.floor(spd * (3 + Math.random() * 5));
          const mat = (rid.mat[0] + Math.random() * (rid.mat[1] - rid.mat[0] + 1)) | 0;
          const stone = Math.floor((rid.stone[0] + Math.random() * (rid.stone[1] - rid.stone[0] + 1)) * 0.25);
          s.xp += xp; s.totalXp += xp; s.stone += stone - rid.cost; s.materials += mat;
          rec.mat.explore += mat;
        }
      }
    }

    // 战斗 farm（容量 = 累计真实时间 / battleCd，与修炼并行，不局限于决策间隔）
    // 跨 epoch 缓存 target：仅境界变化或当前 target 失守时重算胜率
    if (!lastTarget || s.realmIndex !== lastTargetRealm || winRate(g, lastTarget.lv, 8) < 0.30) {
      lastTarget = bestFarmTarget(g, new Map());
      lastTargetRealm = s.realmIndex;
    }
    const target = lastTarget;
    if (process.env.DEBUG && guard % 2000 === 0) console.error(`  [DBG-FARM] r=${s.realmIndex} target=${target ? target.map.name + '#' + target.idx + ' wr=' + target.wr.toFixed(2) : 'NULL'} tf=${Math.floor(t / CONFIG_BATTLE_CD) - fightAccum}`);
    if (target) {
      const totalFights = Math.floor(t / CONFIG_BATTLE_CD) - fightAccum;
      if (totalFights > 0) { fightAccum += totalFights; applyFarm(g, target, totalFights, rec); }
    }

    // 奇遇（约每 ~37s 一次，仅 baoyao 给材料）
    const evRate = dt / 37.5;
    let evN = Math.floor(evRate) + (Math.random() < (evRate % 1) ? 1 : 0);
    for (let i = 0; i < evN; i++) {
      const ev = g.EVENTS[Math.floor(Math.random() * g.EVENTS.length)];
      if (ev.reward.mat) { const mm = ev.reward.mat(); s.materials += mm; rec.mat.event += mm; }
    }

    // 每日签到（约每 86400s 一次）
    if (Math.floor(t / 86400) > Math.floor((t - dt) / 86400)) {
      const idx = Math.min((s.checkInStreak || 0), Math.max(0, CONFIG_CHECKIN_LEN - 1));
      const rw = CONFIG_CHECKIN[idx];
      if (rw) { s.stone += rw.stone; s.materials += rw.mat; s.checkInStreak = (s.checkInStreak || 0) + 1; rec.mat.checkin += rw.mat; }
    }

    // 装备+熔炼+贪婪分配
    equipAndSmelt(g, rec);
    spendMaterials(g, rec);

    // 日志瘦身，避免无限增长
    if (s.log.length > 120) s.log = s.log.slice(-60);

    // 修炼决策：破境 / 购买（破境优先，farm 已在本 epoch 完成）
    if (g.canBreak()) {
      tryBreak(); recRealm();
      if (s.realmIndex === 9 && g.canReincarnate()) break; // 首轮回到达真仙即停
      continue;
    }
    if (best && dt >= best.time - 1e-9) {
      if (best.kind === 'tech') g.buyTechnique(best.id);
      else if (best.kind === 'abode') g.buyAbode(best.id);
      else if (best.kind === 'ins') g.comprehend('dao');
    }
  }

  // 末态快照
  equipAndSmelt(g, rec);
  return {
    realmEnterT, realmMatAtEnter, realmGearAtEnter, realmPetAtEnter,
    finalGear: gearSnapshot(g), finalPets: Object.assign({}, s.pets),
    finalRealm: s.realmIndex, finalT: t, finalMat: s.materials, rec, fails,
    finalTech: Object.assign({}, s.techniques), finalAbode: Object.assign({}, s.abodes),
    finalInsight: Object.assign({}, s.insightLv), finalLegacy: s.legacy, finalTotalXp: s.totalXp
  };
}

function gearSnapshot(g) {
  const s = g.state; const out = {};
  for (const slot of ['weapon', 'armor', 'trinket']) {
    const tid = s.equipped[slot];
    if (tid && s.treasures[tid]) {
      const o = s.treasures[tid];
      out[slot] = { id: tid, level: o.level, affixes: (o.affixes || []).map(a => ({ type: a.type, value: a.value })) };
    }
  }
  return out;
}

/* ---------- 用真实装备重跑战斗胜率矩阵 ---------- */
function combatMatrixRealGear(g, gear, pets, trials) {
  const maps = ['yaolin', 'guzhanchang', 'moyuan', 'xianxi', 'xuli', 'heti', 'dasheng', 'tianjie'];
  const res = [];
  for (let r = 0; r < 10; r++) {
    const g2 = makeGame(); const s2 = g2.state;
    g2.setRoot('earth'); s2.pills.bijie = 1e9;
    // 用真实成长状态（取 progression 末态的 tech/abode/insight/legacy/totalXp 近似）
    Object.assign(s2.techniques, g.finalTech);
    Object.assign(s2.abodes, g.finalAbode);
    Object.assign(s2.insightLv, g.finalInsight);
    s2.legacy = g.finalLegacy;
    s2.realmIndex = r; s2.layer = 8;
    // 装备真实法宝
    for (const slot of ['weapon', 'armor', 'trinket']) {
      const gd = gear[slot]; if (!gd) continue;
      s2.treasures[gd.id] = { count: 1, level: gd.level, affixes: gd.affixes.map(a => ({ type: a.type, kind: a.type === 'crit' || a.type === 'dodge' || a.type === 'hit' ? 'add' : 'pct', value: a.value })) };
      s2.equipped[slot] = gd.id;
    }
    Object.assign(s2.pets, pets);
    const mapRows = [];
    for (const mid of maps) {
      const map = g2.MAPS.find(m => m.id === mid); if (!map || map.realmReq > r) continue;
      const cells = map.levels.map(lv => { let w = 0; for (let i = 0; i < trials; i++) if (g2.simulateCombat(lv).win) w++; return { name: lv.name, boss: !!lv.boss, winRate: w / trials }; });
      mapRows.push({ name: map.name, cells });
    }
    const tower = []; let lastWin = 0;
    for (let f = 1; f <= 300; f += 5) { const e = g2.towerEnemy(f); let w = 0; for (let i = 0; i < trials; i++) if (g2.simulateCombat(e).win) w++; tower.push({ floor: f, winRate: w / trials }); if (w / trials >= 0.5) lastWin = f; }
    res.push({ realm: r, mapRows, tower, lastWinFloor: lastWin });
  }
  return res;
}

/* ---------- 格式化 ---------- */
function fmt(sec) { if (!isFinite(sec)) return '∞'; sec = Math.floor(sec); const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60); if (d > 0) return `${d}天${h}时`; if (h > 0) return `${h}时${m}分`; return `${m}分${sec % 60}秒`; }
function fmtN(n) { if (n >= 1e8) return (n / 1e8).toFixed(2) + '亿'; if (n >= 1e4) return (n / 1e4).toFixed(2) + '万'; return Math.round(n).toString(); }

function main() {
  const SEEDS = Number(process.env.SEEDS || 12), MAXT = Number(process.env.MAXT || 220) * 86400, TRIALS = 100;
  const realmNames = ['炼气', '筑基', '金丹', '元婴', '化神', '炼虚', '合体', '大乘', '渡劫', '真仙'];
  const R = [];
  const log = (s) => { R.push(s); console.log(s); };

  log('============================================================');
  log(' 放置修仙 · 材料经济模拟' + (Object.keys(OVERRIDES).length ? ' (OVERRIDE=' + JSON.stringify(OVERRIDES) + ')' : '') + (EXPLORE_FRAC > 0 ? ' [探秘境占比=' + EXPLORE_FRAC + ']' : ''));
  log(' 种子=' + SEEDS + '  最大=' + fmt(MAXT) + '  战斗试炼=' + TRIALS);
  log('============================================================');

  // 读取 CONFIG 常量（battleCd / treasure.maxLevel / awaken.maxAffixes / checkIn 长度）
  const dataText = fs.readFileSync(DATA, 'utf8');
  CONFIG_BATTLE_CD = Number((dataText.match(/battleCd:\s*([0-9.]+)/) || [])[1]) || 6;
  CONFIG_TREASURE_MAX = Number((dataText.match(/maxLevel:\s*([0-9]+)/) || [])[1]) || 20;
  CONFIG_AWAKEN_MAX = Number((dataText.match(/maxAffixes:\s*([0-9]+)/) || [])[1]) || 3;

  const runs = [];
  for (let i = 0; i < SEEDS; i++) runs.push(simProgression('earth', 5000 + i * 29, MAXT));

  // 汇总：各境界到达时间 + 入境界时材料
  log('\n########## A. 首轮回各境界到达时间 / 入境界材料 ##########');
  const realmMed = {};
  for (let ri = 0; ri < 10; ri++) {
    const arr = runs.map(r => r.realmEnterT[ri]).filter(v => v !== undefined).sort((a, b) => a - b);
    if (arr.length) realmMed[ri] = arr[Math.floor(arr.length / 2)];
    log(`  ${realmNames[ri]}: 到达 ${arr.length ? fmt(arr[Math.floor(arr.length / 2)]) : '未达'}  | 入境界材料≈${arr.length ? fmtN(median(runs.map(r => r.realmMatAtEnter[ri]).filter(v => v !== undefined))) : '-'}`);
  }

  // 材料来源汇总
  log('\n########## B. 材料来源 / 去向汇总（中位种子） ##########');
  const mid = runs[Math.floor(runs.length / 2)];
  const rk = mid.rec.mat;
  log('  战斗掉落: ' + fmtN(rk.combat) + '  熔炼返还: ' + fmtN(rk.smelt) + '  探秘境: ' + fmtN(rk.explore) + '  奇遇: ' + fmtN(rk.event) + '  签到: ' + fmtN(rk.checkin) + '  灵宠产出: ' + fmtN(rk.pet));
  log('  去向 → 强化: ' + fmtN(rk.spentEnh) + '  觉醒: ' + fmtN(rk.spentAwk) + '  喂宠: ' + fmtN(rk.spentFeed) + '  末态余料: ' + fmtN(mid.finalMat));
  log('  末态灵宠等级: ' + Object.entries(mid.finalPets).map(([k, v]) => k + ':' + v).join(' '));

  // 装备成长轨迹（中位种子）
  log('\n########## C. 装备/灵宠 成长轨迹（中位种子） ##########');
  for (let ri = 0; ri < 10; ri++) {
    const gear = mid.realmGearAtEnter[ri]; if (!gear) continue;
    const slots = ['weapon', 'armor', 'trinket'].map(sl => {
      const gd = gear[sl]; if (!gd) return sl + ':-';
      return sl + ':' + gd.id + ' Lv' + gd.level + (gd.affixes.length ? '(' + gd.affixes.length + '觉)' : '');
    }).join('  ');
    const pets = mid.realmPetAtEnter[ri] || {};
    const petStr = Object.entries(pets).map(([k, v]) => k + ':' + v).join(' ');
    log(`  ${realmNames[ri]}: ${slots} | 宠 ${petStr}`);
  }

  // 终局校验：真实装备战斗矩阵
  log('\n########## D. 终局校验·真实(经济可负担)装备 战斗胜率矩阵 ##########');
  const matrix = combatMatrixRealGear(mid, mid.finalGear, mid.finalPets, TRIALS);
  for (const row of matrix) {
    log(`  境界${row.realm}(${realmNames[row.realm]}) 试炼塔≈${row.lastWinFloor}层`);
    for (const mr of row.mapRows) log('    · ' + mr.name + ': ' + mr.cells.map(c => `${c.name}${(c.winRate * 100).toFixed(0)}%`).join(' '));
  }
  // 关键结论
  const tianjie = matrix.find(m => m.realm >= 8);
  const dasheng = matrix.find(m => m.realm === 7);
  log('\n>>> 结论: 天道台 渡劫/真仙 胜率 = ' + (tianjie ? tianjie.mapRows.find(x => x.name === '天道台').cells.map(c => c.name + (c.winRate * 100).toFixed(0) + '%').join(' ') : '未测') );
  log('>>> 大乘遗迹 大乘胜率 = ' + (dasheng ? dasheng.mapRows.find(x => x.name === '大乘遗迹').cells.map(c => c.name + (c.winRate * 100).toFixed(0) + '%').join(' ') : '未测'));

  fs.writeFileSync(path.join(ROOT, 'tools', 'material_report_last.txt'), R.join('\n'));
  log('\n报告已写 tools/material_report_last.txt');
}

function median(arr) { const a = arr.slice().sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : NaN; }

/* 从 data.js 解析关键 CONFIG 常量（game 未暴露 CONFIG 对象） */
function loadConfigConstants() {
  const dataText = fs.readFileSync(DATA, 'utf8');
  CONFIG_BATTLE_CD = Number((dataText.match(/battleCd:\s*([0-9.]+)/) || [])[1]) || 6;
  CONFIG_TREASURE_MAX = Number((dataText.match(/maxLevel:\s*([0-9]+)/) || [])[1]) || 20;
  CONFIG_AWAKEN_MAX = Number((dataText.match(/maxAffixes:\s*([0-9]+)/) || [])[1]) || 3;
  const ci = dataText.match(/checkIn:\s*\{[\s\S]*?rewards:\s*\[([\s\S]*?)\]\s*\}/);
  CONFIG_CHECKIN = (ci ? (ci[1].match(/stone:\s*(\d+)\s*,\s*mat:\s*(\d+)/g) || []) : []).map(s => { const m = s.match(/stone:\s*(\d+)\s*,\s*mat:\s*(\d+)/); return { stone: +m[1], mat: +m[2] }; });
  CONFIG_CHECKIN_LEN = CONFIG_CHECKIN.length;
}

// 在 main 开头调用（仅在直接运行本文件时）
if (typeof module !== 'undefined' && require.main === module) {
  loadConfigConstants();
  main();
}

// 供 trib_sim.js 复用：运行前需先调用 loadConfigConstants()
if (typeof module !== 'undefined') {
  module.exports = { simProgression, makeGame, loadConfigConstants, ROOT, fmt, fmtN };
}
