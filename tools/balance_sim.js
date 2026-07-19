/* ============================================================
 * 放置修仙 · 平衡模拟与验证工具 (tools/balance_sim.js)
 * ------------------------------------------------------------
 * 加载真实 data.js + game.js（new Function + localStorage/window shim），
 * 用可控 RNG 做大规模模拟，产出「成长/属性/装备/战斗/功法」全要素报告：
 *   A. 时间驱动成长 / 破境节奏 / 飞升转生（多轮回加速）
 *   B. 各养成系统 投入产出(ROI) 边际分析
 *   C. 战斗胜率矩阵（按境界 × 8 张地图 + 试炼塔）
 *   D. 仙缘(legacy) 曲线与每轮转生加速
 *
 * 用法：
 *   node tools/balance_sim.js            # 用 data.js 当前值跑完整报告
 *   OVERRIDE="cultBandMult=2.2,realmCostGrowth=3.2" node tools/balance_sim.js
 *      # 在内存中覆盖 CONFIG 数值做「假设推演」（不改动源文件），用于再调参
 *
 * 设计要点（与游戏冻结的战斗/平衡公式保持一致）：
 *   - 修炼速度 coreSpeed = (base+flat) × ratio × cultBand
 *   - 突破成本 breakCost = baseCost × layerCostGrowth^layer × realmCostGrowth^realm × (major? majorBreakMult:1)
 *   - 战斗 atk/def/hp = 固定值加法 × 大道比例 × 境界战力带；命中/闪避/暴击纯加法
 *   - 仙缘 legacyGain = floor(√(totalXp / legacyGainBase))，legacyMult = 1 + legacy×legacyPerPoint
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

/* ---------- 在内存中覆盖 CONFIG（仅用于假设推演） ---------- */
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

/* ---------- A. 经济节奏 / 破境 / 飞升转生 ---------- */
function simEconomy(rootId, seed, maxT) {
  seedRNG(seed);
  const g = makeGame(); const s = g.state;
  g.setRoot(rootId); s.pills.bijie = 1e9; // 设计意图：玩家用避劫丹保渡劫成功（仅影响节奏，不计入石耗）
  let t = 0, guard = 0, prevRealm = 0, prevTotal = 0, inFirst = true, prevT = 0;
  const realmEnterT = {}, cycleTimes = [];
  function rec() {
    if (inFirst) {
      if (s.realmIndex !== prevRealm) { realmEnterT[s.realmIndex] = t; prevRealm = s.realmIndex; }
      const gl = s.realmIndex * 9 + s.layer; if (gl !== prevTotal) prevTotal = gl;
    }
  }
  rec();
  while (t < maxT && guard < 3000000) {
    guard++;
    if (g.canBreak()) {
      g.doBreak(); rec();
      if (s.realmIndex === 9 && g.canReincarnate()) {
        const gain = g.legacyGain();
        g.reincarnate();
        cycleTimes.push({ cycle: cycleTimes.length + 1, t, dur: t - prevT, legacy: s.legacy, gain });
        inFirst = false; s.pills.bijie = 1e9; prevT = t; prevRealm = 0; prevTotal = 0;
        continue;
      }
      continue;
    }
    const sp = g.currentSpeed(), sr = g.stoneSpeed(), xr = sp + g.petOutPerSec('xp');
    const tB = (g.breakCost() - s.xp) / xr;
    let best = null;
    for (const td of g.TECHNIQUES) { const lv = s.techniques[td.id] || 0; if (lv >= td.max) continue; const p = g.techniquePrice(td.id); const n = p - s.stone; const tm = n > 0 ? n / sr : 0; if (!best || tm < best.time) best = { time: tm, kind: 'tech', id: td.id }; }
    for (const ad of g.ABODES) { const lv = s.abodes[ad.id] || 0; if (lv >= ad.max) continue; const p = g.abodePrice(ad.id); const n = p - s.stone; const tm = n > 0 ? n / sr : 0; if (!best || tm < best.time) best = { time: tm, kind: 'abode', id: ad.id }; }
    const dl = s.insightLv.dao || 0; if (dl < 50 && s.insight >= g.insightPrice('dao')) best = { time: 0, kind: 'ins', id: 'dao' };
    const nt = Math.min(tB, best ? best.time : Infinity);
    if (!isFinite(nt)) { t += 60; advance(g, 60); continue; }
    let dt = Math.max(0, nt);
    if (dt < 1e-6 && !g.canBreak()) dt = 1; // 买得起即购买（不再因 dt=0 跳过，避免虚高时长）
    advance(g, dt); t += dt;
    if (g.canBreak()) continue;
    if (best && dt >= best.time - 1e-9) {
      if (best.kind === 'tech') g.buyTechnique(best.id);
      else if (best.kind === 'abode') g.buyAbode(best.id);
      else if (best.kind === 'ins') g.comprehend('dao');
    }
  }
  return { realmEnterT, cycleTimes, finalT: t };
}

