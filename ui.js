/* ============================================================
 * 放置修仙 · 逍遥道途 v2 —— 界面渲染与交互
 * ============================================================ */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const view = $('#view');
  const modalLayer = $('#modal-layer');
  const toastLayer = $('#toast-layer');

  const REALM_AVATAR = ['🧘', '🧘', '⚪', '👶', '🌌', '🌠', '🔗', '🚀', '⚡', '✨'];
  let currentTab = 'cultivate';
  let currentMap = 'yaolin';

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
    $('#speed-val').textContent = Game.formatSpeed(Game.currentSpeed());
    $('#progress-bar').style.width = Math.min(100, ratio * 100) + '%';
    $('#progress-pct').textContent = Math.min(100, Math.floor(ratio * 100)) + '%';
    const bb = $('#btn-break');
    if (bb) { const ready = Game.canBreak(); bb.classList.toggle('ready', ready); bb.disabled = !ready; }
    const bl = $('#buff-line'); if (bl) bl.innerHTML = buildBuffLine();
  }

  function buildBuffLine() {
    const s = Game.state;
    let html = '';
    Game.PILLS.forEach(p => { const left = s.pills[p.id] || 0; if (left > 0) html += `<span class="pill-tag">${p.icon} ${p.name} ${Game.formatTime(left)}</span>`; });
    const tm = Game.techniqueMult(); const ab = Game.abodeBonus(); const pa = Game.petAllBonus();
    if (tm > 1) html += `<span class="pill-tag">📜 功法 +${Math.round((tm - 1) * 100)}%</span>`;
    if (ab > 0) html += `<span class="pill-tag">⛰️ 灵气 +${Math.round(ab * 100)}%</span>`;
    if (pa > 0) html += `<span class="pill-tag">🦄 灵宠 +${Math.round(pa * 100)}%</span>`;
    if (s.legacy > 0) html += `<span class="pill-tag">🔁 仙缘 +${Math.round(s.legacy * CONFIG.legacyPerPoint * 100)}%</span>`;
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
      floatNum('+' + Game.formatNum(r.gain) + ' 修为', rect.left + rect.width / 2 - 30, rect.top - 10);
    });
    $('#btn-break').addEventListener('click', () => { if (Game.canBreak()) Game.doBreak(); });
  }

  /* ---------------- 功法 / 洞府 / 丹药 ---------------- */
  function renderTechniques() {
    const s = Game.state;
    const cards = Game.TECHNIQUES.map(t => {
      const lv = s.techniques[t.id] || 0, maxed = lv >= t.max, price = Game.techniquePrice(t.id), afford = s.stone >= price && !maxed;
      const bonus = lv > 0 ? `当前加成 +${Math.round(t.mult * lv * 100)}%` : '尚未修习';
      const btn = maxed ? `<button class="buy-btn maxed" disabled>圆满</button>`
        : `<button class="buy-btn" data-buy="technique" data-id="${t.id}" ${afford ? '' : 'disabled'}>修习<div class="price">${Game.formatNum(price)} 💎</div></button>`;
      return `<div class="card"><div class="icon">${t.icon}</div><div class="body"><div class="name">${t.name} <span class="lv">${lv}/${t.max} 层</span></div><div class="desc">${t.desc}</div><div class="sub">${bonus}</div></div>${btn}</div>`;
    }).join('');
    view.innerHTML = `<div class="section-title">📜 功法 <small>消耗灵石，永久提升修炼速度</small></div><div class="list">${cards}</div>`;
    bindBuy('technique');
  }
  function renderAbodes() {
    const s = Game.state;
    const cards = Game.ABODES.map(a => {
      const lv = s.abodes[a.id] || 0, maxed = lv >= a.max, price = Game.abodePrice(a.id), afford = s.stone >= price && !maxed;
      const bonus = lv > 0 ? `灵气浓度 +${Math.round(a.mult * lv * 100)}%` : '未开拓';
      const btn = maxed ? `<button class="buy-btn maxed" disabled>圆满</button>`
        : `<button class="buy-btn" data-buy="abode" data-id="${a.id}" ${afford ? '' : 'disabled'}>拓建<div class="price">${Game.formatNum(price)} 💎</div></button>`;
      return `<div class="card"><div class="icon">${a.icon}</div><div class="body"><div class="name">${a.name} <span class="lv">${lv}/${a.max} 重</span></div><div class="desc">${a.desc}</div><div class="sub">${bonus}</div></div>${btn}</div>`;
    }).join('');
    view.innerHTML = `<div class="section-title">⛰️ 洞府 <small>提升灵气浓度，乘法加成修炼</small></div><div class="list">${cards}</div>`;
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
    const cards = Game.PETS.map(p => {
      const lv = s.pets[p.id] || 0;
      const out = (p.produce.type === 'all') ? `全资源 +${Math.round(p.produce.base * lv * 100)}%` : `产出 ${p.produce.base * lv < 0.01 ? (p.produce.base * lv).toFixed(3) : Game.formatNum(p.produce.base * lv)}/${typeUnit(p.produce.type)}`;
      const feed = Game.feedCost(p.id), fAfford = lv > 0 && s.materials >= feed;
      const fbtn = lv <= 0 ? `<span class="sub">尚未收服</span>`
        : `<button class="buy-btn" data-feed="${p.id}" ${fAfford ? '' : 'disabled'}>喂养<div class="price">${feed} 🌿</div></button>`;
      return `<div class="card"><div class="icon">${p.icon}</div><div class="body"><div class="name">${p.name} <span class="lv">${lv} 级</span></div><div class="desc">${p.desc}</div><div class="sub">${out}</div></div>${fbtn}</div>`;
    }).join('');
    view.innerHTML = `
      <div class="section-title">🐾 灵宠 <small>寻妖收服，喂养升级，自动产出</small></div>
      <div class="res-bar"><div class="res-chip mat"><div class="l">天材地宝</div><div class="v">🌿 ${Game.formatNum(s.materials)}</div></div></div>
      ${seekBtn}
      <div class="list" style="margin-top:12px">${cards}</div>`;
    $('#btn-seek').addEventListener('click', () => { if (Game.seekPet()) renderCurrent(); else toast('灵石不足'); });
    view.querySelectorAll('[data-feed]').forEach(b => b.addEventListener('click', () => { if (Game.feedPet(b.dataset.feed)) renderCurrent(); else toast('天材地宝不足'); }));
  }
  function typeUnit(t) { return t === 'xp' ? '修为' : t === 'stone' ? '灵石' : '🌿'; }

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

  /* ---------------- 秘境 ---------------- */
  function renderSecret() {
    const s = Game.state;
    const cd = !Game.canExplore();
    const cards = Game.SECRET_REALMS.map(r => {
      const afford = s.stone >= r.cost;
      const btn = `<button class="buy-btn" data-explore="${r.id}" ${afford && !cd ? '' : 'disabled'}>探索<div class="price">${Game.formatNum(r.cost)} 💎</div></button>`;
      return `<div class="card"><div class="icon">${r.icon}</div><div class="body"><div class="name">${r.name}</div><div class="desc">修为${Game.formatNum(r.xp[0])}~${Game.formatNum(r.xp[1])} · 灵石${Game.formatNum(r.stone[0])}~${Game.formatNum(r.stone[1])} · 🌿${r.mat[0]}~${r.mat[1]}</div><div class="sub">风险 ${Math.round(r.risk * 100)}%（损修为 ${Math.round(r.riskLoss * 100)}%）</div></div>${btn}</div>`;
    }).join('');
    const cdText = cd ? `<div class="cd-text">秘境冷却中……</div>` : '';
    view.innerHTML = `<div class="section-title">🗺️ 秘境历练 <small>耗灵石探索，得资源亦有机危</small></div>${cdText}<div class="list">${cards}</div>`;
    view.querySelectorAll('[data-explore]').forEach(b => b.addEventListener('click', () => {
      if (Game.explore(b.dataset.explore)) renderCurrent(); else toast('灵石不足或冷却中');
    }));
  }

  /* ---------------- 悟道 ---------------- */
  function renderInsight() {
    const s = Game.state;
    const cards = Game.INSIGHTS.map(i => {
      const lv = s.insightLv[i.id] || 0, maxed = lv >= i.max, price = Game.insightPrice(i.id), afford = s.insight >= price && !maxed;
      const bonus = lv > 0 ? `当前 +${Math.round(i.mult * lv * 100)}%` : '未参悟';
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
    const st = Game.combatStats();
    const cd = !Game.canBattle();
    const maps = Game.MAPS;
    const mapTabs = maps.map(m => {
      const unlocked = isMapUnlocked(m.id);
      const cleared = s.mapProgress[m.id] !== undefined && s.mapProgress[m.id] >= m.levels.length - 1;
      return `<button class="map-tab ${m.id === currentMap ? 'active' : ''} ${unlocked ? '' : 'locked'}" data-map="${m.id}" ${unlocked ? '' : 'disabled'}>${unlocked ? m.icon : '🔒'} ${m.name}${cleared ? ' ✓' : ''}</button>`;
    }).join('');
    const map = maps.find(m => m.id === currentMap);
    const levels = map.levels.map((lv, i) => {
      const unlocked = Game.isLevelUnlocked(map.id, i);
      const cleared = s.mapProgress[map.id] !== undefined && s.mapProgress[map.id] >= i;
      const btn = unlocked
        ? `<button class="buy-btn fight-btn" data-fight="${map.id}:${i}" ${cd ? 'disabled' : ''}>${cleared ? '再战' : '挑战'}</button>`
        : `<button class="buy-btn" disabled>🔒 未解锁</button>`;
      return `<div class="level-row ${cleared ? 'cleared' : ''} ${unlocked ? '' : 'locked'}">
        <div class="level-idx">${i + 1}</div>
        <div class="level-body">
          <div class="name">${lv.icon} ${lv.name} ${lv.boss ? '<span class="boss-tag">BOSS</span>' : ''} ${cleared ? '<span class="cleared-tag">已通关</span>' : ''}</div>
          <div class="enemy-stats">攻${lv.atk} 防${lv.def} 气血${lv.hp} 命中${Math.round(lv.hit * 100)}% 闪避${Math.round(lv.dodge * 100)}% 暴击${Math.round(lv.crit * 100)}%</div>
          <div class="reward-line">奖励 灵石${Game.formatNum(lv.reward.stone[0])}~${Game.formatNum(lv.reward.stone[1])} · 🌿${lv.reward.mat[0]}~${lv.reward.mat[1]} · 修为${Game.formatNum(lv.reward.xp[0])}~${Game.formatNum(lv.reward.xp[1])}${lv.drop && lv.drop.chance ? ` · 法宝掉落${Math.round(lv.drop.chance * 100)}%` : ''}</div>
        </div>${btn}</div>`;
    }).join('');
    const cdText = cd ? `<div class="cd-text">⏳ 调息中… 还需 ${Game.battleCooldownLeft()} 秒</div>` : '';
    view.innerHTML = `
      <div class="section-title">⚔️ 历练 · 战斗 <small>回合制对战，命中/闪避/暴击皆随机</small></div>
      <div class="player-panel">
        <div class="pp-head">🧘 自身战力 <b>${Game.formatNum(st.power)}</b></div>
        <div class="pp-stats">
          <span>攻 ${st.atk}</span><span>防 ${st.def}</span><span>气血 ${st.hp}</span>
          <span>命中 ${Math.round(st.hit * 100)}%</span><span>闪避 ${Math.round(st.dodge * 100)}%</span><span>暴击 ${Math.round(st.crit * 100)}%</span>
        </div>
      </div>
      <div class="map-tabs">${mapTabs}</div>
      <div class="map-desc">${map.desc}</div>
      ${cdText}
      <div class="level-path">${levels}</div>`;
    view.querySelectorAll('[data-map]').forEach(b => b.addEventListener('click', () => { if (!b.disabled) { currentMap = b.dataset.map; renderBattle(); } }));
    view.querySelectorAll('[data-fight]').forEach(b => b.addEventListener('click', () => {
      const [mid, idx] = b.dataset.fight.split(':');
      const r = Game.fight(mid, parseInt(idx, 10));
      if (!r) return;
      if (r.error === 'locked') { toast('关卡尚未解锁'); return; }
      if (r.error === 'cd') { toast('调息中，稍后再战'); return; }
      showCombat(r); renderBattle();
    }));
  }
  // 取玩家等级最高的功法作为「本命功法」，决定施法光环色
  const TECH_ELEMENT = { tuna: '#6fcf97', yinqi: '#56ccf2', zhoutian: '#aab7ff', wuxing: '#f2c94c', taiyi: '#f2994a', hongmeng: '#bb6bd9' };
  function topTechnique() {
    const techs = Game.state.techniques || {}; let best = null, bestLv = 0;
    Game.TECHNIQUES.forEach(t => { const lv = techs[t.id] || 0; if (lv > bestLv) { bestLv = lv; best = t; } });
    return best;
  }
  function showCombat(r) {
    const lv = r.level, res = r.res;
    const pHp0 = res.player.hp, eHp0 = res.enemy.hp;
    const tech = topTechnique();
    const aura = tech ? (TECH_ELEMENT[tech.id] || '#9fd0ff') : '#9fd0ff';
    const techName = tech ? tech.icon + tech.name : '🌀 道法';
    const lines = res.log.slice(0, 18).map(e => {
      if (e.miss) return `<div class="cl ${e.side}">${e.side === 'p' ? '你' : '敌'} 落空/被闪避…</div>`;
      return `<div class="cl ${e.side}">${e.side === 'p' ? '你' : '敌'} 造成 ${e.dmg}${e.crit ? ' 💥暴击' : ''}</div>`;
    }).join('');
    const more = res.log.length > 18 ? `<div class="cl">…共 ${res.log.length} 回合</div>` : '';
    let rewardHtml = '';
    if (r.win && r.reward) rewardHtml = `<div class="reward">战利品：灵石+${Game.formatNum(r.reward.stone)} 🌿+${r.reward.mat} 修为+${Game.formatNum(r.reward.xp)}</div>`;
    if (r.win && r.drop) rewardHtml += `<div class="reward drop">获得法宝 ${r.drop.icon}${r.drop.name} <span style="color:${qColor(r.drop.quality)}">${qName(r.drop.quality)}</span>${r.drop.first ? '（新）' : ''}</div>`;
    const m = modal(`
      <h2 class="${r.win ? 'win' : 'lose'}">${lv.icon} ${r.win ? '胜！' : '败'}</h2>
      <div class="battle-stage" style="--aura:${aura}">
        <div class="bars">
          <div class="hpbar p"><div class="hp-fill p" style="width:100%"></div><span class="hp-label" data-plabel>气血 ${pHp0}</span></div>
          <div class="hpbar e"><div class="hp-fill e" style="width:100%"></div><span class="hp-label" data-elabel>${lv.name} ${eHp0}</span></div>
        </div>
        <div class="arena">
          <div class="fighter p"><div class="aura"></div><div class="avatar">🧘</div><div class="fname">你</div></div>
          <div class="fighter e ${lv.boss ? 'boss' : ''}">${lv.boss ? '<div class="crown">👑</div>' : ''}<div class="avatar">${lv.icon}</div><div class="fname">${lv.name}</div></div>
        </div>
        <div class="skill-banner">施放 · ${techName}</div>
        <div class="beam"></div>
        <div class="fx-layer"></div>
      </div>
      <div class="combat-sub">${lv.name} · 回合 ${res.rounds} · 你剩余气血 <span data-pend>${pHp0}</span></div>
      <div class="combat-log">${lines}${more}</div>
      <div class="combat-reward" style="display:none">${rewardHtml}</div>
      <button class="btn" id="cb-ok" style="display:none">收剑</button>`, 'combat');
    $('#cb-ok').addEventListener('click', () => closeModal(m));
    playBattle(res, lv, m);
    return m;
  }
  // 逐回合回放战斗 log，驱动卡通演出
  function playBattle(res, lv, m) {
    const stage = m.querySelector('.battle-stage');
    const pFill = stage.querySelector('.hp-fill.p'), eFill = stage.querySelector('.hp-fill.e');
    const pLabel = stage.querySelector('[data-plabel]'), eLabel = stage.querySelector('[data-elabel]');
    const pFighter = stage.querySelector('.fighter.p'), eFighter = stage.querySelector('.fighter.e');
    const fx = stage.querySelector('.fx-layer');
    const banner = stage.querySelector('.skill-banner'), beam = stage.querySelector('.beam');
    const pAura = pFighter.querySelector('.aura');
    const log = res.log, pHp0 = res.player.hp, eHp0 = res.enemy.hp;
    let pHp = pHp0, eHp = eHp0, i = 0;
    const delay = Math.max(110, Math.min(400, 6500 / Math.max(1, log.length)));
    function setHp() {
      pFill.style.width = Math.max(0, pHp / pHp0 * 100) + '%';
      eFill.style.width = Math.max(0, eHp / eHp0 * 100) + '%';
      pLabel.textContent = '气血 ' + Math.max(0, Math.round(pHp));
      eLabel.textContent = lv.name + ' ' + Math.max(0, Math.round(eHp));
      m.querySelector('[data-pend]').textContent = Math.max(0, Math.round(pHp));
    }
    function lunge(who) { const f = who === 'p' ? pFighter : eFighter; const c = who === 'p' ? 'lunge-p' : 'lunge-e'; f.classList.remove(c); void f.offsetWidth; f.classList.add(c); }
    function hitReact(f) { f.classList.remove('hit'); void f.offsetWidth; f.classList.add('hit'); setTimeout(() => f.classList.remove('hit'), 320); }
    function floatText(target, text, cls) {
      const s = fx.getBoundingClientRect(), t = target.getBoundingClientRect();
      const el = document.createElement('div'); el.className = 'dmg-num ' + cls; el.textContent = text;
      el.style.left = (t.left - s.left + t.width / 2) + 'px';
      el.style.top = (t.top - s.top + t.height * 0.18) + 'px';
      fx.appendChild(el); setTimeout(() => el.remove(), 950);
    }
    function castSkill() {
      pAura.classList.add('on');
      banner.classList.remove('show'); void banner.offsetWidth; banner.classList.add('show');
      beam.classList.remove('show'); void beam.offsetWidth; beam.classList.add('show');
      setTimeout(() => pAura.classList.remove('on'), 1100);
    }
    function step() {
      if (!stage.isConnected) return;
      if (i >= log.length) { finish(); return; }
      const e = log[i];
      if (e.side === 'p' && (i === 0 || i % 6 === 5)) castSkill();
      if (e.side === 'p') {
        if (e.miss) { floatText(eFighter, '闪避', 'miss'); lunge('p'); }
        else {
          eHp = Math.max(0, eHp - e.dmg); setHp(); lunge('p'); hitReact(eFighter);
          floatText(eFighter, '-' + e.dmg + (e.crit ? ' 暴击!' : ''), e.crit ? 'crit' : 'dmg');
          if (e.crit) { stage.classList.remove('crit'); void stage.offsetWidth; stage.classList.add('crit'); }
        }
      } else {
        if (e.miss) { floatText(pFighter, '闪避', 'miss'); lunge('e'); }
        else {
          pHp = Math.max(0, pHp - e.dmg); setHp(); lunge('e'); hitReact(pFighter);
          floatText(pFighter, '-' + e.dmg + (e.crit ? ' 暴击!' : ''), e.crit ? 'crit' : 'dmg');
          if (e.crit) { stage.classList.remove('crit'); void stage.offsetWidth; stage.classList.add('crit'); }
        }
      }
      i++; setTimeout(step, delay);
    }
    function finish() {
      pHp = res.pHp; eHp = res.eHp; setHp();
      const rw = m.querySelector('.combat-reward'); if (rw) rw.style.display = '';
      const ok = m.querySelector('#cb-ok'); if (ok) ok.style.display = '';
    }
    setTimeout(step, 250);
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
      const smeltAfford = own.count >= 2;
      const equipped = s.equipped[t.slot] === t.id;
      const enhBtn = maxed ? `<button class="buy-btn maxed" disabled>圆满</button>`
        : `<button class="buy-btn" data-enh="${t.id}" ${enhAfford ? '' : 'disabled'}>强化<div class="price">${cost.mat}🌿 ${Game.formatNum(cost.stone)}💎</div></button>`;
      const eqBtn = equipped ? `<button class="buy-btn eq" data-unequip="${t.slot}">卸下</button>`
        : `<button class="buy-btn" data-equip="${t.id}">装备</button>`;
      const smeltBtn = smeltAfford ? `<button class="buy-btn smelt" data-smelt="${t.id}">熔炼<div class="price">+${CONFIG.treasure.smeltMatPerQuality * t.quality}🌿</div></button>` : '';
      return `<div class="tcard">
        <div class="ti" style="color:${qColor(t.quality)}">${t.icon}</div>
        <div class="tn">${t.name} <span class="q" style="color:${qColor(t.quality)}">${qName(t.quality)}</span></div>
        <div class="td">${t.desc}</div>
        <div class="tattrs">${attrText(ts.attrs)}</div>
        <div class="tsub">持有 ${own.count} · ${own.level}级</div>
        <div class="tactions">${eqBtn}${enhBtn}${smeltBtn}</div>
      </div>`;
    }).join('');
    view.innerHTML = `
      <div class="section-title">💎 法宝 <small>获取/装备/强化/熔炼，撑起战力</small></div>
      <div class="res-bar"><div class="res-chip mat"><div class="l">天材地宝</div><div class="v">🌿 ${Game.formatNum(s.materials)}</div></div><div class="res-chip"><div class="l">灵石</div><div class="v">💎 ${Game.formatNum(s.stone)}</div></div></div>
      <div class="slot-row">${slotHtml}</div>
      <div class="section-title sub">法宝囊</div>
      <div class="treasure-grid">${inv}</div>`;
    view.querySelectorAll('[data-equip]').forEach(b => b.addEventListener('click', () => { if (Game.equipTreasure(b.dataset.equip)) renderTreasure(); else toast('无法装备'); }));
    view.querySelectorAll('[data-unequip]').forEach(b => b.addEventListener('click', () => { Game.unequip(b.dataset.unequip); renderTreasure(); }));
    view.querySelectorAll('[data-enh]').forEach(b => b.addEventListener('click', () => { if (Game.enhanceTreasure(b.dataset.enh)) renderTreasure(); else toast('材料或灵石不足'); }));
    view.querySelectorAll('[data-smelt]').forEach(b => b.addEventListener('click', () => { if (Game.smeltTreasure(b.dataset.smelt)) renderTreasure(); else toast('至少需要 2 件方可熔炼'); }));
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
      case 'battle': renderBattle(); break;
      case 'treasure': renderTreasure(); break;
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

  /* ---------------- 事件订阅 ---------------- */
  Game.on('break', (d) => {
    if (d.major) showTribulation(d.realm, d.success);
    else toast('破境成功，修为更进', true);
    renderCurrent();
  });
  Game.on('achievement', (a) => { toast(`🏆 解锁成就：${a.name}`, true); if (currentTab === 'achv') renderAchievements(); });
  Game.on('event', () => { if (currentTab === 'event') renderEvents(); });
  Game.on('pills', () => { if (currentTab === 'cultivate' || currentTab === 'pill') renderCurrent(); });
  Game.on('root', () => {});
  Game.on('pet', () => { if (currentTab === 'pet') renderCurrent(); });
  Game.on('explore', () => { if (currentTab === 'secret') renderCurrent(); });
  Game.on('insight', () => { if (currentTab === 'insight') renderCurrent(); });
  Game.on('reincarnate', (d) => { showReincarnate(d.gain); renderCurrent(); });
  Game.on('reset', () => { updateTopbar(); });

  /* ---------------- 启动 ---------------- */
  function init() {
    const offline = Game.start();
    document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));
    switchTab('cultivate');
    updateTopbar();
    if (offline) showOffline(offline);
    if (!Game.state.rootId) showRootPicker();
    function loop() { updateTopbar(); requestAnimationFrame(loop); }
    requestAnimationFrame(loop);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
