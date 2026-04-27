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
  const n = CONFIG.buildings.length;
  const bMult     = new Array(n).fill(1); // per-building multiplier
  const synMult   = new Array(n).fill(1); // synergy multiplier
  const counts    = gameState.buildingCounts;
  let   globalMult = 1;

  CONFIG.upgrades.forEach(u => {
    if (!gameState.upgradePurchased[u.id]) return;
    const ef = u.effect;
    if (ef.type === 'cps_mult') {
      globalMult *= ef.value;
    } else if (ef.type === 'building_cps_mult') {
      const i = CONFIG.buildings.findIndex(b => b.id === ef.buildingId);
      if (i >= 0) bMult[i] *= ef.value;
    } else if (ef.type === 'synergy') {
      const ia = CONFIG.buildings.findIndex(b => b.id === ef.a);
      const ib = CONFIG.buildings.findIndex(b => b.id === ef.b);
      if (ia >= 0 && ib >= 0) {
        synMult[ia] *= (1 + (counts[ib] || 0) * ef.pct);
        synMult[ib] *= (1 + (counts[ia] || 0) * ef.pct);
      }
    } else if (ef.type === 'grandma_variant') {
      const ig = CONFIG.buildings.findIndex(b => b.id === 'grandma');
      const il = CONFIG.buildings.findIndex(b => b.id === ef.buildingId);
      if (ig >= 0) bMult[ig] *= ef.grandmaBoost;
      if (il >= 0) synMult[il] *= (1 + (counts[ig] || 0) * ef.linkedBoost);
    }
  });

  let total = 0;
  CONFIG.buildings.forEach((b, i) => {
    total += b.baseCPS * (counts[i] || 0) * bMult[i] * synMult[i];
  });
  gameState.productionRate = total * globalMult;
}

function buyUpgrade(id) {
  const u = CONFIG.upgrades.find(u => u.id === id);
  if (!u || gameState.upgradePurchased[id]) return false;
  if (gameState.bananaCount < u.cost) return false;
  // check unlock condition
  if (u.unlockBuilding) {
    const ia = CONFIG.buildings.findIndex(b => b.id === u.unlockBuilding.id);
    if (ia < 0 || (gameState.buildingCounts[ia] || 0) < u.unlockBuilding.count) return false;
    if (u.unlockBuilding.id2) {
      const ib = CONFIG.buildings.findIndex(b => b.id === u.unlockBuilding.id2);
      if (ib < 0 || (gameState.buildingCounts[ib] || 0) < (u.unlockBuilding.count2 || 1)) return false;
    }
  } else if (gameState.totalBananasEarned < (u.unlockAt || 0)) {
    return false;
  }
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
