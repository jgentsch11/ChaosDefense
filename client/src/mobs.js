import * as THREE from 'three';

const activeMobs = [];
const deathParticles = [];

let spawnTimer = 0;
let elapsedTime = 0;
let mobsSpawnedTotal = 0;

const SPAWN_Z = -17;
const PLAYER_BASE_Z = 8;
const MOB_X_MIN = -2.5;
const MOB_X_MAX = -0.3;

const BASE_SPAWN_INTERVAL = 2000;
const MIN_SPAWN_INTERVAL = 400;
const BASE_MOB_SPEED = 3;
const MAX_MOB_SPEED = 6;
const MOB_RADIUS = 0.35;

const mobGeometry = new THREE.BoxGeometry(0.55, 0.55, 0.55);
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

const particleGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
const particleMaterial = new THREE.MeshBasicMaterial({ color: 0xff4444 });

function getSpawnInterval() {
  const rampFactor = Math.min(elapsedTime / 120000, 1);
  return BASE_SPAWN_INTERVAL - rampFactor * (BASE_SPAWN_INTERVAL - MIN_SPAWN_INTERVAL);
}

function getMobSpeed() {
  const rampFactor = Math.min(elapsedTime / 150000, 1);
  return BASE_MOB_SPEED + rampFactor * (MAX_MOB_SPEED - BASE_MOB_SPEED);
}

function getMobType() {
  const r = Math.random();
  const minutesElapsed = elapsedTime / 60000;

  if (minutesElapsed > 1.5 && r < 0.15) return 'tank';
  if (minutesElapsed > 0.5 && r < 0.3) return 'fast';
  return 'basic';
}

function spawnMob(scene) {
  const type = getMobType();
  let mesh, hp, speed, radius;

  if (type === 'tank') {
    const geo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    mesh = new THREE.Mesh(geo, tankMobMaterial);
    hp = 3;
    speed = getMobSpeed() * 0.6;
    radius = 0.5;
  } else if (type === 'fast') {
    const geo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
    mesh = new THREE.Mesh(geo, fastMobMaterial);
    hp = 1;
    speed = getMobSpeed() * 1.4;
    radius = 0.25;
  } else {
    mesh = new THREE.Mesh(mobGeometry, mobMaterial);
    hp = 1;
    speed = getMobSpeed();
    radius = MOB_RADIUS;
  }

  const x = MOB_X_MIN + Math.random() * (MOB_X_MAX - MOB_X_MIN);
  mesh.position.set(x, radius + 0.05, SPAWN_Z);
  mesh.castShadow = true;
  scene.add(mesh);

  activeMobs.push({ mesh, type, hp, speed, radius, scored: false });
  mobsSpawnedTotal++;
}

export function getActiveMobs() {
  return activeMobs;
}

export function getMobsSpawnedTotal() {
  return mobsSpawnedTotal;
}

export function updateMobs(scene, delta) {
  elapsedTime += delta;
  spawnTimer += delta;

  const interval = getSpawnInterval();
  if (spawnTimer >= interval) {
    spawnTimer -= interval;
    spawnMob(scene);
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
        unit.scored = true;
        toRemoveUnits.push(unit);

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
  if (mob.mesh.geometry !== mobGeometry) {
    mob.mesh.geometry.dispose();
  }
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
    if (mob.mesh.geometry !== mobGeometry) mob.mesh.geometry.dispose();
  }
  activeMobs.length = 0;

  for (const p of deathParticles) {
    scene.remove(p.mesh);
  }
  deathParticles.length = 0;

  spawnTimer = 0;
  elapsedTime = 0;
  mobsSpawnedTotal = 0;
}
