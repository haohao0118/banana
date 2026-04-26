// 游戏入口：登录态、邮件中心和主循环

let lastTickTime      = null;
let autoSaveTimer     = 0;
let unlockCheckTimer  = 0;
let cursorClickTimer  = 0;
let gameLoopStarted   = false;
let authMode        = 'register';
let resetTimer      = null;
let resetPending    = false;
let bananaTouch     = null;
let soundEnabled    = localStorage.getItem('soundEnabled')   !== 'false';
let bgMusicEnabled  = localStorage.getItem('bgMusicEnabled') !== 'false';
let clickVolume     = Number(localStorage.getItem('clickVolume')   ?? 50) / 100;
let bgMusicVolume   = Number(localStorage.getItem('bgMusicVolume') ?? 25) / 100;
let audioCtx        = null;

const AUTO_SAVE_INTERVAL = 30;

// ─── 背景音乐状态 ─
let bgMasterGain    = null;
let bgDroneOsc      = null;
let bgScheduleTimer = null;
let bgNextNoteTime  = 0;
let bgNoteIdx       = 0;
let bgMusicRunning  = false;

const BG_NOTES   = [261.63, 329.63, 392.00, 440.00, 523.25];
const BG_PATTERN = [0,1,2,3,4,3,2,1,0,2,3,1,4,2,1,3,0,4,2,3,1,2,4,3,0,1];

function initAudio() {
  if (audioCtx) return;
  try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
}

function playClickSound() {
  if (!soundEnabled) return;
  try {
    if (!audioCtx) initAudio();
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(360, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(220, audioCtx.currentTime + 0.08);
    gain.gain.setValueAtTime(clickVolume * 0.18, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.15);
  } catch {}
}

// ─── 背景音乐 ──────────────────────────────────────

function startBgMusic() {
  if (bgMusicRunning || !bgMusicEnabled) return;
  if (!audioCtx) initAudio();
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  bgMusicRunning = true;
  bgMasterGain = audioCtx.createGain();
  bgMasterGain.gain.value = bgMusicVolume;
  bgMasterGain.connect(audioCtx.destination);
  bgDroneOsc = audioCtx.createOscillator();
  const droneGain = audioCtx.createGain();
  bgDroneOsc.type = 'sine';
  bgDroneOsc.frequency.value = 130.81;
  droneGain.gain.value = 0.07;
  bgDroneOsc.connect(droneGain);
  droneGain.connect(bgMasterGain);
  bgDroneOsc.start();
  bgNextNoteTime = audioCtx.currentTime + 0.1;
  scheduleBgNotes();
}

function stopBgMusic() {
  bgMusicRunning = false;
  if (bgScheduleTimer) clearTimeout(bgScheduleTimer);
  if (bgDroneOsc) { try { bgDroneOsc.stop(); } catch {} bgDroneOsc = null; }
  if (bgMasterGain) {
    try { bgMasterGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.8); } catch {}
    bgMasterGain = null;
  }
  bgNoteIdx = 0;
}

function scheduleBgNotes() {
  if (!bgMusicRunning || !bgMasterGain) return;
  const ahead = 2.0, interval = 1.1;
  while (bgNextNoteTime < audioCtx.currentTime + ahead) {
    const freq = BG_NOTES[BG_PATTERN[bgNoteIdx % BG_PATTERN.length]];
    bgNoteIdx++;
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(bgMasterGain);
    const t = bgNextNoteTime, dur = interval * 1.9;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.22, t + 0.3);
    gain.gain.setValueAtTime(0.14, t + dur - 0.6);
    gain.gain.linearRampToValueAtTime(0, t + dur);
    osc.start(t);
    osc.stop(t + dur);
    bgNextNoteTime += interval;
  }
  bgScheduleTimer = setTimeout(scheduleBgNotes, 600);
}

function setBgMusicVolume(vol) {
  bgMusicVolume = vol;
  if (bgMasterGain) bgMasterGain.gain.value = vol;
}

