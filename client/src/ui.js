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
  const hearts = lives > 0 ? '\u2764'.repeat(Math.min(lives, 20)) : '';
  document.getElementById('lives-value').textContent = hearts || 'DEAD';

  el.classList.remove('damage');
  void el.offsetWidth;
  el.classList.add('damage');
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
