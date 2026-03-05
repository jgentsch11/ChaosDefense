import * as THREE from 'three';
import { createDynamicBody, getWorld } from './physics.js';

const MAX_UNITS = 300;

const activeUnits = [];
let nextUnitId = 0;

const unitGeometry = new THREE.SphereGeometry(0.3, 12, 8);
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

export function spawnBlueNormie(scene, position, velocity) {
  recycleIfAtCap(scene);

  const mesh = new THREE.Mesh(unitGeometry, blueMaterial);
  mesh.position.copy(position);
  mesh.castShadow = true;
  scene.add(mesh);

  const { body, collider } = createDynamicBody(getWorld(), position, 0.3, 1, 0.4);
  body.setLinvel({ x: velocity.x, y: velocity.y, z: velocity.z }, true);

  const unit = { id: nextUnitId++, mesh, body, collider, type: 'normie', scored: false };
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
  body.setLinvel({ x: velocity.x, y: velocity.y, z: velocity.z }, true);

  const unit = { id: nextUnitId++, mesh, body, collider, type: 'tank', scored: false };
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
    world.removeRigidBody(unit.body);
    unit.body = null;
    unit.collider = null;
  }
}

export function cleanupFallenUnits(scene, yThreshold = -5) {
  const toRemove = [];
  for (const unit of activeUnits) {
    if (!unit.body) continue;
    const pos = unit.body.translation();
    if (pos.y < yThreshold) {
      toRemove.push(unit);
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