/* ---------- B. ROI 边际分析（快照法） ---------- */
function buildState(opts) {
  const g = makeGame(); const s = g.state;
  g.setRoot(opts.root || 'wood');
  s.realmIndex = opts.realm || 0; s.layer = opts.layer || 0; s.totalXp = opts.totalXp || 0;
  Object.keys(opts.tech || {}).forEach(id => s.techniques[id] = opts.tech[id]);
  Object.keys(opts.abode || {}).forEach(id => s.abodes[id] = opts.abode[id]);
  s.insight = opts.insight || 0; s.insightLv = opts.insightLv || {}; s.legacy = opts.legacy || 0;
  Object.keys(opts.pets || {}).forEach(id => s.pets[id] = opts.pets[id]);
  Object.keys(opts.treasures || {}).forEach(tid => { s.treasures[tid] = { count: 1, level: 20, affixes: opts.treasures[tid].affixes || [] }; s.equipped[opts.treasures[tid].slot] = tid; });
  return g;
}
function roiAnalysis() {
  const phases = [
    { name: '早期·炼气(0,0)', realm: 0, layer: 0, tech: { tuna: 5 }, abode: { cave: 3 }, insightLv: {}, legacy: 0, pets: {}, root: 'wood' },
    { name: '中期·金丹(2,4)', realm: 2, layer: 4, tech: { tuna: 30, yinqi: 25, zhoutian: 18, wuxing: 10, taiyi: 6, hongmeng: 4 }, abode: { cave: 25, lingmai: 20, fudi: 14, xianfu: 8 }, insightLv: { dao: 20 }, legacy: 0, pets: { qilin: 30, jinchan: 25, qingniao: 20, xiezhi: 15 }, root: 'earth' },
    { name: '后期·大乘(7,4)', realm: 7, layer: 4, tech: { tuna: 70, yinqi: 60, zhoutian: 50, wuxing: 40, taiyi: 30, hongmeng: 25 }, abode: { cave: 60, lingmai: 50, fudi: 40, xianfu: 30 }, insightLv: { dao: 40 }, legacy: 50, pets: { qilin: 60, jinchan: 50, qingniao: 40, xiezhi: 30 }, root: 'earth' }
  ];
  const out = [];
  for (const ph of phases) {
    const g = buildState(ph); const s = g.state;
    const spd = g.currentSpeed(); const stoneRate = g.stoneSpeed();
    const rows = [];
    for (const tdef of g.TECHNIQUES) {
      const lv = s.techniques[tdef.id] || 0; if (lv >= tdef.max) continue;
      const price = g.techniquePrice(tdef.id);
      const lv0 = lv; s.techniques[tdef.id] = lv + 1; const d = g.currentSpeed() - spd; s.techniques[tdef.id] = lv0;
      rows.push({ sys: '功法·' + tdef.name, cost: price, dSpd: d, roi: d / price, payback: price / stoneRate });
    }
    for (const adef of g.ABODES) {
      const lv = s.abodes[adef.id] || 0; if (lv >= adef.max) continue;
      const price = g.abodePrice(adef.id);
      const lv0 = lv; s.abodes[adef.id] = lv + 1; const d = g.currentSpeed() - spd; s.abodes[adef.id] = lv0;
      rows.push({ sys: '洞府·' + adef.name, cost: price, dSpd: d, roi: d / price, payback: price / stoneRate });
    }
    const daoLv = s.insightLv.dao || 0;
    if (daoLv < 50) { const price = g.insightPrice('dao'); const lv0 = daoLv; s.insightLv.dao = daoLv + 1; const d = g.currentSpeed() - spd; s.insightLv.dao = lv0; rows.push({ sys: '悟道·大道', cost: price, cur: 'insight', dSpd: d, roi: d / Math.max(1, price), payback: NaN }); }
    out.push({ phase: ph.name, spd, rows });
  }
  return out;
}

