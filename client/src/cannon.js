import * as THREE from 'three';
import { spawnBlueNormie } from './units.js';

const FIRE_INTERVAL_MS = 650;
const LAUNCH_SPEED = 12;
const LANE_HALF_WIDTH = 7.2;
const MOVE_SPEED = 8;
const RAPID_FIRE_MULTIPLIER = 0.25;
const RAPID_FIRE_DURATION_MS = 9000;
const PIERCING_DURATION_MS = 9000;
const DOUBLE_SHOT_DURATION_MS = 11000;
const TRIPLE_SHOT_DURATION_MS = 10000;
const BASE_SHOOTER_COUNT = 1;
const SHOOTER_SPACING = 0.9;
const LEVEL_FIRE_RATE_STEP = 0.1;
const MAX_LEVEL_FIRE_RATE_MULTIPLIER = 2.25;

let cannonMesh = null;
let muzzleFlash = null;
let lastFireTime = 0;
let lastCannonTime = 0;
let moveLeft = false;
let moveRight = false;
let flashTimer = 0;
let rapidFireUntil = 0;
let piercingUntil = 0;
let doubleShotUntil = 0;
let tripleShotUntil = 0;
let levelFireRateMultiplier = 1;

export function createCannon(scene) {
  const group = new THREE.Group();

  const baseGeo = new THREE.CylinderGeometry(0.4, 0.5, 0.4, 16);
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x445566 });
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.y = 0.2;
  group.add(base);

  const barrelGeo = new THREE.CylinderGeometry(0.12, 0.15, 0.8, 12);
  const barrelMat = new THREE.MeshStandardMaterial({ color: 0x667788 });
  const barrel = new THREE.Mesh(barrelGeo, barrelMat);
  barrel.position.y = 0.6;
  barrel.rotation.x = Math.PI / 8;
  group.add(barrel);

  const flashGeo = new THREE.SphereGeometry(0.25, 8, 6);
  const flashMat = new THREE.MeshBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 0 });
  muzzleFlash = new THREE.Mesh(flashGeo, flashMat);
  muzzleFlash.position.set(0, 0.9, -0.4);
  group.add(muzzleFlash);

  group.position.set(0, 0.0, 8);
  group.castShadow = true;
  scene.add(group);

  cannonMesh = group;
  lastCannonTime = 0;
  lastFireTime = 0;
  flashTimer = 0;
  rapidFireUntil = 0;
  piercingUntil = 0;
  doubleShotUntil = 0;
  tripleShotUntil = 0;
  levelFireRateMultiplier = 1;
  return group;
}

export function setupControls() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') moveLeft = true;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') moveRight = true;
  });

  document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') moveLeft = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') moveRight = false;
  });
}

export function updateCannon(scene, time) {
  if (!cannonMesh) return;
  const fireInterval = getCurrentFireInterval(time);

  const dt = lastCannonTime === 0 ? 0.016 : Math.min((time - lastCannonTime) / 1000, 0.1);
  lastCannonTime = time;

  const moveDir = (moveRight ? 1 : 0) - (moveLeft ? 1 : 0);
  cannonMesh.position.x += moveDir * MOVE_SPEED * dt;
  cannonMesh.position.x = THREE.MathUtils.clamp(cannonMesh.position.x, -LANE_HALF_WIDTH, LANE_HALF_WIDTH);

  if (!Number.isFinite(lastFireTime) || time < lastFireTime) {
    lastFireTime = time - fireInterval;
  }

  if (time - lastFireTime >= fireInterval) {
    lastFireTime = time;
    fireVolley(scene, time);
  }

  if (muzzleFlash && flashTimer > 0) {
    flashTimer -= dt;
    muzzleFlash.material.opacity = Math.max(flashTimer / 0.08, 0);
  }
}

function fireVolley(scene, time) {
  const shooterCount = getCurrentShooterCount(time);
  for (let i = 0; i < shooterCount; i++) {
    const laneOffset = i - (shooterCount - 1) / 2;
    fireUnit(scene, laneOffset * SHOOTER_SPACING, time);
  }

  flashTimer = 0.08;
  if (muzzleFlash) {
    muzzleFlash.material.opacity = 0.9;
  }
}

function fireUnit(scene, xOffset = 0, time = performance.now()) {
  const pos = new THREE.Vector3(
    cannonMesh.position.x + xOffset + (Math.random() - 0.5) * 0.08,
    cannonMesh.position.y + 0.7,
    cannonMesh.position.z - 0.5
  );

  const spread = xOffset * 0.2 + (Math.random() - 0.5) * 0.2;
  const velocity = new THREE.Vector3(spread, 0.5, -LAUNCH_SPEED);

  const isPiercingActive = time < piercingUntil;
  spawnBlueNormie(scene, pos, velocity, {
    pierceAll: isPiercingActive,
  });
}

function getCurrentFireInterval(time) {
  const scaledBaseInterval = FIRE_INTERVAL_MS / levelFireRateMultiplier;
  if (time < rapidFireUntil) {
    return scaledBaseInterval * RAPID_FIRE_MULTIPLIER;
  }
  return scaledBaseInterval;
}

export function activateRapidFire(durationMs = RAPID_FIRE_DURATION_MS) {
  rapidFireUntil = performance.now() + durationMs;
}

export function activatePiercingBonus(durationMs = PIERCING_DURATION_MS) {
  piercingUntil = performance.now() + durationMs;
}

export function activateDoubleShotBonus(durationMs = DOUBLE_SHOT_DURATION_MS) {
  doubleShotUntil = performance.now() + durationMs;
}

export function activateTripleShotBonus(durationMs = TRIPLE_SHOT_DURATION_MS) {
  tripleShotUntil = performance.now() + durationMs;
}

export function setLevelFireRateBoost(level) {
  const safeLevel = Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1;
  const rawMultiplier = 1 + (safeLevel - 1) * LEVEL_FIRE_RATE_STEP;
  levelFireRateMultiplier = THREE.MathUtils.clamp(
    rawMultiplier,
    1,
    MAX_LEVEL_FIRE_RATE_MULTIPLIER
  );
}

function getCurrentShooterCount(time) {
  return BASE_SHOOTER_COUNT + getExtraShots(time);
}

function getExtraShots(time) {
  if (time < tripleShotUntil) return 2;
  if (time < doubleShotUntil) return 1;
  return 0;
}

export function getPlayerShotRate(time = performance.now()) {
  const fireInterval = getCurrentFireInterval(time);
  if (fireInterval <= 0) return 0;
  return getCurrentShooterCount(time) * (1000 / fireInterval);
}

export function getActivePowerups(time = performance.now()) {
  const active = [];
  const rapidMs = Math.max(rapidFireUntil - time, 0);
  if (rapidMs > 0) active.push({ id: 'rapid', label: 'Rapid Fire', msRemaining: rapidMs });

  const pierceMs = Math.max(piercingUntil - time, 0);
  if (pierceMs > 0) active.push({ id: 'pierce', label: 'Piercing Shots', msRemaining: pierceMs });

  const doubleShotMs = Math.max(doubleShotUntil - time, 0);
  const tripleShotMs = Math.max(tripleShotUntil - time, 0);
  if (tripleShotMs > 0) {
    active.push({ id: 'triple', label: 'Triple Shot', msRemaining: tripleShotMs });
  } else if (doubleShotMs > 0) {
    active.push({ id: 'double', label: 'Double Shot', msRemaining: doubleShotMs });
  }

  return active;
}
