/* ============================================================
 * 放置修仙 · 逍遥道途 v2 —— 游戏数据与数值平衡配置
 * 新增：灵根 / 灵宠 / 秘境 / 悟道 / 飞升转生 / 渡劫风险
 * 所有可调参数集中在此，方便后续平衡微调。
 * ============================================================ */

/* ---------- 全局数值参数（已为 v2 重平衡） ---------- */
const CONFIG = {
  /* 修炼速度与突破成本 */
  baseSpeed: 0.5,          // 基础修炼速度（修为/秒），炼气一层时（v5 下调：纯修炼锚定 ~1~2 年，养成系统压缩到可玩）
  growthPerLayer: 1.08,    // 每完成 1 个小层，基础速度 ×1.08（仅层内成长）
  realmSpeedMult: 1.0,     // 已并入下方「修炼带」(cultBand) 统一做境界缩放，避免重复乘境界
  // 修炼带：把「基础 + 固定值」整体按境界缩放（功法/洞府固定值也由此享受比例提升，与战斗战力带一致）
  cultBandBase: 1,         // 修炼带基数
  cultBandMult: 2.2,       // 每大境界 修炼带 ×2.2（v3 重平衡：由 1.5 上调，使修炼速度随境界成长足以追上突破成本，解除中后期卡死）
  cultBandLayer: 0.06,     // 每小层 修炼带 +6%（v3 由 0.04→0.05 上调；本次再微调软化层内墙，仅作用于修炼速度，不影响战斗平衡）
  baseCost: 900,           // 第 0 层突破所需修为（基准）
  layerCostGrowth: 2.0,    // 每小层突破成本 ×2.0（v3 由 2.10 下调，层内节奏更平滑）
  realmCostGrowth: 3.2,    // 每大境界突破成本 ×3.2（v3 重平衡：由 9.00 大幅下调——原值使成本增速远超速度增速，导致元婴之后永久卡死、游戏不可通关；现与修炼带(×2.2)/功法洞府再投资/仙缘复合匹配）
  majorBreakMult: 2.5,     // 大境界突破（第 9 层→下一境界）成本额外 ×2.5（v3 由 3.2 下调，留出余量）
  // 说明：speedCap / legacyCap 已移除。
  // 修炼速度模型（v5 重构）：coreSpeed = base×band×比例乘区(灵根/悟道/仙缘/宠物/宝光)，
  // 玩家购买的功法/洞府/丹药改为【固定值加法】且【加在乘法链之后、不乘任何比例】（除非天道境界缩放），
  // 从而消除原「比例项乘法乘积」在后期的爆炸；仙缘(legacyMult)转生乘区保留不封顶。

  /* 资源产出 */
  stoneRatio: 0.18,        // 灵石产出速度 = 修为速度 × 此比例
  offlineCapHours: 8,      // 离线收益封顶时长（小时）
  offlineEff: 0.5,         // 离线修炼效率（相对在线）

  /* 手动与奇遇 */
  clickBase: 0.5,          // 「运转周天」单次获得 = 当前速度 × 此值
  clickStoneChance: 0.15,  // 每次运转周天额外获得灵石的概率
  eventMinSec: 20,         // 奇遇最短间隔（秒）
  eventMaxSec: 55,         // 奇遇最长间隔（秒）

  /* 灵根加成（type 对应倍率类型） */
  rootStoneBonus: 0.25,    // 金石灵根：灵石效率
  rootSpeedBonus: 0.15,    // 木灵灵根：修炼速度
  rootPillBonus: 0.30,     // 水灵灵根：丹药效果
  rootTribBonus: 0.15,     // 火灵灵根：渡劫成功率
  rootAllBonus: 0.08,      // 厚土灵根：全资源

  /* 飞升转生 */
  legacyPerPoint: 0.03,    // 每 1 点仙缘：全局全效率 +3%
  legacyGainBase: 5e6,     // 飞升仙缘核算基数（totalXp / base 开方）

  /* 渡劫风险 */
  tribBase: 0.70,          // 大境界突破基础成功率
  tribFailLoss: 0.5,       // 渡劫失败损失「当前层累积修为」比例
  tribMercyStreak: 4,      // 连续渡劫失败达此次数后，下次必成（保底/怜悯机制，防极端霉运致挫败；设 0 关闭）

  /* 悟性点来源 */
  insightPerMajor: [0, 5, 12, 25, 45, 80, 140, 240, 400, 700], // 各大境界突破奖励（按 realmIndex）
  insightEventChance: 0.12,// 奇遇附带悟性点的概率

  /* 灵宠 */
  seekCostBase: 80,        // 寻妖基础灵石
  seekCostGrowth: 1.55,    // 寻妖成本增长
  feedCostBase: 4,         // 单次喂养消耗材料
  feedCostGrowth: 1.35,    // 喂养成本增长

  /* 秘境探索冷却（秒） */
  realmCooldown: 3,

  /* ---- 战斗 / 法宝 ----
   * 设计原则（按需求）：
   *  - 攻/防/气血 以「固定值加法」为主，绝大多数养成系统加固定值且【不封顶】，
   *    升级永远看得见涨；只有「悟道·大道」是比例倍率（唯一主力比例），
   *    境界提供「战力带」放大（修炼游戏固有，非封顶）。
   *  - 命中/闪避/暴击 纯加法累加，【不再软封顶】；战斗判定时仅把概率夹到 [0,1]。 */
  combat: {
    baseHit: 0.60,        // 基础命中率
    baseDodge: 0.05,      // 基础闪避率
    baseCrit: 0.04,       // 基础暴击率
    critMult: 1.6,        // 暴击伤害倍率
    defMit: 0.5,          // 防御减伤系数（dmg -= def*defMit）
    variance: 0.15,       // 伤害浮动 ±15%
    battleCd: 6,          // 每次战斗冷却（秒），避免连刷取代修炼
    maxRounds: 300,       // 单场战斗最大回合数（防死循环）
    // 境界战力带：把"固定值加成池"随境界放大，保证养成在后期仍有意义（非封顶，仅缩放）
    bandBase: 1,          // 战力带基数
    bandMult: 2.3,        // 每大境界战力带 ×2.3（v3 重平衡：由 1.8 上调，使玩家攻防气血随境界成长跟上敌人属性增速≈2.4×/境界，令高阶地图(大乘遗迹/天道台)在对应境界(大乘/渡劫)可胜，避免终局内容不可达）
    bandLayer: 0.05,      // 每小层战力带 +5%
    // 基础常量（再乘战力带）
    flatAtk: 6, flatDef: 3, flatHp: 60,
    // 各养成系统「固定值」加成（每级/每层加固定值，不封顶）
    techAtk: 42,          // 功法训练强度 → 攻（techSum × techAtk）
    techShare: 0.55,      // 功法额外分摊给 防/血 的比例
    abodeDef: 16,         // 洞府灵气 → 防（abodeSum × abodeDef）
    abodeHp: 34,          // 洞府灵气 → 血（abodeSum × abodeHp）
    pillK: 0,              // 丹药不再影响战斗属性（仅修炼速度 buff）；若需战斗丹，请开发专用新丹药
    petAllCombat: 90,     // 灵宠·獬豸 全资源 → 全属性（petAllBonus × petAllCombat）
    legacyCombat: 70,     // 仙缘 → 全属性固定值（legacy × legacyCombat）
    // 悟道：仅「大道」为比例倍率；「渡劫/聚财」为固定值
    insDaoAtk: 0.04,      // 悟道·大道 每级 +4% 攻（比例，唯一主力比例）
    insDaoCrit: 0.006,    // 悟道·大道 每级 +0.6% 暴击（比例）
    insJieDef: 7,         // 悟道·渡劫 每级 +7 防（固定值）
    insJieDodge: 0.004,   // 悟道·渡劫 每级 +0.4% 闪避（固定值）
    insCaiHp: 28,         // 悟道·聚财 每级 +28 血（固定值）
    // 境界对命中/闪避/暴击的成长（固定值，不封顶）
    realmHit: 0.03,       // 每个大境界 +3% 命中
    realmDodge: 0.025,    // 每个大境界 +2.5% 闪避
    realmCrit: 0.02,      // 每个大境界 +2% 暴击
    // 无尽塔
    towerStep: 0.05,      // 每层难度 +5%
    towerBase: 0.5        // 塔第 1 层基础难度系数
  },
  treasure: {
    maxLevel: 20,         // 法宝强化上限
    enhanceMatBase: 18,   // 强化基础材料消耗
    enhanceStoneBase: 160,// 强化基础灵石消耗
    enhanceGrowth: 1.55,  // 强化成本增长
    smeltMatPerQuality: 6 // 熔炼每件(按品质)返还天材地宝
  },

  /* ---- 新增：反馈/爽点/生命周期系统（纯表现+限时增益，不破坏战力模型） ---- */
  // 天降机缘（Golden Buff）：脉冲随机事件，屏上出现可点击宝光，点击得临时增益
  golden: {
    minInterval: 150, maxInterval: 320,   // 两次机缘最小/最大间隔（秒）
    pity: 480,                            // 保底：距上次超过此秒数必出
    orbLife: 20,                          // 宝光在屏可点击时长（秒）
    buffs: [
      { id: 'speed', name: '灵机迸发', desc: '修炼速度 ×5', mult: 5, dur: 30, color: 'rgba(127,209,193,0.92)' },
      { id: 'all',   name: '万物滋长', desc: '全资源 ×2',   mult: 2, dur: 60, color: 'rgba(255,215,111,0.94)', scope: 'all' },
      { id: 'burst', name: '天降洪福', desc: '瞬时修为爆发', burst: 60, color: 'rgba(199,154,255,0.94)' }
    ]
  },
  // 法宝觉醒（词缀）：满级后可觉醒，按「本法宝基数百分比」或加性百分比赋予词缀（条数封顶）
  awaken: {
    costBase: 150, costGrowth: 1.85, maxAffixes: 3,
    pity: 2,               // 连续 N 次非百分比(加成型)词条后，下次必出 攻/血 百分比词条（保底；满 3 条槽需 ≤2 方能保证至少 1 条有用词条）
    affixes: [
      { type: 'atk',   kind: 'pct', min: 0.08, max: 0.18, name: '锋锐' },
      { type: 'def',   kind: 'pct', min: 0.08, max: 0.18, name: '坚壁' },
      { type: 'hp',    kind: 'pct', min: 0.08, max: 0.18, name: '生生' },
      { type: 'crit',  kind: 'add', min: 0.02, max: 0.04, name: '会心' },
      { type: 'dodge', kind: 'add', min: 0.02, max: 0.04, name: '逍遥' },
      { type: 'hit',   kind: 'add', min: 0.015,max: 0.03, name: '必中' }
    ]
  },
  // 手动「运转周天」combo / 暴击（仅影响手动单次收益，不动自动 pacing）
  combo: { window: 3.0, perStack: 0.02, max: 3.0, critChance: 0.15, critMult: 3.0 },
  // 每日签到（7 日递增循环）
  checkIn: {
    rewards: [
      { stone: 200,   mat: 5 },
      { stone: 400,   mat: 10 },
      { stone: 800,   mat: 20 },
      { stone: 1500,  mat: 35 },
      { stone: 3000,  mat: 60 },
      { stone: 6000,  mat: 100 },
      { stone: 12000, mat: 200 }
    ]
  }
};

