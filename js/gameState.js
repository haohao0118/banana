// 游戏运行时状态
const gameState = {
  isAuthenticated: false,
  currentUser: '',
  currentUserId: '',
  isGMAuthenticated: false,

  bananaCount: 0,
  totalBananasEarned: 0,
  totalClicks: 0,
  productionRate: 0,

  // Cookie Clicker 风格建筑数量（20种，对应 CONFIG.buildings 索引）
  buildingCounts: new Array(20).fill(0),
  // 永久解锁标志（index 0/1 默认可见，其余需达到 basePrice×10% 才显示）
  buildingUnlocked: new Array(20).fill(false).map((_, i) => i < 2),

  mails: [],
  unreadMailCount: 0,

  upgradePurchased: {},

  selectedBananaStyle: 0,
  lastSaveTime:  Date.now(),
  lastLoginTime: Date.now(),
};
