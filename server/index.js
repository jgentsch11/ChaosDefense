const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

const PORT = process.env.PORT || 3000;
const LEADERBOARD_INTERVAL_MS = 2000;

let players = [];

app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    game: 'Horde Havoc',
    activePlayers: players.length,
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
      bestScore: 0,
    });

    console.log(`${name} joined (${socket.id}). Players online: ${players.length}`);
    socket.emit('joined', { username: name });
  });

  socket.on('scoreUpdate', ({ score }) => {
    const player = players.find((p) => p.socketId === socket.id);
    if (player && typeof score === 'number' && score >= 0) {
      player.score = score;
      player.bestScore = Math.max(player.bestScore, score);
    }
  });

  socket.on('disconnect', () => {
    const player = players.find((p) => p.socketId === socket.id);
    players = players.filter((p) => p.socketId !== socket.id);
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
