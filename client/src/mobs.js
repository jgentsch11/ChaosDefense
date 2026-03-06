import * as THREE from 'three';

const activeMobs = [];
const deathParticles = [];

let spawnTimer = 0;
let elapsedTime = 0;
let mobsSpawnedTotal = 0;
let bonusFramesSpawned = 0;
let smoothedBalanceFactor = 1;
let lastBonusSpawnAt = -Infinity;
let lastHeartSpawnAt = -Infinity;

const SPAWN_Z = -84;
const PLAYER_BASE_Z = 8;
const LEFT_LANE_X_MIN = -7.2;
const LEFT_LANE_X_MAX = -0.8;
const RIGHT_LANE_X_MIN = 0.8;
const RIGHT_LANE_X_MAX = 7.2;
const BONUS_SAFE_RIGHT_X_MIN = 2.9;

const BASE_SPAWN_INTERVAL = 800;
const MIN_SPAWN_INTERVAL = 280;
const EARLY_WAVE_DURATION_MS = 8000;
const EARLY_WAVE_SPEEDUP = 0.75;
const BASE_MOB_SPEED = 4.5;
const MAX_MOB_SPEED = 6.5;
const MOB_RADIUS = 0.6;
const BONUS_FRAME_EVERY = 14;
const BONUS_FRAME_EXTRA_CHANCE = 0.1;
const BONUS_FORCE_SCORE = 260;
const BONUS_FORCE_COOLDOWN_MS = 12000;
const HEART_UNLOCK_SCORE = 80;
const HEART_SPAWN_INTERVAL_MS = 12000;
const HEART_HP = 1;
const BASE_PLAYER_SHOTS_PER_SEC = 1000 / 320;
const BONUS_WALL_BASE_HITS = 2;
const BONUS_WALL_HIT_STEP_EVERY = 3;
const BONUS_WALL_MAX_HITS = 8;

const mobGeometry = new THREE.BoxGeometry(1.0, 1.0, 1.0);
const mobMaterial = new THREE.MeshStandardMaterial({
  color: 0xe94560,
  emissive: 0xe94560,
  emissiveIntensity: 0.25,
  roughness: 0.4,
});

const fastMobMaterial = new THREE.MeshStandardMaterial({
  color: 0xff8800,
  emissive: 0xff6600,
  emissiveIntensity: 0.3,
  roughness: 0.3,
});

const tankMobMaterial = new THREE.MeshStandardMaterial({
  color: 0x990033,
  emissive: 0x660022,
  emissiveIntensity: 0.2,
  roughness: 0.6,
});

const heavyMobMaterial = new THREE.MeshStandardMaterial({
  color: 0x4a0066,
  emissive: 0x330044,
  emissiveIntensity: 0.35,
  roughness: 0.5,
  metalness: 0.3,
});

const bossMobMaterial = new THREE.MeshStandardMaterial({
  color: 0x1a1a1a,
  emissive: 0xff2200,
  emissiveIntensity: 0.5,
  roughness: 0.3,
  metalness: 0.6,
});
const skullCraniumMaterial = new THREE.MeshStandardMaterial({
  color: 0x1a1a1a,
  emissive: 0xff2200,
  emissiveIntensity: 0.5,
  roughness: 0.3,
  metalness: 0.6,
});
const skullEyeMaterial = new THREE.MeshStandardMaterial({
  color: 0x000000,
  emissive: 0xff0000,
  emissiveIntensity: 1.2,
});
const skullJawMaterial = new THREE.MeshStandardMaterial({
  color: 0x222222,
  emissive: 0x991100,
  emissiveIntensity: 0.3,
  roughness: 0.5,
});
const skullToothMaterial = new THREE.MeshStandardMaterial({ color: 0xccccaa, roughness: 0.6 });

