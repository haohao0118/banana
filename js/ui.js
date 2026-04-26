// UI 操作（读取 gameState，更新 DOM）

// ─── 数字格式化 ───────────────────────────────────

const NUM_SUFFIXES = [
  [1e30, 'No'], [1e27, 'Oc'], [1e24, 'Sp'], [1e21, 'Sx'],
  [1e18, 'Qi'], [1e15, 'Qa'], [1e12, 'T'],  [1e9,  'B'],
  [1e6,  'M'],  [1e3,  'K'],
];

function formatNumber(num) {
  num = Math.floor(num);
  for (const [threshold, suffix] of NUM_SUFFIXES) {
    if (num >= threshold) {
      return (num / threshold).toFixed(1).replace(/\.0$/, '') + suffix;
    }
  }
  return num.toString();
}

function formatRate(num) {
  if (num === 0)  return '0';
  if (num < 0.1)  return num.toFixed(2);
  if (num < 10)   return num.toFixed(1);
  return formatNumber(num);
}

// ─── 顶部信息栏 ───────────────────────────────────

function updateTopBar() {
  document.getElementById('banana-display').textContent = formatNumber(gameState.bananaCount);
  document.getElementById('rate-display').textContent   = '+' + formatRate(gameState.productionRate);
}

// ─── 飘出迷你香蕉 ────────────────────────────────

function spawnFloatingBanana(clientX, clientY, isCrit) {
  const style   = CONFIG.bananaStyles[gameState.selectedBananaStyle];
  const wrapper = document.querySelector('.game-wrapper');
  const rect    = wrapper.getBoundingClientRect();

  const el = document.createElement('div');
  el.className = 'floating-banana'
    + (isCrit ? ' crit' : '')
    + (style.cssClass ? ' ' + style.cssClass : '');
  el.textContent = style.emoji;

  const drift = (Math.random() - 0.5) * 28;
  el.style.left = (clientX - rect.left - 10 + drift) + 'px';
  el.style.top  = (clientY - rect.top  - 10) + 'px';

  wrapper.appendChild(el);
  el.addEventListener('animationend', () => el.remove(), { once: true });
}

// ─── 浮动点击数值 ─────────────────────────────────

function spawnClickValueText(clientX, clientY, value, isCrit) {
  const wrapper = document.querySelector('.game-wrapper');
  const rect    = wrapper.getBoundingClientRect();
  const el      = document.createElement('div');
  el.className  = 'floating-click-val' + (isCrit ? ' crit' : '');
  el.textContent = '+' + formatNumber(value);
  const drift   = (Math.random() - 0.5) * 50;
  el.style.left = (clientX - rect.left + drift) + 'px';
  el.style.top  = (clientY - rect.top  - 22) + 'px';
  wrapper.appendChild(el);
  el.addEventListener('animationend', () => el.remove(), { once: true });
}

// ─── 香蕉点击动画 ─────────────────────────────────

function playClickAnimation(isCrit) {
  const img = document.querySelector('.banana-img');
  if (!img) return;
  img.classList.remove('click-anim', 'crit-anim');
  void img.offsetWidth;
  img.classList.add(isCrit ? 'crit-anim' : 'click-anim');
  img.addEventListener('animationend', () => {
    img.classList.remove('click-anim', 'crit-anim');
  }, { once: true });
}

// ─── 邮件未读角标 ────────────────────────────────

function updateMailBadge() {
  const badge = document.getElementById('mail-badge');
  if (!badge) return;
  const count = gameState.unreadMailCount || 0;
  badge.textContent = count > 99 ? '99+' : count;
  badge.style.display = count > 0 ? '' : 'none';
}

// ─── 存档指示器 ───────────────────────────────────

let saveIndicatorTimer = null;

function showSaveIndicator() {
  const el = document.getElementById('save-indicator');
  if (!el) return;
  el.classList.add('visible');
  if (saveIndicatorTimer) clearTimeout(saveIndicatorTimer);
  saveIndicatorTimer = setTimeout(() => el.classList.remove('visible'), 1500);
}

// ─── 离线收益弹窗 ─────────────────────────────────

function showOfflineEarnings(amount, offlineMs) {
  const totalSecs = Math.floor(offlineMs / 1000);
  const mins  = Math.floor(totalSecs / 60);
  const hours = Math.floor(mins / 60);

  let timeText;
  if (hours > 0) {
    const remMins = mins % 60;
    timeText = remMins > 0 ? `${hours}小时${remMins}分钟` : `${hours}小时`;
  } else if (mins > 0) {
    timeText = `${mins}分钟`;
  } else {
    timeText = `${totalSecs}秒`;
  }

  document.getElementById('offline-time-text').textContent = timeText;
  document.getElementById('offline-amount').textContent    = '+' + formatNumber(amount) + ' 🍌';
  document.getElementById('offline-modal').classList.add('visible');
}

// ─── 提示条 Toast ─────────────────────────────────

let toastTimer = null;

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('visible');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 1800);
}
