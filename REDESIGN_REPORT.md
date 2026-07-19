# 放置修仙 · 逍遥道途 v2 —— 娱乐性 / 反馈 / 爽点 / 生命周期 重设计方案

> 调研 12 款头部放置类游戏 → 提炼设计模式 → 对照本游戏代码诊断短板 → 形成可执行更新计划。
> 设计原则：**不破坏现有平衡模型**（攻防气血仍为「固定值加法为主 + 仅悟道·大道比例」），新系统只做"反馈/爽感/长线目标"，新增数值一律走"临时 buff / 小系数不封顶 / 明确上限"。

---

## 一、头部放置类游戏调研报告

### 调研对象（12 款标杆，分三类）
- **点击/数值类**：Cookie Clicker、Clicker Heroes、AdVenture Capitalist、Idle Heroes
- **深度/多层类**：Antimatter Dimensions、Realm Grinder、Universal Paperclips、Trimps
- **移动端/现代类**：Egg Inc、Tap Titans 2、Leaf Blower Revolution、Cell to Singularity

### 关键设计模式提炼（可直接借鉴）
| # | 模式 | 代表游戏 | 本游戏对应/缺口 |
|---|------|---------|----------------|
| 1 | **转生多层化 + 零惩罚纯乘区** | AdVenture Capitalist(Angels)、AD(IP/EP/SP层叠) | 已有单层 legacy；可加第二层"道果" |
| 2 | **脉冲随机事件（Golden Cookie）** | Cookie Clicker 金饼干 | 缺口：缺高冲击、可点击的"天降机缘" |
| 3 | **自动委托（Manager/器灵）** | AdVenture Capitalist | 已有灵宠自动产出；可强化为可见"器灵自动运转" |
| 4 | **抽卡冗余自动转化** | Idle Heroes 重复卡转升星 | 已有熔炼（重复法宝→天材地宝），契合 ✅ |
| 5 | **离线收益叙事化弹窗** | Egg Inc / Tap Titans | 已有 showOffline；可加动画 |
| 6 | **突破/演化演出（全屏卡+揭示惊喜）** | Cell to Singularity 演化卡、UP 阶段揭示 | 缺口：突破缺"境界卡" |
| 7 | **Combo/节奏点击** | Tap Titans 2 | 缺口：手动"运转周天"无 combo/暴击 |
| 8 | **装备词缀/重铸（ARPG 刷爽）** | Trimps Heirloom | 缺口：法宝无"觉醒"词缀 |
| 9 | **大数超界呈现** | AD 的 ee 计数法 | 已有 万/亿/兆；可补 京以上 |
| 10 | **成就/收藏集邮满足** | Cell to Singularity 演化卡 | 已有成就；可加法宝图鉴 |
| 11 | **全面反馈即爽感** | 几乎所有标杆 | 缺口：**非战斗系统几乎零反馈**（最大短板） |
| 12 | **日常/周常节奏拉回流** | Egg Inc 合同、Tap Titans 锦标赛 | 缺口：无每日签到 |

### 标杆"最靓点"速记
- Cookie Clicker：**金饼干随机事件**——低概率高回报，制造"手痒必点"脉冲。
- Clicker Heroes：**Ancients 软重置**——把重置惩罚变微调优化。
- AdVenture Capitalist：**Managers 自动委托**——定义"放置"；**Angels 零惩罚飞升**。
- Idle Heroes：**自动战斗+抽卡+挂机**三合一；重复卡自动转升星资源。
- Antimatter Dimensions：**超界计数法（ee）**——把"增长无上限"做成可感奇观。
- Realm Grinder：**三角阵营分叉**——同框架长出多玩法分支。
- Universal Paperclips：**叙事缝合**——数字变故事，阶段揭示制造惊吓式爽感。
- Trimps：**传承物(Heirloom)词缀装备+重铸**——放置里塞进 ARPG 刷装爽点。
- Egg Inc：**电影式过场**——廉价点击也有"大制作感"（CSS transform 即可）。
- Tap Titans 2：**Combo 节奏系统**——乱点变有节奏的技能释放。
- Leaf Blower Revolution：**拖拽合并**——天然适配触屏的"一键质变"爽点。
- Cell to Singularity：**叙事化数值**——抽象数字包装成命名插画卡（渡劫动画即留存）。

---

## 二、当前游戏短板诊断（结合代码通读）

