import { createStaticBody, createSensorZone, getWorld } from './physics.js';

let endZoneSensor = null;

const END_ZONE_Z = -88;

export function createEnemyBase(scene) {
  // Keep collision/end-zone logic but remove the visible red base block.
  createStaticBody(getWorld(), { x: 0, y: 0.75, z: END_ZONE_Z }, { x: 8.4, y: 0.75, z: 1 });

  const { collider } = createSensorZone(
    getWorld(),
    { x: 0, y: 1, z: END_ZONE_Z + 2 },
    { x: 8.8, y: 2, z: 1 }
  );
  endZoneSensor = collider;

  return null;
}

export function getEndZoneSensor() {
  return endZoneSensor;
}

export function getEndZoneZ() {
  return END_ZONE_Z;
}
