import * as THREE from 'three';
import { spawnBlueNormie } from './units.js';

const FIRE_INTERVAL_MS = 200;
const LAUNCH_SPEED = 12;
const LANE_WIDTH = 6;

let cannonMesh = null;
let aimX = 0;
let lastFireTime = 0;
let firing = false;

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

  group.position.set(0, 0.0, 8);
  group.castShadow = true;
  scene.add(group);

  cannonMesh = group;
  return group;
}

export function setupControls(canvas) {
  canvas.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const normalizedX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    aimX = normalizedX * (LANE_WIDTH / 2);
  });

  canvas.addEventListener('pointerdown', () => { firing = true; });
  canvas.addEventListener('pointerup', () => { firing = false; });

  // Fire while holding by default (auto-fire when pointer is down)
  canvas.style.cursor = 'crosshair';
}

export function updateCannon(scene, time) {
  if (!cannonMesh) return;

  cannonMesh.position.x = THREE.MathUtils.lerp(cannonMesh.position.x, aimX, 0.15);

  if (firing && time - lastFireTime > FIRE_INTERVAL_MS) {
    lastFireTime = time;
    fireUnit(scene);
  }
}

function fireUnit(scene) {
  const pos = new THREE.Vector3(
    cannonMesh.position.x + (Math.random() - 0.5) * 0.2,
    cannonMesh.position.y + 0.7,
    cannonMesh.position.z - 0.5
  );

  const spread = (Math.random() - 0.5) * 1.5;
  const velocity = new THREE.Vector3(spread, 2, -LAUNCH_SPEED);

  spawnBlueNormie(scene, pos, velocity);
}