// ─── Tab 切换 ──────────────────────────────────────

function switchTab(tab) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById('tab-' + tab);
  if (panel) panel.classList.add('active');
}

// ─── 建筑列表渲染 ──────────────────────────────────

function renderBuildings() {
  const list = document.getElementById('buildings-list');
  if (!list) return;

  const rows = [];
  let lockedShown = 0;

  CONFIG.buildings.forEach((b, i) => {
    const owned    = gameState.buildingCounts[i] || 0;
    const unlocked = gameState.buildingUnlocked[i] || owned > 0;

    if (unlocked) {
      const price     = getBuildingPrice(i);
      const totalCPS  = getBuildingTotalCPS(i);
      const canAfford = gameState.bananaCount >= price;
      let cpsLine;
      if (owned > 0) {
        const totalRate = gameState.productionRate || 0;
        const pct = totalRate > 0 ? Math.round(totalCPS / totalRate * 100) : 0;
        const perUnit = b.baseCPS < 1 ? b.baseCPS.toFixed(2) : formatNumber(b.baseCPS);
        cpsLine = `每只 ${perUnit}/s · ${owned}只合计 +${formatRate(totalCPS)}/s（占 ${pct}%）`;
      } else {
        cpsLine = `单个 ${b.baseCPS < 1 ? b.baseCPS.toFixed(1) : formatNumber(b.baseCPS)} 🍌/秒`;
      }
      rows.push(`
        <div class="building-row${canAfford ? ' affordable-row' : ''}" data-building="${i}">
          <div class="building-emoji">${b.emoji}</div>
          <div class="building-info">
            <div class="building-name-row">
              <span class="building-name">${b.name}</span>
              ${owned > 0 ? `<span class="building-count">x${owned}</span>` : ''}
            </div>
            ${b.desc ? `<div class="building-desc">${b.desc}</div>` : ''}
            <div class="building-cps">${cpsLine}</div>
          </div>
          <button class="building-buy-btn${canAfford ? ' affordable' : ''}" data-building="${i}">
            ${formatNumber(price)} 🍌
          </button>
        </div>
      `);
    } else if (lockedShown < 2) {
      lockedShown++;
      rows.push(`
        <div class="building-row locked-row" data-building="${i}">
          <div class="building-emoji locked-emoji">${b.emoji}</div>
          <div class="building-info">
            <div class="building-name-row">
              <span class="building-name locked-name">???</span>
            </div>
            <div class="building-cps locked-cps">解锁需 ${formatNumber(b.basePrice * 0.1)} 🍌</div>
          </div>
          <button class="building-buy-btn locked-btn" disabled>🔒</button>
        </div>
      `);
    }
  });

  list.innerHTML = rows.join('');

  list.querySelectorAll('.building-buy-btn:not([disabled])').forEach(btn => {
    btn.addEventListener('click', () => {
      const row = btn.closest('.building-row');
      const idx = parseInt(row.dataset.building, 10);
      if (buyBuilding(idx)) {
        saveGame();
        renderBuildings();
        updateTopBar();
        if (idx === 0) renderMonkeysAroundBanana();
        const b = CONFIG.buildings[idx];
        showToast(`${b.emoji} 雇了一个${b.name}！`);
      } else {
        const need = Math.ceil(getBuildingPrice(idx) - gameState.bananaCount);
        showToast(`还差 ${formatNumber(need)} 🍌`);
      }
    });
  });
}

function updateBuildingAffordability() {
  document.querySelectorAll('.building-row:not(.locked-row)').forEach(row => {
    const i         = parseInt(row.dataset.building, 10);
    const canAfford = gameState.bananaCount >= getBuildingPrice(i);
    row.classList.toggle('affordable-row', canAfford);
    const btn = row.querySelector('.building-buy-btn');
    if (btn) btn.classList.toggle('affordable', canAfford);
  });
}

