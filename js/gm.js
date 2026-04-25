// GM 后台脚本 · 通过 Netlify 函数调用 Supabase（service role）

let gmPassword   = sessionStorage.getItem('monkey_gm_pw') || '';
let gmMailTarget = 'single';

// ─── 格式化工具（独立，不依赖 ui.js）────────────────

function formatNumber(num) {
  num = Math.floor(num);
  if (num < 1000)  return num.toString();
  if (num < 1e6)   return (num / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  if (num < 1e9)   return (num / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num < 1e12)  return (num / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  return (num / 1e12).toFixed(1).replace(/\.0$/, '') + 'T';
}

function formatRate(num) {
  if (num === 0) return '0';
  if (num < 0.1) return num.toFixed(2);
  if (num < 10)  return num.toFixed(1);
  return formatNumber(num);
}

// ─── Toast ────────────────────────────────────────

let _toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('visible');
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('visible'), 2200);
}

// ─── Netlify 函数调用 ─────────────────────────────

async function gmFetch(action, params = {}) {
  const res = await fetch('/.netlify/functions/gm-api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, password: gmPassword, ...params }),
  });
  return res.json();
}

// ─── 面板切换 ─────────────────────────────────────

function showGMPanel() {
  document.getElementById('gm-login-section').style.display = 'none';
  document.getElementById('gm-page-panel').style.display    = '';
  document.getElementById('gm-logout').style.display        = '';
}

function hideGMPanel() {
  document.getElementById('gm-login-section').style.display = '';
  document.getElementById('gm-page-panel').style.display    = 'none';
  document.getElementById('gm-logout').style.display        = 'none';
}

// ─── 登录 ─────────────────────────────────────────

async function handleGMLogin() {
  const pw = document.getElementById('gm-password').value.trim();
  if (!pw) { showToast('请输入密码'); return; }

  // 用 list_players 验证密码（如果密码错误，函数返回 401）
  gmPassword = pw;
  const result = await gmFetch('list_players').catch(() => null);
  if (!result || result.error) {
    gmPassword = '';
    showToast(result?.error || '登录失败');
    return;
  }
  sessionStorage.setItem('monkey_gm_pw', pw);
  showGMPanel();
  renderPlayerList(result.players);
}

// ─── 退出 ─────────────────────────────────────────

function handleGMLogout() {
  gmPassword = '';
  sessionStorage.removeItem('monkey_gm_pw');
  hideGMPanel();
  document.getElementById('gm-password').value = '';
  document.getElementById('gm-stats').innerHTML = '';
}

// ─── 玩家列表渲染 ─────────────────────────────────

function renderPlayerList(players) {
  const box = document.getElementById('gm-stats');
  if (!players || players.length === 0) {
    box.innerHTML = '<div class="gm-empty">暂无注册玩家</div>';
    return;
  }
  box.innerHTML = `
    <div class="gm-list-header">共 ${players.length} 名玩家 · 点击查看详情</div>
    ${players.map(p => `
      <div class="gm-player-row" data-uid="${p.userId}" data-name="${p.username}">
        <span class="gm-player-row-name">${p.username}</span>
        <span class="gm-player-row-arrow">›</span>
      </div>
    `).join('')}
  `;

  box.querySelectorAll('.gm-player-row[data-uid]').forEach(row => {
    row.addEventListener('click', () => {
      document.getElementById('gm-target-user').value = row.dataset.name;
      loadPlayerDetail(row.dataset.uid, row.dataset.name);
    });
  });
}

// ─── 查看玩家详情 ─────────────────────────────────

