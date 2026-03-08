import { connect } from './network.js';

let onPlayCallback = null;

export function initUI(onPlay) {
  onPlayCallback = onPlay;

  const overlay = document.getElementById('login-overlay');
  const input = document.getElementById('username-input');
  const btn = document.getElementById('play-btn');

  function submit() {
    const raw = input.value.trim();
    const username = raw || `Guest_${Math.floor(1000 + Math.random() * 9000)}`;

    overlay.style.display = 'none';
    document.getElementById('score-hud').style.display = 'block';
    document.getElementById('lives-hud').style.display = 'block';
    document.getElementById('level-hud').style.display = 'block';
    document.getElementById('powerups-hud').style.display = 'block';
    document.getElementById('leaderboard').style.display = 'block';
    document.getElementById('controls-hint').style.display = 'block';
    document.getElementById('ap-hud').style.display = 'block';

    connect(username);
    if (onPlayCallback) onPlayCallback(username);
  }

  btn.addEventListener('click', submit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit();
  });
}

export function updateLeaderboard(top10, myUsername) {
  const list = document.getElementById('lb-list');
  list.innerHTML = '';

  for (const entry of top10) {
    const li = document.createElement('li');
    if (entry.username === myUsername) li.classList.add('me');

    const name = document.createElement('span');
    name.className = 'lb-name';
    name.textContent = entry.username;

    const score = document.createElement('span');
    score.className = 'lb-score';
    score.textContent = entry.score.toLocaleString();

    li.appendChild(name);
    li.appendChild(score);
    list.appendChild(li);
  }
}

export function updateScoreHUD(score) {
  document.getElementById('score-value').textContent = score.toLocaleString();
}

export function updateLivesHUD(lives) {
  const el = document.getElementById('lives-hud');
  const hearts = lives > 0 ? '\u2764'.repeat(Math.min(lives, 10)) : '';
  document.getElementById('lives-value').textContent = hearts || 'DEAD';

  el.classList.remove('damage');
  void el.offsetWidth;
  el.classList.add('damage');
}

export function updateLevelHUD(level) {
  const levelValue = document.getElementById('level-value');
  if (levelValue) levelValue.textContent = String(level);
}

