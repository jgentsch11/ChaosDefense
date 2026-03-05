import * as THREE from 'three';

const activeMobs = [];
const deathParticles = [];

let spawnTimer = 0;
let elapsedTime = 0;
let mobsSpawnedTotal = 0;
let bonusFramesSpawned = 0;
let smoothedBalanceFactor = 1;

const SPAWN_Z = -84;
const PLAYER_BASE_Z = 8;
const LEFT_LANE_X_MIN = -7.2;
const LEFT_LANE_X_MAX = -0.8;
const RIGHT_LANE_X_MIN = 0.8;
const RIGHT_LANE_X_MAX = 7.2;

const BASE_SPAWN_INTERVAL = 1300;
const MIN_SPAWN_INTERVAL = 250;
const BASE_MOB_SPEED = 3;
const MAX_MOB_SPEED = 6;
const MOB_RADIUS = 0.6;
const BONUS_FRAME_EVERY = 12;
const BASE_PLAYER_SHOTS_PER_SEC = 1000 / 320;
const BONUS_WALL_BASE_HITS = 2;
const BONUS_WALL_HIT_STEP_EVERY = 3;
const BONUS_WALL_MAX_HITS = 8;

const mobGeometry = new THREE.BoxGeometry(1.0, 1.0, 1.0);
const mobMaterial = new THREE.MeshStandardMaterial({
  color: 0xe94560,
  emissive: 0xe94560,
  emissiveIntensity: 0.25,
  roughness: 0.4,
});

const fastMobMaterial = new THREE.MeshStandardMaterial({
  color: 0xff8800,
  emissive: 0xff6600,
  emissiveIntensity: 0.3,
  roughness: 0.3,
});

const tankMobMaterial = new THREE.MeshStandardMaterial({
  color: 0x990033,
  emissive: 0x660022,
  emissiveIntensity: 0.2,
  roughness: 0.6,
});
const bonusFrameGeometry = new THREE.BoxGeometry(1.3, 1.3, 1.3);
const bonusWallGeometry = new THREE.BoxGeometry(1.9, 1.5, 0.35);
const bonusFrameMaterials = {
  rapid: new THREE.MeshBasicMaterial({ color: 0x4dd6ff, wireframe: true }),
  shooter: new THREE.MeshBasicMaterial({ color: 0xffcc44, wireframe: true }),
  pierce: new THREE.MeshBasicMaterial({ color: 0xcc77ff, wireframe: true }),
};
const bonusWallMaterial = new THREE.MeshStandardMaterial({
  color: 0x4f5d75,
  emissive: 0x1e2633,
  emissiveIntensity: 0.35,
  roughness: 0.55,
  metalness: 0.2,
});

const particleGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
const particleMaterial = new THREE.MeshBasicMaterial({ color: 0xff4444 });

function getSpawnInterval() {
  const rampFactor = Math.min(elapsedTime / 50000, 1);
  return BASE_SPAWN_INTERVAL - rampFactor * (BASE_SPAWN_INTERVAL - MIN_SPAWN_INTERVAL);
}

function getMobSpeed() {
  const rampFactor = Math.min(elapsedTime / 70000, 1);
  return BASE_MOB_SPEED + rampFactor * (MAX_MOB_SPEED - BASE_MOB_SPEED);
}

function getBalanceFactor(playerShotsPerSecond) {
  const rawFactor = THREE.MathUtils.clamp(
    playerShotsPerSecond / BASE_PLAYER_SHOTS_PER_SEC,
    0.7,
    3.2
  );
  smoothedBalanceFactor = THREE.MathUtils.lerp(smoothedBalanceFactor, rawFactor, 0.12);
  return smoothedBalanceFactor;
}

function pickLaneRange() {
  return Math.random() < 0.5
    ? { min: LEFT_LANE_X_MIN, max: LEFT_LANE_X_MAX }
    : { min: RIGHT_LANE_X_MIN, max: RIGHT_LANE_X_MAX };
}

function pickBonusKind() {
  const r = Math.random();
  if (r < 0.45) return 'rapid';
  if (r < 0.75) return 'pierce';
  return 'shooter';
}

function getBonusWallHits() {
  const bonusTier = Math.floor(bonusFramesSpawned / BONUS_WALL_HIT_STEP_EVERY);
  return Math.min(BONUS_WALL_BASE_HITS + bonusTier, BONUS_WALL_MAX_HITS);
}

function getMobType() {
  const r = Math.random();
  const minutesElapsed = elapsedTime / 60000;

  if (minutesElapsed > 1.5 && r < 0.15) return 'tank';
  if (minutesElapsed > 0.5 && r < 0.3) return 'fast';
  return 'basic';
}

