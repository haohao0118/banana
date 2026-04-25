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
  gameState.productionRate = total;
}

// ─── 点击 ──────────────────────────────────────────

function getClickValue() {
  return 1;
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
