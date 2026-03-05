import RAPIER from '@dimforge/rapier3d-compat';

let world = null;
let rapierReady = false;

export async function initPhysics() {
  await RAPIER.init();
  const gravity = { x: 0, y: -9.81, z: 0 };
  world = new RAPIER.World(gravity);
  rapierReady = true;
  return world;
}

export function getWorld() {
  return world;
}

export function isReady() {
  return rapierReady;
}

export function stepPhysics() {
  if (world) world.step();
}

export function createDynamicBody(world, position, radius, mass = 1, restitution = 0.3) {
  const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(position.x, position.y, position.z);
  const body = world.createRigidBody(bodyDesc);

  const colliderDesc = RAPIER.ColliderDesc.ball(radius)
    .setMass(mass)
    .setRestitution(restitution);
  const collider = world.createCollider(colliderDesc, body);

  return { body, collider };
}

export function createStaticBody(world, position, halfExtents) {
  const bodyDesc = RAPIER.RigidBodyDesc.fixed()
    .setTranslation(position.x, position.y, position.z);
  const body = world.createRigidBody(bodyDesc);

  const colliderDesc = RAPIER.ColliderDesc.cuboid(
    halfExtents.x, halfExtents.y, halfExtents.z
  );
  world.createCollider(colliderDesc, body);

  return body;
}

export function createSensorZone(world, position, halfExtents) {
  const bodyDesc = RAPIER.RigidBodyDesc.fixed()
    .setTranslation(position.x, position.y, position.z);
  const body = world.createRigidBody(bodyDesc);

  const colliderDesc = RAPIER.ColliderDesc.cuboid(
    halfExtents.x, halfExtents.y, halfExtents.z
  ).setSensor(true);
  const collider = world.createCollider(colliderDesc, body);

  return { body, collider };
}

export { RAPIER };