/* ---------- 灵根战斗映射（固定值，随境界战力带放大；不封顶） ---------- */
const ROOT_COMBAT = {
  metal: { def: 60, dodge: 0.04 },    // 金石：坚防+闪避
  wood:  { atk: 90, hit: 0.05 },      // 木灵：攻伐+命中
  water: { hp: 400 },                 // 水灵：气血
  fire:  { crit: 0.08 },              // 火灵：暴击
  earth: { atk: 30, def: 30, hp: 150 } // 厚土：全属性
};

/* ---------- 灵宠战斗映射（固定值/级，随境界战力带放大；不封顶） ---------- */
const PET_COMBAT = {
  qilin:   { atk: 14 },    // 火麟兽：攻
  jinchan: { hp: 90 },     // 招财金蟾：气血
  qingniao:{ def: 11 }     // 采灵青鸟：防
  // 獬豸通过全局 petAllBonus 影响战斗属性（全资源加成）
};

/* ---------- 十大境界（每境界 9 小层） ---------- */
const REALMS = [
  { id: 'lianqi',   name: '炼气期', color: '#7fd1c1' },
  { id: 'zhuji',    name: '筑基期', color: '#6fb1ff' },
  { id: 'jindan',   name: '金丹期', color: '#ffd76f' },
  { id: 'yuanying', name: '元婴期', color: '#ff9f9f' },
  { id: 'huashen',  name: '化神期', color: '#c79fff' },
  { id: 'lianxu',   name: '炼虚期', color: '#8affc1' },
  { id: 'heti',     name: '合体期', color: '#ffb38a' },
  { id: 'dasheng',  name: '大乘期', color: '#9ff0ff' },
  { id: 'dujie',    name: '渡劫期', color: '#ff8a8a' },
  { id: 'zhenxian', name: '真仙',   color: '#fff2a8' }
];
const LAYERS_PER_REALM = 9;
const CHINESE_LAYER = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];

/* ---------- 灵根（开局 5 选 1，永久） ---------- */
const ROOTS = [
  { id: 'metal', name: '金石灵根', icon: '🪨', desc: '灵石相关效率 +25%', type: 'stone', mult: 0.25 },
  { id: 'wood',  name: '木灵灵根', icon: '🌿', desc: '修炼速度 +15%',     type: 'speed', mult: 0.15 },
  { id: 'water', name: '水灵灵根', icon: '💧', desc: '丹药效果 +30%',     type: 'pill',  mult: 0.30 },
  { id: 'fire',  name: '火灵灵根', icon: '🔥', desc: '渡劫成功率 +15%',   type: 'trib',  mult: 0.15 },
  { id: 'earth', name: '厚土灵根', icon: '⛰️', desc: '全资源效率 +8%',    type: 'all',   mult: 0.08 }
];