**已有（较强）**
- 战斗演出完整：`showCombat` + `ART`(SVG) + `SFX`(Web Audio) + BOSS 二阶段 + 胜负印章 + 粒子/弹道。
- `showOffline` 离线弹窗、`showTribulation` 渡劫弹窗、`showReincarnate` 飞升弹窗。
- 战斗音效开关（默认关）。

**缺（本次重点）**
1. **非战斗操作零及时反馈**：买功法/洞府/丹药/悟道、装备/强化/熔炼法宝、奇遇、成就解锁、破小层——只有顶部数值跳动 + 一行 toast，无跳字/粒子/震屏/音效。
2. **手动"运转周天"无成长感**：单次跳字，无 combo / 暴击，点击缺乏正反馈循环。
3. **突破演出缺失/朴素**：小层只 toast；大境界渡劫弹窗较朴素，无"境界卡"叙事。
4. **法宝无觉醒/词缀**：满级(20)即终点，缺 ARPG 式刷爽（对照 Trimps Heirloom）。
5. **功法/洞府"圆满(99级)"无庆祝**：长线目标感弱。
6. **无"天降机缘"脉冲事件**：奇遇偏平淡，缺"必点"冲动。
7. **无日常回流机制**：缺每日签到。
8. **生命周期单层**：飞升(legacy)已够用，但缺第二层与明确长线里程碑演出。

---

## 三、更新计划（按优先级，全部可落地）

### P0 — 反馈引擎 + 全系统反馈接线（最大爽感杠杆，低风险）
- **新增 `fx.js` + CSS**：全屏 FX 层（`#fx-layer`，pointer-events:none），提供 `floatText / burst / shake / flash / banner / confetti`。
- **事件总线接线**（`ui.js` 内 `Game.on`）：
  - `click`(运转周天) → 跳字 + combo + 暴击 + 微震屏
  - `break` 小层 → 闪光 + 微震 + "突破！"横幅 + 音效
  - `break` 大境界成功 → 强化渡劫演出（全屏金光 + 震屏 + "晋入X境"横幅）+ 境界卡
  - `break` 大境界失败 → 红闪 + 震屏
  - `buy`(功法/洞府) → 跳字"修习+1/拓建+1" + 星火粒子；满级→"圆满"庆祝
  - `pills` → 金光闪 + "灵力暴涨"
  - `event` → 金色弹窗 + 高价值时"天降机缘"特效
  - `achievement` → 礼花 + 音效 + 庆祝弹窗
  - `treasure` equip → "装备X"；enhance → 爆发 + "+1级"；smelt → "熔炼+🌿"
  - `battle` win → 飘"胜!"；lose → 震屏
  - `pet`/`explore`/`insight`/`reincarnate` → 对应跳字/演出
- **平衡安全**：纯表现层，不改动任何数值/状态。

### P1 — 手动点击 combo+暴击；天降机缘脉冲事件（娱乐性 + 生命周期）
- **运转周天 combo**：连续点击累积 combo（UI 计时复位），combo 提升本次手动收益（封顶系数，如 ×(1+combo×0.02) 上限 ×3）；随机暴击（×2~×5，带红字+音效+闪）。手动点击本就是小头，加 combo 不影响自动 pacing。
- **天降机缘（Golden Buff）**：独立于 EVENTS 的脉冲事件，概率触发屏幕上出现可点击的"机缘宝光"；点击获得临时增益之一：①修炼速度 ×8（30s）②全资源 ×3（60s）③瞬时修为爆发（=当前速度×120s）。临时增益存 `state.goldenBuff{mult,until}`，在 `currentSpeed/stoneSpeed` 生效，tick 到期清除。**限制**：倍数/时长克制，避免破坏 pacing。

### P2 — 法宝觉醒(词缀)；功法/洞府圆满；境界突破卡（装备/功法爽点 + 叙事）
- **法宝觉醒（Trimps Heirloom 等价）**：法宝强化满级(20)后解锁"觉醒"按钮，消耗天材地宝随机赋予 1 条词缀（攻/防/血/暴击/闪避/命中 之一，小系数如 +3%~+8%/条，上限 3 条）。词缀在 `treasureStats`/`combatStats` 生效。**不封顶但系数小、条数封顶**，不破坏战力模型。
- **功法/洞府圆满庆祝**：等级达 99(满) 时一次性"圆满"盛典（全屏粒子 + 横幅 + 音效），并给极小的永久意境加成（如该功法额外 +2% 速度，仅装饰性，封顶）。
- **境界突破卡（Cell to Singularity 演化卡等价）**：大境界突破成功弹出"境界卡"——该境名字 + 意境插画(SVG/emoji 构图) + 一句道韵，可"收藏"。强化叙事化数值与长线里程碑感。

