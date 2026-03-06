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

    const timer = document.createElement('span');
    timer.className = 'powerup-timer';
    timer.textContent = `${(powerup.msRemaining / 1000).toFixed(1)}s`;

    li.appendChild(label);
    li.appendChild(timer);
    list.appendChild(li);
  }
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
