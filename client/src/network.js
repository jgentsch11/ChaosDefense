import { io } from 'socket.io-client';
import { updateLeaderboard } from './ui.js';
import { loadAbilityData } from './abilities.js';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

let socket = null;
let localUsername = null;
let onAbilityDataCallback = null;

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

  socket.on('abilityData', (data) => {
    loadAbilityData(data);
    if (onAbilityDataCallback) onAbilityDataCallback(data);
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

export function sendAwardAP(amount) {
  if (socket?.connected) {
    socket.emit('awardAP', { amount });
  }
}

export function sendPurchaseAbility(abilityId) {
  if (socket?.connected) {
    socket.emit('purchaseAbility', { abilityId });
  }
}

export function sendUpgradeAbility(abilityId) {
  if (socket?.connected) {
    socket.emit('upgradeAbility', { abilityId });
  }
}

export function requestAbilities() {
  if (socket?.connected) {
    socket.emit('getAbilities');
  }
}

export function onAbilityData(callback) {
  onAbilityDataCallback = callback;
}

export function getUsername() {
  return localUsername;
}