/* ---------- 功法（消耗灵石，可升级，永久加成） ----------
 * 字段说明：
 *  - mult : 战斗权重（每级对 攻/防/血 的贡献系数，固定值模型用，见 combatStats），
 *           保留旧值，战斗平衡不受影响。
 *  - flat : 修炼固定值（修为/秒/级），普通档用，线性、不封顶。
 *  - ratio: 修炼比例倍率（每级），仅【最高级·鸿蒙紫气诀】用。
 * 设计原则（按需求）：功法普通档加固定值，只有最高级为比例倍率。 */
const TECHNIQUES = [
  { id: 'tuna',     name: '吐纳术',     desc: '修炼速度 +0.60/级（固定值）', baseStone: 25,     priceGrowth: 1.50, mult: 0.08, flat: 0.60, max: 99, icon: '🌀' },
  { id: 'yinqi',    name: '引气诀',     desc: '修炼速度 +1.20/级（固定值）', baseStone: 220,    priceGrowth: 1.55, mult: 0.12, flat: 1.20, max: 99, icon: '🌬️' },
  { id: 'zhoutian', name: '周天功',     desc: '修炼速度 +2.40/级（固定值）', baseStone: 2400,   priceGrowth: 1.60, mult: 0.18, flat: 2.40, max: 99, icon: '🔄' },
  { id: 'wuxing',   name: '五行诀',     desc: '修炼速度 +4.40/级（固定值）', baseStone: 28000,  priceGrowth: 1.65, mult: 0.25, flat: 4.40, max: 99, icon: '☯️' },
  { id: 'taiyi',    name: '太一真诀',   desc: '修炼速度 +7.20/级（固定值）', baseStone: 360000, priceGrowth: 1.70, mult: 0.40, flat: 7.20, max: 99, icon: '🌟' },
  { id: 'hongmeng', name: '鸿蒙紫气诀', desc: '修炼速度 +16.00/级（固定值·顶级），所有功法效率 +2%/级', baseStone: 5200000, priceGrowth: 1.75, mult: 0.60, flat: 16.00, seriesBuff: 0.02, max: 99, icon: '🟣' }
];

/* ---------- 洞府 / 灵脉（消耗灵石，可升级，永久加成「灵气浓度」→ 修炼速度·固定值） ---------- */
const ABODES = [
  { id: 'cave',    name: '荒野洞府', desc: '灵气浓度 +1.00/级（固定值）', baseStone: 60,    priceGrowth: 1.50, mult: 0.12, flat: 1.00, max: 99, icon: '⛰️' },
  { id: 'lingmai', name: '地脉灵穴', desc: '灵气浓度 +2.00/级（固定值）', baseStone: 900,   priceGrowth: 1.55, mult: 0.18, flat: 2.00, max: 99, icon: '💎' },
  { id: 'fudi',    name: '洞天福地', desc: '灵气浓度 +3.60/级（固定值）', baseStone: 14000, priceGrowth: 1.60, mult: 0.25, flat: 3.60, max: 99, icon: '🏞️' },
  { id: 'xianfu',  name: '上古仙府', desc: '灵气浓度 +8.00/级（固定值·顶级），所有洞府效率 +2%/级', baseStone: 240000, priceGrowth: 1.65, mult: 0.35, flat: 8.00, seriesBuff: 0.02, max: 99, icon: '🏯' }
];

/* ---------- 丹药（消耗灵石，限时冲刺 buff，固定值加成修炼速度，不乘任何比例） ----------
 * flat = 修炼速度固定加成(修为/秒)；duration = 有效秒数；safe = 渡劫必成 */
const PILLS = [
  { id: 'juqi',     name: '聚气丹',     desc: '2 时辰内修炼速度 +0.5/秒',  baseStone: 300,    duration: 7200, flat: 0.5,  icon: '💊' },
  { id: 'jinyuan',  name: '金元丹',     desc: '2 时辰内修炼速度 +1.5/秒',  baseStone: 3200,   duration: 7200, flat: 1.5,  icon: '🟠' },
  { id: 'bijie',    name: '避劫丹',     desc: '2 时辰内修炼速度 +3/秒，渡劫必成', baseStone: 36000,  duration: 7200, flat: 3.0,  safe: true, icon: '🟡' },
  { id: 'jiuzhuan', name: '九转金丹',   desc: '2 时辰内修炼速度 +6/秒',  baseStone: 420000, duration: 7200, flat: 6.0,  icon: '🔆' }
];

/* ---------- 灵宠（寻妖→喂养→自动产出） ---------- */
const PETS = [
  { id: 'qilin',    name: '火麟兽', icon: '🐲', desc: '自动产出修为',      produce: { type: 'xp',   base: 1.5 },   max: 80, weight: 3 },
  { id: 'jinchan',  name: '招财金蟾', icon: '🐸', desc: '自动产出灵石',      produce: { type: 'stone',base: 0.25 },  max: 80, weight: 3 },
  { id: 'qingniao', name: '采灵青鸟', icon: '🐦', desc: '自动产出天材地宝',  produce: { type: 'mat',  base: 0.06 },  max: 80, weight: 2 },
  { id: 'xiezhi',   name: '祥瑞獬豸', icon: '🦄', desc: '全资源加成（每级+4%，封顶）',    produce: { type: 'all',  base: 0.04 },  max: 80, weight: 1 }
];

/* ---------- 秘境历练（爽文故事线「凡人逆天录」，共 5 章，覆盖全游戏流程） ----------
 *  每章含 4~5 段故事 + 分支选择（choices）；玩家选风险强度+探索策略，
 *  不同策略影响收益/风险倍率。收益随境界缩放（currentSpeed × xpSeconds）。
 *  0.3%~0.8% 概率触发「主角机缘」→ 免费突破 1 小层。 */
