import {
  activateRapidFire,
  addPiercingAmmo,
  activateDoubleShotBonus,
  activateTripleShotBonus,
  activateWideCannon,
  activateExplosiveShots,
} from './cannon.js';

const AP_LEVEL_RATE = 0.10;
const AP_GAMEOVER_RATE = 0.05;

export const ABILITY_DEFS = [
  {
    id: 'rapid',
    label: 'Rapid Fire',
    color: '#4dd6ff',
    purchaseCost: 500,
    baseCooldownSec: 90,
    cooldownReductionPerLevel: 10,
    maxUpgradeLevel: 5,
    baseUpgradeCost: 300,
    durationMs: 12000,
    activate() { activateRapidFire(this.durationMs); },
  },
  {
    id: 'double',
    label: 'Double Shot',
    color: '#ffcc44',
    purchaseCost: 600,
    baseCooldownSec: 100,
    cooldownReductionPerLevel: 12,
    maxUpgradeLevel: 5,
    baseUpgradeCost: 350,
    durationMs: 13000,
    activate() { activateDoubleShotBonus(this.durationMs); },
  },
  {
    id: 'triple',
    label: 'Triple Shot',
    color: '#ff44aa',
    purchaseCost: 800,
    baseCooldownSec: 120,
    cooldownReductionPerLevel: 15,
    maxUpgradeLevel: 5,
    baseUpgradeCost: 500,
    durationMs: 10500,
    activate() { activateTripleShotBonus(this.durationMs); },
  },
  {
    id: 'pierce',
    label: 'Piercing x3',
    color: '#00ffcc',
    purchaseCost: 700,
    baseCooldownSec: 90,
    cooldownReductionPerLevel: 10,
    maxUpgradeLevel: 5,
    baseUpgradeCost: 400,
    durationMs: 0,
    activate() { addPiercingAmmo(3); },
  },
  {
    id: 'wide',
    label: 'Wide Cannon',
    color: '#44ff88',
    purchaseCost: 900,
    baseCooldownSec: 120,
    cooldownReductionPerLevel: 15,
    maxUpgradeLevel: 5,
    baseUpgradeCost: 550,
    durationMs: 12000,
    activate() { activateWideCannon(this.durationMs); },
  },
  {
    id: 'explosive',
    label: 'Explosive Shots',
    color: '#ff6600',
    purchaseCost: 850,
    baseCooldownSec: 110,
    cooldownReductionPerLevel: 12,
    maxUpgradeLevel: 5,
    baseUpgradeCost: 500,
    durationMs: 12000,
    activate() { activateExplosiveShots(this.durationMs); },
  },
  {
    id: 'life',
    label: 'Extra Life',
    color: '#e94560',
    purchaseCost: 1000,
    baseCooldownSec: 180,
    cooldownReductionPerLevel: 20,
    maxUpgradeLevel: 5,
    baseUpgradeCost: 600,
    durationMs: 0,
    activate: null,
  },
];

let abilityPoints = 0;

let ownedAbilities = {};

let cooldownTimers = {};

export function getAbilityPoints() {
  return abilityPoints;
}

export function setAbilityPoints(ap) {
  abilityPoints = Math.max(0, Math.floor(ap));
}

export function loadAbilityData(data) {
  abilityPoints = data.abilityPoints || 0;
  ownedAbilities = {};
  cooldownTimers = {};
  if (data.abilities) {
    for (const [id, info] of Object.entries(data.abilities)) {
      if (info.owned) {
        ownedAbilities[id] = { upgradeLevel: info.upgradeLevel || 0 };
      }
    }
  }
}

export function getOwnedAbilities() {
  return ownedAbilities;
}

export function isOwned(id) {
  return !!ownedAbilities[id];
}

export function hasAnyAbilities() {
  return Object.keys(ownedAbilities).length > 0;
}

export function getUpgradeLevel(id) {
  return ownedAbilities[id]?.upgradeLevel ?? 0;
}

export function getEffectiveCooldown(id) {
  const def = ABILITY_DEFS.find(d => d.id === id);
  if (!def) return 0;
  const level = getUpgradeLevel(id);
  return Math.max(10, def.baseCooldownSec - level * def.cooldownReductionPerLevel);
}

