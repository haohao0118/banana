// 核心游戏逻辑

// ─── 建筑系统 ──────────────────────────────────────

function getBuildingPrice(index) {
  const b     = CONFIG.buildings[index];
  const owned = gameState.buildingCounts[index] || 0;
  return Math.ceil(b.basePrice * Math.pow(CONFIG.buildingPriceGrowth, owned));
}

function getBuildingTotalCPS(index) {
  return CONFIG.buildings[index].baseCPS * (gameState.buildingCounts[index] || 0);
}

function buyBuilding(index) {
  const price = getBuildingPrice(index);
  if (gameState.bananaCount < price) return false;
  gameState.bananaCount -= price;
  gameState.buildingCounts[index] = (gameState.buildingCounts[index] || 0) + 1;
  recalcProductionRate();
  return true;
}

function recalcProductionRate() {
  let total = 0;
  CONFIG.buildings.forEach((b, i) => {
    total += b.baseCPS * (gameState.buildingCounts[i] || 0);
  });
  let mult = 1;
  CONFIG.upgrades.forEach(u => {
    if (gameState.upgradePurchased[u.id] && u.effect.type === 'cps_mult') {
      mult *= u.effect.value;
    }
  });
  gameState.productionRate = total * mult;
}

function buyUpgrade(id) {
  const u = CONFIG.upgrades.find(u => u.id === id);
  if (!u || gameState.upgradePurchased[id]) return false;
  if (gameState.bananaCount < u.cost) return false;
  if (gameState.totalBananasEarned < u.unlockAt) return false;
  gameState.bananaCount -= u.cost;
  gameState.upgradePurchased[id] = true;
  recalcProductionRate();
  return true;
}

// ─── 点击 ──────────────────────────────────────────

function getClickValue() {
  let val = CONFIG.baseClickValue;
  CONFIG.upgrades.forEach(u => {
    if (gameState.upgradePurchased[u.id] && u.effect.type === 'click_mult') {
      val *= u.effect.value;
    }
  });
  return val;
}

function processBananaClick() {
  const val = getClickValue();
  gameState.bananaCount        += val;
  gameState.totalBananasEarned += val;
  gameState.totalClicks++;
  return { value: val, isCrit: false };
}

// ─── 生产循环 ─────────────────────────────────────

function gameTick(deltaSeconds) {
  if (gameState.productionRate > 0) {
    const earned = gameState.productionRate * deltaSeconds;
    gameState.bananaCount        += earned;
    gameState.totalBananasEarned += earned;
  }
}

// ─── 离线收益 ─────────────────────────────────────

function calculateOfflineEarnings() {
  const elapsed = (Date.now() - (gameState.lastLoginTime || Date.now())) / 1000;
  if (elapsed < 10) return 0;
  const offlineSec = Math.min(elapsed, 7200);
  if (gameState.productionRate <= 0) return 0;
  return Math.floor(gameState.productionRate * offlineSec * 0.5);
}