// ─── 建筑解锁检测（每秒一次）────────────────────────

let _unlockPopupTimer = null;
function showUnlockPopup(b) {
  const el = document.getElementById('unlock-popup');
  if (!el) return;
  el.textContent = `🎉 新角色解锁：${b.emoji} ${b.name}`;
  el.classList.add('visible');
  if (_unlockPopupTimer) clearTimeout(_unlockPopupTimer);
  _unlockPopupTimer = setTimeout(() => el.classList.remove('visible'), 3000);
}

function checkBuildingUnlocks() {
  let changed = false;
  CONFIG.buildings.forEach((b, i) => {
    if (i === 0) return;
    if (!gameState.buildingUnlocked[i] && gameState.totalBananasEarned >= b.basePrice) {
      gameState.buildingUnlocked[i] = true;
      changed = true;
      showUnlockPopup(b);
    }
  });
  if (changed) renderBuildings();
}

// ─── 小猴子围绕香蕉显示 ────────────────────────────

function renderMonkeysAroundBanana() {
  const ring = document.getElementById('monkey-ring');
  if (!ring) return;
  const count = gameState.buildingCounts[0] || 0;
  if (count === 0) { ring.innerHTML = ''; return; }
  ring.innerHTML = Array.from({ length: count }, (_, i) => {
    const delay = ((i % 12) / 12 * 2).toFixed(1);
    return `<span class="ring-monkey" style="animation-delay:${delay}s">🐒</span>`;
  }).join('');
}

// ─── 小猴子点击视觉效果（每 10 秒）────────────────

function triggerCursorClickVisual() {
  document.querySelectorAll('.ring-monkey').forEach((el, i) => {
    setTimeout(() => {
      el.classList.remove('ring-click');
      void el.offsetWidth;
      el.classList.add('ring-click');
      el.addEventListener('animationend', () => el.classList.remove('ring-click'), { once: true });
    }, i * 40);
  });
}

// ─── 工具函数 ──────────────────────────────────────

function setVisible(id, visible) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('visible', visible);
}

function getAttachmentSummary(mail) {
  if (!mail.attachments || mail.attachments.length === 0) return '无附件';
  return mail.attachments.map(item => {
    if (item.type === 'banana') return `🍌 +${formatNumber(item.amount)}`;
    if (item.type === 'item')   return `${item.name || item.itemId} x${item.amount}`;
    return `${item.amount}`;
  }).join(' · ');
}

// ─── 邮件弹窗 ──────────────────────────────────────

async function openMailModal() {
  document.getElementById('mail-modal').classList.add('visible');
  await reloadMails();
  renderMailList();
}

function closeMailModal() {
  document.getElementById('mail-modal').classList.remove('visible');
}

function renderMailList() {
  const list = document.getElementById('mail-list');
  if (!list) return;
  const mails = Array.isArray(gameState.mails) ? gameState.mails : [];
  if (mails.length === 0) {
    list.innerHTML = '<div class="mail-empty">还没有收到邮件</div>';
    updateMailBadge();
    return;
  }
  list.innerHTML = mails.map(mail => {
    const claimedClass = mail.claimed ? ' claimed' : '';
    const attachment   = getAttachmentSummary(mail);
    const timeText = new Date(mail.createdAt || Date.now()).toLocaleString('zh-CN', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
    return `
      <article class="mail-card${claimedClass}">
        <div class="mail-card-head">
          <strong>${mail.subject || '系统邮件'}</strong>
          <span>${timeText}</span>
        </div>
        <div class="mail-from">来自：${mail.from || '系统'}</div>
        <div class="mail-body">${mail.body || ''}</div>
        <div class="mail-attach">${attachment}</div>
        <button class="mail-claim-btn" data-mail-id="${mail.id}" ${mail.claimed ? 'disabled' : ''}>${mail.claimed ? '已领取' : '领取'}</button>
      </article>
    `;
  }).join('');

  list.querySelectorAll('.mail-claim-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const result = await claimMail(btn.dataset.mailId);
      if (!result.success) { showToast(result.message || '领取失败'); return; }
      renderMailList();
    });
  });
  updateMailBadge();
}

