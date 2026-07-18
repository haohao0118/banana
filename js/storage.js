// 存储层 · Supabase 版

const FAKE_EMAIL_DOMAIN = 'game.local';
const GM_SESSION_KEY    = 'monkey_gm_session';

// ─── 工具 ─────────────────────────────────────────

function safeParseJSON(raw, fallback = null) {
  try { return raw ? JSON.parse(raw) : fallback; }
  catch { return fallback; }
}

function toEmail(username) {
  const value = String(username || '').trim().toLowerCase();
  // 兼容新注册时填写真实邮箱，也兼容旧版的用户名账号。
  return value.includes('@') ? value : `${value}@${FAKE_EMAIL_DOMAIN}`;
}

function requireSupabase() {
  if (!supabaseClient) {
    throw new Error('Supabase 客户端未加载，请检查网络或刷新页面');
  }
  return supabaseClient;
}

function formatAuthError(error, fallback) {
  const message = String(error?.message || error || '').trim();
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return '认证服务无法访问，请联系管理员检查 Supabase 项目地址';
  }
  if (/email not confirmed/i.test(message)) return '邮箱尚未验证，请先完成邮箱验证';
  if (/invalid login credentials/i.test(message)) return '用户名或密码错误';
  if (/already registered|user already exists/i.test(message)) return '该用户名或邮箱已被使用';
  if (/invalid.*email/i.test(message)) return '邮箱地址无效，请检查后重试';
  return message || fallback;
}

// ─── 默认存档 ──────────────────────────────────────

function createDefaultSaveData() {
  return {
    bananaCount: 0, totalBananasEarned: 0, totalClicks: 0,
    productionRate: 0,
    buildingCounts: new Array(20).fill(0),
    buildingUnlocked: new Array(20).fill(false).map((_, i) => i < 1),
    upgradePurchased: {},
    mails: [], unreadMailCount: 0,
    selectedBananaStyle: 0,
    lastSaveTime: Date.now(), lastLoginTime: Date.now(),
  };
}

// ─── 存档规范化 ────────────────────────────────────