const SECRET_REALMS = [
  {
    id: 'chapter1', name: '第一章·剑崖奇遇', icon: '🗡️',
    realmReq: 0, cost: 50,
    xpSeconds: [20, 80], mat: [1, 3], stone: [50, 150],
    insightChance: 0.03, insightGain: 1,
    fortuneChance: 0.005, fortuneDesc: '✨ 剑意灌体！你突破一层修为壁垒！',
    riskType: 'xpPct', riskChance: 0.12, riskRange: [0.1, 3.0],
    storyTitle: '凡人逆天录·第一章',
    storyText: '你误入一处无名剑崖，崖壁上布满了纵横剑痕。隐约间，你感受到一股微弱的召唤——那是一位陨落在此的凡修，毕生参悟的「逆命剑诀」……',
    storyChapters: [
      '你触摸第一道剑痕，脑海中浮现一个凡人少年持剑劈山的画面。那少年资质平平，却以一股不服输的狠劲，硬生生劈开了挡在面前的第一座山。',
      '第二道剑痕承载着一式剑招「斩命」——斩断的不是敌人，而是自己的命运枷锁。你盘膝参悟，体内灵气随之共振。',
      '第三道剑痕是残缺的，但你看到了那凡人少年成长为青年的身影——他站在天劫之下，以凡人之躯逆天而行。你的道心为之震颤。',
      '完整的「逆命剑诀」在你心中成型！你不由自主地挥出一剑，剑芒划破长空，崖壁上的剑痕尽数共鸣！',
    ],
    choices: [
      { text: '🛡️ 稳扎稳打·细悟剑意', desc: '风险略降，收益稳定', riskMult: 0.8, rewardMult: 1.0, insightUp: 0.05 },
      { text: '⚔️ 锋芒毕露·全力参悟', desc: '标准收益，风险正常', riskMult: 1.0, rewardMult: 1.2, insightUp: 0.03 },
      { text: '🔥 剑走偏锋·直取核心', desc: '高收益高风险，可能触发机缘', riskMult: 1.5, rewardMult: 1.8, fortuneUp: 0.01 },
    ],
    successMsg: '🗡️ 剑意入体！你悟出一式剑意，修为精进。',
    failMsg: '💥 剑意反噬！你被震退数丈，气息紊乱。',
  },
  {
    id: 'chapter2', name: '第二章·乱世崛起', icon: '🏟️',
    realmReq: 1, cost: 400,
    xpSeconds: [30, 120], mat: [3, 8], stone: [100, 400],
    insightChance: 0.04, insightGain: 1,
    fortuneChance: 0.005, fortuneDesc: '✨ 宗门震动！你以碾压之势名震一方！',
    riskType: 'xpPct', riskChance: 0.13, riskRange: [0.1, 3.0],
    storyTitle: '凡人逆天录·第二章',
    storyText: '你离开剑崖，来到一座巍峨的古城。城中正在举办十年一度的「天骄会武」——优胜者可入宗门核心，获修炼资源无数。你决定以「逆命剑诀」参战……',
    storyChapters: [
      '第一轮，你一剑击败对手——台下哗然。一个无名散修，使得一手从未见过的剑法，招式不讲道理却凌厉无比。',
      '第二轮对阵宗门真传弟子。对方灵根上品、法宝精良，你的「逆命剑诀」却被逼出了第二式——「逆势」！越是劣势，剑势越强！',
      '决赛！你面对的是上一届冠军——金丹后期，掌握地阶功法。全场无人看好你。但你闭上眼睛，想起了剑崖上那个逆天而战的背影。',
      '一剑！仅仅一剑！你的「斩命」突破了境界壁垒，斩破了对手的护体真罡。全场死寂，然后爆发出震天的喝彩！你赢了。',
    ],
    choices: [
      { text: '🛡️ 稳扎稳打·一招一式', desc: '稳赢，收益均衡', riskMult: 0.8, rewardMult: 1.0, matUp: 1 },
      { text: '⚔️ 全力出手·碾压对手', desc: '标准战法，灵石更多', riskMult: 1.0, rewardMult: 1.3, stoneUp: 1.5 },
      { text: '🔥 以命相搏·越级挑战', desc: '高风险！可能秒杀对手拿大奖', riskMult: 1.6, rewardMult: 2.0, fortuneUp: 0.008 },
    ],
    successMsg: '🏟️ 宗门震动！你声名鹊起，资源滚滚而来。',
    failMsg: '💥 你被对手击中要害，败下阵来，修为受损。',
  },
  {
    id: 'chapter3', name: '第三章·秘境夺宝', icon: '💎',
    realmReq: 3, cost: 3000,
    xpSeconds: [40, 180], mat: [8, 20], stone: [300, 1500],
    insightChance: 0.05, insightGain: 1,
    fortuneChance: 0.005, fortuneDesc: '✨ 你抢到了上古至宝！万古唯一！',
    riskType: 'xpPct', riskChance: 0.15, riskRange: [0.1, 3.0],
    storyTitle: '凡人逆天录·第三章',
    storyText: '一座上古秘境在虚空中显现！传闻里面藏着一位陨落仙尊的遗藏——谁能拿到，谁就能打破修行瓶颈，一飞冲天。各方势力蜂拥而至……',
    storyChapters: [
      '秘境入口是一道万丈深渊，无数修士跃入其中。你悄然跟在众人之后，却不急于出手——剑崖的经历让你明白，真正的宝藏，从不在明处。',
      '深渊之下是迷宫般的甬道。你听到了前方的打斗声——有人为了一株万年灵药在厮杀。你绕道而行，凭直觉走向了一条无人问津的岔路。',
      '岔路的尽头是一间石室。石室内没有灵药、没有法宝——只有一面镜子。镜中映出的是你自己，但那不是现在的你……是那个可能成为的你。',
      '你伸手触镜，无数记忆涌入脑海——你看到了自己未来可能的无数命运。这就是仙尊真正的遗藏：不是外物，而是一眼看透道途本源的能力。',
    ],
    choices: [
      { text: '🕵️ 暗中观察·伺机而动', desc: '安全第一，材料为主', riskMult: 0.7, rewardMult: 0.9, matUp: 2 },
      { text: '⚡ 直奔核心·抢夺至宝', desc: '标准收益，灵石+修为', riskMult: 1.0, rewardMult: 1.2 },
      { text: '🌌 探索隐藏区域', desc: '高风险！可能发现隐藏机缘', riskMult: 1.7, rewardMult: 2.2, fortuneUp: 0.012, insightUp: 0.06 },
    ],
    successMsg: '💎 你参透了镜中玄机，修为与眼界并进！',
    failMsg: '💥 镜像反噬！你的心神险些被吸入镜中，挣扎退出后元气大伤。',
  },
  {
    id: 'chapter4', name: '第四章·仙路争锋', icon: '⚔️',
    realmReq: 5, cost: 22000,
    xpSeconds: [60, 240], mat: [20, 50], stone: [1000, 5000],
    insightChance: 0.06, insightGain: 2,
    fortuneChance: 0.006, fortuneDesc: '✨ 你击败了宿命之敌！道心通明！',
    riskType: 'xpPct', riskChance: 0.16, riskRange: [0.1, 3.0],
    storyTitle: '凡人逆天录·第四章',
    storyText: '你的名声传遍了九天十地。但也引来了一个宿敌——来自上界的「天选之子」，他拥有你无法企及的先天条件。你们注定有一战……',
    storyChapters: [
      '你闭关参悟「逆命剑诀」最后一式。这一式的名字你早已知道——「逆命」。不是剑法，是意志。你回忆起一路走来的每一个脚印。',
      '天选之子找到了你。你们在九天之上对峙。他周身笼罩着天道恩宠的光辉，而你只是一个从最底层杀出来的凡人。但他眼中的忌惮，是真的。',
      '战斗持续了七天七夜。你的「逆命」一式终于施展出来——不是斩向敌人，而是斩向你自己的命运！那一刻，你超越了天道的束缚。',
      '天选之子跪了下来。不是认输，是被你的道所震撼。他说了一句话：「凡人之躯，比肩神明……不，比神明更耀眼。」你突破了最后的瓶颈。',
    ],
    choices: [
      { text: '🧘 提升心境·稳固道基', desc: '稳扎稳打，悟性+修为', riskMult: 0.8, rewardMult: 1.0, insightUp: 0.06 },
      { text: '⚔️ 正面迎战·以力证道', desc: '硬碰硬，收益均衡', riskMult: 1.0, rewardMult: 1.3 },
      { text: '🔥 以弱胜强·绝地反击', desc: '置之死地而后生，超高收益', riskMult: 1.8, rewardMult: 2.5, fortuneUp: 0.015 },
    ],
    successMsg: '⚔️ 你战胜了宿敌，仙路再无阻碍！',
    failMsg: '💥 天选之子的力量远超预料，你负伤败退，境界动摇。',
  },
  {
    id: 'chapter5', name: '第五章·逆天之战', icon: '🌌',
    realmReq: 8, cost: 220000,
    xpSeconds: [120, 480], mat: [50, 120], stone: [5000, 20000],
    insightChance: 0.08, insightGain: 3,
    fortuneChance: 0.008, fortuneDesc: '✨ 你以凡人之躯逆了这片天！证道真仙！',
    riskType: 'xpPct', riskChance: 0.18, riskRange: [0.1, 3.0],
    storyTitle: '凡人逆天录·终章',
    storyText: '天道降下旨意：你的存在违背了天理，必须被抹除。但你早已不是那个仰望苍穹的凡人了——你手中握剑，身后是整个被你改变的世界……',
    storyChapters: [
      '天道化身降临！那是这片天地意志的具现——巨大无比，俯瞰众生。你在他面前渺小如尘埃。但你握紧了剑柄，嘴角带着笑意。',
      '「你不怕我？」天道的声音轰鸣。你说：「怕。但我一路走来，每天都在面对不可能战胜的敌人。而你，不过是最后一个。」——一剑出！',
      '「逆命剑诀·最终式——凡人逆天！」这一剑汇聚了你一生的意志。不是斩天，是斩断天对人的枷锁。天道化身露出了震惊的表情。',
      '枷锁崩碎！天道化身的躯体炸裂成无数光点，散落在天地之间。阳光重新照在大地上——这一次，照在了所有人身上，不再有高低贵贱之分。',
      '你站在群山之巅，天道的碎片在你身边飘落。这片天地，从此有了一个新的名字——「凡人界」。而你，是它的守护者。也是第一个以凡人之躯证道真仙的传奇。',
    ],
    choices: [
      { text: '🛡️ 坚守本心·稳如磐石', desc: '稳扎稳打，道心稳固', riskMult: 0.8, rewardMult: 1.0, insightUp: 0.08 },
      { text: '⚡ 全力一击·不留余地', desc: '标准战法，修为+灵石', riskMult: 1.0, rewardMult: 1.4 },
      { text: '🌌 逆命而行·超越天道', desc: '极致风险！可能直接证道', riskMult: 2.0, rewardMult: 3.0, fortuneUp: 0.02 },
    ],
    successMsg: '🌌 你赢了。天地之间，回荡着你的名字。',
    failMsg: '💥 天道化身太强了……你被打落凡尘，修为大损。',
  },
];

