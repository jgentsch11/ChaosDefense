import * as THREE from 'three';
import { createStaticBody, createSensorZone, getWorld } from './physics.js';

let endZoneSensor = null;

const END_ZONE_Z = -18;

export function createEnemyBase(scene) {
  const baseGeo = new THREE.BoxGeometry(6, 1.5, 2);
  const baseMat = new THREE.MeshStandardMaterial({ color: 0xcc2222 });
  const baseMesh = new THREE.Mesh(baseGeo, baseMat);
  baseMesh.position.set(0, 0.75, END_ZONE_Z);
  baseMesh.castShadow = true;
  baseMesh.receiveShadow = true;
  scene.add(baseMesh);

  createStaticBody(getWorld(), { x: 0, y: 0.75, z: END_ZONE_Z }, { x: 3, y: 0.75, z: 1 });

  const { collider } = createSensorZone(
    getWorld(),
    { x: 0, y: 1, z: END_ZONE_Z + 2 },
    { x: 3.5, y: 2, z: 1 }
  );
  endZoneSensor = collider;

  return baseMesh;
}

export function getEndZoneSensor() {
  return endZoneSensor;
}

export function getEndZoneZ() {
  return END_ZONE_Z;
}