// ─── 登录弹窗 ──────────────────────────────────────

function openAuthModal() {
  document.getElementById('auth-modal').classList.add('visible');
  document.querySelector('.game-wrapper').classList.add('auth-locked');
}

function closeAuthModal() {
  document.getElementById('auth-modal').classList.remove('visible');
  document.querySelector('.game-wrapper').classList.remove('auth-locked');
}

function syncAuthModeUI() {
  const switchBtn = document.getElementById('auth-switch-mode');
  const prompt    = document.querySelector('#auth-modal .modal-offline-desc');
  if (!switchBtn || !prompt) return;
  if (authMode === 'register') {
    switchBtn.textContent = '切换到登录';
    prompt.textContent    = '首次进入请注册账号，之后会自动保持登录状态';
  } else {
    switchBtn.textContent = '切换到注册';
    prompt.textContent    = '已有账号可以直接登录，首次进入请先注册';
  }
}

function toggleAuthMode() {
  authMode = authMode === 'register' ? 'login' : 'register';
  syncAuthModeUI();
  syncAuthModeHint();
}

async function handleAuthSubmit(type) {
  const username = document.getElementById('auth-username').value;
  const password = document.getElementById('auth-password').value;
  const action   = type === 'register' ? registerPlayerAccount : loginPlayerAccount;
  let result;
  try { result = await action(username, password); }
  catch (e) { console.error('Auth error:', e); showToast('网络错误，请检查控制台'); return; }
  if (!result.success) { showToast(result.message || '操作失败'); return; }
  closeAuthModal();
  showToast(type === 'register' ? '注册成功，已自动登录' : '登录成功');
  bootstrapPlayerSession();
}

// ─── 主流程 ────────────────────────────────────────

function applyOfflineEarningsIfNeeded() {
  const offlineMs = Date.now() - gameState.lastLoginTime;
  const earnings  = calculateOfflineEarnings();
  if (earnings > 0) {
    gameState.bananaCount        += earnings;
    gameState.totalBananasEarned += earnings;
    showOfflineEarnings(earnings, offlineMs);
  }
  gameState.lastLoginTime = Date.now();
}

function bootstrapPlayerSession() {
  applyOfflineEarningsIfNeeded();
  checkBuildingUnlocks();
  renderBuildings();
  renderUpgrades();
  renderMonkeysAroundBanana();
  updateTopBar();
  renderMailList();
  updateMailBadge();
  updateTutorial();
  saveGame();
  if (!gameLoopStarted) {
    gameLoopStarted = true;
    lastTickTime    = null;
    requestAnimationFrame(gameLoop);
  }
  startBgMusic();
}

function syncAuthModeHint() {
  const hint = document.getElementById('auth-pw-hint');
  if (hint) hint.style.display = authMode === 'register' ? '' : 'none';
}

function gameLoop(timestamp) {
  if (!gameState.isAuthenticated) return;
  if (lastTickTime === null) lastTickTime = timestamp;
  const deltaSeconds = (timestamp - lastTickTime) / 1000;
  lastTickTime = timestamp;

  gameTick(deltaSeconds);
  updateTopBar();
  updateBuildingAffordability();

  updateUpgradeAffordability();

  unlockCheckTimer += deltaSeconds;
  if (unlockCheckTimer >= 1) {
    unlockCheckTimer = 0;
    checkBuildingUnlocks();
    updateTutorial();
    const upgradeTab = document.getElementById('tab-upgrade');
    if (upgradeTab && upgradeTab.classList.contains('active')) renderUpgrades();
  }

  cursorClickTimer = 0;

  autoSaveTimer += deltaSeconds;
  if (autoSaveTimer >= AUTO_SAVE_INTERVAL) {
    autoSaveTimer = 0;
    saveGame();
  }
  requestAnimationFrame(gameLoop);
}