/* ---------- C. 战斗胜率矩阵 ---------- */
function snapAtRealm(rootId, seed, target) {
  seedRNG(seed);
  const g = makeGame(); const s = g.state; g.setRoot(rootId); s.pills.bijie = 1e9;
  let t = 0, guard = 0, reached = false;
  while (t < 60 * 86400 && guard < 1500000) {
    guard++;
    if (g.canBreak()) { g.doBreak(); if (s.realmIndex === target) { reached = true; break; } if (s.realmIndex === 9 && g.canReincarnate()) break; continue; }
    const sp = g.currentSpeed(), sr = g.stoneSpeed(), xr = sp + g.petOutPerSec('xp');
    const tB = (g.breakCost() - s.xp) / xr;
    let best = null;
    for (const td of g.TECHNIQUES) { const lv = s.techniques[td.id] || 0; if (lv >= td.max) continue; const p = g.techniquePrice(td.id); const n = p - s.stone; const tm = n > 0 ? n / sr : 0; if (!best || tm < best.time) best = { time: tm, kind: 'tech', id: td.id }; }
    for (const ad of g.ABODES) { const lv = s.abodes[ad.id] || 0; if (lv >= ad.max) continue; const p = g.abodePrice(ad.id); const n = p - s.stone; const tm = n > 0 ? n / sr : 0; if (!best || tm < best.time) best = { time: tm, kind: 'abode', id: ad.id }; }
    const dl = s.insightLv.dao || 0; if (dl < 50 && s.insight >= g.insightPrice('dao')) best = { time: 0, kind: 'ins', id: 'dao' };
    const nt = Math.min(tB, best ? best.time : Infinity);
    if (!isFinite(nt)) { t += 60; advance(g, 60); continue; }
    let dt = Math.max(0, nt); if (dt < 1e-6 && !g.canBreak()) dt = 1;
    advance(g, dt); t += dt;
    if (g.canBreak()) continue;
    if (best && dt >= best.time - 1e-9) { if (best.kind === 'tech') g.buyTechnique(best.id); else if (best.kind === 'abode') g.buyAbode(best.id); else if (best.kind === 'ins') g.comprehend('dao'); }
  }
  if (!reached) return null;
  return { tech: Object.assign({}, s.techniques), abode: Object.assign({}, s.abodes), insightLv: Object.assign({}, s.insightLv), insight: s.insight, legacy: s.legacy, totalXp: s.totalXp, t };
}
function combatMatrix(rootId, seed, trials) {
  const maps = ['yaolin', 'guzhanchang', 'moyuan', 'xianxi', 'xuli', 'heti', 'dasheng', 'tianjie'];
  const res = [];
  for (let r = 0; r < 10; r++) {
    const snap = snapAtRealm(rootId, seed, r); if (!snap) { res.push({ realm: r, ok: false }); continue; }
    const treasures = {
      donghuang: { slot: 'weapon', affixes: [{ type: 'atk', kind: 'pct', value: 0.15 }, { type: 'hp', kind: 'pct', value: 0.15 }, { type: 'def', kind: 'pct', value: 0.15 }] },
      hunyuan: { slot: 'armor', affixes: [{ type: 'def', kind: 'pct', value: 0.15 }, { type: 'hp', kind: 'pct', value: 0.15 }, { type: 'dodge', kind: 'add', value: 0.03 }] },
      kunlun: { slot: 'trinket', affixes: [{ type: 'crit', kind: 'add', value: 0.04 }, { type: 'hit', kind: 'add', value: 0.03 }, { type: 'dodge', kind: 'add', value: 0.04 }] }
    };
    const pets = { qilin: 60, jinchan: 50, qingniao: 40, xiezhi: 30 };
    const g = buildState({ root: rootId, realm: r, layer: 8, totalXp: snap.totalXp, tech: snap.tech, abode: snap.abode, insightLv: snap.insightLv, insight: snap.insight, legacy: snap.legacy, pets, treasures });
    const mapRows = [];
    for (const mid of maps) {
      const map = g.MAPS.find(m => m.id === mid); if (!map || map.realmReq > r) continue;
      const cells = map.levels.map(lv => { let w = 0; for (let i = 0; i < trials; i++) if (g.simulateCombat(lv).win) w++; return { name: lv.name, boss: !!lv.boss, winRate: w / trials }; });
      mapRows.push({ name: map.name, cells });
    }
    const tower = []; let lastWin = 0;
    for (let f = 1; f <= 300; f += 5) { const e = g.towerEnemy(f); let w = 0; for (let i = 0; i < trials; i++) if (g.simulateCombat(e).win) w++; tower.push({ floor: f, winRate: w / trials }); if (w / trials >= 0.5) lastWin = f; }
    res.push({ realm: r, ok: true, t: snap.t, mapRows, tower, lastWinFloor: lastWin });
  }
  return res;
}

/* ---------- 格式化 ---------- */
function fmt(sec) { if (!isFinite(sec)) return '∞'; sec = Math.floor(sec); const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60); if (d > 0) return `${d}天${h}时`; if (h > 0) return `${h}时${m}分`; return `${m}分${sec % 60}秒`; }
function fmtN(n) { if (n >= 1e8) return (n / 1e8).toFixed(2) + '亿+'; if (n >= 1e4) return (n / 1e4).toFixed(2) + '万'; return Math.round(n).toString(); }