async function loadPlayerDetail(userId, username) {
  const result = await gmFetch('get_player', { userId });
  if (!result.success) { showToast(result.error || '查询失败'); return; }

  const save    = result.save;
  const monkeys = Array.isArray(save.monkeys) ? save.monkeys.filter(Boolean) : [];
  const mails   = Array.isArray(save.mails)   ? save.mails   : [];
  const summary = monkeys.length
    ? monkeys.map(m => `Lv.${m.level}`).join('，')
    : '暂无猴子';

  const up = save.upgrades || {};
  document.getElementById('gm-stats').innerHTML = `
    <div class="gm-detail-back" id="gm-back-btn">← 返回列表</div>
    <div class="gm-stat-row"><span>账号</span><strong>${username}</strong></div>
    <div class="gm-stat-row"><span>当前香蕉</span><strong>${formatNumber(save.bananaCount || 0)}</strong></div>
    <div class="gm-stat-row"><span>累计香蕉</span><strong>${formatNumber(save.totalBananasEarned || 0)}</strong></div>
    <div class="gm-stat-row"><span>产速</span><strong>${formatRate(save.productionRate || 0)}/s</strong></div>
    <div class="gm-stat-row"><span>猴子</span><strong>${monkeys.length}/10</strong></div>
    <div class="gm-stat-row"><span>累计点击</span><strong>${formatNumber(save.totalClicks || 0)}</strong></div>
    <div class="gm-stat-row"><span>累计合成</span><strong>${formatNumber(save.totalMerges || 0)}</strong></div>
    <div class="gm-stat-row"><span>未读邮件</span><strong>${save.unreadMailCount || 0}</strong></div>
    <div class="gm-stat-row"><span>邮件总数</span><strong>${mails.length}</strong></div>
    <div class="gm-stat-row"><span>升级：点击力</span><strong>Lv.${up.clickPower || 0}</strong></div>
    <div class="gm-stat-row"><span>升级：猴速</span><strong>Lv.${up.monkeySpeed || 0}</strong></div>
    <div class="gm-stat-row"><span>升级：暴击</span><strong>Lv.${up.critRate || 0}</strong></div>
    <div class="gm-stat-block"><p>${summary}</p></div>
    <button class="gm-btn gm-btn-danger" id="gm-delete-player-btn" style="width:100%;margin-top:10px" type="button">🗑️ 删除该玩家账号</button>
  `;

  document.getElementById('gm-back-btn').addEventListener('click', async () => {
    const listResult = await gmFetch('list_players');
    if (listResult.success) renderPlayerList(listResult.players);
  });

  let deleteConfirm = false;
  let deleteTimer   = null;
  const deleteBtn   = document.getElementById('gm-delete-player-btn');
  deleteBtn.addEventListener('click', async function() {
    if (!deleteConfirm) {
      deleteConfirm = true;
      this.textContent = '⚠️ 再次点击确认删除（不可恢复）';
      deleteTimer = setTimeout(() => {
        deleteConfirm = false;
        this.textContent = '🗑️ 删除该玩家账号';
      }, 4000);
      return;
    }
    clearTimeout(deleteTimer);
    const res = await gmFetch('delete_player', { userId });
    if (!res.success) { showToast(res.error || '删除失败'); return; }
    showToast(`${username} 已删除`);
    const listResult = await gmFetch('list_players');
    if (listResult.success) renderPlayerList(listResult.players);
  });
}

async function handleGMLoadPlayer() {
  const name = document.getElementById('gm-target-user').value.trim();
  if (!name) { showToast('请输入玩家用户名'); return; }

  const listResult = await gmFetch('list_players');
  if (!listResult.success) { showToast(listResult.error || '查询失败'); return; }

  const player = listResult.players.find(
    p => p.username.toLowerCase() === name.toLowerCase()
  );
  if (!player) { showToast('未找到该玩家'); return; }

  loadPlayerDetail(player.userId, player.username);
}

// ─── 重置玩家进度 ─────────────────────────────────