### P3 — 每日签到；大数超界；飞升演出强化（生命周期）
- **每日签到**：每日首次进入弹"签到"领天材地宝/灵石（递增 7 日循环），存 `state.lastCheckIn`。拉回流。
- **大数超界呈现**：`formatNum` 扩展 京/垓/秭…之后用 `e` 科学计数，避免 `Infinity`。
- **飞升演出强化**：`showReincarnate` 加全屏光 + 粒子 + 仙缘数字滚动。

---

## 四、验证与取舍（反复验证）

对每个特性做可行性 + 平衡双校验（已对照全量代码）：

| 特性 | 技术可行 | 平衡风险 | 取舍 |
|------|---------|---------|------|
| FX 引擎/事件接线 | ✅ 事件总线现成 | 无（纯表现） | 直接做 |
| combo/暴击(手动) | ✅ 改 clickCultivate | 低（手动是小头） | 系数封顶 ×3 |
| 天降机缘 | ✅ 加 goldenBuff | 中（需克制倍数） | 速度×8/30s、全资源×3/60s、瞬时=速度×120s |
| 法宝觉醒词缀 | ✅ 加 affixes 字段 | 中（需小系数+条数封顶） | 单条 +3~8%、上限 3 条、不封顶但慢 |
| 功法/洞府圆满 | ✅ | 低 | 仅演出 + 极小装饰加成 |
| 境界突破卡 | ✅ 弹窗 | 无 | 直接做 |
| 每日签到 | ✅ | 无 | 7 日递增循环 |
| 大数超界 | ✅ 改 formatNum | 无 | 直接做 |
| 飞升演出强化 | ✅ | 无 | 直接做 |

**平衡底线（不可破）**：
- 实战属性模型保持「固定值加法为主 + 仅悟道·大道比例」；觉醒词缀只加小系数固定值/百分比且不封顶但增长慢。
- 所有临时增益（天降机缘）限时、倍数克制，不进存档长期乘区（仅 `goldenBuff.until` 期间生效）。
- 不改动 `baseCost/layerCostGrowth/realmCostGrowth/majorBreakMult`、修炼带、战斗 `pillK=0`、MAPS 难度等已调平衡参数。

**验证手段**：沿用现有 `pace.js`(pacing)、`verify.js`(战斗33断言)、`smoke2.js`(浏览器0报错)；新增 `fx_test.js` 校验 combo/暴击、goldenBuff 生效与到期、awaken 词缀生效、签到日期逻辑、formatNum 超界。最终浏览器冒烟 0 报错 + 重打包 + 推送。

---

## 五、执行顺序
1. 写 `fx.js`（FX 引擎）+ `style.css` 增补 + `index.html` 引入。
2. `ui.js`：事件接线 + combo UI + 天降机缘 orb + 境界卡 + 觉醒按钮 + 签到弹窗 + 圆满庆祝。
3. `game.js`：goldenBuff 系统、awakenTreasure + 词缀进 combatStats、checkIn、combo/暴击进 clickCultivate、formatNum 超界、飞升演出数据。
4. `data.js`：新增 golden/awaken/checkin/combo 配置与词缀池。
5. 验证（pace/verify/smoke/fx_test）→ 重打包 → 提交推送。

---

## 六、独立校验修正记录（agent-2efef0c6）
方向获认可；落地参数按以下修正收敛：
- **天降机缘**：速度 ×8→**×5(30s)**、全资源 ×3→**×2(60s)**、瞬时爆发 ×120s→**×60s**；buff 须同时作用于 `petOutPerSec`；`load()` 清除过期 buff，且离线收益计算先排除 goldenBuff。
- **法宝觉醒词缀**：攻/防/血 = **本法宝 base 的 +8~18%/条**（非全属性百分比），暴击/闪避/命中 = **加性 +1.5~4%/条**；封顶 **3 条**；必须同步更新 `combatFormula` 与 `combatBreakdown`（否则面板与实际不符）；"再觉醒"= 重 roll 或停满 3 条。
- **事件总线**：`emit('treasure')` 补 `{action}`（equip/enhance/smelt/awaken），`emit('buy')` 补 `{id,type,maxed}`，新增 `'golden'/'awaken'/'checkin'`。
- **state 字段**：combo **不持久化**（模块变量 + load 归零）；goldenBuff/lastCheckIn/affixes 走 defaultState；旧档 `treasures` 缺 affixes 以 `(own.affixes||[])` 守卫。
- **额外低风险点子（采纳部分）**：法宝图鉴、数量级里程碑成就、天降机缘保底、器灵自动运转可视化、离线收益飘字。

