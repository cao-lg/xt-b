// 放置修仙 · 渡劫失败路径模拟
// 基于 material_sim.simProgression（真实修炼+战斗产出框架），隔离「渡劫失败」对节奏的影响。
// 关键解耦：speedBoost（避劫丹 ×4 速度）与 guarantee（必成）独立可控，
//   从而能干净地测量「失败本身」的节奏代价，而非与速度加成混淆。
//
// 用法：node tools/trib_sim.js [SEEDS] [MAXT_DAYS]
// 环境变量：ROOT_FIRE=1 额外把火灵根纳入（默认木/火都跑）

const path = require('path');
const fs = require('fs');
const mat = require('./material_sim.js');
const { simProgression, loadConfigConstants, fmt, fmtN } = mat;

loadConfigConstants();

const SEEDS = parseInt(process.argv[2] || '30', 10);
const MAXT = (parseInt(process.argv[3] || '45', 10)) * 86400;

const realmNames = ['炼气','筑基','金丹','元婴','化神','炼虚','合体','大乘','渡劫','真仙'];

// 灵根 → 基础渡劫成功率（火灵根 +15%）
const ROOTS = [
  { id: 'wood', p: 0.70, note: '木灵（无渡劫加成）' },
  { id: 'fire', p: 0.85, note: '火灵（渡劫 +15%）' },
];

// 模拟模式
const MODES = [
  { key: 'base',   label: '基线(必成+×4速)',            opt: { speedBoost: true,  guarantee: true  } },
  { key: 'fNoSpd', label: '从不使用避劫丹(无速+真实)',  opt: { speedBoost: false, guarantee: false } },
  { key: 'fSpd',   label: '真实掷骰(×4速+真实)',        opt: { speedBoost: true,  guarantee: false } },
  { key: 'fSpdM',  label: '真实+保底4(×4速)',           opt: { speedBoost: true,  guarantee: false, mercy: { guarantee: 4 } } },
  { key: 'fNoM',   label: '从不避劫丹+保底4',            opt: { speedBoost: false, guarantee: false, mercy: { guarantee: 4 } } },
];

function runMode(rootId, opt) {
  const ts = [], totals = [], streaks = [], forced = [];
  for (let i = 0; i < SEEDS; i++) {
    const r = simProgression(rootId, 5000 + i * 29, MAXT, Object.assign({}, opt));
    ts.push(r.finalT);
    totals.push(r.fails.total);
    streaks.push(r.fails.maxStreak);
    forced.push(r.fails.forced);
  }
  const med = a => { const x = a.slice().sort((u, v) => u - v); return x.length ? x[Math.floor(x.length / 2)] : NaN; };
  const pct = (a, q) => { const x = a.slice().sort((u, v) => u - v); return x[Math.min(x.length - 1, Math.max(0, Math.floor(x.length * q)))]; };
  return {
    medT: med(ts), meanT: ts.reduce((s, v) => s + v, 0) / ts.length, p95T: pct(ts, 0.95), maxT: Math.max(...ts),
    medFails: med(totals), meanFails: totals.reduce((s, v) => s + v, 0) / totals.length, maxFails: Math.max(...totals),
    maxStreakMed: med(streaks), maxStreakMax: Math.max(...streaks),
    forcedSum: forced.reduce((s, v) => s + v, 0),
    ts, totals, streaks,
  };
}

const R = [];
const log = s => { R.push(s); console.log(s); };

log('============================================================');
log(' 放置修仙 · 渡劫失败路径模拟');
log(' 种子=' + SEEDS + '  最大=' + fmt(MAXT) + '  灵根=[木0.70 / 火0.85]');
log('============================================================');

const data = {};
for (const root of ROOTS) {
  data[root.id] = {};
  log('\n########## 灵根 ' + root.id + '（' + root.note + '，渡劫成功率 ' + (root.p * 100).toFixed(0) + '%）##########');
  const base = runMode(root.id, MODES[0].opt);
  data[root.id].base = base;
  log('  模式                           中位时间    均值时间    P95时间    最慢     中位失败数  最坏连败  强制必成(保底触发)');
  for (const m of MODES) {
    const r = runMode(root.id, m.opt);
    data[root.id][m.key] = r;
    const tax = (r.medT / base.medT - 1) * 100;
    log('    ' + m.label.padEnd(22) + ' ' + fmt(r.medT).padEnd(10) + fmt(r.meanT).padEnd(10) + fmt(r.p95T).padEnd(9) + fmt(r.maxT).padEnd(8) +
        String(r.medFails).padEnd(10) + String(r.maxStreakMax).padEnd(9) + String(r.forcedSum).padEnd(8) + (m.key === 'base' ? '' : '  (税+' + tax.toFixed(0) + '%)'));
  }
  // 连败分布
  const sb = data[root.id].fSpd.streaks;
  const dist = {};
  sb.forEach(v => dist[v] = (dist[v] || 0) + 1);
  log('  真实掷骰(×4速) 连败分布: ' + Object.keys(dist).map(k => '连败' + k + '=' + (100 * dist[k] / sb.length).toFixed(0) + '%').join('  '));
  const pGE = k => (100 * sb.filter(v => v >= k).length / sb.length).toFixed(1);
  log('    P(某大境界连败≥3)=' + pGE(3) + '%   P(≥4)=' + pGE(4) + '%   P(≥5)=' + pGE(5) + '%');
}

// 终局可达性结论
log('\n########## 结论 ##########');
for (const root of ROOTS) {
  const b = data[root.id].base.medT, fn = data[root.id].fNoSpd, fs = data[root.id].fSpd, fsm = data[root.id].fSpdM;
  log('  ' + root.id + ' (p=' + (root.p * 100).toFixed(0) + '%):');
  log('    基线必成 ' + fmt(b) + ' → 从不避劫丹 ' + fmt(fn.medT) + ' (中位+' + ((fn.medT / b - 1) * 100).toFixed(0) + '%，最坏' + fmt(fn.maxT) + ')');
  log('    纯失败税(同速) ' + fmt(fs.medT) + ' (+' + ((fs.medT / b - 1) * 100).toFixed(0) + '%)，最坏连败 ' + fs.maxStreakMax + ' 次');
  log('    加保底4 ' + fmt(fsm.medT) + ' (+' + ((fsm.medT / b - 1) * 100).toFixed(0) + '%)，连败封顶 ' + fsm.maxStreakMax + ' 次 → 最坏' + fmt(fsm.maxT));
}
log('\n>>> 是否需保底：若「从不避劫丹」最坏时间仍 << 合理上限(如 3×基线) 且最坏连败可控，则非必需；保底仅作体验兜底。');

fs.writeFileSync(path.join(mat.ROOT, 'tools', 'trib_report_last.txt'), R.join('\n'));
log('\n报告已写 tools/trib_report_last.txt');