function createSkullMesh(scale) {
  const group = new THREE.Group();
  const s = scale;

  const craniumGeo = new THREE.SphereGeometry(1.2 * s, 16, 16);
  const cranium = new THREE.Mesh(craniumGeo, skullCraniumMaterial);
  cranium.scale.set(1, 0.9, 1);
  cranium.castShadow = true;
  group.add(cranium);

  const eyeGeo = new THREE.SphereGeometry(0.3 * s, 10, 10);
  const leftEye = new THREE.Mesh(eyeGeo, skullEyeMaterial);
  leftEye.position.set(-0.42 * s, 0.15 * s, 0.9 * s);
  group.add(leftEye);
  const rightEye = new THREE.Mesh(eyeGeo, skullEyeMaterial);
  rightEye.position.set(0.42 * s, 0.15 * s, 0.9 * s);
  group.add(rightEye);

  const noseGeo = new THREE.BoxGeometry(0.15 * s, 0.25 * s, 0.15 * s);
  const noseMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  const nose = new THREE.Mesh(noseGeo, noseMat);
  nose.position.set(0, -0.15 * s, 1.0 * s);
  group.add(nose);

  const jawGeo = new THREE.BoxGeometry(0.9 * s, 0.2 * s, 0.4 * s);
  const jaw = new THREE.Mesh(jawGeo, skullJawMaterial);
  jaw.position.set(0, -0.65 * s, 0.7 * s);
  jaw.castShadow = true;
  group.add(jaw);

  const toothGeo = new THREE.BoxGeometry(0.12 * s, 0.15 * s, 0.1 * s);
  for (let i = -2; i <= 2; i++) {
    const tooth = new THREE.Mesh(toothGeo, skullToothMaterial);
    tooth.position.set(i * 0.18 * s, -0.5 * s, 0.95 * s);
    group.add(tooth);
  }

  return group;
}

const bonusFrameGeometry = new THREE.TorusGeometry(1.5, 0.22, 16, 42);
const bonusCoreGeometry = new THREE.SphereGeometry(0.7, 18, 14);
const bonusWallGeometry = new THREE.BoxGeometry(4.2, 3.4, 0.45);
const bonusFrameMaterials = {
  rapid: new THREE.MeshStandardMaterial({ color: 0x4dd6ff, emissive: 0x1f84b6, emissiveIntensity: 0.8, metalness: 0.3, roughness: 0.35 }),
  shooter: new THREE.MeshStandardMaterial({ color: 0xffcc44, emissive: 0x8f6a00, emissiveIntensity: 0.85, metalness: 0.25, roughness: 0.35 }),
  pierce: new THREE.MeshStandardMaterial({ color: 0xcc77ff, emissive: 0x5d1a8f, emissiveIntensity: 0.85, metalness: 0.35, roughness: 0.35 }),
};
const bonusCoreMaterials = {
  rapid: new THREE.MeshStandardMaterial({ color: 0x79e5ff, emissive: 0x2eb6ff, emissiveIntensity: 1.0, metalness: 0.1, roughness: 0.2 }),
  shooter: new THREE.MeshStandardMaterial({ color: 0xffe07d, emissive: 0xffb200, emissiveIntensity: 1.0, metalness: 0.1, roughness: 0.25 }),
  pierce: new THREE.MeshStandardMaterial({ color: 0xe2acff, emissive: 0xa448ff, emissiveIntensity: 1.0, metalness: 0.15, roughness: 0.25 }),
};
const bonusWallMaterials = {
  rapid: new THREE.MeshStandardMaterial({ color: 0x2e5d73, emissive: 0x15384a, emissiveIntensity: 0.7, roughness: 0.5, metalness: 0.25 }),
  shooter: new THREE.MeshStandardMaterial({ color: 0x8f6b2b, emissive: 0x533800, emissiveIntensity: 0.7, roughness: 0.5, metalness: 0.25 }),
  pierce: new THREE.MeshStandardMaterial({ color: 0x57307d, emissive: 0x2f114f, emissiveIntensity: 0.7, roughness: 0.5, metalness: 0.3 }),
};
const heartShape = new THREE.Shape();
heartShape.moveTo(0, 0.55);
heartShape.bezierCurveTo(0, 0.95, -0.52, 1.15, -0.78, 0.72);
heartShape.bezierCurveTo(-1.02, 0.32, -0.78, -0.12, -0.42, -0.42);
heartShape.lineTo(0, -0.86);
heartShape.lineTo(0.42, -0.42);
heartShape.bezierCurveTo(0.78, -0.12, 1.02, 0.32, 0.78, 0.72);
heartShape.bezierCurveTo(0.52, 1.15, 0, 0.95, 0, 0.55);

