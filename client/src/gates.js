import * as THREE from 'three';
import { createSensorZone, getWorld, RAPIER } from './physics.js';
import { spawnBlueNormie, getActiveUnits } from './units.js';

const gates = [];
const processedCollisions = new Set();

const GATE_CONFIGS = [
  { z: 2, type: 'multiply', value: 2, label: 'x2', color: 0x00cc66 },
  { z: -4, type: 'add', value: 5, label: '+5', color: 0x22aaff },
  { z: -10, type: 'multiply', value: 2, label: 'x2', color: 0x00cc66 },
];

export function createGates(scene) {
  for (const cfg of GATE_CONFIGS) {
    const gate = buildGate(scene, cfg);
    gates.push(gate);
  }
}

function buildGate(scene, cfg) {
  const group = new THREE.Group();
  const postGeo = new THREE.BoxGeometry(0.2, 2, 0.2);
  const postMat = new THREE.MeshStandardMaterial({ color: cfg.color });

  const leftPost = new THREE.Mesh(postGeo, postMat);
  leftPost.position.set(-3, 1, cfg.z);
  group.add(leftPost);

  const rightPost = new THREE.Mesh(postGeo, postMat);
  rightPost.position.set(3, 1, cfg.z);
  group.add(rightPost);

  const barGeo = new THREE.BoxGeometry(6.4, 0.3, 0.2);
  const barMat = new THREE.MeshStandardMaterial({ color: cfg.color, emissive: cfg.color, emissiveIntensity: 0.3 });
  const bar = new THREE.Mesh(barGeo, barMat);
  bar.position.set(0, 2.1, cfg.z);
  group.add(bar);

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 40px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(cfg.label, 128, 32);

  const texture = new THREE.CanvasTexture(canvas);
  const labelGeo = new THREE.PlaneGeometry(1.6, 0.4);
  const labelMat = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
  const labelMesh = new THREE.Mesh(labelGeo, labelMat);
  labelMesh.position.set(0, 2.5, cfg.z);
  group.add(labelMesh);

  scene.add(group);

  const { body, collider } = createSensorZone(
    getWorld(),
    { x: 0, y: 1, z: cfg.z },
    { x: 3, y: 1.5, z: 0.4 }
  );

  return { group, body, collider, config: cfg, colliderHandle: collider.handle };
}

export function processGateCollisions(scene) {
  const world = getWorld();
  if (!world) return;

  const units = getActiveUnits();

  for (const gate of gates) {
    for (const unit of [...units]) {
      if (unit.scored) continue;

      const unitColliders = [];
      unit.body.forEachCollider((c) => unitColliders.push(c));
      if (unitColliders.length === 0) continue;

      const unitHandle = unitColliders[0].handle;
      const pairKey = `${gate.colliderHandle}_${unitHandle}`;

      if (processedCollisions.has(pairKey)) continue;

      if (world.intersectionPair(gate.collider, unitColliders[0])) {
        processedCollisions.add(pairKey);
        triggerGate(scene, gate, unit);
      }
    }
  }
}

function triggerGate(scene, gate, sourceUnit) {
  const pos = sourceUnit.body.translation();
  const vel = sourceUnit.body.linvel();

  const cfg = gate.config;
  let spawnCount = 0;

  if (cfg.type === 'multiply') {
    spawnCount = cfg.value - 1;
  } else if (cfg.type === 'add') {
    spawnCount = cfg.value;
  }

  for (let i = 0; i < spawnCount; i++) {
    const offset = new THREE.Vector3(
      (Math.random() - 0.5) * 1.0,
      Math.random() * 0.5,
      (Math.random() - 0.5) * 0.5
    );
    const spawnPos = new THREE.Vector3(pos.x + offset.x, pos.y + offset.y, pos.z + offset.z);
    const spawnVel = new THREE.Vector3(
      vel.x + (Math.random() - 0.5) * 2,
      vel.y + Math.random() * 1,
      vel.z
    );
    spawnBlueNormie(scene, spawnPos, spawnVel);
  }
}
