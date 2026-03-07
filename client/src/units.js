import * as THREE from 'three';
import { createDynamicBody, getWorld } from './physics.js';

const MAX_UNITS = 300;
const PROJECTILE_MAX_AGE_MS = 22000;
const PIERCING_MAX_AGE_MS = 4000;
const PIERCING_MIN_SPEED_SQ = 4.0;
const PIERCING_MAX_HITS = 10;
const PROJECTILE_MIN_Z = -88;
const PROJECTILE_MAX_Z = 12;
const NORMIE_RADIUS = 0.3;

const activeUnits = [];
let nextUnitId = 0;

const unitGeometry = new THREE.SphereGeometry(NORMIE_RADIUS, 12, 8);
const blueMaterial = new THREE.MeshStandardMaterial({
  color: 0x44aaff,
  emissive: 0x2266cc,
  emissiveIntensity: 0.5,
});
const explosiveMaterial = new THREE.MeshStandardMaterial({
  color: 0xff6600,
  emissive: 0xff4400,
  emissiveIntensity: 0.6,
});
const piercingMaterial = new THREE.MeshStandardMaterial({
  color: 0xeeffff,
  emissive: 0x00ffff,
  emissiveIntensity: 1.8,
  metalness: 0.7,
  roughness: 0.1,
});
const PIERCING_RADIUS = 0.7;
const goldMaterial = new THREE.MeshStandardMaterial({
  color: 0xffd700,
  metalness: 0.6,
  roughness: 0.3,
});

export function getActiveUnits() {
  return activeUnits;
}

export function spawnBlueNormie(scene, position, velocity, options = {}) {
  recycleIfAtCap(scene);

  const isExplosive = options.explosive ?? false;
  const isPiercing = options.isPiercingShot ?? false;
  const radius = isPiercing ? PIERCING_RADIUS : NORMIE_RADIUS;
  const mat = isPiercing ? piercingMaterial : isExplosive ? explosiveMaterial : blueMaterial;
  const geo = isPiercing ? new THREE.SphereGeometry(PIERCING_RADIUS, 16, 12) : unitGeometry;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(position);
  mesh.castShadow = true;
  scene.add(mesh);

  const { body, collider } = createDynamicBody(getWorld(), position, radius, isPiercing ? 2 : 1, 0.4);
  configureProjectileBody(body, collider);
  body.setLinvel({ x: velocity.x, y: velocity.y, z: velocity.z }, true);

  const unit = {
    id: nextUnitId++,
    mesh,
    body,
    collider,
    type: 'normie',
    scored: false,
    spawnedAt: performance.now(),
    canTriggerGates: options.canTriggerGates ?? true,
    pierceAll: options.pierceAll ?? false,
    explosive: isExplosive,
    isPiercingShot: isPiercing,
    piercesRemaining: isPiercing ? PIERCING_MAX_HITS : Infinity,
  };
  activeUnits.push(unit);
  return unit;
}

export function spawnGoldTank(scene, position, velocity) {
  recycleIfAtCap(scene);

  const geometry = new THREE.SphereGeometry(0.45, 16, 12);
  const mesh = new THREE.Mesh(geometry, goldMaterial);
  mesh.position.copy(position);
  mesh.castShadow = true;
  scene.add(mesh);

  const { body, collider } = createDynamicBody(getWorld(), position, 0.45, 5, 0.2);
  configureProjectileBody(body, collider);
  body.setLinvel({ x: velocity.x, y: velocity.y, z: velocity.z }, true);

  const unit = {
    id: nextUnitId++,
    mesh,
    body,
    collider,
    type: 'tank',
    scored: false,
    spawnedAt: performance.now(),
  };
  activeUnits.push(unit);
  return unit;
}

export function syncUnits() {
  for (const unit of activeUnits) {
    if (!unit.body) continue;
    const pos = unit.body.translation();
    unit.mesh.position.set(pos.x, pos.y, pos.z);

    const rot = unit.body.rotation();
    unit.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
  }
}

export function removeUnit(scene, unit) {
  const idx = activeUnits.indexOf(unit);
  if (idx === -1) return;
  activeUnits.splice(idx, 1);

  scene.remove(unit.mesh);
  const world = getWorld();
  if (world && unit.body) {
    const bodyHandle = unit.body.handle;
    const trackedBody = typeof bodyHandle === 'number' ? world.getRigidBody(bodyHandle) : null;
    if (trackedBody) {
      world.removeRigidBody(trackedBody);
    }
    unit.body = null;
    unit.collider = null;
  }
}

export function cleanupFallenUnits(scene, yThreshold = -5) {
  const toRemove = [];
  const now = performance.now();
  for (const unit of activeUnits) {
    if (!unit.body) continue;
    const pos = unit.body.translation();
    const age = now - (unit.spawnedAt || now);
    if (pos.y < yThreshold || pos.z < PROJECTILE_MIN_Z || pos.z > PROJECTILE_MAX_Z || age > PROJECTILE_MAX_AGE_MS) {
      toRemove.push(unit);
      continue;
    }
    if (unit.isPiercingShot) {
      if (age > PIERCING_MAX_AGE_MS) {
        toRemove.push(unit);
        continue;
      }
      const vel = unit.body.linvel();
      const speedSq = vel.x * vel.x + vel.y * vel.y + vel.z * vel.z;
      if (speedSq < PIERCING_MIN_SPEED_SQ) {
        toRemove.push(unit);
        continue;
      }
      if (unit.piercesRemaining <= 0) {
        toRemove.push(unit);
      }
    }
  }
  for (const unit of toRemove) {
    removeUnit(scene, unit);
  }
}


function recycleIfAtCap(scene) {
  while (activeUnits.length >= MAX_UNITS) {
    removeUnit(scene, activeUnits[0]);
  }
}

function configureProjectileBody(body, collider) {
  body.setGravityScale(0.35, true);
  body.setLinearDamping(0.03);
  body.setAngularDamping(0.02);
  collider.setFriction(0.0);
  // Membership: group 1 (0x0002). Filter: group 0 only (0x0001).
  // Statics default to all groups, so projectiles still hit floor/walls
  // but pass through each other.
  collider.setCollisionGroups((0x0002 << 16) | 0x0001);
}

export function resetUnits(scene) {
  for (const unit of [...activeUnits]) {
    removeUnit(scene, unit);
  }
}