const heartGeometry = new THREE.ExtrudeGeometry(heartShape, {
  depth: 0.45,
  bevelEnabled: true,
  bevelThickness: 0.07,
  bevelSize: 0.07,
  bevelSegments: 2,
  steps: 1,
});
heartGeometry.center();
const heartOutlineGeometry = new THREE.EdgesGeometry(heartGeometry);
const heartMaterial = new THREE.MeshStandardMaterial({
  color: 0xff6ea8,
  emissive: 0xb3295f,
  emissiveIntensity: 0.8,
  roughness: 0.35,
  metalness: 0.15,
});
const heartOutlineMaterial = new THREE.LineBasicMaterial({
  color: 0xffd4e6,
  transparent: true,
  opacity: 0.95,
});

const particleGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
const particleMaterial = new THREE.MeshBasicMaterial({ color: 0xff4444 });

function getSpawnInterval() {
  const rampFactor = Math.min(elapsedTime / 45000, 1);
  const baseInterval =
    BASE_SPAWN_INTERVAL - rampFactor * (BASE_SPAWN_INTERVAL - MIN_SPAWN_INTERVAL);
  const earlyFactor =
    elapsedTime < EARLY_WAVE_DURATION_MS
      ? THREE.MathUtils.lerp(
          EARLY_WAVE_SPEEDUP,
          1,
          elapsedTime / EARLY_WAVE_DURATION_MS
        )
      : 1;
  return baseInterval * earlyFactor;
}

function getMobSpeed() {
  const rampFactor = Math.min(elapsedTime / 45000, 1);
  return BASE_MOB_SPEED + rampFactor * (MAX_MOB_SPEED - BASE_MOB_SPEED);
}

function getBalanceFactor(playerShotsPerSecond) {
  const rawFactor = THREE.MathUtils.clamp(
    playerShotsPerSecond / BASE_PLAYER_SHOTS_PER_SEC,
    0.7,
    1.7
  );
  smoothedBalanceFactor = THREE.MathUtils.lerp(smoothedBalanceFactor, rawFactor, 0.04);
  return smoothedBalanceFactor;
}

function pickLaneRange() {
  return Math.random() < 0.5
    ? { min: LEFT_LANE_X_MIN, max: LEFT_LANE_X_MAX }
    : { min: RIGHT_LANE_X_MIN, max: RIGHT_LANE_X_MAX };
}

function pickRightLaneRange() {
  return { min: RIGHT_LANE_X_MIN, max: RIGHT_LANE_X_MAX };
}

function pickBonusLaneRange() {
  return { min: BONUS_SAFE_RIGHT_X_MIN, max: RIGHT_LANE_X_MAX };
}

function pickBonusKind() {
  const r = Math.random();
  if (r < 0.45) return 'rapid';
  if (r < 0.75) return 'pierce';
  return 'shooter';
}

function getBonusWallHits() {
  const bonusTier = Math.floor(bonusFramesSpawned / BONUS_WALL_HIT_STEP_EVERY);
  return Math.min(BONUS_WALL_BASE_HITS + bonusTier, BONUS_WALL_MAX_HITS);
}

function createHitIndicator() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(2.0, 0.8, 1);

  function update(hits) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(8, 12, 18, 0.78)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);
    ctx.fillStyle = '#e6f0ff';
    ctx.font = 'bold 46px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`HITS: ${Math.max(hits, 0)}`, canvas.width / 2, canvas.height / 2);
    texture.needsUpdate = true;
  }

  sprite.userData.disposeLabel = () => {
    texture.dispose();
    material.dispose();
  };

  return { sprite, update };
}

function createPowerupBadge(kind) {
  const labels = {
    rapid: 'RAPID FIRE',
    shooter: 'DOUBLE SHOT',
    pierce: 'PIERCING',
  };
  const colors = {
    rapid: '#63d6ff',
    shooter: '#ffcf5b',
    pierce: '#d69dff',
  };

  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 120;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(6, 12, 24, 0.82)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = colors[kind];
  ctx.lineWidth = 5;
  ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
  ctx.fillStyle = '#dce9ff';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('POWER UP', canvas.width / 2, 40);
  ctx.fillStyle = colors[kind];
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText(labels[kind], canvas.width / 2, 86);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(3.4, 1.3, 1);
  sprite.userData.disposeLabel = () => {
    texture.dispose();
    material.dispose();
  };

  return sprite;
}

function updateHitIndicators(mob) {
  if (!mob.hitIndicatorUpdaters) return;
  for (const update of mob.hitIndicatorUpdaters) {
    update(mob.hp);
  }
}

