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
const PLAYER_DATA_PATH = path.join(__dirname, 'player-data.json');

let players = [];

function loadPlayerData() {
  try {
    if (fs.existsSync(PLAYER_DATA_PATH)) {
      return JSON.parse(fs.readFileSync(PLAYER_DATA_PATH, 'utf-8'));
    }
  } catch (err) {
    console.error('Failed to load player data:', err.message);
  }
  return {};
}

function savePlayerData(data) {
  try {
    fs.writeFileSync(PLAYER_DATA_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save player data:', err.message);
  }
}

let allPlayerData = loadPlayerData();

function getPlayerRecord(username) {
  if (!allPlayerData[username]) {
    allPlayerData[username] = { abilityPoints: 0, abilities: {} };
  }
  return allPlayerData[username];
}

const VALID_ABILITY_IDS = ['rapid', 'double', 'triple', 'pierce', 'wide', 'explosive', 'life'];
const ABILITY_COSTS = {
  rapid: 500, double: 600, triple: 800, pierce: 700,
  wide: 900, explosive: 850, life: 1000,
};
const BASE_UPGRADE_COSTS = {
  rapid: 300, double: 350, triple: 500, pierce: 400,
  wide: 550, explosive: 500, life: 600,
};
const MAX_UPGRADE_LEVEL = 5;

app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    game: 'Horde Havoc',
    activePlayers: players.length,
  });
});

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  let currentUsername = null;

  socket.on('join', ({ username }) => {
    const name = (username || '').trim() || `Guest_${Math.floor(1000 + Math.random() * 9000)}`;
    currentUsername = name;

    players = players.filter((p) => p.socketId !== socket.id);
    players.push({
      username: name,
      score: 0,
      socketId: socket.id,
      bestScore: 0,
    });

    console.log(`${name} joined (${socket.id}). Players online: ${players.length}`);
    socket.emit('joined', { username: name });

    const record = getPlayerRecord(name);
    socket.emit('abilityData', {
      abilityPoints: record.abilityPoints,
      abilities: record.abilities,
    });
  });

  socket.on('scoreUpdate', ({ score }) => {
    const player = players.find((p) => p.socketId === socket.id);
    if (player && typeof score === 'number' && score >= 0) {
      player.score = score;
      player.bestScore = Math.max(player.bestScore, score);
    }
  });

  socket.on('getAbilities', () => {
    if (!currentUsername) return;
    const record = getPlayerRecord(currentUsername);
    socket.emit('abilityData', {
      abilityPoints: record.abilityPoints,
      abilities: record.abilities,
    });
  });

  socket.on('awardAP', ({ amount }) => {
    if (!currentUsername) return;
    if (typeof amount !== 'number' || amount <= 0 || amount > 10000) return;
    const record = getPlayerRecord(currentUsername);
    record.abilityPoints += Math.floor(amount);
    savePlayerData(allPlayerData);
    socket.emit('abilityData', {
      abilityPoints: record.abilityPoints,
      abilities: record.abilities,
    });
  });

  socket.on('purchaseAbility', ({ abilityId }) => {
    if (!currentUsername) return;
    if (!VALID_ABILITY_IDS.includes(abilityId)) return;

    const record = getPlayerRecord(currentUsername);
    const cost = ABILITY_COSTS[abilityId];

    if (!record.abilities[abilityId]?.owned && record.abilityPoints >= cost) {
      record.abilityPoints -= cost;
      record.abilities[abilityId] = {
        owned: true,
        upgradeLevel: record.abilities[abilityId]?.upgradeLevel || 0,
      };
      savePlayerData(allPlayerData);
    }

    socket.emit('abilityData', {
      abilityPoints: record.abilityPoints,
      abilities: record.abilities,
    });
  });

  socket.on('upgradeAbility', ({ abilityId }) => {
    if (!currentUsername) return;
    if (!VALID_ABILITY_IDS.includes(abilityId)) return;

    const record = getPlayerRecord(currentUsername);
    const abilityInfo = record.abilities[abilityId];
    if (!abilityInfo?.owned) return;
    if (abilityInfo.upgradeLevel >= MAX_UPGRADE_LEVEL) return;

    const cost = Math.floor(BASE_UPGRADE_COSTS[abilityId] * (1 + abilityInfo.upgradeLevel * 0.5));
    if (record.abilityPoints < cost) return;

    record.abilityPoints -= cost;
    abilityInfo.upgradeLevel++;
    savePlayerData(allPlayerData);

    socket.emit('abilityData', {
      abilityPoints: record.abilityPoints,
      abilities: record.abilities,
    });
  });

  socket.on('disconnect', () => {
    const player = players.find((p) => p.socketId === socket.id);
    players = players.filter((p) => p.socketId !== socket.id);
    currentUsername = null;
    console.log(
      `${player?.username ?? 'Unknown'} disconnected. Players online: ${players.length}`
    );
  });
});

setInterval(() => {
  const bestByUsername = new Map();
  for (const player of players) {
    const currentBest = bestByUsername.get(player.username);
    if (!currentBest || player.bestScore > currentBest.score) {
      bestByUsername.set(player.username, {
        username: player.username,
        score: player.bestScore,
      });
    }
  }

  const activeBestScores = [...bestByUsername.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  io.emit('leaderboard', activeBestScores);
}, LEADERBOARD_INTERVAL_MS);

httpServer.listen(PORT, () => {
  console.log(`Horde Havoc server listening on port ${PORT}`);
});