// ─── 点击香蕉 ──────────────────────────────────────

function handleBananaClick(event) {
  if (!gameState.isAuthenticated) { openAuthModal(); return; }
  const result = processBananaClick();
  spawnFloatingBanana(event.clientX, event.clientY, result.isCrit);
  spawnClickValueText(event.clientX, event.clientY, result.value, result.isCrit);
  playClickAnimation(result.isCrit);
  playClickSound();
  updateTopBar();
}

// ─── 科技树 ────────────────────────────────────────

let selectedUpgradeId = null;

function getUpgradeState(u) {
  if (gameState.upgradePurchased[u.id]) return 'owned';
  if (gameState.totalBananasEarned < u.unlockAt) return 'hidden';
  if (gameState.bananaCount >= u.cost) return 'available';
  return 'locked';
}

function renderUpgrades() {
  const grid = document.getElementById('upgrade-grid');
  if (!grid) return;

  const icons = CONFIG.upgrades.map(u => {
    const state = getUpgradeState(u);
    if (state === 'hidden') return '';
    const sel = u.id === selectedUpgradeId ? ' selected' : '';
    return `<button class="upgrade-icon upgrade-${state}${sel}" data-id="${u.id}" type="button" aria-label="${u.name}">
      <span class="upgrade-emoji">${u.emoji}</span>
      ${state === 'owned' ? '<span class="upgrade-check">✓</span>' : ''}
    </button>`;
  }).join('');

  grid.innerHTML = icons || '<div class="upgrade-empty">继续收集香蕉以解锁科技</div>';
  grid.querySelectorAll('.upgrade-icon[data-id]').forEach(btn => {
    btn.addEventListener('click', () => handleUpgradeIconClick(btn.dataset.id));
  });
  updateUpgradeDetail();
}

function handleUpgradeIconClick(id) {
  selectedUpgradeId = (selectedUpgradeId === id) ? null : id;
  renderUpgrades();
}

function updateUpgradeDetail() {
  const panel = document.getElementById('upgrade-detail');
  if (!panel) return;

  if (!selectedUpgradeId) {
    panel.innerHTML = '<div class="upgrade-detail-hint">点击科技图标查看详情</div>';
    return;
  }
  const u = CONFIG.upgrades.find(u => u.id === selectedUpgradeId);
  if (!u) return;
  const state   = getUpgradeState(u);
  const isOwned = state === 'owned';
  const canBuy  = state === 'available';
  const catLabel = u.category === 'click' ? '点击力' : '产速';

  panel.innerHTML = `
    <div class="upgrade-detail-inner">
      <div class="upgrade-detail-head">
        <span class="upgrade-detail-emoji">${u.emoji}</span>
        <div class="upgrade-detail-info">
          <div class="upgrade-detail-name">${u.name} <span class="upgrade-cat-badge">${catLabel}</span></div>
          <div class="upgrade-detail-effect">${u.desc}</div>
        </div>
      </div>
      ${isOwned
        ? '<div class="upgrade-detail-owned">✓ 已拥有</div>'
        : `<div class="upgrade-detail-cost">${canBuy ? '💰' : '🔒'} 需要 ${formatNumber(u.cost)} 🍌</div>
           <button class="upgrade-buy-btn${canBuy ? ' can-buy' : ''}" data-id="${u.id}" ${canBuy ? '' : 'disabled'} type="button">
             ${canBuy ? '购买' : '余额不足'}
           </button>`
      }
    </div>`;

  const buyBtn = panel.querySelector('.upgrade-buy-btn[data-id]');
  if (buyBtn) {
    buyBtn.addEventListener('click', () => {
      if (buyUpgrade(buyBtn.dataset.id)) {
        selectedUpgradeId = null;
        saveGame();
        renderUpgrades();
        updateTopBar();
        showToast(`🔬 ${u.name} 已解锁！`);
      }
    });
  }
}