/* ---------- 法宝品质（5 档，倍率影响法宝属性） ---------- */
const QUALITY = [
  { id: 1, name: '凡品', color: '#9fb0c0', mult: 1.0,  weight: 60 },
  { id: 2, name: '灵器', color: '#6fb1ff', mult: 1.6,  weight: 26 },
  { id: 3, name: '宝器', color: '#ffd76f', mult: 2.4,  weight: 10 },
  { id: 4, name: '仙器', color: '#ff9f9f', mult: 3.6,  weight: 3.5 },
  { id: 5, name: '神器', color: '#c79fff', mult: 5.5,  weight: 0.5 }
];

/* ---------- 法宝（3 槽位：weapon/armor/trinket） ----------
 * base: 基础属性 {atk 攻 / def 防 / hp 气血 / hit 命中 / dodge 闪避 / crit 暴击}
 * quality: 品质档位(见 QUALITY)                                                      */
const TREASURES = [
  { id: 'qingfeng',   name: '青锋剑',   icon: '🗡️', slot: 'weapon',  quality: 1, base: { atk: 8,  hit: 0.03 },        desc: '锋锐无匹，攻伐与命中兼备' },
  { id: 'lihuofan',   name: '离火幡',   icon: '🔥', slot: 'weapon',  quality: 2, base: { atk: 12, crit: 0.04 },       desc: '引动离火，暴击攀升' },
  { id: 'xuanyuan',   name: '轩辕剑',   icon: '⚔️', slot: 'weapon',  quality: 4, base: { atk: 18, hit: 0.05, crit: 0.03 }, desc: '人皇圣器，攻伐无双' },
  { id: 'donghuang',  name: '东皇钟',   icon: '🔔', slot: 'weapon',  quality: 5, base: { atk: 26, def: 8, crit: 0.05, dodge: 0.03 }, desc: '钟鸣震九天，攻防一体，回旋闪避' },
  { id: 'jinyi',      name: '金缕衣',   icon: '🛡️', slot: 'armor',   quality: 1, base: { def: 10, hp: 40, dodge: 0.02 },          desc: '金线织就，身法灵动，防御气血兼修' },
  { id: 'taiji',      name: '太极图',   icon: '☯️', slot: 'armor',   quality: 3, base: { def: 16, dodge: 0.04 },     desc: '阴阳流转，闪避加身' },
  { id: 'wujin',      name: '乌金甲',   icon: '🪖', slot: 'armor',   quality: 4, base: { def: 22, hp: 90, hit: 0.02 },          desc: '乌金百炼，坚不可摧，隐隐有杀机' },
  { id: 'hunyuan',    name: '混元铠',   icon: '🛡️', slot: 'armor',   quality: 5, base: { def: 30, hp: 150, dodge: 0.05 }, desc: '混元一气，神铠护身，万法不侵' },
  { id: 'fengming',   name: '风鸣环',   icon: '💍', slot: 'trinket', quality: 2, base: { dodge: 0.06, hit: 0.03 },   desc: '风随环动，身法飘忽' },
  { id: 'xingchen',   name: '星辰珠',   icon: '🔮', slot: 'trinket', quality: 3, base: { crit: 0.06, hit: 0.03 },    desc: '星力汇聚，暴击激增' },
  { id: 'kunlun',     name: '昆仑镜',   icon: '🪞', slot: 'trinket', quality: 5, base: { dodge: 0.05, crit: 0.04, hit: 0.02 }, desc: '照见虚妄，诸般增益' }
];