> 平衡底线不变：实战属性模型保持「固定值加法为主 + 仅悟道·大道比例」；觉醒词缀只加小系数、条数封顶；临时增益限时克制、不进长期乘区；不改动已调平衡参数。

---

## 七、执行记录与落地确认

### 已落地文件
- **`fx.js`**（新增）：反馈特效引擎 `window.FX`：`floatText / burst / shake / flash / banner / confetti`，纯表现层，挂全屏 `#fx-layer`（`pointer-events:none`）。
- **`style.css`**（增补）：`#fx-layer`、`.fx-float`(crit/gold/big/good/bad)、`.fx-particle`、`.fx-flash`、`.fx-banner`(gold/jade/danger)、`.fx-confetti`、`.fx-shake`，以及 `.golden-orb`（天降机缘宝光）、`.combo-meter`（连击表）、`.affix-chip`（词缀）、`.realm-card`（境界卡）、`.checkin`（签到弹窗）等配套样式。
- **`index.html`**：在 `ui.js` 前引入 `fx.js`。
- **`data.js`**：新增 `golden / awaken / combo / checkIn` 配置（见 §六收敛参数）。
- **`game.js`**：实现 `goldenBuff`（speed×5 / all×2 作用于 `currentSpeed`/`stoneSpeed`/`petOutPerSec`，burst 瞬时=速度×60s；`load()` 清过期、`tick` 到期清除、离线收益排除）、`awakenTreasure`+词缀进 `treasureStats`/`combatStats`/`combatFormula`/`combatBreakdown`、`checkIn`（7 日递增、连签中断判定）、`clickCultivate` combo+暴击、combo 模块变量不持久化、`formatNum` 超界科学计数、全部 `emit` 载荷补充（`buy`/`treasure` 含 action、`golden`/`awaken`/`checkin` 事件）。
- **`ui.js`**：全系统事件接线（break/buy/event/achievement/treasure/battle/pet/explore/insight/reincarnate/click/pills）+ combo UI + 天降机缘 orb + 境界突破卡 + 觉醒按钮 + 签到弹窗 + 圆满庆祝；`buildBuffLine` 显示 active 增益倒计时。

### 实现期两处设计微调（已验证合理）
1. **觉醒词缀 pct 改为「本法宝当前(已缩放)数值)的 +X%」**：原设想「+base 的 %」在满级(20)时因 scale 放大，raw base 占比极小（≈1~2%），爽点被稀释；改为对当前已缩放数值 ×(1+value)，保证 +8~18% 是真实可见的战力提升，且仍「条数封顶、不封顶但慢」。add 类（暴击/闪避/命中）维持加性 +1.5~4%。
2. **满 3 条再觉醒 = 重 roll 全部 3 条**：`awakenTreasure` 在已达上限时清空并重新生成 `maxAffixes` 条新词缀（而非只加 1 条），UI 按钮文案随之切到「重铸觉醒」。

### 验证结果（全绿）
- `fx_test.js`/sandbox 逻辑测试：**32/32 通过**（formatNum 超界、combo 递增与不持久化、goldenBuff 生效/到期/speed 不污染灵石/burst 即时、awaken 词缀数值与重 roll、签到连签与中断、breakCost 与 combatFormula 平衡底线未变）。
- 浏览器冒烟（Playwright 真机）：**9/9 通过，0 控制台/页面报错**（初始化、运转周天连击、天降机缘 spawn+点击、购功法、破境、法宝觉醒、全标签遍历、formatNum 超界、reload 存档读档）。
- 回归：`verify.js` 战斗 **33/33**、`pace.js`  pacing 正常。

> 平衡底线已守住：攻防气血仍为「固定值加法为主 + 仅悟道·大道比例」；所有临时增益限时克制、不进长期乘区；未改动 `baseCost/layerCostGrowth/realmCostGrowth/majorBreakMult`、修炼带、战斗 `pillK=0`、MAPS 难度等已调参数。