function updateUpgradeAffordability() {
  document.querySelectorAll('.upgrade-icon[data-id]').forEach(btn => {
    const id = btn.dataset.id;
    const u  = CONFIG.upgrades.find(u => u.id === id);
    if (!u) return;
    const state = getUpgradeState(u);
    const sel   = id === selectedUpgradeId ? ' selected' : '';
    btn.className = `upgrade-icon upgrade-${state}${sel}`;
  });
}

// ─── 新手引导 ──────────────────────────────────────

function updateTutorial() {
  const el = document.getElementById('tutorial-hint');
  if (!el) return;

  const monkeys    = gameState.buildingCounts[0] || 0;
  const hasUpgrade = Object.values(gameState.upgradePurchased).some(Boolean);

  if (hasUpgrade) { el.classList.remove('visible'); return; }

  let text;
  if (monkeys === 0 && gameState.totalBananasEarned < 15) {
    text = '👆 点击香蕉赚取香蕉！';
  } else if (monkeys === 0) {
    text = '🐒 去猴子树，买一只小猴子（15 🍌）';
  } else if (gameState.totalBananasEarned < 100) {
    text = '✨ 继续点击，凑够 100 🍌';
  } else {
    text = '🔬 去科技树购买第一个升级（100 🍌）';
  }

  el.textContent = text;
  el.classList.add('visible');
}

// ─── 设置弹窗 ──────────────────────────────────────

function openSettings() {
  const totalBuildings = gameState.buildingCounts.reduce((a, b) => a + b, 0);
  document.getElementById('stat-username').textContent  = gameState.currentUser || '-';
  document.getElementById('stat-clicks').textContent    = formatNumber(gameState.totalClicks);
  document.getElementById('stat-buildings').textContent = formatNumber(totalBuildings);
  document.getElementById('stat-total').textContent     = formatNumber(gameState.totalBananasEarned);

  const cv = Math.round(clickVolume * 100);
  const bv = Math.round(bgMusicVolume * 100);
  document.getElementById('toggle-sound').checked    = soundEnabled;
  document.getElementById('toggle-bgmusic').checked  = bgMusicEnabled;
  document.getElementById('volume-click').value      = cv;
  document.getElementById('volume-bgmusic').value    = bv;
  document.getElementById('volume-click-val').textContent   = cv + '%';
  document.getElementById('volume-bgmusic-val').textContent = bv + '%';

  resetCancelPending();
  document.getElementById('settings-modal').classList.add('visible');
}

async function handleLogout() {
  closeSettings();
  await logoutPlayerAccount();
  gameLoopStarted = false;
  lastTickTime    = null;
  openAuthModal();
}

function closeSettings() {
  resetCancelPending();
  document.getElementById('settings-modal').classList.remove('visible');
}

function handleResetClick() {
  const btn     = document.getElementById('btn-reset');
  const warning = document.getElementById('reset-warning');
  if (!resetPending) {
    resetPending = true;
    btn.textContent = '⚠️ 再点一次确认重置';
    btn.classList.add('btn-reset-danger');
    warning.style.display = '';
    resetTimer = setTimeout(resetCancelPending, 3000);
    return;
  }
  resetCancelPending();
  closeSettings();
  resetGame();
}

function resetCancelPending() {
  resetPending = false;
  clearTimeout(resetTimer);
  const btn = document.getElementById('btn-reset');
  if (btn) { btn.textContent = '🔄 重置游戏'; btn.classList.remove('btn-reset-danger'); }
  const warning = document.getElementById('reset-warning');
  if (warning) warning.style.display = 'none';
}

// ─── 事件绑定 ──────────────────────────────────────