/* ---------- 战斗地图 / 关卡 ----------
 * 逐关解锁；清掉上一关才开下一关，清掉本图 BOSS 解锁下一张图。
 * 敌人属性: atk/def/hp/hit/dodge/crit
 * reward: 胜利奖励区间；drop: {chance 掉落概率, pool:[法宝id...]}            */
const MAPS = [
  { id: 'yaolin', name: '妖兽森林', icon: '🌲', desc: '林间妖兽横行，初出茅庐者可历练于此', realmReq: 0, levels: [
    { name: '野狼妖', icon: '🐺', atk: 134, def: 251, hp: 634, hit: 0.6698, dodge: 0.1411, crit: 0.02, reward: {"stone":[20,60],"mat":[1,3],"xp":[100,400]}, drop: {"chance":0.55,"pool":["qingfeng","jinyi","fengming"]} },
    { name: '巨蟒妖', icon: '🐍', atk: 176, def: 330, hp: 833, hit: 0.6698, dodge: 0.1411, crit: 0.02, reward: {"stone":[50,140],"mat":[2,5],"xp":[300,900]}, drop: {"chance":0.5,"pool":["qingfeng","lihuofan","jinyi","fengming"]} },
    { name: '赤睛虎', icon: '🐯', atk: 205, def: 385, hp: 971, hit: 0.6698, dodge: 0.1411, crit: 0.02, reward: {"stone":[120,320],"mat":[3,8],"xp":[800,2000]}, drop: {"chance":0.45,"pool":["lihuofan","jinyi","taiji","fengming","xingchen"]} },
    { name: '妖将·血爪', icon: '👹', atk: 230, def: 432, hp: 1090, hit: 0.6698, dodge: 0.1411, crit: 0.02, reward: {"stone":[300,700],"mat":[5,12],"xp":[2000,5000]}, drop: {"chance":0.4,"pool":["lihuofan","taiji","xingchen","wujin"]}, boss: true },
  ]},
  { id: 'guzhanchang', name: '上古战场', icon: '⚔️', desc: '残魂不灭，杀机四伏，需筑基以上修为', realmReq: 1, levels: [
    { name: '无名战魂', icon: '👻', atk: 1398, def: 1926, hp: 4865, hit: 0.7045, dodge: 0.1824, crit: 0.039, reward: {"stone":[260,600],"mat":[4,10],"xp":[1800,4500]}, drop: {"chance":0.45,"pool":["lihuofan","jinyi","taiji","fengming","xingchen"]} },
    { name: '断戟将军', icon: '🪦', atk: 1835, def: 2527, hp: 6385, hit: 0.7045, dodge: 0.1824, crit: 0.039, reward: {"stone":[600,1300],"mat":[7,16],"xp":[4000,9000]}, drop: {"chance":0.42,"pool":["lihuofan","taiji","wujin","xingchen","xuanyuan"]} },
    { name: '阴煞统领', icon: '💀', atk: 2141, def: 2948, hp: 7449, hit: 0.7045, dodge: 0.1824, crit: 0.039, reward: {"stone":[1300,2800],"mat":[12,26],"xp":[9000,20000]}, drop: {"chance":0.4,"pool":["taiji","wujin","xingchen","xuanyuan","kunlun"]} },
    { name: '古战场之主', icon: '👑', atk: 2404, def: 3310, hp: 8361, hit: 0.7045, dodge: 0.1824, crit: 0.039, reward: {"stone":[3000,6000],"mat":[20,42],"xp":[20000,45000]}, drop: {"chance":0.38,"pool":["wujin","xuanyuan","kunlun","donghuang"]}, boss: true },
  ]},
  { id: 'moyuan', name: '魔渊', icon: '🌋', desc: '魔气滔天，凶险异常，金丹以上方可涉足', realmReq: 2, levels: [
    { name: '噬魂魔兵', icon: '😈', atk: 5147, def: 6710, hp: 16951, hit: 0.7393, dodge: 0.2115, crit: 0.1932, reward: {"stone":[2500,5200],"mat":[16,34],"xp":[16000,36000]}, drop: {"chance":0.42,"pool":["taiji","wujin","xingchen","xuanyuan","kunlun"]} },
    { name: '炼狱炎魔', icon: '🦹', atk: 6755, def: 8807, hp: 22249, hit: 0.7393, dodge: 0.2115, crit: 0.1932, reward: {"stone":[5500,11000],"mat":[30,60],"xp":[38000,80000]}, drop: {"chance":0.4,"pool":["xuanyuan","wujin","kunlun","donghuang"]} },
    { name: '九幽魔将', icon: '🦠', atk: 7881, def: 10275, hp: 25957, hit: 0.7393, dodge: 0.2115, crit: 0.1932, reward: {"stone":[12000,24000],"mat":[55,110],"xp":[90000,180000]}, drop: {"chance":0.38,"pool":["xuanyuan","kunlun","donghuang","wujin"]} },
    { name: '魔渊君·修罗', icon: '👺', atk: 8846, def: 11533, hp: 29135, hit: 0.7393, dodge: 0.2115, crit: 0.1932, reward: {"stone":[28000,55000],"mat":[100,200],"xp":[200000,420000]}, drop: {"chance":0.36,"pool":["xuanyuan","kunlun","donghuang","hunyuan"]}, boss: true },
  ]},
  { id: 'xianxi', name: '仙界裂隙', icon: '🌌', desc: '仙魔交汇之地，藏无上法宝，化神以上方可入', realmReq: 4, levels: [
    { name: '裂隙游魂', icon: '🌟', atk: 39159, def: 49934, hp: 126149, hit: 1.1555, dodge: 0.1717, crit: 0.288, reward: {"stone":[24000,48000],"mat":[80,160],"xp":[170000,360000]}, drop: {"chance":0.4,"pool":["xuanyuan","kunlun","donghuang","hunyuan"]} },
    { name: '守界仙卫', icon: '🛡️', atk: 51396, def: 65538, hp: 165570, hit: 1.1555, dodge: 0.1717, crit: 0.288, reward: {"stone":[52000,100000],"mat":[150,300],"xp":[380000,800000]}, drop: {"chance":0.38,"pool":["xuanyuan","kunlun","donghuang","hunyuan"]} },
    { name: '堕仙残影', icon: '🪽', atk: 59962, def: 76461, hp: 193165, hit: 1.1555, dodge: 0.1717, crit: 0.288, reward: {"stone":[110000,220000],"mat":[280,560],"xp":[900000,1800000]}, drop: {"chance":0.36,"pool":["xuanyuan","kunlun","donghuang","hunyuan"]} },
    { name: '裂隙主宰·鸿钧', icon: '🌠', atk: 67304, def: 85824, hp: 216818, hit: 1.1555, dodge: 0.1717, crit: 0.288, reward: {"stone":[260000,520000],"mat":[520,1000],"xp":[2000000,4200000]}, drop: {"chance":0.34,"pool":["donghuang","xuanyuan","kunlun","hunyuan"]}, boss: true },
  ]},
  { id: 'xuli', name: '炼虚禁地', icon: '⛩️', desc: '法则乱流，非炼虚以上不可踏足', realmReq: 5, levels: [
    { name: '法则乱流', icon: '🌪️', atk: 95311, def: 120645, hp: 304787, hit: 1.2427, dodge: 0.2032, crit: 0.3322, reward: {"stone":[36000,72000],"mat":[120,240],"xp":[250000,520000]}, drop: {"chance":0.36,"pool":["xuanyuan","kunlun","donghuang","hunyuan"]} },
    { name: '虚空妖灵', icon: '👾', atk: 125095, def: 158346, hp: 400033, hit: 1.2427, dodge: 0.2032, crit: 0.3322, reward: {"stone":[78000,150000],"mat":[220,440],"xp":[550000,1100000]}, drop: {"chance":0.34,"pool":["xuanyuan","kunlun","donghuang","hunyuan"]} },
    { name: '混沌守卫', icon: '🛡️', atk: 145944, def: 184737, hp: 466705, hit: 1.2427, dodge: 0.2032, crit: 0.3322, reward: {"stone":[165000,330000],"mat":[400,800],"xp":[1200000,2400000]}, drop: {"chance":0.32,"pool":["xuanyuan","kunlun","donghuang","hunyuan"]} },
    { name: '妖皇·裂空', icon: '👑', atk: 163815, def: 207358, hp: 523853, hit: 1.2427, dodge: 0.2032, crit: 0.3322, reward: {"stone":[390000,780000],"mat":[700,1400],"xp":[2500000,5200000]}, drop: {"chance":0.3,"pool":["donghuang","xuanyuan","kunlun","hunyuan"]}, boss: true },
  ]},
  { id: 'heti', name: '合体战场', icon: '⚔️', desc: '上古仙魔战场，合体期方可一战', realmReq: 6, levels: [
    { name: '残存仙兵', icon: '🗡️', atk: 228117, def: 281578, hp: 711355, hit: 0.9458, dodge: 1.3286, crit: 0.5825, reward: {"stone":[55000,110000],"mat":[180,360],"xp":[350000,720000]}, drop: {"chance":0.34,"pool":["donghuang","xuanyuan","kunlun","hunyuan"]} },
    { name: '魔道巨擘', icon: '😈', atk: 299403, def: 369571, hp: 933654, hit: 0.9458, dodge: 1.3286, crit: 0.5825, reward: {"stone":[120000,240000],"mat":[330,660],"xp":[800000,1600000]}, drop: {"chance":0.32,"pool":["donghuang","xuanyuan","kunlun","hunyuan"]} },
    { name: '战场英灵', icon: '👻', atk: 349304, def: 431167, hp: 1089263, hit: 0.9458, dodge: 1.3286, crit: 0.5825, reward: {"stone":[260000,520000],"mat":[600,1200],"xp":[1800000,3600000]}, drop: {"chance":0.3,"pool":["donghuang","xuanyuan","kunlun","hunyuan"]} },
    { name: '战神·刑天', icon: '🪓', atk: 392076, def: 483962, hp: 1222642, hit: 0.9458, dodge: 1.3286, crit: 0.5825, reward: {"stone":[600000,1200000],"mat":[1000,2000],"xp":[3800000,7800000]}, drop: {"chance":0.28,"pool":["donghuang","xuanyuan","kunlun","hunyuan"]}, boss: true },
  ]},
  { id: 'dasheng', name: '大乘遗迹', icon: '🏛️', desc: '大乘先辈遗留下来的试炼之地', realmReq: 7, levels: [
    { name: '遗迹守卫', icon: '🗿', atk: 504684, def: 623539, hp: 1575257, hit: 0.9835, dodge: 1.4208, crit: 0.6263, reward: {"stone":[85000,170000],"mat":[260,520],"xp":[480000,1000000]}, drop: {"chance":0.32,"pool":["donghuang","xuanyuan","kunlun","hunyuan"]} },
    { name: '法则幻影', icon: '✨', atk: 662398, def: 818395, hp: 2067525, hit: 0.9835, dodge: 1.4208, crit: 0.6263, reward: {"stone":[180000,360000],"mat":[480,960],"xp":[1100000,2200000]}, drop: {"chance":0.3,"pool":["donghuang","xuanyuan","kunlun","hunyuan"]} },
    { name: '太古神兽', icon: '🐉', atk: 772798, def: 954794, hp: 2412112, hit: 0.9835, dodge: 1.4208, crit: 0.6263, reward: {"stone":[380000,760000],"mat":[880,1760],"xp":[2500000,5000000]}, drop: {"chance":0.28,"pool":["donghuang","xuanyuan","kunlun","hunyuan"]} },
    { name: '古佛·迦叶', icon: '🛕', atk: 867426, def: 1071708, hp: 2707473, hit: 0.9835, dodge: 1.4208, crit: 0.6263, reward: {"stone":[900000,1800000],"mat":[1500,3000],"xp":[5200000,10500000]}, drop: {"chance":0.26,"pool":["donghuang","xuanyuan","kunlun","hunyuan"]}, boss: true },
  ]},
  { id: 'tianjie', name: '天道台', icon: '☁️', desc: '直面天道的最终试炼，渡劫期方可登临', realmReq: 8, levels: [
    { name: '天雷化身', icon: '⚡', atk: 1115958, def: 1378329, hp: 3482095, hit: 1.0212, dodge: 1.5164, crit: 0.673, reward: {"stone":[130000,260000],"mat":[380,760],"xp":[650000,1350000]}, drop: {"chance":0.3,"pool":["donghuang","xuanyuan","kunlun","hunyuan"]} },
    { name: '心魔镜像', icon: '🪞', atk: 1464695, def: 1809057, hp: 4570250, hit: 1.0212, dodge: 1.5164, crit: 0.673, reward: {"stone":[280000,560000],"mat":[700,1400],"xp":[1500000,3000000]}, drop: {"chance":0.28,"pool":["donghuang","xuanyuan","kunlun","hunyuan"]} },
    { name: '天道意志', icon: '👁️', atk: 1708811, def: 2110567, hp: 5331958, hit: 1.0212, dodge: 1.5164, crit: 0.673, reward: {"stone":[600000,1200000],"mat":[1300,2600],"xp":[3500000,7000000]}, drop: {"chance":0.26,"pool":["donghuang","xuanyuan","kunlun","hunyuan"]} },
    { name: '天道化身', icon: '🌌', atk: 1918054, def: 2369004, hp: 5984851, hit: 1.0212, dodge: 1.5164, crit: 0.673, reward: {"stone":[1400000,2800000],"mat":[2200,4400],"xp":[7500000,15000000]}, drop: {"chance":0.24,"pool":["donghuang","xuanyuan","kunlun","hunyuan"]}, boss: true },
  ]},
];