function normalizeMail(mail) {
  if (!mail || typeof mail !== 'object') return null;
  const attachments = Array.isArray(mail.attachments)
    ? mail.attachments.map(item => {
        if (!item || typeof item !== 'object') return null;
        return {
          type:   item.type   || 'banana',
          itemId: item.itemId || '',
          name:   item.name   || '',
          amount: Math.max(0, Number(item.amount) || 0),
        };
      }).filter(Boolean)
    : [];
  return {
    id:         mail.id || `mail_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    from:       mail.from    || 'GM后台',
    subject:    mail.subject || '系统邮件',
    body:       mail.body    || '',
    attachments,
    createdAt:  Number(mail.createdAt) || Date.now(),
    claimed:    Boolean(mail.claimed),
    claimedAt:  mail.claimedAt ? Number(mail.claimedAt) : null,
  };
}

function normalizeSaveData(raw) {
  const base = createDefaultSaveData();
  if (!raw || typeof raw !== 'object') return base;

  // buildingCounts：20 个建筑的数量，向后兼容旧存档（旧存档没有此字段）
  const rawCounts = Array.isArray(raw.buildingCounts) ? raw.buildingCounts : [];
  const buildingCounts = new Array(20).fill(0).map((_, i) =>
    Math.max(0, Math.floor(Number(rawCounts[i]) || 0))
  );

  // buildingUnlocked：永久解锁标志，向后兼容（旧存档默认只解锁 0/1，其余由 checkBuildingUnlocks 补全）
  const rawUnlocked = Array.isArray(raw.buildingUnlocked) ? raw.buildingUnlocked : [];
  const buildingUnlocked = new Array(20).fill(false).map((_, i) => {
    if (i < 1) return true;
    if (buildingCounts[i] > 0) return true; // 已购买过则永久解锁
    return Boolean(rawUnlocked[i]);
  });

  const rawUpgrades = (raw.upgradePurchased && typeof raw.upgradePurchased === 'object') ? raw.upgradePurchased : {};
  const upgradePurchased = {};
  CONFIG.upgrades.forEach(u => { if (rawUpgrades[u.id] === true) upgradePurchased[u.id] = true; });

  const mails = Array.isArray(raw.mails)
    ? raw.mails.map(normalizeMail).filter(Boolean).slice(0, CONFIG.mailInboxLimit)
    : [];

  return {
    bananaCount:        Math.max(0, Number(raw.bananaCount)        || 0),
    totalBananasEarned: Math.max(0, Number(raw.totalBananasEarned) || 0),
    totalClicks:        Math.max(0, Number(raw.totalClicks)        || 0),
    productionRate:     Math.max(0, Number(raw.productionRate)     || 0),
    buildingCounts,
    buildingUnlocked,
    upgradePurchased,
    mails,
    unreadMailCount: Number(raw.unreadMailCount) || mails.filter(m => !m.claimed).length,
    selectedBananaStyle: Math.max(0, Math.min(
      CONFIG.bananaStyles.length - 1, Number(raw.selectedBananaStyle) || 0
    )),
    lastSaveTime:  Number(raw.lastSaveTime)  || Date.now(),
    lastLoginTime: Number(raw.lastLoginTime) || Date.now(),
  };
}

function applySaveDataToGameState(data) {
  const save = normalizeSaveData(data);
  gameState.bananaCount        = save.bananaCount;
  gameState.totalBananasEarned = save.totalBananasEarned;
  gameState.totalClicks        = save.totalClicks;
  gameState.productionRate     = save.productionRate;
  gameState.buildingCounts     = save.buildingCounts;
  gameState.buildingUnlocked   = save.buildingUnlocked;
  gameState.upgradePurchased   = save.upgradePurchased;
  gameState.mails              = save.mails;
  gameState.unreadMailCount    = save.unreadMailCount;
  gameState.selectedBananaStyle = save.selectedBananaStyle;
  gameState.lastSaveTime       = save.lastSaveTime;
  gameState.lastLoginTime      = save.lastLoginTime;
  // 用存档中的 buildingCounts 重算产速（不依赖存档里的 productionRate 缓存值）
  recalcProductionRate();
}

function collectSaveDataFromGameState() {
  return {
    bananaCount:        gameState.bananaCount,
    totalBananasEarned: gameState.totalBananasEarned,
    totalClicks:        gameState.totalClicks,
    productionRate:     gameState.productionRate,
    buildingCounts:     [...gameState.buildingCounts],
    buildingUnlocked:   [...gameState.buildingUnlocked],
    upgradePurchased:   { ...gameState.upgradePurchased },
    mails:              gameState.mails,
    unreadMailCount:    gameState.unreadMailCount,
    selectedBananaStyle: gameState.selectedBananaStyle,
    lastSaveTime:       Date.now(),
    lastLoginTime:      gameState.lastLoginTime || Date.now(),
  };
}

// ─── 注册 ──────────────────────────────────────────

async function registerPlayerAccount(username, password, email = '') {
  const name = String(username || '').trim();
  if (!name || !password)  return { success: false, message: '用户名和密码不能为空' };
  if (name.length > 20)    return { success: false, message: '用户名最多 20 个字符' };
  if (password.length < 6) return { success: false, message: '密码至少需要 6 个字符' };

  const authEmail = String(email || '').trim().toLowerCase() || toEmail(name);
  if (!/^\S+@\S+\.\S+$/.test(authEmail)) {
    return { success: false, message: '请输入有效的邮箱地址' };
  }
  const client = requireSupabase();

  const { data: existing, error: lookupError } = await client
    .from('profiles').select('id').ilike('username', name).maybeSingle();
  // 资料表尚未初始化时，Auth 仍可完成注册，后续登录会自动补齐资料。
  if (lookupError && lookupError.code !== '42P01') console.warn('profile lookup:', lookupError);
  if (existing) return { success: false, message: '该用户名已被使用' };

  const { data, error } = await client.auth.signUp({
    email: authEmail,
    password,
    options: { data: { username: name } },
  });
  if (error) {
    return { success: false, message: formatAuthError(error, '注册失败，请稍后再试') };
  }

  const userId = data?.user?.id;
  if (!userId) return { success: false, message: '注册失败，请稍后再试' };

  if (!data.session) {
    return {
      success: true,
      username: name,
      pendingEmailConfirm: true,
      message: '注册成功，请先到邮箱完成验证；若使用用户名注册，请在 Supabase 关闭邮箱确认，或重新填写可收信的邮箱'
    };
  }

  const saveData = createDefaultSaveData();
  let profileRes = await client.from('profiles').upsert(
    { id: userId, username: name, email: authEmail }, { onConflict: 'id' }
  );
  // 兼容尚未执行最新 SQL 的旧项目，邮箱字段缺失时仍可完成注册。
  if (profileRes.error && /email|column/i.test(profileRes.error.message || '')) {
    profileRes = await client.from('profiles').upsert({ id: userId, username: name }, { onConflict: 'id' });
  }
  const saveRes = await client.from('game_saves').upsert(
    { user_id: userId, save_data: saveData, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  );

  if (profileRes.error || saveRes.error) {
    return { success: false, message: profileRes.error?.message || saveRes.error?.message || '注册失败，请稍后再试' };
  }

  gameState.currentUser     = name;
  gameState.currentUserId   = userId;
  gameState.isAuthenticated = true;
  applySaveDataToGameState(saveData);
  return { success: true, username: name };
}

// ─── 登录 ──────────────────────────────────────────

async function loginPlayerAccount(username, password) {
  const name = String(username || '').trim();
  if (!name || !password) return { success: false, message: '用户名和密码不能为空' };

  const client = requireSupabase();
  let authEmail = toEmail(name);
  // 新版账号可填写真实邮箱登录；旧版用户名仍使用 game.local 别名。
  if (!name.includes('@')) {
    const { data: profile } = await client.from('profiles').select('email').ilike('username', name).maybeSingle();
    if (profile?.email) authEmail = profile.email;
  }
  const { data, error } = await client.auth.signInWithPassword({
    email: authEmail, password,
  });
  if (error || !data?.user?.id) {
    return { success: false, message: formatAuthError(error, '用户名或密码错误') };
  }

  const userId = data.user.id;
  let { data: profile, error: profileError } = await client
    .from('profiles').select('id, username').eq('id', userId).maybeSingle();

  if (profileError) return { success: false, message: profileError.message || '登录失败，请稍后再试' };

  if (!profile) {
    const fallbackName = name || (data.user.email ? data.user.email.split('@')[0] : '');
    let upsertRes = await client.from('profiles').upsert(
      { id: userId, username: fallbackName, email: authEmail }, { onConflict: 'id' }
    );
    if (upsertRes.error && /email|column/i.test(upsertRes.error.message || '')) {
      upsertRes = await client.from('profiles').upsert({ id: userId, username: fallbackName }, { onConflict: 'id' });
    }
    if (upsertRes.error) return { success: false, message: upsertRes.error.message || '登录失败，请稍后再试' };
    ({ data: profile, error: profileError } = await client
      .from('profiles').select('id, username').eq('id', userId).maybeSingle());
    if (profileError || !profile) return { success: false, message: profileError?.message || '登录失败，请稍后再试' };
  }

  gameState.currentUser     = profile.username;
  gameState.currentUserId   = userId;
  gameState.isAuthenticated = true;
  await loadGame();
  return { success: true, username: profile.username };
}

// ─── 会话恢复 ──────────────────────────────────────

async function restoreSessionFromStorage() {
  if (!supabaseClient) return false;
  const { data, error: sessionError } = await supabaseClient.auth.getSession();
  if (sessionError) { console.warn('getSession error:', sessionError); return false; }
  const session = data?.session;
  if (!session) return false;

  const { data: profile } = await supabaseClient
    .from('profiles').select('username').eq('id', session.user.id).maybeSingle();
  if (!profile) { await supabaseClient.auth.signOut(); return false; }

  gameState.currentUser     = profile.username;
  gameState.currentUserId   = session.user.id;
  gameState.isAuthenticated = true;
  await loadGame();
  return true;
}

// ─── 退出登录 ──────────────────────────────────────

async function logoutPlayerAccount() {
  saveGame();
  await supabaseClient.auth.signOut();
  gameState.currentUser     = '';
  gameState.currentUserId   = '';
  gameState.isAuthenticated = false;
  gameState.mails           = [];
  gameState.unreadMailCount = 0;
}

// ─── 存档 / 读档 ────────────────────────────────────

async function saveGame() {
  if (!gameState.isAuthenticated || !gameState.currentUserId) return false;
  const save = collectSaveDataFromGameState();
  const { error } = await supabaseClient
    .from('game_saves')
    .upsert({ user_id: gameState.currentUserId, save_data: save, updated_at: new Date().toISOString() },
             { onConflict: 'user_id' });
  if (error) { console.warn('存档失败:', error); return false; }
  showSaveIndicator();
  return true;
}

async function loadGame() {
  if (!gameState.currentUserId) {
    applySaveDataToGameState(createDefaultSaveData());
    return false;
  }
  const { data, error } = await supabaseClient
    .from('game_saves').select('save_data').eq('user_id', gameState.currentUserId).maybeSingle();
  applySaveDataToGameState((error || !data) ? createDefaultSaveData() : data.save_data);
  return !error && !!data;
}

// ─── 邮件刷新 ──────────────────────────────────────

async function reloadMails() {
  if (!gameState.currentUserId) return;
  const { data } = await supabaseClient
    .from('game_saves').select('save_data').eq('user_id', gameState.currentUserId).maybeSingle();
  if (!data?.save_data?.mails) return;
  const mails = Array.isArray(data.save_data.mails)
    ? data.save_data.mails.map(normalizeMail).filter(Boolean).slice(0, CONFIG.mailInboxLimit)
    : [];
  gameState.mails           = mails;
  gameState.unreadMailCount = mails.filter(m => !m.claimed).length;
}

// ─── 邮件领取 ──────────────────────────────────────

async function claimMail(mailId) {
  const mail = gameState.mails.find(m => m.id === mailId);
  if (!mail || mail.claimed) return { success: false, message: '邮件不可领取' };

  (mail.attachments || []).forEach(item => {
    if (!item?.amount) return;
    if (item.type === 'banana') {
      gameState.bananaCount        += item.amount;
      gameState.totalBananasEarned += item.amount;
    }
  });

  mail.claimed              = true;
  mail.claimedAt            = Date.now();
  gameState.unreadMailCount = gameState.mails.filter(m => !m.claimed).length;

  saveGame();
  updateTopBar();
  updateMailBadge();
  showToast('邮件已领取');
  return { success: true };
}

// ─── 重置游戏 ──────────────────────────────────────

async function resetGame() {
  if (!gameState.currentUserId) return;
  const base = createDefaultSaveData();
  applySaveDataToGameState(base);
  await saveGame();
  renderBuildings();
  renderMonkeysAroundBanana();
  renderMailList();
  updateMailBadge();
  updateTopBar();
  showToast('游戏已重置');
}

// ─── GM 本地会话 ───────────────────────────────────

function setGMSession(ok)    { sessionStorage.setItem(GM_SESSION_KEY, ok ? '1' : ''); }
function isGMSessionValid()  { return sessionStorage.getItem(GM_SESSION_KEY) === '1'; }
function clearGMSession()    { sessionStorage.removeItem(GM_SESSION_KEY); }