function createHeartBadge() {
  const canvas = document.createElement('canvas');
  canvas.width = 220;
  canvas.height = 120;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(12, 4, 10, 0.78)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#ff7cab';
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
  ctx.fillStyle = '#ffc5db';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('HEALTH', canvas.width / 2, 36);
  ctx.font = 'bold 48px sans-serif';
  ctx.fillText('\u2665 +1', canvas.width / 2, 88);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(2.6, 1.4, 1);
  sprite.userData.disposeLabel = () => {
    texture.dispose();
    material.dispose();
  };

  return sprite;
}

function getMobType() {
  const r = Math.random();
  const secondsElapsed = elapsedTime / 1000;

  if (secondsElapsed > 45 && r < 0.06) return 'boss';
  if (secondsElapsed > 30 && r < 0.12) return 'heavy';
  if (secondsElapsed > 15 && r < 0.22) return 'tank';
  if (secondsElapsed > 5 && r < 0.35) return 'fast';
  return 'basic';
}

const TRAILING_POWERUP_CHANCE = 0.4;

function spawnTrailingPowerup(scene, parentMob) {
  const bonusKind = pickBonusKind();
  const core = new THREE.Mesh(bonusCoreGeometry, bonusCoreMaterials[bonusKind]);
  core.scale.setScalar(0.85);

  const badge = createPowerupBadge(bonusKind);
  badge.position.set(0, 1.4, 0);

  const group = new THREE.Group();
  group.add(core);
  group.add(badge);

  const radius = 0.6;
  const zOffset = parentMob.radius + radius + 0.5;
  const x = parentMob.mesh.position.x;
  group.position.set(x, radius + 0.05, SPAWN_Z - zOffset);
  group.castShadow = true;
  scene.add(group);

  activeMobs.push({
    mesh: group,
    type: 'trailing_powerup',
    hp: 1,
    speed: parentMob.speed,
    radius,
    bonusKind,
    scored: false,
    hitIndicatorUpdaters: null,
  });
}

export function spawnLevelBoss(scene, level) {
  const levelMult = Math.pow(1.25, level - 1);
  const hp = Math.round(30 * levelMult);
  const speed = 2.0 + (level - 1) * 0.1;
  const scale = 1.5 + (level - 1) * 0.08;
  const radius = 1.8 * scale;

  const mesh = createSkullMesh(scale);
  mesh.position.set(0, radius + 0.05, SPAWN_Z);
  mesh.castShadow = true;

  const hitLabel = createHitIndicator();
  hitLabel.sprite.position.set(0, radius + 1.0, 0);
  mesh.add(hitLabel.sprite);
  const hitIndicatorUpdaters = [hitLabel.update];
  hitLabel.update(hp);

  scene.add(mesh);

  const mob = {
    mesh,
    type: 'level_boss',
    hp,
    speed,
    radius,
    bonusKind: null,
    scored: false,
    hitIndicatorUpdaters,
    isLevelBoss: true,
  };
  activeMobs.push(mob);
  return mob;
}

function spawnExplosionEffect(scene, position) {
  const geo = new THREE.SphereGeometry(0.3, 12, 8);
  const mat = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.8 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(position);
  scene.add(mesh);
  deathParticles.push({ mesh, velocity: new THREE.Vector3(0, 0, 0), life: 0.4, isExplosion: true });
}