async function handleGMResetPlayer() {
  const name = document.getElementById('gm-target-user').value.trim();
  if (!name) { showToast('请输入玩家用户名'); return; }

  const listResult = await gmFetch('list_players');
  if (!listResult.success) { showToast(listResult.error || '查询失败'); return; }

  const player = listResult.players.find(
    p => p.username.toLowerCase() === name.toLowerCase()
  );
  if (!player) { showToast('未找到该玩家'); return; }

  const result = await gmFetch('reset_player', { userId: player.userId });
  if (!result.success) { showToast(result.error || '重置失败'); return; }
  showToast(`${player.username} 的进度已重置`);
  loadPlayerDetail(player.userId, player.username);
}

// ─── 发送邮件 ─────────────────────────────────────

function buildMailPayload() {
  const subject   = document.getElementById('gm-mail-subject').value.trim()    || 'GM 邮件';
  const body      = document.getElementById('gm-mail-body').value.trim()        || '来自 GM 后台的消息';
  const bananaAmt = Math.max(0, Number(document.getElementById('gm-mail-banana').value)     || 0);
  const itemId    = document.getElementById('gm-mail-item').value.trim();
  const itemCount = Math.max(0, Number(document.getElementById('gm-mail-item-count').value) || 0);
  const attachments = [];

  if (bananaAmt > 0) attachments.push({ type: 'banana', itemId: '', name: '香蕉', amount: bananaAmt });
  if (itemId && itemCount > 0) attachments.push({ type: 'item', itemId, name: itemId, amount: itemCount });

  return { from: 'GM 后台', subject, body, attachments };
}

async function handleGMSendMail() {
  const mail = buildMailPayload();

  if (gmMailTarget === 'all') {
    const result = await gmFetch('send_mail_all', { mail });
    if (!result.success) { showToast(result.error || '群发失败'); return; }
    showToast(`邮件已群发给 ${result.sent} 名玩家`);
    return;
  }

  const name = document.getElementById('gm-target-user').value.trim();
  if (!name) { showToast('请先在玩家查询里填写目标用户名'); return; }

  const listResult = await gmFetch('list_players');
  if (!listResult.success) { showToast(listResult.error || '查询失败'); return; }

  const player = listResult.players.find(
    p => p.username.toLowerCase() === name.toLowerCase()
  );
  if (!player) { showToast('未找到该玩家'); return; }

  const result = await gmFetch('send_mail', { userId: player.userId, mail });
  if (!result.success) { showToast(result.error || '发送失败'); return; }
  showToast(`邮件已发送给 ${player.username}`);
}

// ─── 发送目标切换 ─────────────────────────────────

function setGMMailTarget(target) {
  gmMailTarget = target;
  document.getElementById('gm-target-single').classList.toggle('active', target === 'single');
  document.getElementById('gm-target-all').classList.toggle('active', target === 'all');
}

// ─── 初始化 ───────────────────────────────────────

function bindGMEvents() {
  document.getElementById('gm-login-page-btn').addEventListener('click', handleGMLogin);
  document.getElementById('gm-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleGMLogin();
  });
  document.getElementById('gm-logout').addEventListener('click', handleGMLogout);
  document.getElementById('gm-load-player').addEventListener('click', handleGMLoadPlayer);
  document.getElementById('gm-reset-player').addEventListener('click', handleGMResetPlayer);
  document.getElementById('gm-send-mail').addEventListener('click', handleGMSendMail);
  document.getElementById('gm-target-single').addEventListener('click', () => setGMMailTarget('single'));
  document.getElementById('gm-target-all').addEventListener('click', () => setGMMailTarget('all'));
}

async function bootstrapGMPage() {
  bindGMEvents();

  // 如果 sessionStorage 里有密码，自动验证
  if (gmPassword) {
    const result = await gmFetch('list_players').catch(() => null);
    if (result?.success) {
      showGMPanel();
      renderPlayerList(result.players);
      return;
    }
    // 密码失效，清除
    gmPassword = '';
    sessionStorage.removeItem('monkey_gm_pw');
  }
}

document.addEventListener('DOMContentLoaded', bootstrapGMPage);