function bindAuthEvents() {
  document.getElementById('auth-register').addEventListener('click', () => handleAuthSubmit('register'));
  document.getElementById('auth-login').addEventListener('click',    () => handleAuthSubmit('login'));
  document.getElementById('auth-switch-mode').addEventListener('click', toggleAuthMode);
  document.getElementById('auth-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleAuthSubmit(authMode);
  });
  document.getElementById('auth-username').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleAuthSubmit(authMode);
  });
}

function bindGeneralEvents() {
  window.addEventListener('beforeunload', saveGame);
  document.addEventListener('contextmenu', e => e.preventDefault());

  // 香蕉点击
  const bananaBtn = document.getElementById('main-banana');
  bananaBtn.addEventListener('dragstart', e => e.preventDefault());
  document.querySelector('.banana-img').addEventListener('dragstart', e => e.preventDefault());
  bananaBtn.addEventListener('click', handleBananaClick);
  bananaBtn.addEventListener('touchstart', e => {
    bananaTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });
  bananaBtn.addEventListener('touchend', e => {
    if (!bananaTouch) return;
    const t = e.changedTouches[0];
    if (Math.abs(t.clientX - bananaTouch.x) > 12 || Math.abs(t.clientY - bananaTouch.y) > 12) {
      bananaTouch = null; return;
    }
    bananaTouch = null;
    e.preventDefault();
    handleBananaClick({ clientX: t.clientX, clientY: t.clientY });
  }, { passive: false });

  // 离线弹窗
  document.getElementById('offline-confirm').addEventListener('click', () => {
    setVisible('offline-modal', false);
  });

  // 邮件
  document.getElementById('mail-btn').addEventListener('click', openMailModal);
  document.getElementById('mail-close').addEventListener('click', closeMailModal);
  document.getElementById('mail-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeMailModal();
  });

  // 设置
  document.getElementById('settings-close').addEventListener('click', closeSettings);
  document.getElementById('btn-reset').addEventListener('click', handleResetClick);
  document.getElementById('btn-logout').addEventListener('click', handleLogout);
  document.getElementById('settings-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeSettings();
  });

  // 音量控制
  document.getElementById('toggle-sound').addEventListener('change', e => {
    soundEnabled = e.target.checked;
    localStorage.setItem('soundEnabled', soundEnabled);
    if (soundEnabled) initAudio();
  });
  document.getElementById('volume-click').addEventListener('input', e => {
    clickVolume = Number(e.target.value) / 100;
    localStorage.setItem('clickVolume', e.target.value);
    document.getElementById('volume-click-val').textContent = e.target.value + '%';
  });
  document.getElementById('toggle-bgmusic').addEventListener('change', e => {
    bgMusicEnabled = e.target.checked;
    localStorage.setItem('bgMusicEnabled', bgMusicEnabled);
    if (bgMusicEnabled) startBgMusic(); else stopBgMusic();
  });
  document.getElementById('volume-bgmusic').addEventListener('input', e => {
    bgMusicVolume = Number(e.target.value) / 100;
    localStorage.setItem('bgMusicVolume', e.target.value);
    document.getElementById('volume-bgmusic-val').textContent = e.target.value + '%';
    setBgMusicVolume(bgMusicVolume);
  });

  // 底部导航
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (tab === 'settings') { openSettings(); return; }
      document.querySelectorAll('.nav-btn').forEach(n => n.classList.remove('active'));
      btn.classList.add('active');
      switchTab(tab);
    });
  });
}

// ─── 入口 ──────────────────────────────────────────

async function init() {
  bindAuthEvents();
  bindGeneralEvents();
  syncAuthModeUI();
  syncAuthModeHint();

  try {
    const restored = await restoreSessionFromStorage();
    if (restored) { bootstrapPlayerSession(); closeAuthModal(); return; }
  } catch (e) { console.error('Session restore error:', e); }

  openAuthModal();
}

document.addEventListener('DOMContentLoaded', init);