function spawnMob(scene, balanceFactor, score = 0, level = 1, levelMultiplier = 1) {
  const timeSinceBonus = elapsedTime - lastBonusSpawnAt;
  const timeSinceHeart = elapsedTime - lastHeartSpawnAt;
  const shouldForceBonus = score >= BONUS_FORCE_SCORE && timeSinceBonus > BONUS_FORCE_COOLDOWN_MS;
  const shouldSpawnHeart =
    !shouldForceBonus &&
    score >= HEART_UNLOCK_SCORE &&
    timeSinceHeart > HEART_SPAWN_INTERVAL_MS &&
    Math.random() < 0.45;
  const shouldSpawnBonusFrame =
    !shouldSpawnHeart &&
    (shouldForceBonus ||
      (mobsSpawnedTotal > 0 &&
        (mobsSpawnedTotal % BONUS_FRAME_EVERY === 0 || Math.random() < BONUS_FRAME_EXTRA_CHANCE)));
  const type = shouldSpawnHeart ? 'heart' : shouldSpawnBonusFrame ? 'bonus' : getMobType();
  let mesh, hp, speed, radius, bonusKind = null;
  let hitIndicatorUpdaters = null;

  if (type === 'bonus') {
    bonusKind = pickBonusKind();
    const frame = new THREE.Mesh(bonusFrameGeometry, bonusFrameMaterials[bonusKind]);
    frame.rotation.x = Math.PI / 2;
    const core = new THREE.Mesh(bonusCoreGeometry, bonusCoreMaterials[bonusKind]);
    const wall = new THREE.Mesh(bonusWallGeometry, bonusWallMaterials[bonusKind]);
    wall.position.z = 0.65; // Toward the player; acts as the blocking wall.
    wall.castShadow = true;
    wall.receiveShadow = true;

    const group = new THREE.Group();
    group.add(frame);
    group.add(core);
    group.add(wall);

    const badge = createPowerupBadge(bonusKind);
    badge.position.set(0, 2.8, 0);
    group.add(badge);

    const wallLabel = createHitIndicator();
    wallLabel.sprite.position.set(0, 1.2, 0.9);
    group.add(wallLabel.sprite);

    const frameLabel = createHitIndicator();
    frameLabel.sprite.position.set(0, 2.35, -0.2);
    group.add(frameLabel.sprite);

    mesh = group;

    hp = getBonusWallHits();
    speed = getMobSpeed() * (1.0 + (balanceFactor - 1) * 0.2) * levelMultiplier;
    radius = 1.35;
    bonusFramesSpawned++;
    lastBonusSpawnAt = elapsedTime;

    hitIndicatorUpdaters = [wallLabel.update, frameLabel.update];
    for (const update of hitIndicatorUpdaters) update(hp);
    activeMobs.push({
      mesh,
      type,
      hp,
      speed,
      radius,
      bonusKind,
      scored: false,
      hitIndicatorUpdaters,
    });
    mobsSpawnedTotal++;
    return;
  } else if (type === 'heart') {
    const heart = new THREE.Mesh(heartGeometry, heartMaterial);
    heart.scale.set(0.75, 0.75, 0.75);
    const heartOutline = new THREE.LineSegments(
      heartOutlineGeometry,
      heartOutlineMaterial
    );
    heartOutline.scale.set(0.77, 0.77, 0.77);
    const badge = createHeartBadge();
    badge.position.set(0, 1.75, 0);
    mesh = new THREE.Group();
    mesh.add(heart);
    mesh.add(heartOutline);
    mesh.add(badge);
    hp = HEART_HP;
    speed = getMobSpeed() * 0.7 * levelMultiplier;
    radius = 0.8;
    lastHeartSpawnAt = elapsedTime;
  } else if (type === 'boss') {
    hp = 20 + level * 3;
    const sizeScale = 1 + 0.02 * (hp - 20);
    const sz = 2.2 * sizeScale;
    const geo = new THREE.BoxGeometry(sz, sz, sz);
    mesh = new THREE.Mesh(geo, bossMobMaterial);
    speed = getMobSpeed() * 0.35 * balanceFactor * levelMultiplier;
    radius = 1.3 * sizeScale;
  } else if (type === 'heavy') {
    hp = 10 + Math.floor(level * 1.5);
    const sizeScale = 1 + 0.04 * (hp - 10);
    const sz = 1.7 * sizeScale;
    const geo = new THREE.BoxGeometry(sz, sz, sz);
    mesh = new THREE.Mesh(geo, heavyMobMaterial);
    speed = getMobSpeed() * 0.5 * balanceFactor * levelMultiplier;
    radius = 1.0 * sizeScale;
  } else if (type === 'tank') {
    hp = 3 + Math.floor(level / 2);
    const sizeScale = 1 + 0.08 * (hp - 3);
    const sz = 1.4 * sizeScale;
    const geo = new THREE.BoxGeometry(sz, sz, sz);
    mesh = new THREE.Mesh(geo, tankMobMaterial);
    speed = getMobSpeed() * 0.6 * balanceFactor * levelMultiplier;
    radius = 0.85 * sizeScale;
  } else if (type === 'fast') {
    const geo = new THREE.BoxGeometry(0.7, 0.7, 0.7);
    mesh = new THREE.Mesh(geo, fastMobMaterial);
    hp = 1;
    speed = getMobSpeed() * 1.4 * balanceFactor * levelMultiplier;
    radius = 0.42;
  } else {
    mesh = new THREE.Mesh(mobGeometry, mobMaterial);
    hp = 1;
    speed = getMobSpeed() * balanceFactor * levelMultiplier;
    radius = MOB_RADIUS;
  }

  const lane =
    type === 'bonus'
      ? pickBonusLaneRange()
      : type === 'heart' || type === 'tank' || type === 'heavy' || type === 'boss'
        ? pickRightLaneRange()
        : pickLaneRange();
  const x = lane.min + Math.random() * (lane.max - lane.min);
  mesh.position.set(x, radius + 0.05, SPAWN_Z);
  mesh.castShadow = true;

  if (hp > 1) {
    const hitLabel = createHitIndicator();
    hitLabel.sprite.position.set(0, radius + 0.55, 0);
    mesh.add(hitLabel.sprite);
    hitIndicatorUpdaters = [hitLabel.update];
    hitLabel.update(hp);
  }

  scene.add(mesh);

  const mob = {
    mesh,
    type,
    hp,
    speed,
    radius,
    bonusKind,
    scored: false,
    hitIndicatorUpdaters,
  };
  activeMobs.push(mob);
  mobsSpawnedTotal++;

  if ((type === 'tank' || type === 'heavy' || type === 'boss') && Math.random() < TRAILING_POWERUP_CHANCE) {
    spawnTrailingPowerup(scene, mob);
  }
}

