/* ============================================================
 * 放置修仙 · 逍遥道途 v2 —— 游戏数据与数值平衡配置
 * 新增：灵根 / 灵宠 / 秘境 / 悟道 / 飞升转生 / 渡劫风险
 * 所有可调参数集中在此，方便后续平衡微调。
 * ============================================================ */

/* ---------- 全局数值参数（已为 v2 重平衡） ---------- */
const CONFIG = {
  /* 修炼速度与突破成本 */
  baseSpeed: 2.0,          // 基础修炼速度（修为/秒），炼气一层时
  growthPerLayer: 1.08,    // 每完成 1 个小层，修炼速度 ×1.08
  realmSpeedMult: 1.5,     // 每跨越 1 个大境界，基础速度 ×1.5
  baseCost: 120,           // 第 0 层突破所需修为（基准）
  layerCostGrowth: 1.50,   // 每小层突破成本 ×1.50
  realmCostGrowth: 3.50,   // 每大境界突破成本 ×3.50（高于速度复合，保证长线越来越难）
  majorBreakMult: 2.0,     // 大境界突破（第 9 层→下一境界）成本额外 ×2.0
  speedCap: 30,            // 非转生加成（功法/洞府/丹药/悟性/灵宠/灵根）总乘子上限，防失控
  legacyCap: 10,           // 仙缘（飞升转生）全局倍率上限，保证转生收益有界

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
    bandMult: 1.8,        // 每大境界战力带 ×1.8
    bandLayer: 0.05,      // 每小层战力带 +5%
    // 基础常量（再乘战力带）
    flatAtk: 6, flatDef: 3, flatHp: 60,
    // 各养成系统「固定值」加成（每级/每层加固定值，不封顶）
    techAtk: 42,          // 功法训练强度 → 攻（techSum × techAtk）
    techShare: 0.55,      // 功法额外分摊给 防/血 的比例
    abodeDef: 16,         // 洞府灵气 → 防（abodeSum × abodeDef）
    abodeHp: 34,          // 洞府灵气 → 血（abodeSum × abodeHp）
    pillK: 220,           // 丹药临时 buff → 全属性（(pillMult-1) × pillK）
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

/* ---------- 功法（消耗灵石，可升级，永久乘法加成修炼速度） ---------- */
const TECHNIQUES = [
  { id: 'tuna',     name: '吐纳术',     desc: '修炼速度 +8%/级',   baseStone: 25,     priceGrowth: 1.50, mult: 0.08, max: 99, icon: '🌀' },
  { id: 'yinqi',    name: '引气诀',     desc: '修炼速度 +12%/级',  baseStone: 220,    priceGrowth: 1.55, mult: 0.12, max: 99, icon: '🌬️' },
  { id: 'zhoutian', name: '周天功',     desc: '修炼速度 +18%/级',  baseStone: 2400,   priceGrowth: 1.60, mult: 0.18, max: 99, icon: '🔄' },
  { id: 'wuxing',   name: '五行诀',     desc: '修炼速度 +25%/级',  baseStone: 28000,  priceGrowth: 1.65, mult: 0.25, max: 99, icon: '☯️' },
  { id: 'taiyi',    name: '太一真诀',   desc: '修炼速度 +40%/级',  baseStone: 360000, priceGrowth: 1.70, mult: 0.40, max: 99, icon: '🌟' },
  { id: 'hongmeng', name: '鸿蒙紫气诀', desc: '修炼速度 +60%/级',  baseStone: 5200000,priceGrowth: 1.75, mult: 0.60, max: 99, icon: '🟣' }
];

/* ---------- 洞府 / 灵脉（消耗灵石，可升级，乘法加成「灵气浓度」） ---------- */
const ABODES = [
  { id: 'cave',    name: '荒野洞府', desc: '灵气浓度 +12%/级', baseStone: 60,    priceGrowth: 1.50, mult: 0.12, max: 99, icon: '⛰️' },
  { id: 'lingmai', name: '地脉灵穴', desc: '灵气浓度 +18%/级', baseStone: 900,   priceGrowth: 1.55, mult: 0.18, max: 99, icon: '💎' },
  { id: 'fudi',    name: '洞天福地', desc: '灵气浓度 +25%/级', baseStone: 14000, priceGrowth: 1.60, mult: 0.25, max: 99, icon: '🏞️' },
  { id: 'xianfu',  name: '上古仙府', desc: '灵气浓度 +35%/级', baseStone: 240000, priceGrowth: 1.65, mult: 0.35, max: 99, icon: '🏯' }
];

/* ---------- 丹药（消耗灵石，限时 buff，乘法加成修炼速度） ---------- */
const PILLS = [
  { id: 'juqi',     name: '聚气丹',     desc: '4 时辰内修炼速度 ×2',  baseStone: 300,    duration: 14400, mult: 1.0, icon: '💊' },
  { id: 'jinyuan',  name: '金元丹',     desc: '4 时辰内修炼速度 ×3',  baseStone: 3200,   duration: 14400, mult: 2.0, icon: '🟠' },
  { id: 'bijie',    name: '避劫丹',     desc: '12 时辰内修炼速度 ×4，渡劫必成', baseStone: 36000,  duration: 43200, mult: 3.0, safe: true, icon: '🟡' },
  { id: 'jiuzhuan', name: '九转金丹',   desc: '12 时辰内修炼速度 ×6', baseStone: 420000, duration: 43200, mult: 5.0, icon: '🔆' }
];

/* ---------- 灵宠（寻妖→喂养→自动产出） ---------- */
const PETS = [
  { id: 'qilin',    name: '火麟兽', icon: '🐲', desc: '自动产出修为',      produce: { type: 'xp',   base: 1.5 },   max: 80, weight: 3 },
  { id: 'jinchan',  name: '招财金蟾', icon: '🐸', desc: '自动产出灵石',      produce: { type: 'stone',base: 0.25 },  max: 80, weight: 3 },
  { id: 'qingniao', name: '采灵青鸟', icon: '🐦', desc: '自动产出天材地宝',  produce: { type: 'mat',  base: 0.06 },  max: 80, weight: 2 },
  { id: 'xiezhi',   name: '祥瑞獬豸', icon: '🦄', desc: '全资源加成（封顶）',    produce: { type: 'all',  base: 0.04 },  max: 80, weight: 1 }
];

/* ---------- 秘境历练（消耗灵石探索，随机奖励 + 风险） ---------- */
const SECRET_REALMS = [
  { id: 'baihua',  name: '百花秘境', icon: '🌸', cost: 50,    xp: [200, 800],     stone: [0, 120],    mat: [1, 3],  risk: 0.10, riskLoss: 0.30 },
  { id: 'yaolin',  name: '药林秘境', icon: '🌳', cost: 400,   xp: [1500, 6000],   stone: [80, 600],   mat: [3, 8],  risk: 0.12, riskLoss: 0.35 },
  { id: 'hanhai',  name: '瀚海秘境', icon: '🌊', cost: 3000,  xp: [10000, 40000],  stone: [500, 3000], mat: [8, 20], risk: 0.15, riskLoss: 0.40 },
  { id: 'xingchen',name: '星陨秘境', icon: '🌌', cost: 22000, xp: [80000, 320000], stone: [4000, 20000],mat: [20, 50],risk: 0.18, riskLoss: 0.45 }
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
    { name: '野狼妖', icon: '🐺', atk: 150, def: 282, hp: 714, hit: 0.6698, dodge: 0.1411, crit: 0.02, reward: {"stone":[20,60],"mat":[1,3],"xp":[100,400]}, drop: {"chance":0.55,"pool":["qingfeng","jinyi","fengming"]} },
    { name: '巨蟒妖', icon: '🐍', atk: 192, def: 361, hp: 912, hit: 0.6698, dodge: 0.1411, crit: 0.02, reward: {"stone":[50,140],"mat":[2,5],"xp":[300,900]}, drop: {"chance":0.5,"pool":["qingfeng","lihuofan","jinyi","fengming"]} },
    { name: '赤睛虎', icon: '🐯', atk: 222, def: 416, hp: 1051, hit: 0.6698, dodge: 0.1411, crit: 0.02, reward: {"stone":[120,320],"mat":[3,8],"xp":[800,2000]}, drop: {"chance":0.45,"pool":["lihuofan","jinyi","taiji","fengming","xingchen"]} },
    { name: '妖将·血爪', icon: '👹', atk: 251, def: 471, hp: 1189, hit: 0.6698, dodge: 0.1411, crit: 0.02, reward: {"stone":[300,700],"mat":[5,12],"xp":[2000,5000]}, drop: {"chance":0.4,"pool":["lihuofan","taiji","xingchen","wujin"]}, boss: true },
  ]},
  { id: 'guzhanchang', name: '上古战场', icon: '⚔️', desc: '残魂不灭，杀机四伏，需筑基以上修为', realmReq: 1, levels: [
    { name: '无名战魂', icon: '👻', atk: 1573, def: 2166, hp: 5473, hit: 0.7045, dodge: 0.1824, crit: 0.039, reward: {"stone":[260,600],"mat":[4,10],"xp":[1800,4500]}, drop: {"chance":0.45,"pool":["lihuofan","jinyi","taiji","fengming","xingchen"]} },
    { name: '断戟将军', icon: '🪦', atk: 2010, def: 2768, hp: 6993, hit: 0.7045, dodge: 0.1824, crit: 0.039, reward: {"stone":[600,1300],"mat":[7,16],"xp":[4000,9000]}, drop: {"chance":0.42,"pool":["lihuofan","taiji","wujin","xingchen","xuanyuan"]} },
    { name: '阴煞统领', icon: '💀', atk: 2316, def: 3189, hp: 8057, hit: 0.7045, dodge: 0.1824, crit: 0.039, reward: {"stone":[1300,2800],"mat":[12,26],"xp":[9000,20000]}, drop: {"chance":0.4,"pool":["taiji","wujin","xingchen","xuanyuan","kunlun"]} },
    { name: '古战场之主', icon: '👑', atk: 2622, def: 3610, hp: 9121, hit: 0.7045, dodge: 0.1824, crit: 0.039, reward: {"stone":[3000,6000],"mat":[20,42],"xp":[20000,45000]}, drop: {"chance":0.38,"pool":["wujin","xuanyuan","kunlun","donghuang"]}, boss: true },
  ]},
  { id: 'moyuan', name: '魔渊', icon: '🌋', desc: '魔气滔天，凶险异常，金丹以上方可涉足', realmReq: 2, levels: [
    { name: '噬魂魔兵', icon: '😈', atk: 5790, def: 7549, hp: 19070, hit: 0.7393, dodge: 0.2115, crit: 0.1932, reward: {"stone":[2500,5200],"mat":[16,34],"xp":[16000,36000]}, drop: {"chance":0.42,"pool":["taiji","wujin","xingchen","xuanyuan","kunlun"]} },
    { name: '炼狱炎魔', icon: '🦹', atk: 7398, def: 9645, hp: 24367, hit: 0.7393, dodge: 0.2115, crit: 0.1932, reward: {"stone":[5500,11000],"mat":[30,60],"xp":[38000,80000]}, drop: {"chance":0.4,"pool":["xuanyuan","wujin","kunlun","donghuang"]} },
    { name: '九幽魔将', icon: '🦠', atk: 8524, def: 11113, hp: 28076, hit: 0.7393, dodge: 0.2115, crit: 0.1932, reward: {"stone":[12000,24000],"mat":[55,110],"xp":[90000,180000]}, drop: {"chance":0.38,"pool":["xuanyuan","kunlun","donghuang","wujin"]} },
    { name: '魔渊君·修罗', icon: '👺', atk: 9650, def: 12581, hp: 31784, hit: 0.7393, dodge: 0.2115, crit: 0.1932, reward: {"stone":[28000,55000],"mat":[100,200],"xp":[200000,420000]}, drop: {"chance":0.36,"pool":["xuanyuan","kunlun","donghuang","hunyuan"]}, boss: true },
  ]},
  { id: 'xianxi', name: '仙界裂隙', icon: '🌌', desc: '仙魔交汇之地，藏无上法宝，化神以上方可入', realmReq: 4, levels: [
    { name: '裂隙游魂', icon: '🌟', atk: 44054, def: 56176, hp: 141917, hit: 1.1555, dodge: 0.1717, crit: 0.288, reward: {"stone":[24000,48000],"mat":[80,160],"xp":[170000,360000]}, drop: {"chance":0.4,"pool":["xuanyuan","kunlun","donghuang","hunyuan"]} },
    { name: '守界仙卫', icon: '🛡️', atk: 56291, def: 71780, hp: 181339, hit: 1.1555, dodge: 0.1717, crit: 0.288, reward: {"stone":[52000,100000],"mat":[150,300],"xp":[380000,800000]}, drop: {"chance":0.38,"pool":["xuanyuan","kunlun","donghuang","hunyuan"]} },
    { name: '堕仙残影', icon: '🪽', atk: 64857, def: 82703, hp: 208934, hit: 1.1555, dodge: 0.1717, crit: 0.288, reward: {"stone":[110000,220000],"mat":[280,560],"xp":[900000,1800000]}, drop: {"chance":0.36,"pool":["xuanyuan","kunlun","donghuang","hunyuan"]} },
    { name: '裂隙主宰·鸿钧', icon: '🌠', atk: 73423, def: 93626, hp: 236529, hit: 1.1555, dodge: 0.1717, crit: 0.288, reward: {"stone":[260000,520000],"mat":[520,1000],"xp":[2000000,4200000]}, drop: {"chance":0.34,"pool":["donghuang","xuanyuan","kunlun","hunyuan"]}, boss: true },
  ]},
  { id: 'xuli', name: '炼虚禁地', icon: '⛩️', desc: '法则乱流，非炼虚以上不可踏足', realmReq: 5, levels: [
    { name: '法则乱流', icon: '🌪️', atk: 107225, def: 135725, hp: 342885, hit: 1.2427, dodge: 0.2032, crit: 0.3322, reward: {"stone":[36000,72000],"mat":[120,240],"xp":[250000,520000]}, drop: {"chance":0.36,"pool":["xuanyuan","kunlun","donghuang","hunyuan"]} },
    { name: '虚空妖灵', icon: '👾', atk: 137009, def: 173427, hp: 438131, hit: 1.2427, dodge: 0.2032, crit: 0.3322, reward: {"stone":[78000,150000],"mat":[220,440],"xp":[550000,1100000]}, drop: {"chance":0.34,"pool":["xuanyuan","kunlun","donghuang","hunyuan"]} },
    { name: '混沌守卫', icon: '🛡️', atk: 157858, def: 199818, hp: 504803, hit: 1.2427, dodge: 0.2032, crit: 0.3322, reward: {"stone":[165000,330000],"mat":[400,800],"xp":[1200000,2400000]}, drop: {"chance":0.32,"pool":["xuanyuan","kunlun","donghuang","hunyuan"]} },
    { name: '妖皇·裂空', icon: '👑', atk: 178708, def: 226209, hp: 571476, hit: 1.2427, dodge: 0.2032, crit: 0.3322, reward: {"stone":[390000,780000],"mat":[700,1400],"xp":[2500000,5200000]}, drop: {"chance":0.3,"pool":["donghuang","xuanyuan","kunlun","hunyuan"]}, boss: true },
  ]},
  { id: 'heti', name: '合体战场', icon: '⚔️', desc: '上古仙魔战场，合体期方可一战', realmReq: 6, levels: [
    { name: '残存仙兵', icon: '🗡️', atk: 256631, def: 316775, hp: 800275, hit: 0.9458, dodge: 1.3286, crit: 0.5825, reward: {"stone":[55000,110000],"mat":[180,360],"xp":[350000,720000]}, drop: {"chance":0.34,"pool":["donghuang","xuanyuan","kunlun","hunyuan"]} },
    { name: '魔道巨擘', icon: '😈', atk: 327918, def: 404769, hp: 1022573, hit: 0.9458, dodge: 1.3286, crit: 0.5825, reward: {"stone":[120000,240000],"mat":[330,660],"xp":[800000,1600000]}, drop: {"chance":0.32,"pool":["donghuang","xuanyuan","kunlun","hunyuan"]} },
    { name: '战场英灵', icon: '👻', atk: 377818, def: 466364, hp: 1178182, hit: 0.9458, dodge: 1.3286, crit: 0.5825, reward: {"stone":[260000,520000],"mat":[600,1200],"xp":[1800000,3600000]}, drop: {"chance":0.3,"pool":["donghuang","xuanyuan","kunlun","hunyuan"]} },
    { name: '战神·刑天', icon: '🪓', atk: 427719, def: 527959, hp: 1333791, hit: 0.9458, dodge: 1.3286, crit: 0.5825, reward: {"stone":[600000,1200000],"mat":[1000,2000],"xp":[3800000,7800000]}, drop: {"chance":0.28,"pool":["donghuang","xuanyuan","kunlun","hunyuan"]}, boss: true },
  ]},
  { id: 'dasheng', name: '大乘遗迹', icon: '🏛️', desc: '大乘先辈遗留下来的试炼之地', realmReq: 7, levels: [
    { name: '遗迹守卫', icon: '🗿', atk: 567770, def: 701482, hp: 1772164, hit: 0.9835, dodge: 1.4208, crit: 0.6263, reward: {"stone":[85000,170000],"mat":[260,520],"xp":[480000,1000000]}, drop: {"chance":0.32,"pool":["donghuang","xuanyuan","kunlun","hunyuan"]} },
    { name: '法则幻影', icon: '✨', atk: 725484, def: 896338, hp: 2264432, hit: 0.9835, dodge: 1.4208, crit: 0.6263, reward: {"stone":[180000,360000],"mat":[480,960],"xp":[1100000,2200000]}, drop: {"chance":0.3,"pool":["donghuang","xuanyuan","kunlun","hunyuan"]} },
    { name: '太古神兽', icon: '🐉', atk: 835884, def: 1032737, hp: 2609020, hit: 0.9835, dodge: 1.4208, crit: 0.6263, reward: {"stone":[380000,760000],"mat":[880,1760],"xp":[2500000,5000000]}, drop: {"chance":0.28,"pool":["donghuang","xuanyuan","kunlun","hunyuan"]} },
    { name: '古佛·迦叶', icon: '🛕', atk: 946283, def: 1169136, hp: 2953607, hit: 0.9835, dodge: 1.4208, crit: 0.6263, reward: {"stone":[900000,1800000],"mat":[1500,3000],"xp":[5200000,10500000]}, drop: {"chance":0.26,"pool":["donghuang","xuanyuan","kunlun","hunyuan"]}, boss: true },
  ]},
  { id: 'tianjie', name: '天道台', icon: '☁️', desc: '直面天道的最终试炼，渡劫期方可登临', realmReq: 8, levels: [
    { name: '天雷化身', icon: '⚡', atk: 1255453, def: 1550620, hp: 3917357, hit: 1.0212, dodge: 1.5164, crit: 0.673, reward: {"stone":[130000,260000],"mat":[380,760],"xp":[650000,1350000]}, drop: {"chance":0.3,"pool":["donghuang","xuanyuan","kunlun","hunyuan"]} },
    { name: '心魔镜像', icon: '🪞', atk: 1604190, def: 1981348, hp: 5005512, hit: 1.0212, dodge: 1.5164, crit: 0.673, reward: {"stone":[280000,560000],"mat":[700,1400],"xp":[1500000,3000000]}, drop: {"chance":0.28,"pool":["donghuang","xuanyuan","kunlun","hunyuan"]} },
    { name: '天道意志', icon: '👁️', atk: 1848306, def: 2282858, hp: 5767220, hit: 1.0212, dodge: 1.5164, crit: 0.673, reward: {"stone":[600000,1200000],"mat":[1300,2600],"xp":[3500000,7000000]}, drop: {"chance":0.26,"pool":["donghuang","xuanyuan","kunlun","hunyuan"]} },
    { name: '天道化身', icon: '🌌', atk: 2092422, def: 2584367, hp: 6528928, hit: 1.0212, dodge: 1.5164, crit: 0.673, reward: {"stone":[1400000,2800000],"mat":[2200,4400],"xp":[7500000,15000000]}, drop: {"chance":0.24,"pool":["donghuang","xuanyuan","kunlun","hunyuan"]}, boss: true },
  ]},
];

/* ---------- 悟道（消耗悟性点，永久提升） ---------- */
const INSIGHTS = [
  { id: 'dao',  name: '参悟·大道', desc: '基础修炼速度 +4%/级', base: 2, growth: 1.5, mult: 0.04, max: 50, icon: '☯️' },
  { id: 'jie',  name: '参悟·渡劫', desc: '渡劫成功率 +4%/级',   base: 3, growth: 1.6, mult: 0.04, max: 50, icon: '⚡' },
  { id: 'cai',  name: '参悟·聚财', desc: '灵石效率 +4%/级',     base: 2, growth: 1.5, mult: 0.04, max: 50, icon: '💰' }
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
