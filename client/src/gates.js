import * as THREE from 'three';
import { createSensorZone, getWorld } from './physics.js';
import { spawnBlueNormie, getActiveUnits } from './units.js';

const gates = [];
const processedPairs = new Set();

const GATE_CONFIGS = [
  { z: 4,   type: 'multiply', value: 2, label: 'x2', color: 0x00cc66 },
  { z: 0,   type: 'add',      value: 3, label: '+3', color: 0x22aaff },
  { z: -4,  type: 'multiply', value: 2, label: 'x2', color: 0x00cc66 },
  { z: -8,  type: 'add',      value: 5, label: '+5', color: 0x22aaff },
  { z: -12, type: 'multiply', value: 3, label: 'x3', color: 0xffcc00 },
];

const GATE_LEFT_X = 0.15;
const GATE_RIGHT_X = 2.85;
const GATE_CENTER_X = (GATE_LEFT_X + GATE_RIGHT_X) / 2;
const GATE_Z_THRESHOLD = 0.5;
const GATE_X_MARGIN = 0.05;

export function createGates(scene) {
  gates.length = 0;
  processedPairs.clear();

  for (let i = 0; i < GATE_CONFIGS.length; i++) {
    const gate = buildGate(scene, GATE_CONFIGS[i]);
    gate.id = i;
    gates.push(gate);
  }
}

function buildGate(scene, cfg) {
  const group = new THREE.Group();
  const postGeo = new THREE.BoxGeometry(0.2, 2, 0.2);
  const postMat = new THREE.MeshStandardMaterial({ color: cfg.color });

  const leftPost = new THREE.Mesh(postGeo, postMat);
  leftPost.position.set(GATE_LEFT_X, 1, cfg.z);
  group.add(leftPost);

  const rightPost = new THREE.Mesh(postGeo, postMat);
  rightPost.position.set(GATE_RIGHT_X, 1, cfg.z);
  group.add(rightPost);

  const barWidth = GATE_RIGHT_X - GATE_LEFT_X + 0.2;
  const barGeo = new THREE.BoxGeometry(barWidth, 0.3, 0.2);
  const barMat = new THREE.MeshStandardMaterial({ color: cfg.color, emissive: cfg.color, emissiveIntensity: 0.3 });
  const bar = new THREE.Mesh(barGeo, barMat);
  bar.position.set(GATE_CENTER_X, 2.1, cfg.z);
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
  const labelGeo = new THREE.PlaneGeometry(1.2, 0.35);
  const labelMat = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
  const labelMesh = new THREE.Mesh(labelGeo, labelMat);
  labelMesh.position.set(GATE_CENTER_X, 2.45, cfg.z);
  group.add(labelMesh);

  scene.add(group);

  return { group, config: cfg };
}

export function processGateCollisions(scene) {
  const units = getActiveUnits();

  for (const gate of gates) {
    for (const unit of [...units]) {
      if (unit.scored || !unit.body || !unit.canTriggerGates) continue;

      const pairKey = `g${gate.id}_u${unit.id}`;
      if (processedPairs.has(pairKey)) continue;

      const pos = unit.body.translation();
      const inZ = Math.abs(pos.z - gate.config.z) < GATE_Z_THRESHOLD;
      // Keep gate triggers to the bonus lane only; center shots should not auto-multiply.
      const inX = pos.x >= GATE_LEFT_X + GATE_X_MARGIN && pos.x <= GATE_RIGHT_X - GATE_X_MARGIN;

      if (inZ && inX) {
        processedPairs.add(pairKey);
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

  const baseForwardSpeed = Math.min(vel.z, -9.5);

  for (let i = 0; i < spawnCount; i++) {
    const laneOffset = i - (spawnCount - 1) / 2;
    const spawnPos = new THREE.Vector3(
      THREE.MathUtils.clamp(pos.x + laneOffset * 0.35, GATE_LEFT_X + GATE_X_MARGIN, GATE_RIGHT_X - GATE_X_MARGIN),
      Math.max(pos.y, 0.45),
      pos.z - 0.2 - Math.abs(laneOffset) * 0.05
    );
    const spawnVel = new THREE.Vector3(
      vel.x * 0.35 + laneOffset * 0.6,
      0.2,
      baseForwardSpeed
    );
    spawnBlueNormie(scene, spawnPos, spawnVel, { canTriggerGates: false });
  }
}