export function getUpgradeCost(id) {
  const def = ABILITY_DEFS.find(d => d.id === id);
  if (!def) return Infinity;
  const level = getUpgradeLevel(id);
  if (level >= def.maxUpgradeLevel) return Infinity;
  return Math.floor(def.baseUpgradeCost * (1 + level * 0.5));
}

export function markPurchased(id) {
  const def = ABILITY_DEFS.find(d => d.id === id);
  if (!def) return false;
  if (ownedAbilities[id]) return false;
  if (abilityPoints < def.purchaseCost) return false;
  abilityPoints -= def.purchaseCost;
  ownedAbilities[id] = { upgradeLevel: 0 };
  return true;
}

export function markUpgraded(id) {
  if (!ownedAbilities[id]) return false;
  const cost = getUpgradeCost(id);
  if (abilityPoints < cost) return false;
  const def = ABILITY_DEFS.find(d => d.id === id);
  if (ownedAbilities[id].upgradeLevel >= def.maxUpgradeLevel) return false;
  abilityPoints -= cost;
  ownedAbilities[id].upgradeLevel++;
  return true;
}

export function isOnCooldown(id) {
  const usedAt = cooldownTimers[id];
  if (!usedAt) return false;
  const cdMs = getEffectiveCooldown(id) * 1000;
  return (performance.now() - usedAt) < cdMs;
}

export function getRemainingCooldown(id) {
  const usedAt = cooldownTimers[id];
  if (!usedAt) return 0;
  const cdMs = getEffectiveCooldown(id) * 1000;
  return Math.max(0, cdMs - (performance.now() - usedAt)) / 1000;
}

export function activateAbility(id, addLifeFn) {
  if (!ownedAbilities[id]) return false;
  if (isOnCooldown(id)) return false;

  const def = ABILITY_DEFS.find(d => d.id === id);
  if (!def) return false;

  if (id === 'life') {
    if (addLifeFn) addLifeFn();
  } else {
    def.activate();
  }

  cooldownTimers[id] = performance.now();
  return true;
}

export function activateAllReady(addLifeFn) {
  const activated = [];
  for (const id of Object.keys(ownedAbilities)) {
    if (!isOnCooldown(id)) {
      if (activateAbility(id, addLifeFn)) {
        activated.push(id);
      }
    }
  }
  return activated;
}

export function resetCooldowns() {
  cooldownTimers = {};
}

export function calculateLevelAP(currentScore) {
  return Math.floor(currentScore * AP_LEVEL_RATE);
}

export function calculateGameOverAP(finalScore) {
  return Math.floor(finalScore * AP_GAMEOVER_RATE);
}

export function awardAP(amount) {
  abilityPoints += Math.max(0, Math.floor(amount));
}

export function getAbilityMenuItems() {
  const owned = Object.keys(ownedAbilities);
  return owned.map((id, index) => {
    const def = ABILITY_DEFS.find(d => d.id === id);
    return {
      id,
      index: index + 1,
      label: def.label,
      color: def.color,
      onCooldown: isOnCooldown(id),
      remainingCooldown: Math.ceil(getRemainingCooldown(id)),
      upgradeLevel: ownedAbilities[id].upgradeLevel,
    };
  });
}

export function getShopItems() {
  return ABILITY_DEFS.map(def => {
    const owned = isOwned(def.id);
    const level = getUpgradeLevel(def.id);
    const maxed = level >= def.maxUpgradeLevel;
    return {
      id: def.id,
      label: def.label,
      color: def.color,
      owned,
      upgradeLevel: level,
      maxUpgradeLevel: def.maxUpgradeLevel,
      purchaseCost: def.purchaseCost,
      upgradeCost: maxed ? null : getUpgradeCost(def.id),
      cooldownSec: getEffectiveCooldown(def.id),
      maxed,
      canBuy: !owned && abilityPoints >= def.purchaseCost,
      canUpgrade: owned && !maxed && abilityPoints >= getUpgradeCost(def.id),
    };
  });
}

export function serializeForServer() {
  const abilities = {};
  for (const def of ABILITY_DEFS) {
    abilities[def.id] = {
      owned: !!ownedAbilities[def.id],
      upgradeLevel: ownedAbilities[def.id]?.upgradeLevel || 0,
    };
  }
  return { abilityPoints, abilities };
}
