const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

const PORT = process.env.PORT || 3000;
const LEADERBOARD_INTERVAL_MS = 2000;
const HISTORY_PATH = path.join(__dirname, 'leaderboard-history.json');
const MAX_HISTORY_ENTRIES = 5000;

let players = [];
let gameHistory = [];
let saveTimer = null;

loadHistory();

app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    game: 'Horde Havoc',
    activePlayers: players.length,
    totalGamesRecorded: gameHistory.length,
  });
});

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on('join', ({ username }) => {
    const name = (username || '').trim() || `Guest_${Math.floor(1000 + Math.random() * 9000)}`;

    players = players.filter((p) => p.socketId !== socket.id);
    players.push({
      username: name,
      score: 0,
      socketId: socket.id,
      startedAt: Date.now(),
    });

    console.log(`${name} joined (${socket.id}). Players online: ${players.length}`);
    socket.emit('joined', { username: name });
  });

  socket.on('scoreUpdate', ({ score }) => {
    const player = players.find((p) => p.socketId === socket.id);
    if (player && typeof score === 'number' && score >= 0) {
      player.score = score;
    }
  });

  socket.on('disconnect', () => {
    const player = players.find((p) => p.socketId === socket.id);
    if (player) {
      recordFinishedGame(player);
    }
    players = players.filter((p) => p.socketId !== socket.id);
    console.log(
      `${player?.username ?? 'Unknown'} disconnected. Players online: ${players.length}`
    );
  });
});

setInterval(() => {
  const historicalTop = [...gameHistory];
  const liveTop = players.map(({ username, score, startedAt }) => ({
    username,
    score,
    endedAt: null,
    startedAt,
    live: true,
  }));

  const top10 = [...historicalTop, ...liveTop]
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(({ username, score }) => ({ username, score }));

  io.emit('leaderboard', top10);
}, LEADERBOARD_INTERVAL_MS);

httpServer.listen(PORT, () => {
  console.log(`Horde Havoc server listening on port ${PORT}`);
});

function recordFinishedGame(player) {
  const record = {
    username: player.username,
    score: player.score,
    startedAt: player.startedAt || Date.now(),
    endedAt: Date.now(),
  };
  gameHistory.push(record);
  if (gameHistory.length > MAX_HISTORY_ENTRIES) {
    gameHistory = gameHistory.slice(gameHistory.length - MAX_HISTORY_ENTRIES);
  }
  scheduleHistorySave();
}

function loadHistory() {
  try {
    if (!fs.existsSync(HISTORY_PATH)) return;
    const raw = fs.readFileSync(HISTORY_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      gameHistory = parsed;
      return;
    }
    if (parsed && Array.isArray(parsed.games)) {
      gameHistory = parsed.games;
    }
  } catch (err) {
    console.error('Failed to load leaderboard history:', err.message);
    gameHistory = [];
  }
}

function scheduleHistorySave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveHistory();
  }, 250);
}

function saveHistory() {
  try {
    const payload = {
      savedAt: new Date().toISOString(),
      games: gameHistory,
    };
    fs.writeFileSync(HISTORY_PATH, JSON.stringify(payload, null, 2));
  } catch (err) {
    console.error('Failed to persist leaderboard history:', err.message);
  }
}
