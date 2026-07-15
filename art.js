/* ============================================================
 * 战斗美术资源（原创简化 SVG，内联，零外部依赖，可自由使用）
 * 暴露 window.ART：主题调色板、角色/怪物/BOSS/弹道 SVG。
 * 说明：以下 SVG 为原创几何剪影，风格统一、可主题换色；
 *       不使用任何商业游戏素材，可随游戏自由分发。
 * ============================================================ */
window.ART = (function () {
  // 各图主题调色板（背景渐变、地面、强调色、角色色、粒子色、粒子类型）
  const themes = {
    yaolin:      { name: '妖兽森林', bg: 'linear-gradient(180deg,#1d3b25,#0d1f15)', ground: 'rgba(90,170,100,0.32)', accent: '#7fe0a0', fig: '#d7ecdd', fig2: '#3f7a52', particle: '#bfe9c8', pkind: 'leaf' },
    guzhanchang: { name: '上古战场', bg: 'linear-gradient(180deg,#3a1f1c,#1b0e0c)', ground: 'rgba(190,100,80,0.32)', accent: '#ff9a6a', fig: '#ecd0bb', fig2: '#7a3b2a', particle: '#ffd0b0', pkind: 'ember' },
    moyuan:      { name: '魔渊',     bg: 'linear-gradient(180deg,#2a1230,#140a1c)', ground: 'rgba(150,60,160,0.32)', accent: '#d98aff', fig: '#e6c8f0', fig2: '#5a2a6a', particle: '#e9c8ff', pkind: 'spark' },
    xianxi:      { name: '仙界裂隙', bg: 'linear-gradient(180deg,#101a3a,#080c1c)', ground: 'rgba(90,120,200,0.32)', accent: '#8ab4ff', fig: '#d3dcff', fig2: '#2a3a7a', particle: '#c8d8ff', pkind: 'star' }
  };
  const elementColors = { wood: '#6fcf97', wind: '#56ccf2', cycle: '#aab7ff', five: '#f2c94c', supreme: '#f2994a', prime: '#bb6bd9' };
  const techElement = { tuna: 'wood', yinqi: 'wind', zhoutian: 'cycle', wuxing: 'five', taiyi: 'supreme', hongmeng: 'prime' };

  function theme(mapId) { return themes[mapId] || themes.yaolin; }
  function elementOf(techId) { return techElement[techId] || 'cycle'; }
  function elementColor(el) { return elementColors[el] || '#aab7ff'; }

  // 修士（玩家通用）：道袍 + 本命飞剑
  function playerSVG() {
    return `<svg viewBox="0 0 120 132" class="svg-fig" aria-hidden="true">
      <g class="cult">
        <path class="robe" d="M60 54 Q30 70 30 122 L90 122 Q90 70 60 54 Z"/>
        <path class="robe-trim" d="M60 56 L74 122 L46 122 Z"/>
        <circle class="skin" cx="60" cy="40" r="16"/>
        <path class="hair" d="M43 38 Q60 12 77 38 Q70 26 60 24 Q50 26 43 38 Z"/>
        <path class="hair-tie" d="M44 40 Q40 30 50 30"/>
        <rect class="sword" x="94" y="44" width="6" height="62" rx="3" transform="rotate(20 97 75)"/>
        <path class="sword-tip" d="M104 32 L112 44 L100 46 Z"/>
        <circle class="sword-gem" cx="97" cy="40" r="4"/>
      </g></svg>`;
  }

  function monsterBody(mapId) {
    switch (mapId) {
      case 'yaolin': return `  <!-- 妖兽：狼形野兽 -->
        <ellipse class="m-body" cx="60" cy="80" rx="40" ry="28"/>
        <circle class="m-head" cx="62" cy="46" r="22"/>
        <path class="m-ear" d="M46 32 L42 8 L58 28 Z"/>
        <path class="m-ear" d="M78 32 L82 8 L66 28 Z"/>
        <path class="m-snout" d="M62 46 L90 58 L62 64 Z"/>
        <circle class="m-eye" cx="56" cy="44" r="3.2"/><circle class="m-eye" cx="70" cy="44" r="3.2"/>
        <rect class="m-leg" x="36" y="102" width="11" height="22" rx="4"/>
        <rect class="m-leg" x="74" y="102" width="11" height="22" rx="4"/>`;
      case 'guzhanchang': return `  <!-- 上古战场：持矛战魂 -->
        <path class="m-body" d="M40 112 L40 62 Q60 42 80 62 L80 112 Z"/>
        <path class="m-head" d="M44 42 Q60 18 76 42 Q60 52 44 42 Z"/>
        <rect class="m-spear" x="86" y="18" width="6" height="100" rx="3"/>
        <path class="m-spear-tip" d="M86 10 L97 26 L86 22 Z"/>
        <circle class="m-eye" cx="54" cy="42" r="3"/><circle class="m-eye" cx="66" cy="42" r="3"/>`;
      case 'moyuan': return `  <!-- 魔渊：独角魔 -->
        <path class="m-body" d="M36 114 Q36 58 60 52 Q84 58 84 114 Z"/>
        <path class="m-horn" d="M46 54 Q38 22 26 30 Q44 38 52 56 Z"/>
        <path class="m-horn" d="M74 54 Q82 22 94 30 Q76 38 68 56 Z"/>
        <circle class="m-eye" cx="52" cy="72" r="4"/><circle class="m-eye" cx="68" cy="72" r="4"/>
        <path class="m-mouth" d="M50 94 Q60 102 70 94"/>`;
      case 'xianxi': return `  <!-- 仙界裂隙：星魂 -->
        <circle class="m-body" cx="60" cy="62" r="30"/>
        <path class="m-star" d="M60 26 L65 51 L90 56 L65 61 L60 86 L55 61 L30 56 L55 51 Z"/>
        <path class="m-tail" d="M60 92 Q40 108 60 124 Q80 108 60 92"/>`;
      default: return `<circle class="m-body" cx="60" cy="70" r="34"/>`;
    }
  }

  function monsterSVG(mapId, isBoss) {
    const crown = isBoss
      ? `<path class="crown" d="M42 20 L50 4 L60 16 L70 4 L78 20 Z"/><circle class="aura-ring" cx="60" cy="66" r="56" fill="none"/>`
      : '';
    return `<svg viewBox="0 0 120 132" class="svg-fig${isBoss ? ' boss' : ''}" aria-hidden="true">
      <g class="mon">${monsterBody(mapId)}${crown}</g></svg>`;
  }

  // 功法/心法 施法弹道
  function projectileSVG(element) {
    const c = elementColor(element);
    const inner = {
      wood:    `<path d="M8 30 Q40 8 72 30 Q40 52 8 30 Z" fill="${c}"/>`,
      wind:    `<path d="M12 30 Q40 6 68 30 Q40 54 12 30 Z" fill="none" stroke="${c}" stroke-width="6"/>`,
      cycle:   `<circle cx="40" cy="30" r="20" fill="none" stroke="${c}" stroke-width="6"/><circle cx="40" cy="30" r="8" fill="${c}"/>`,
      five:    `<path d="M40 6 L46 26 L67 26 L50 39 L56 60 L40 46 L24 60 L30 39 L13 26 L34 26 Z" fill="${c}"/>`,
      supreme: `<circle cx="40" cy="30" r="18" fill="${c}"/><circle cx="40" cy="30" r="27" fill="none" stroke="${c}" stroke-width="3" opacity="0.6"/>`,
      prime:   `<path d="M40 8 Q62 30 40 52 Q18 30 40 8 Z" fill="${c}"/><path d="M18 30 Q40 52 62 30 Q40 8 18 30 Z" fill="none" stroke="${c}" stroke-width="4"/>`
    }[element] || `<circle cx="40" cy="30" r="14" fill="${c}"/>`;
    return `<svg viewBox="0 0 80 60" class="svg-proj">${inner}</svg>`;
  }

  return { themes, theme, elementOf, elementColor, playerSVG, monsterSVG, projectileSVG };
})();