/* ---------- 主流程 ---------- */
function main() {
  const SEEDS = 12, MAXT = 45 * 86400, TRIALS = 100;
  const realmNames = ['炼气', '筑基', '金丹', '元婴', '化神', '炼虚', '合体', '大乘', '渡劫', '真仙'];
  const R = [];
  const log = (s) => { R.push(s); console.log(s); };

  log('============================================================');
  log(' 放置修仙 · 平衡模拟报告' + (Object.keys(OVERRIDES).length ? ' (假设推演 OVERRIDE=' + JSON.stringify(OVERRIDES) + ')' : ''));
  log(' 种子数=' + SEEDS + '  最大时长=' + fmt(MAXT) + '  战斗试炼=' + TRIALS + '次');
  log('============================================================');

  // A
  log('\n########## A. 时间驱动成长 / 破境节奏 (首轮回) ##########');
  const realmMed = {};
  for (let i = 0; i < SEEDS; i++) { const r = simEconomy('earth', 5000 + i * 29, MAXT); for (let ri = 0; ri < 10; ri++) { const v = r.realmEnterT[ri]; if (v !== undefined) (realmMed[ri] = realmMed[ri] || []).push(v); } }
  let allReach = true;
  for (let ri = 0; ri < 10; ri++) { const a = (realmMed[ri] || []).slice().sort((x, y) => x - y); const m = a.length ? a[Math.floor(a.length / 2)] : NaN; if (ri > 0 && !isFinite(m)) allReach = false; log(`  ${realmNames[ri]}: ${isFinite(m) ? fmt(m) : '未达'}`); }
  const ratios = []; for (let ri = 1; ri < 10; ri++) { const a = realmMed[ri - 1], b = realmMed[ri]; if (a && b) { const ma = a.slice().sort((x, y) => x - y)[0], mb = b.slice().sort((x, y) => x - y)[0]; if (ma > 0) ratios.push(mb / ma); } }
  log(`  全部种子首轮回达真仙? ${allReach ? '是' : '否(存在卡死)'}`);
  log(`  相邻境界平均耗时比: ${(ratios.reduce((s, x) => s + x, 0) / ratios.length).toFixed(2)}x`);

  // 多轮回加速（单轨迹）
  const tr = simEconomy('earth', 777, 365 * 86400);
  log('\n  多轮回加速（轨迹 seed=777）:');
  tr.cycleTimes.slice(0, 8).forEach(c => log(`    第${c.cycle}次: 达真仙@${fmt(c.t)} 本轮回${fmt(c.dur)} 仙缘+${c.gain} 累计${c.legacy} ×${(1 + c.legacy * 0.03).toFixed(2)}`));
  if (tr.cycleTimes.length > 8) log(`    ... 共 ${tr.cycleTimes.length} 次轮回`);

  // B
  log('\n########## B. 各系统投入产出(ROI) 边际分析 ##########');
  for (const ph of roiAnalysis()) {
    log(`\n  --- ${ph.phase} (速度 ${fmtN(ph.spd)}/s) ---`);
    log('    系统                  下一级成本      边际速度/s     ROI(速度/石)   回本时间');
    ph.rows.slice().sort((a, b) => (b.roi || 0) - (a.roi || 0)).forEach(row => {
      const cost = row.cur ? fmtN(row.cost) + '(悟性)' : fmtN(row.cost) + '石';
      const roi = isFinite(row.roi) ? row.roi.toExponential(2) : '—';
      const pb = isFinite(row.payback) ? fmt(row.payback) : '—';
      log(`    ${(row.sys).padEnd(18)} ${cost.padEnd(14)} ${row.dSpd.toFixed(3).padEnd(14)} ${roi.padEnd(13)} ${pb}`);
    });
  }

  // C
  log('\n########## C. 战斗胜率矩阵 (满级觉醒法宝+满喂灵宠) ##########');
  for (const row of combatMatrix('earth', 9876, TRIALS)) {
    if (!row.ok) { log(`  境界${row.realm}: 经济模拟未到达`); continue; }
    log(`  境界${row.realm}(${realmNames[row.realm]}) 到达${fmt(row.t)} 试炼塔≈${row.lastWinFloor}层`);
    for (const mr of row.mapRows) log('    · ' + mr.name + ': ' + mr.cells.map(c => `${c.name}${(c.winRate * 100).toFixed(0)}%`).join(' '));
  }

  fs.writeFileSync(path.join(ROOT, 'tools', 'balance_report_last.txt'), R.join('\n'));
}
main();