export function updateLevelTimer(secondsRemaining) {
  const el = document.getElementById('level-timer-value');
  if (!el) return;
  const mins = Math.floor(secondsRemaining / 60);
  const secs = Math.floor(secondsRemaining % 60);
  el.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function showBossWarning() {
  const el = document.getElementById('boss-warning');
  if (el) el.style.display = 'block';
}

export function hideBossWarning() {
  const el = document.getElementById('boss-warning');
  if (el) el.style.display = 'none';
}

export function showLevelComplete(level, callback) {
  const overlay = document.getElementById('level-complete-overlay');
  const title = document.getElementById('level-complete-title');
  if (title) title.textContent = `LEVEL ${level} COMPLETE!`;
  if (overlay) overlay.style.display = 'flex';

  setTimeout(() => {
    if (overlay) overlay.style.display = 'none';
    if (callback) callback();
  }, 2000);
}

export function updatePowerupsHUD(powerups) {
  const list = document.getElementById('powerups-list');
  if (!list) return;
  list.innerHTML = '';

  if (!powerups || powerups.length === 0) {
    const li = document.createElement('li');
    li.className = 'powerup-empty';
    li.textContent = 'No active power-ups';
    list.appendChild(li);
    return;
  }

  for (const powerup of powerups) {
    const li = document.createElement('li');
    li.className = 'powerup-item';

    const label = document.createElement('span');
    label.className = 'powerup-label';
    label.textContent = powerup.label;

    li.appendChild(label);

    if (powerup.msRemaining >= 0) {
      const timer = document.createElement('span');
      timer.className = 'powerup-timer';
      timer.textContent = `${(powerup.msRemaining / 1000).toFixed(1)}s`;
      li.appendChild(timer);
    } else {
      const badge = document.createElement('span');
      badge.className = 'powerup-timer';
      badge.textContent = '▲ / W';
      li.appendChild(badge);
    }

    list.appendChild(li);
  }
}

export function showShop(score, items, onBuy) {
  const overlay = document.getElementById('shop-overlay');
  const scoreDisplay = document.getElementById('shop-score-display');
  const container = document.getElementById('shop-items');

  scoreDisplay.textContent = `Score: ${score.toLocaleString()}`;
  container.innerHTML = '';

  for (const item of items) {
    const row = document.createElement('div');
    row.className = 'shop-item';
    if (score < item.cost) row.classList.add('shop-item-disabled');

    const name = document.createElement('span');
    name.className = 'shop-item-name';
    name.textContent = item.label;

    const cost = document.createElement('span');
    cost.className = 'shop-item-cost';
    cost.textContent = `${item.cost} pts`;

    row.appendChild(name);
    row.appendChild(cost);

    if (score >= item.cost) {
      row.addEventListener('click', () => onBuy(item.id));
    }

    container.appendChild(row);
  }

  overlay.style.display = 'flex';
}

export function hideShop() {
  const overlay = document.getElementById('shop-overlay');
  if (overlay) overlay.style.display = 'none';
}

export function showGameOver(finalScore, onRetry) {
  const overlay = document.getElementById('gameover-overlay');
  overlay.style.display = 'flex';
  document.getElementById('gameover-score').textContent = `Final Score: ${finalScore.toLocaleString()}`;

  const retryBtn = document.getElementById('retry-btn');
  const handler = () => {
    retryBtn.removeEventListener('click', handler);
    overlay.style.display = 'none';
    if (onRetry) onRetry();
  };
  retryBtn.addEventListener('click', handler);
}

// ── AP HUD ────────────────────────────────────────────────

export function updateAPHUD(ap) {
  const el = document.getElementById('ap-value');
  if (el) el.textContent = ap.toLocaleString();
}

// ── Ability Shop Overlay ──────────────────────────────────

export function showAbilityShop(ap, earnedAP, shopItems, onBuy, onUpgrade, onContinue) {
  const overlay = document.getElementById('ability-shop-overlay');
  const apDisplay = document.getElementById('ability-shop-ap-display');
  const earnedEl = document.getElementById('ability-shop-earned');
  const container = document.getElementById('ability-shop-items');
  const continueBtn = document.getElementById('ability-shop-continue');

  apDisplay.textContent = `AP: ${ap.toLocaleString()}`;
  earnedEl.textContent = earnedAP > 0 ? `+${earnedAP.toLocaleString()} AP earned!` : '';
  container.innerHTML = '';

  for (const item of shopItems) {
    const row = document.createElement('div');
    row.className = 'ability-shop-row' + (item.owned ? ' owned' : '');

    const dot = document.createElement('div');
    dot.className = 'ability-shop-dot';
    dot.style.background = item.color;
    row.appendChild(dot);

    const info = document.createElement('div');
    info.className = 'ability-shop-info';

    const name = document.createElement('span');
    name.className = 'ability-shop-name';
    name.textContent = item.label;
    info.appendChild(name);

    const detail = document.createElement('span');
    detail.className = 'ability-shop-detail';
    if (item.owned) {
      detail.textContent = `Lvl ${item.upgradeLevel}/${item.maxUpgradeLevel} · CD: ${item.cooldownSec}s`;
    } else {
      detail.textContent = `Cost: ${item.purchaseCost} AP`;
    }
    info.appendChild(detail);
    row.appendChild(info);

    if (!item.owned) {
      const buyBtn = document.createElement('button');
      buyBtn.className = 'ability-shop-btn';
      buyBtn.textContent = `Buy ${item.purchaseCost}`;
      buyBtn.disabled = !item.canBuy;
      buyBtn.addEventListener('click', () => {
        onBuy(item.id);
      });
      row.appendChild(buyBtn);
    } else if (item.maxed) {
      const maxLabel = document.createElement('span');
      maxLabel.className = 'ability-shop-maxed';
      maxLabel.textContent = 'MAX';
      row.appendChild(maxLabel);
    } else {
      const upgradeBtn = document.createElement('button');
      upgradeBtn.className = 'ability-shop-btn';
      upgradeBtn.textContent = `Upgrade ${item.upgradeCost}`;
      upgradeBtn.disabled = !item.canUpgrade;
      upgradeBtn.addEventListener('click', () => {
        onUpgrade(item.id);
      });
      row.appendChild(upgradeBtn);
    }

    container.appendChild(row);
  }

  const newContinueBtn = continueBtn.cloneNode(true);
  continueBtn.parentNode.replaceChild(newContinueBtn, continueBtn);
  newContinueBtn.addEventListener('click', () => {
    overlay.style.display = 'none';
    if (onContinue) onContinue();
  });

  overlay.style.display = 'flex';
}

export function hideAbilityShop() {
  const overlay = document.getElementById('ability-shop-overlay');
  if (overlay) overlay.style.display = 'none';
}

export function refreshAbilityShop(ap, shopItems, onBuy, onUpgrade) {
  const apDisplay = document.getElementById('ability-shop-ap-display');
  const container = document.getElementById('ability-shop-items');

  if (apDisplay) apDisplay.textContent = `AP: ${ap.toLocaleString()}`;
  if (!container) return;

  container.innerHTML = '';
  for (const item of shopItems) {
    const row = document.createElement('div');
    row.className = 'ability-shop-row' + (item.owned ? ' owned' : '');

    const dot = document.createElement('div');
    dot.className = 'ability-shop-dot';
    dot.style.background = item.color;
    row.appendChild(dot);

    const info = document.createElement('div');
    info.className = 'ability-shop-info';

    const name = document.createElement('span');
    name.className = 'ability-shop-name';
    name.textContent = item.label;
    info.appendChild(name);

    const detail = document.createElement('span');
    detail.className = 'ability-shop-detail';
    if (item.owned) {
      detail.textContent = `Lvl ${item.upgradeLevel}/${item.maxUpgradeLevel} · CD: ${item.cooldownSec}s`;
    } else {
      detail.textContent = `Cost: ${item.purchaseCost} AP`;
    }
    info.appendChild(detail);
    row.appendChild(info);

    if (!item.owned) {
      const buyBtn = document.createElement('button');
      buyBtn.className = 'ability-shop-btn';
      buyBtn.textContent = `Buy ${item.purchaseCost}`;
      buyBtn.disabled = !item.canBuy;
      buyBtn.addEventListener('click', () => {
        onBuy(item.id);
      });
      row.appendChild(buyBtn);
    } else if (item.maxed) {
      const maxLabel = document.createElement('span');
      maxLabel.className = 'ability-shop-maxed';
      maxLabel.textContent = 'MAX';
      row.appendChild(maxLabel);
    } else {
      const upgradeBtn = document.createElement('button');
      upgradeBtn.className = 'ability-shop-btn';
      upgradeBtn.textContent = `Upgrade ${item.upgradeCost}`;
      upgradeBtn.disabled = !item.canUpgrade;
      upgradeBtn.addEventListener('click', () => {
        onUpgrade(item.id);
      });
      row.appendChild(upgradeBtn);
    }

    container.appendChild(row);
  }
}

// ── Spacebar Abilities Menu ───────────────────────────────

export function showAbilitiesMenu(menuItems, onActivate, onUseAll, onClose) {
  const overlay = document.getElementById('abilities-menu-overlay');
  const container = document.getElementById('abilities-menu-items');
  const useAllBtn = document.getElementById('abilities-use-all-btn');
  const closeBtn = document.getElementById('abilities-close-btn');

  container.innerHTML = '';

  for (const item of menuItems) {
    const row = document.createElement('div');
    row.className = 'ability-menu-row' + (item.onCooldown ? ' ability-on-cooldown' : '');

    const key = document.createElement('div');
    key.className = 'ability-menu-key';
    key.textContent = String(item.index);
    row.appendChild(key);

    const dot = document.createElement('div');
    dot.className = 'ability-menu-dot';
    dot.style.background = item.color;
    row.appendChild(dot);

    const label = document.createElement('span');
    label.className = 'ability-menu-label';
    label.textContent = item.label;
    row.appendChild(label);

    if (item.onCooldown) {
      const cd = document.createElement('span');
      cd.className = 'ability-menu-cd';
      cd.textContent = `${item.remainingCooldown}s`;
      row.appendChild(cd);
    } else {
      const ready = document.createElement('span');
      ready.className = 'ability-menu-ready';
      ready.textContent = 'READY';
      row.appendChild(ready);
    }

    if (!item.onCooldown) {
      row.addEventListener('click', () => onActivate(item.id));
    }

    container.appendChild(row);
  }

  const newUseAll = useAllBtn.cloneNode(true);
  useAllBtn.parentNode.replaceChild(newUseAll, useAllBtn);
  newUseAll.addEventListener('click', () => onUseAll());

  const newClose = closeBtn.cloneNode(true);
  closeBtn.parentNode.replaceChild(newClose, closeBtn);
  newClose.addEventListener('click', () => onClose());

  overlay.style.display = 'flex';
}

export function hideAbilitiesMenu() {
  const overlay = document.getElementById('abilities-menu-overlay');
  if (overlay) overlay.style.display = 'none';
}
