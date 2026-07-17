/* ============================================================
 * 找回「东皇钟」脚本
 * 用法：打开你的修仙游戏页面 → 按 F12 → Console(控制台) →
 *       把下面这段整段粘贴进去 → 回车。页面会自动刷新，东皇钟即恢复。
 * 说明：直接修改浏览器本地存档(xiuxian_save_v2)，与线上版本无关，任何版本均可用。
 *       按"强化满了"恢复为上限 20 级；如需其它等级，把 level: 20 改成对应数字。
 * ============================================================ */
(function () {
  const KEY = 'xiuxian_save_v2';
  const raw = localStorage.getItem(KEY);
  if (!raw) { alert('没找到存档，请先打开游戏页面再试'); return; }
  const data = JSON.parse(raw);
  data.treasures = data.treasures || {};
  data.equipped  = data.equipped  || {};
  // 恢复强化满级(20)的东皇钟，并装备到武器位
  data.treasures['donghuang'] = { count: 1, level: 20 };
  data.equipped['weapon'] = 'donghuang';
  localStorage.setItem(KEY, JSON.stringify(data));
  alert('已恢复：东皇钟 ×1（强化20级）并已装备，即将刷新页面。');
  location.reload();
})();
