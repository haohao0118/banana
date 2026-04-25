// GM 后台 API · Netlify 无服务器函数
// 环境变量（在 Netlify Dashboard → Site Settings → Environment Variables 里设置）：
//   SUPABASE_URL         ← Supabase 项目 URL
//   SUPABASE_SERVICE_KEY ← Supabase service_role key（保密，绝不放前端）
//   GM_PASSWORD          ← GM 后台密码（你自己定）

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const GM_PASSWORD          = process.env.GM_PASSWORD;

const BASE_HEADERS = {
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

function rest(path, options = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: { ...BASE_HEADERS, ...(options.headers || {}) },
  });
}

function ok(body) {
  return { statusCode: 200, body: JSON.stringify(body) };
}

function err(msg, status = 400) {
  return { statusCode: status, body: JSON.stringify({ error: msg }) };
}

function makeMail(mail, suffix = '') {
  return {
    id: `mail_${Date.now()}_${Math.random().toString(16).slice(2)}${suffix}`,
    from: mail.from || 'GM 后台',
    subject: mail.subject || '系统邮件',
    body: mail.body || '',
    attachments: Array.isArray(mail.attachments) ? mail.attachments : [],
    createdAt: Date.now(),
    claimed: false,
    claimedAt: null,
  };
}

function defaultSave() {
  return {
    bananaCount: 0, totalBananasEarned: 0, totalClicks: 0,
    productionRate: 0,
    buildingCounts: new Array(20).fill(0),
    mails: [], unreadMailCount: 0,
    selectedBananaStyle: 0,
    lastSaveTime: Date.now(), lastLoginTime: Date.now(),
  };
}

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, body: '' };
  }
  if (event.httpMethod !== 'POST') return err('Method Not Allowed', 405);

  let body;
  try { body = JSON.parse(event.body); }
  catch { return err('请求格式错误'); }

  const { action, password, ...params } = body;

  if (!GM_PASSWORD || password !== GM_PASSWORD) return err('GM 密码错误', 401);

  try {
    // ── 获取玩家列表 ──────────────────────────────
    if (action === 'list_players') {
      const [pRes, sRes] = await Promise.all([
        rest('/profiles?select=id,username,created_at&order=created_at.desc'),
        rest('/game_saves?select=user_id,save_data,updated_at'),
      ]);
      const profiles = await pRes.json();
      const saves    = await sRes.json();
      if (!Array.isArray(profiles)) return err('读取玩家列表失败', 500);

      const saveMap = {};
      if (Array.isArray(saves)) saves.forEach(s => { saveMap[s.user_id] = s; });

      const players = profiles.map(p => {
        const row  = saveMap[p.id];
        const save = row?.save_data || {};
        const monkeys = Array.isArray(save.monkeys) ? save.monkeys.filter(Boolean) : [];
        return {
          userId: p.id, username: p.username, createdAt: p.created_at,
          updatedAt: row?.updated_at,
          bananaCount: save.bananaCount || 0,
          totalBananasEarned: save.totalBananasEarned || 0,
          productionRate: save.productionRate || 0,
          totalClicks: save.totalClicks || 0,
          totalMerges: save.totalMerges || 0,
          monkeyCount: monkeys.length,
          monkeys: save.monkeys || [],
          unreadMailCount: save.unreadMailCount || 0,
          upgrades: save.upgrades || {},
        };
      });
      return ok({ success: true, players });
    }

    // ── 查看单个玩家 ──────────────────────────────
    if (action === 'get_player') {
      const { userId } = params;
      const [pRes, sRes] = await Promise.all([
        rest(`/profiles?id=eq.${userId}&select=*`),
        rest(`/game_saves?user_id=eq.${userId}&select=*`),
      ]);
      const profiles = await pRes.json();
      const saves    = await sRes.json();
      if (!profiles[0]) return err('玩家不存在', 404);
      return ok({ success: true, profile: profiles[0], save: saves[0]?.save_data || {} });
    }

    // ── 发送邮件（指定玩家）──────────────────────
    if (action === 'send_mail') {
      const { userId, mail } = params;
      const sRes = await rest(`/game_saves?user_id=eq.${userId}&select=save_data`);
      const saves = await sRes.json();
      const save  = (saves[0]?.save_data) || {};

      const mails = Array.isArray(save.mails) ? save.mails : [];
      mails.unshift(makeMail(mail));
      if (mails.length > 50) mails.pop();
      save.mails = mails;
      save.unreadMailCount = mails.filter(m => !m.claimed).length;

      const upRes = await rest(`/game_saves?user_id=eq.${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ save_data: save, updated_at: new Date().toISOString() }),
      });
      if (!upRes.ok) return err('写入存档失败', 500);
      return ok({ success: true });
    }

    // ── 群发邮件 ──────────────────────────────────
    if (action === 'send_mail_all') {
      const { mail } = params;
      const [pRes, sRes] = await Promise.all([
        rest('/profiles?select=id'),
        rest('/game_saves?select=user_id,save_data'),
      ]);
      const profiles = await pRes.json();
      const saves    = await sRes.json();
      if (!Array.isArray(profiles)) return err('读取玩家列表失败', 500);

      const saveMap = {};
      if (Array.isArray(saves)) saves.forEach(s => { saveMap[s.user_id] = s.save_data; });

      let sent = 0;
      await Promise.all(profiles.map(async p => {
        const save  = saveMap[p.id] || {};
        const mails = Array.isArray(save.mails) ? save.mails : [];
        mails.unshift(makeMail(mail, `_${p.id.slice(0, 6)}`));
        if (mails.length > 50) mails.pop();
        save.mails = mails;
        save.unreadMailCount = mails.filter(m => !m.claimed).length;
        const r = await rest(`/game_saves?user_id=eq.${p.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ save_data: save, updated_at: new Date().toISOString() }),
        });
        if (r.ok) sent++;
      }));
      return ok({ success: true, sent });
    }

    // ── 删除玩家 ──────────────────────────────────
    if (action === 'delete_player') {
      const { userId } = params;
      const delRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
      });
      if (!delRes.ok) {
        const msg = await delRes.text();
        return err(`删除失败: ${msg}`, 500);
      }
      return ok({ success: true });
    }

    // ── 重置玩家进度 ──────────────────────────────
    if (action === 'reset_player') {
      const { userId } = params;
      const r = await rest(`/game_saves?user_id=eq.${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ save_data: defaultSave(), updated_at: new Date().toISOString() }),
      });
      if (!r.ok) return err('重置失败', 500);
      return ok({ success: true });
    }

    return err('未知操作');
  } catch (e) {
    return err(e.message, 500);
  }
};