export function getActiveMobs() {
  return activeMobs;
}

export function getMobsSpawnedTotal() {
  return mobsSpawnedTotal;
}

export function updateMobs(
  scene,
  delta,
  playerShotsPerSecond = BASE_PLAYER_SHOTS_PER_SEC,
  score = 0,
  level = 1,
  canSpawn = true
) {
  elapsedTime += delta;
  spawnTimer += delta;

  const levelMultiplier = Math.pow(1.25, level - 1);
  const balanceFactor = getBalanceFactor(playerShotsPerSecond);

  if (canSpawn) {
    const interval = getSpawnInterval() / balanceFactor / levelMultiplier;
    if (spawnTimer >= interval) {
      spawnTimer -= interval;
      spawnMob(scene, balanceFactor, score, level, levelMultiplier);
      if (elapsedTime > 20000 && balanceFactor > 1.5 && Math.random() < 0.12) {
        spawnMob(scene, balanceFactor, score, level, levelMultiplier);
      }
    }
  }

  const dt = delta / 1000;
  for (const mob of activeMobs) {
    mob.mesh.position.z += mob.speed * dt;
    if (mob.type === 'level_boss') {
      const strafeRange = 5.0;
      const strafeSpeed = 0.0018 + (mob.speed * 0.0003);
      mob.mesh.position.x = Math.sin(elapsedTime * strafeSpeed + mob.radius) * strafeRange;
      mob.mesh.rotation.y = Math.sin(elapsedTime * 0.002) * 0.3;
      mob.mesh.position.y = mob.radius + 0.05 + Math.sin(elapsedTime * 0.003) * 0.25;
      const pulse = 0.4 + Math.sin(elapsedTime * 0.005) * 0.25;
      mob.mesh.children[0]?.material?.emissiveIntensity !== undefined &&
        (mob.mesh.children[0].material.emissiveIntensity = pulse);
    } else {
      mob.mesh.rotation.y += dt * 1.5;
      if (mob.type === 'bonus') {
        mob.mesh.rotation.z += dt * 1.3;
      } else if (mob.type === 'heart') {
        mob.mesh.rotation.y += dt * 0.7;
        mob.mesh.rotation.z = Math.sin(elapsedTime * 0.0025 + mob.mesh.position.x) * 0.15;
      } else if (mob.type === 'trailing_powerup') {
        mob.mesh.rotation.z += dt * 0.8;
      }
      mob.mesh.position.y = mob.radius + 0.05 + Math.sin(elapsedTime * 0.003 + mob.mesh.position.x * 2) * 0.08;
    }
  }

  updateParticles(scene, dt);
}