function spawnMob(scene, balanceFactor) {
  const shouldSpawnBonusFrame = mobsSpawnedTotal > 0 && mobsSpawnedTotal % BONUS_FRAME_EVERY === 0;
  const type = shouldSpawnBonusFrame ? 'bonus' : getMobType();
  let mesh, hp, speed, radius, bonusKind = null;

  if (type === 'bonus') {
    bonusKind = pickBonusKind();
    const frame = new THREE.Mesh(bonusFrameGeometry, bonusFrameMaterials[bonusKind]);
    const wall = new THREE.Mesh(bonusWallGeometry, bonusWallMaterial);
    wall.position.z = 0.65; // Toward the player; acts as the blocking wall.
    wall.castShadow = true;
    wall.receiveShadow = true;

    const group = new THREE.Group();
    group.add(frame);
    group.add(wall);
    mesh = group;

    hp = getBonusWallHits();
    speed = getMobSpeed() * (1.0 + (balanceFactor - 1) * 0.2);
    radius = 1.0;
    bonusFramesSpawned++;
  } else if (type === 'tank') {
    const geo = new THREE.BoxGeometry(1.4, 1.4, 1.4);
    mesh = new THREE.Mesh(geo, tankMobMaterial);
    hp = 3;
    speed = getMobSpeed() * 0.6 * balanceFactor;
    radius = 0.85;
  } else if (type === 'fast') {
    const geo = new THREE.BoxGeometry(0.7, 0.7, 0.7);
    mesh = new THREE.Mesh(geo, fastMobMaterial);
    hp = 1;
    speed = getMobSpeed() * 1.4 * balanceFactor;
    radius = 0.42;
  } else {
    mesh = new THREE.Mesh(mobGeometry, mobMaterial);
    hp = 1;
    speed = getMobSpeed() * balanceFactor;
    radius = MOB_RADIUS;
  }

  const lane = pickLaneRange();
  const x = lane.min + Math.random() * (lane.max - lane.min);
  mesh.position.set(x, radius + 0.05, SPAWN_Z);
  mesh.castShadow = true;
  scene.add(mesh);

  activeMobs.push({ mesh, type, hp, speed, radius, bonusKind, scored: false });
  mobsSpawnedTotal++;
}

export function getActiveMobs() {
  return activeMobs;
}

export function getMobsSpawnedTotal() {
  return mobsSpawnedTotal;
}

export function updateMobs(scene, delta, playerShotsPerSecond = BASE_PLAYER_SHOTS_PER_SEC) {
  elapsedTime += delta;
  spawnTimer += delta;

  const balanceFactor = getBalanceFactor(playerShotsPerSecond);
  const interval = getSpawnInterval() / balanceFactor;
  if (spawnTimer >= interval) {
    spawnTimer -= interval;
    spawnMob(scene, balanceFactor);
    // Stronger players trigger occasional extra horde pressure to keep parity.
    if (balanceFactor > 1.2 && Math.random() < 0.35) {
      spawnMob(scene, balanceFactor);
    }
  }

  const dt = delta / 1000;
  for (const mob of activeMobs) {
    mob.mesh.position.z += mob.speed * dt;
    mob.mesh.rotation.y += dt * 1.5;
    mob.mesh.position.y = mob.radius + 0.05 + Math.sin(elapsedTime * 0.003 + mob.mesh.position.x * 2) * 0.08;
  }

  updateParticles(scene, dt);
}

export function checkMobUnitCollisions(scene, units, onMobKilled) {
  const toRemoveUnits = [];
  const toRemoveMobs = [];

  for (const mob of activeMobs) {
    if (mob.scored) continue;
    const mPos = mob.mesh.position;

    for (const unit of units) {
      if (unit.scored || !unit.body) continue;
      const uPos = unit.body.translation();

      const dx = mPos.x - uPos.x;
      const dy = mPos.y - uPos.y;
      const dz = mPos.z - uPos.z;
      const distSq = dx * dx + dy * dy + dz * dz;

      const hitDist = mob.radius + 0.3;
      if (distSq < hitDist * hitDist) {
        mob.hp--;
        if (!unit.pierceAll) {
          unit.scored = true;
          toRemoveUnits.push(unit);
        }

        if (mob.hp <= 0) {
          mob.scored = true;
          toRemoveMobs.push(mob);
          spawnDeathParticles(scene, mPos);
          if (onMobKilled) onMobKilled(mob);
        }
        break;
      }
    }
  }

  return { toRemoveUnits, toRemoveMobs };
}

export function checkMobsReachedBase() {
  const reached = [];
  for (const mob of activeMobs) {
    if (!mob.scored && mob.mesh.position.z >= PLAYER_BASE_Z) {
      mob.scored = true;
      reached.push(mob);
    }
  }
  return reached;
}

export function removeMob(scene, mob) {
  scene.remove(mob.mesh);
  disposeMobVisual(mob.mesh);
  const idx = activeMobs.indexOf(mob);
  if (idx !== -1) activeMobs.splice(idx, 1);
}

function spawnDeathParticles(scene, position) {
  for (let i = 0; i < 6; i++) {
    const mesh = new THREE.Mesh(particleGeometry, particleMaterial);
    mesh.position.copy(position);
    scene.add(mesh);

    const velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 6,
      Math.random() * 4 + 1,
      (Math.random() - 0.5) * 6
    );

    deathParticles.push({ mesh, velocity, life: 0.6 });
  }
}

function updateParticles(scene, dt) {
  for (let i = deathParticles.length - 1; i >= 0; i--) {
    const p = deathParticles[i];
    p.life -= dt;
    p.velocity.y -= 9.81 * dt;
    p.mesh.position.addScaledVector(p.velocity, dt);
    p.mesh.scale.setScalar(Math.max(p.life / 0.6, 0.01));

    if (p.life <= 0) {
      scene.remove(p.mesh);
      deathParticles.splice(i, 1);
    }
  }
}

export function resetMobs(scene) {
  for (const mob of [...activeMobs]) {
    scene.remove(mob.mesh);
    disposeMobVisual(mob.mesh);
  }
  activeMobs.length = 0;

  for (const p of deathParticles) {
    scene.remove(p.mesh);
  }
  deathParticles.length = 0;

  spawnTimer = 0;
  elapsedTime = 0;
  mobsSpawnedTotal = 0;
  smoothedBalanceFactor = 1;
  bonusFramesSpawned = 0;
}

function disposeMobVisual(root) {
  if (!root) return;
  if (root.isGroup) {
    for (const child of root.children) {
      if (child.geometry && child.geometry !== bonusFrameGeometry && child.geometry !== bonusWallGeometry) {
        child.geometry.dispose();
      }
    }
    return;
  }

  if (root.geometry && root.geometry !== mobGeometry && root.geometry !== bonusFrameGeometry) {
    root.geometry.dispose();
  }
}
