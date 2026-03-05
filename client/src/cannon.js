import * as THREE from 'three';
import { spawnBlueNormie } from './units.js';

const FIRE_INTERVAL_MS = 200;
const LAUNCH_SPEED = 8;
const LANE_HALF_WIDTH = 2.5;
const MOVE_SPEED = 8;

let cannonMesh = null;
let muzzleFlash = null;
let lastFireTime = 0;
let lastCannonTime = 0;
let moveLeft = false;
let moveRight = false;
let flashTimer = 0;

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

  const dt = lastCannonTime === 0 ? 0.016 : Math.min((time - lastCannonTime) / 1000, 0.1);
  lastCannonTime = time;

  const moveDir = (moveRight ? 1 : 0) - (moveLeft ? 1 : 0);
  cannonMesh.position.x += moveDir * MOVE_SPEED * dt;
  cannonMesh.position.x = THREE.MathUtils.clamp(cannonMesh.position.x, -LANE_HALF_WIDTH, LANE_HALF_WIDTH);

  if (time - lastFireTime > FIRE_INTERVAL_MS) {
    lastFireTime = time;
    fireUnit(scene);
  }

  if (muzzleFlash && flashTimer > 0) {
    flashTimer -= dt;
    muzzleFlash.material.opacity = Math.max(flashTimer / 0.08, 0);
  }
}

function fireUnit(scene) {
  const pos = new THREE.Vector3(
    cannonMesh.position.x + (Math.random() - 0.5) * 0.15,
    cannonMesh.position.y + 0.7,
    cannonMesh.position.z - 0.5
  );

  const spread = (Math.random() - 0.5) * 0.4;
  const velocity = new THREE.Vector3(spread, 1.5, -LAUNCH_SPEED);

  spawnBlueNormie(scene, pos, velocity);

  flashTimer = 0.08;
  if (muzzleFlash) {
    muzzleFlash.material.opacity = 0.9;
  }
}