/* ---------- 悟道（消耗悟性点，永久提升） ---------- */
const INSIGHTS = [
  { id: 'dao',  name: '参悟·大道', desc: '基础修炼速度 +4%/级', base: 2, growth: 1.5, mult: 0.04, max: 50, icon: '☯️' },
  { id: 'jie',  name: '参悟·渡劫', desc: '渡劫成功率 +4%/级',   base: 3, growth: 1.6, mult: 0.04, max: 50, icon: '⚡' },
  { id: 'cai',  name: '参悟·聚财', desc: '灵石效率 +4%/级',     base: 2, growth: 1.5, mult: 0.04, max: 50, icon: '💰' }
];

/* ---------- 仙缘殿·永久道韵（消耗「仙玉」购买，跨轮回永久生效） ---------- */
/* kind 对应生效维度：xiuwei=修炼速度, zhanli=战斗攻防血, xianyuan=仙缘(仙玉)获取 */
const BLESSINGS = [
  { id: 'xiuwei',   kind: 'xiuwei',   name: '道韵·长春', desc: '修炼速度 +8%/级（永久）', icon: '🌱', baseCost: 20, growth: 1.7, max: 10, effect: 0.08 },
  { id: 'zhanli',   kind: 'zhanli',   name: '道韵·破军', desc: '战斗 攻/防/血 +8%/级（永久）', icon: '⚔️', baseCost: 20, growth: 1.7, max: 10, effect: 0.08 },
  { id: 'xianyuan', kind: 'xianyuan', name: '道韵·聚仙', desc: '仙玉获取 +10%/级（永久）', icon: '🔮', baseCost: 30, growth: 1.8, max: 10, effect: 0.10 }
];

