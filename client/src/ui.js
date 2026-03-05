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
    document.getElementById('leaderboard').style.display = 'block';

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
