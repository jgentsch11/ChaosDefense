import { io } from 'socket.io-client';
import { updateLeaderboard } from './ui.js';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

let socket = null;
let localUsername = null;

export function connect(username) {
  localUsername = username;
  socket = io(SERVER_URL);

  socket.on('connect', () => {
    socket.emit('join', { username });
  });

  socket.on('joined', ({ username: confirmed }) => {
    localUsername = confirmed;
  });

  socket.on('leaderboard', (top10) => {
    updateLeaderboard(top10, localUsername);
  });

  socket.on('disconnect', () => {
    console.log('Disconnected from server');
  });
}

export function sendScore(score) {
  if (socket?.connected) {
    socket.emit('scoreUpdate', { score });
  }
}

export function getUsername() {
  return localUsername;
}