/* ---------- 无尽试炼塔·位阶（本地，依据历史最高层） ---------- */
const TOWER_TIERS = [
  { floor: 0,   title: '凡俗',     icon: '🌑' },
  { floor: 10,  title: '炼气士',   icon: '🌒' },
  { floor: 25,  title: '筑基真人', icon: '🌓' },
  { floor: 50,  title: '金丹真人', icon: '🌔' },
  { floor: 100, title: '元婴真君', icon: '🌕' },
  { floor: 200, title: '化神天君', icon: '☀️' },
  { floor: 400, title: '炼虚尊者', icon: '🌟' },
  { floor: 700, title: '合体大宗', icon: '👑' },
  { floor: 1000,title: '大乘仙尊', icon: '🏯' },
  { floor: 1500,title: '渡劫道祖', icon: '⚡' },
  { floor: 2000,title: '真仙之姿', icon: '✨' }
];

/* ---------- 奇遇事件（随机触发，奖励进入日志） ---------- */
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
const EVENTS = [
  { id: 'lingcao',  name: '采得灵草',   desc: '于山涧采得一枚灵草，售予同门。',         reward: { stone: () => randInt(20, 90) },                                       weight: 3, icon: '🌿' },
  { id: 'chuanong', name: '前辈传功',   desc: '偶遇散修前辈，传你一丝法力。',           reward: { xp:    () => randInt(50, 220) },                                      weight: 3, icon: '🙇' },
  { id: 'dunwu',    name: '灵机顿悟',   desc: '静坐间忽有所悟，修为小进。',             reward: { xp:    () => randInt(120, 560) },                                     weight: 2, icon: '💡' },
  { id: 'kuangmai', name: '灵石矿脉',   desc: '掘地三尺，发现一处小型灵石矿。',         reward: { stone: () => randInt(120, 480) },                                     weight: 2, icon: '⛏️' },
  { id: 'xiangrui', name: '天降祥瑞',   desc: '祥云蔽日，福泽加身，修为灵石兼得。',     reward: { stone: () => randInt(320, 900), xp: () => randInt(220, 700) },         weight: 1, icon: '🌈' },
  { id: 'yaoshou',  name: '妖兽袭扰',   desc: '一头妖兽路过，虽惊无险，捡得残丹。',     reward: { stone: () => randInt(60, 180) },                                      weight: 1, icon: '🐺' },
  { id: 'xianyuan', name: '仙缘眷顾',   desc: '似有古老存在垂青，赐下一点悟性。',       reward: { insight: () => 1 }, weight: 1, icon: '✨' },
  { id: 'baoyao',  name: '误入药园',   desc: '迷雾中闯入上古药园，采得数株灵药。',     reward: { mat: () => randInt(2, 6) }, weight: 1, icon: '🌺' }
];

/* ---------- 成就（含 v2 新系统） ---------- */
const ACHIEVEMENTS = [
  { id: 'a1',  name: '初窥门径',   desc: '踏入炼气期',                 realm: 0, icon: '🌱' },
  { id: 'a2',  name: '根基初成',   desc: '凝结筑基，道基初立',         realm: 1, icon: '🧱' },
  { id: 'a3',  name: '金丹大道',   desc: '丹田凝丹，寿元大增',         realm: 2, icon: '⚪' },
  { id: 'a4',  name: '元婴出窍',   desc: '育出元婴，可离体而行',       realm: 3, icon: '👶' },
  { id: 'a5',  name: '化神可期',   desc: '神念化形，洞悉天地',         realm: 4, icon: '🌌' },
  { id: 'a6',  name: '炼虚合道',   desc: '炼虚入微，法则初触',         realm: 5, icon: '🌠' },
  { id: 'a7',  name: '合体双修',   desc: '身神合一，气象万千',         realm: 6, icon: '🔗' },
  { id: 'a8',  name: '大乘在望',   desc: '大乘将满，半步仙人',         realm: 7, icon: '🚀' },
  { id: 'a9',  name: '渡劫飞升',   desc: '历经天劫，劫后余生',         realm: 8, icon: '⚡' },
  { id: 'a10', name: '真仙果位',   desc: '功成圆满，证得真仙',         realm: 9, icon: '✨' },
  { id: 'p1',  name: '初遇灵宠',   desc: '收服第一只灵宠',             pet: 1,  icon: '🐾' },
  { id: 'p2',  name: '万灵朝宗',   desc: '集齐四种灵宠',               pet: 4,  icon: '🐲' },
  { id: 's1',  name: '初探秘境',   desc: '首次踏入秘境历练',           explore: 1, icon: '🗺️' },
  { id: 'w1',  name: '悟道有成',   desc: '累计参悟达到 10 级',         insight: 10, icon: '📿' },
  { id: 'r1',  name: '轮回飞升',   desc: '首次飞升转世，得证仙缘',     reincarnate: 1, icon: '🔁' },
  { id: 'c1',  name: '初临战阵',   desc: '首次出战妖兽',               battle: 1,  icon: '⚔️' },
  { id: 'c2',  name: '妖将伏诛',   desc: '斩杀任一地图 BOSS',          boss: 1,    icon: '👹' },
  { id: 'c3',  name: '仙魔尽伏',   desc: '通关全部四张地图',           mapAll: 1, icon: '🌌' },
  { id: 't1',  name: '初得法宝',   desc: '获得第一件法宝',             treasure: 1, icon: '💎' },
  { id: 't2',  name: '法宝大成',   desc: '将任一法宝强化至满级',       enhanceMax: 1, icon: '✨' }
];