export function checkMobUnitCollisions(scene, units, onMobKilled) {
  const toRemoveUnits = [];
  const toRemoveMobs = [];
  const BLAST_RADIUS = 2.5;

  for (const mob of activeMobs) {
    if (mob.scored) continue;
    const mPos = mob.mesh.position;

    for (const unit of units) {
      if (unit.scored || !unit.body) continue;
      const uPos = unit.body.translation();

      const dx = mPos.x - uPos.x;
      const dy = mPos.y - uPos.y;
      const dz = mPos.z - uPos.z;
      const distSq = dx * dx + dy * dy + dz * dz;

      const hitDist = mob.radius + 0.3;
      if (distSq < hitDist * hitDist) {
        mob.hp--;
        updateHitIndicators(mob);
        if (!unit.pierceAll) {
          unit.scored = true;
          toRemoveUnits.push(unit);
        }

        if (mob.hp <= 0) {
          mob.scored = true;
          toRemoveMobs.push(mob);
          spawnDeathParticles(scene, mPos);
          if (onMobKilled) onMobKilled(mob);
        }

        if (unit.explosive) {
          spawnExplosionEffect(scene, mPos);
          for (const other of activeMobs) {
            if (other === mob || other.scored) continue;
            const ox = other.mesh.position.x - mPos.x;
            const oy = other.mesh.position.y - mPos.y;
            const oz = other.mesh.position.z - mPos.z;
            const od = ox * ox + oy * oy + oz * oz;
            if (od < BLAST_RADIUS * BLAST_RADIUS) {
              other.hp--;
              updateHitIndicators(other);
              if (other.hp <= 0 && !other.scored) {
                other.scored = true;
                toRemoveMobs.push(other);
                spawnDeathParticles(scene, other.mesh.position);
                if (onMobKilled) onMobKilled(other);
              }
            }
          }
        }

        break;
      }
    }
  }

  return { toRemoveUnits, toRemoveMobs };
}

export function checkMobsReachedBase() {
  const reached = [];
  for (const mob of activeMobs) {
    if (!mob.scored && mob.mesh.position.z >= PLAYER_BASE_Z) {
      mob.scored = true;
      reached.push(mob);
    }
  }
  return reached;
}

export function removeMob(scene, mob) {
  scene.remove(mob.mesh);
  disposeMobVisual(mob.mesh);
  const idx = activeMobs.indexOf(mob);
  if (idx !== -1) activeMobs.splice(idx, 1);
}

function spawnDeathParticles(scene, position) {
  for (let i = 0; i < 6; i++) {
    const mesh = new THREE.Mesh(particleGeometry, particleMaterial);
    mesh.position.copy(position);
    scene.add(mesh);

    const velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 6,
      Math.random() * 4 + 1,
      (Math.random() - 0.5) * 6
    );

    deathParticles.push({ mesh, velocity, life: 0.6 });
  }
}

function updateParticles(scene, dt) {
  for (let i = deathParticles.length - 1; i >= 0; i--) {
    const p = deathParticles[i];
    p.life -= dt;

    if (p.isExplosion) {
      const progress = 1 - p.life / 0.4;
      p.mesh.scale.setScalar(1 + progress * 6);
      p.mesh.material.opacity = Math.max((1 - progress) * 0.8, 0);
    } else {
      p.velocity.y -= 9.81 * dt;
      p.mesh.position.addScaledVector(p.velocity, dt);
      p.mesh.scale.setScalar(Math.max(p.life / 0.6, 0.01));
    }

    if (p.life <= 0) {
      scene.remove(p.mesh);
      if (p.isExplosion) {
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
      }
      deathParticles.splice(i, 1);
    }
  }
}

export function resetMobs(scene) {
  for (const mob of [...activeMobs]) {
    scene.remove(mob.mesh);
    disposeMobVisual(mob.mesh);
  }
  activeMobs.length = 0;

  for (const p of deathParticles) {
    scene.remove(p.mesh);
  }
  deathParticles.length = 0;

  spawnTimer = 0;
  elapsedTime = 0;
  mobsSpawnedTotal = 0;
  smoothedBalanceFactor = 1;
  bonusFramesSpawned = 0;
  lastBonusSpawnAt = -Infinity;
  lastHeartSpawnAt = -Infinity;
}

function disposeMobVisual(root) {
  if (!root) return;
  root.traverse((child) => {
    if (typeof child.userData.disposeLabel === 'function') {
      child.userData.disposeLabel();
    }
  });

  if (root.geometry && root.geometry !== mobGeometry && root.geometry !== bonusFrameGeometry) {
    root.geometry.dispose();
  }
  if (root.isGroup) {
    for (const child of root.children) {
      if (
        child.geometry &&
        child.geometry !== bonusFrameGeometry &&
        child.geometry !== bonusWallGeometry &&
        child.geometry !== bonusCoreGeometry &&
        child.geometry !== heartGeometry &&
        child.geometry !== heartOutlineGeometry
      ) {
        child.geometry.dispose();
      }
    }
  }
}
