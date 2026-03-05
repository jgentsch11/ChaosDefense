import * as THREE from 'three';
import { createDynamicBody, getWorld } from './physics.js';

const MAX_UNITS = 300;
const PROJECTILE_MAX_AGE_MS = 22000;
const PROJECTILE_MIN_Z = -100;
const PROJECTILE_MAX_Z = 12;
const NORMIE_RADIUS = 0.3;
const PROJECTILE_SEPARATION_DIST = NORMIE_RADIUS * 2.05;

const activeUnits = [];
let nextUnitId = 0;

const unitGeometry = new THREE.SphereGeometry(NORMIE_RADIUS, 12, 8);
const blueMaterial = new THREE.MeshStandardMaterial({
  color: 0x44aaff,
  emissive: 0x2266cc,
  emissiveIntensity: 0.5,
});
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

  const mesh = new THREE.Mesh(unitGeometry, blueMaterial);
  mesh.position.copy(position);
  mesh.castShadow = true;
  scene.add(mesh);

  const { body, collider } = createDynamicBody(getWorld(), position, NORMIE_RADIUS, 1, 0.4);
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
  separateOverlappingUnits();

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
    }
  }
  for (const unit of toRemove) {
    removeUnit(scene, unit);
  }
}

function separateOverlappingUnits() {
  const minDist = PROJECTILE_SEPARATION_DIST;
  const minDistSq = minDist * minDist;

  for (let i = 0; i < activeUnits.length; i++) {
    const a = activeUnits[i];
    if (!a.body || a.scored) continue;
    const aPos = a.body.translation();

    for (let j = i + 1; j < activeUnits.length; j++) {
      const b = activeUnits[j];
      if (!b.body || b.scored) continue;
      const bPos = b.body.translation();

      // Cheap broad-phase reject for non-nearby projectiles.
      if (Math.abs(aPos.z - bPos.z) > minDist * 1.5) continue;
      if (Math.abs(aPos.x - bPos.x) > minDist * 1.5) continue;

      const dx = bPos.x - aPos.x;
      const dy = bPos.y - aPos.y;
      const dz = bPos.z - aPos.z;
      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq >= minDistSq) continue;

      const dist = Math.max(Math.sqrt(distSq), 0.0001);
      const overlap = minDist - dist;
      if (overlap <= 0) continue;

      const nx = dx / dist;
      const ny = dy / dist;
      const nz = dz / dist;
      const push = overlap * 0.5;

      a.body.setTranslation(
        { x: aPos.x - nx * push, y: aPos.y - ny * push, z: aPos.z - nz * push },
        true
      );
      b.body.setTranslation(
        { x: bPos.x + nx * push, y: bPos.y + ny * push, z: bPos.z + nz * push },
        true
      );
    }
  }
}

function recycleIfAtCap(scene) {
  while (activeUnits.length >= MAX_UNITS) {
    removeUnit(scene, activeUnits[0]);
  }
}

function configureProjectileBody(body, collider) {
  // Keep projectiles moving down-lane instead of immediately dropping/rolling.
  body.setGravityScale(0.35, true);
  body.setLinearDamping(0.03);
  body.setAngularDamping(0.02);
  collider.setFriction(0.0);
}

export function resetUnits(scene) {
  for (const unit of [...activeUnits]) {
    removeUnit(scene, unit);
  }
}
