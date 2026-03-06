import * as THREE from 'three';
import { initPhysics, stepPhysics, getWorld, createStaticBody } from './physics.js';
import {
  initUI,
  updateScoreHUD,
  updateLivesHUD,
  updateLevelHUD,
  updateLevelTimer,
  updatePowerupsHUD,
  showGameOver,
  showBossWarning,
  hideBossWarning,
  showLevelComplete,
} from './ui.js';
import { sendScore } from './network.js';
import {
  createCannon,
  setupControls,
  updateCannon,
  activateRapidFire,
  activatePiercingBonus,
  activateDoubleShotBonus,
  activateTripleShotBonus,
  activateWideCannon,
  activateExplosiveShots,
  setLevelFireRateBoost,
  getActivePowerups,
  getPlayerShotRate,
  getCannonPosition,
} from './cannon.js';
import { createEnemyBase, getEndZoneZ } from './enemies.js';
import { syncUnits, cleanupFallenUnits, getActiveUnits, removeUnit, resetUnits } from './units.js';
import {
  updateMobs,
  checkMobUnitCollisions,
  checkMobsReachedBase,
  removeMob,
  resetMobs,
  getActiveMobs,
  spawnLevelBoss,
} from './mobs.js';

let scene, camera, renderer;
let score = 0;
let lives = 5;
let currentLevel = 1;
const MAX_LIVES = 10;
let gameRunning = false;
const roadMarkings = [];
let roadScrollMinZ = -19;
let roadScrollMaxZ = 10;
const ROAD_SCROLL_SPEED = 9;

const LEVEL_DURATION_MS = 60000;
const BOSS_WARNING_TIME_MS = 55000;

let levelState = 'playing';
let levelElapsed = 0;
let powerupPickups = [];

async function startGame(username) {
  try {
    if (scene) {
      resetUnits(scene);
      resetMobs(scene);
      clearPowerupPickups();
    }

    await initPhysics();

    score = 0;
    lives = 5;
    currentLevel = 1;
    levelState = 'playing';
    levelElapsed = 0;
    updateScoreHUD(score);
    updateLivesHUD(lives);
    updateLevelHUD(currentLevel);
    updateLevelTimer(LEVEL_DURATION_MS / 1000);
    setLevelFireRateBoost(currentLevel);
    updatePowerupsHUD([]);
    hideBossWarning();

    initScene();
    buildLane();
    createCannon(scene);
    createEnemyBase(scene);
    setupControls();

    gameRunning = true;
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
  } catch (err) {
    console.error('startGame failed:', err);
    showError(err.message);
  }
}

function showError(msg) {
  let el = document.getElementById('error-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'error-overlay';
    el.style.cssText =
      'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;' +
      'background:rgba(0,0,0,0.9);z-index:200;color:#e94560;font-family:monospace;' +
      'font-size:1.1rem;padding:40px;text-align:center;white-space:pre-wrap;';
    document.body.appendChild(el);
  }
  el.textContent = 'Game Error:\n\n' + msg;
}

function initScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x151525);
  scene.fog = new THREE.Fog(0x151525, 50, 120);

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 15, 18);
  camera.lookAt(0, 0, -10);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  const ambientLight = new THREE.AmbientLight(0x667799, 1.0);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffeedd, 1.8);
  dirLight.position.set(5, 15, 10);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 50;
  dirLight.shadow.camera.left = -15;
  dirLight.shadow.camera.right = 15;
  dirLight.shadow.camera.top = 15;
  dirLight.shadow.camera.bottom = -25;
  scene.add(dirLight);

  const rimLight = new THREE.PointLight(0xe94560, 0.8, 30);
  rimLight.position.set(-5, 5, -15);
  scene.add(rimLight);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

function buildLane() {
  const laneLength = 180;
  const laneWidth = 16;
  const halfWidth = laneWidth / 2;

  const leftGeo = new THREE.BoxGeometry(halfWidth, 0.2, laneLength);
  const leftMat = new THREE.MeshStandardMaterial({ color: 0x3a2030, roughness: 0.7 });
  const leftFloor = new THREE.Mesh(leftGeo, leftMat);
  leftFloor.position.set(-halfWidth / 2, -0.1, -4);
  leftFloor.receiveShadow = true;
  scene.add(leftFloor);

  const rightGeo = new THREE.BoxGeometry(halfWidth, 0.2, laneLength);
  const rightMat = new THREE.MeshStandardMaterial({ color: 0x2d243e, roughness: 0.7 });
  const rightFloor = new THREE.Mesh(rightGeo, rightMat);
  rightFloor.position.set(halfWidth / 2, -0.1, -4);
  rightFloor.receiveShadow = true;
  scene.add(rightFloor);

  createStaticBody(getWorld(), { x: 0, y: -0.1, z: -4 }, { x: halfWidth, y: 0.1, z: laneLength / 2 });

  addLaneLabel(scene, 'HORDE', -4.0, 10, '#e94560');
  addLaneLabel(scene, 'ENEMY', 4.0, 10, '#8b7dff');

  const wallHeight = 0.8;
  const wallThickness = 0.15;
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x1a4a80, transparent: true, opacity: 0.6 });
  const wallGeo = new THREE.BoxGeometry(wallThickness, wallHeight, laneLength);

  const leftWall = new THREE.Mesh(wallGeo, wallMat);
  leftWall.position.set(-halfWidth, wallHeight / 2, -4);
  scene.add(leftWall);
  createStaticBody(getWorld(), { x: -halfWidth, y: wallHeight / 2, z: -4 }, { x: wallThickness / 2, y: wallHeight / 2, z: laneLength / 2 });

  const rightWall = new THREE.Mesh(wallGeo, wallMat);
  rightWall.position.set(halfWidth, wallHeight / 2, -4);
  scene.add(rightWall);
  createStaticBody(getWorld(), { x: halfWidth, y: wallHeight / 2, z: -4 }, { x: wallThickness / 2, y: wallHeight / 2, z: laneLength / 2 });

  addLaneMarkings(laneWidth, laneLength);
}

function addLaneLabel(scene, text, x, z, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.font = 'bold 36px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 32);

  const texture = new THREE.CanvasTexture(canvas);
  const geo = new THREE.PlaneGeometry(2, 0.5);
  const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, 0.02, z);
  scene.add(mesh);
}

function addLaneMarkings(laneWidth, laneLength) {
  const lineGeo = new THREE.PlaneGeometry(0.05, 1.2);
  const lineMat = new THREE.MeshBasicMaterial({ color: 0x223355, side: THREE.DoubleSide });
  const laneCenterOffset = laneWidth * 0.25;
  roadMarkings.length = 0;
  roadScrollMinZ = -4 - laneLength / 2 + 1.2;
  roadScrollMaxZ = -4 + laneLength / 2 - 1.2;

  for (let z = roadScrollMaxZ; z > roadScrollMinZ; z -= 2.8) {
    const lineL = new THREE.Mesh(lineGeo, lineMat);
    lineL.rotation.x = -Math.PI / 2;
    lineL.position.set(-laneCenterOffset, 0.01, z);
    scene.add(lineL);
    roadMarkings.push(lineL);

    const lineR = new THREE.Mesh(lineGeo, lineMat);
    lineR.rotation.x = -Math.PI / 2;
    lineR.position.set(laneCenterOffset, 0.01, z);
    scene.add(lineR);
    roadMarkings.push(lineR);
  }
}

function updateRoadMotion(deltaMs) {
  const dz = (deltaMs / 1000) * ROAD_SCROLL_SPEED;
  const span = roadScrollMaxZ - roadScrollMinZ;
  for (const dash of roadMarkings) {
    dash.position.z += dz;
    if (dash.position.z > roadScrollMaxZ) {
      dash.position.z -= span;
    }
  }
}

function checkScoring() {
  const units = getActiveUnits();
  const scoreZ = getEndZoneZ() + 1.4;

  for (const unit of [...units]) {
    if (unit.scored || !unit.body) continue;

    const pos = unit.body.translation();
    if (pos.z <= scoreZ) {
      unit.scored = true;
      addScore(unit.type === 'tank' ? 10 : 1);

      setTimeout(() => removeUnit(scene, unit), 300);
    }
  }
}

function processMobCollisions() {
  const units = getActiveUnits();

  const { toRemoveUnits, toRemoveMobs } = checkMobUnitCollisions(scene, units, (mob) => {
    if (mob.type === 'heart') {
      lives = Math.min(lives + 1, MAX_LIVES);
      updateLivesHUD(lives);
    }

    if (mob.type === 'bonus' || mob.type === 'trailing_powerup') {
      applyBonusEffect(mob.bonusKind);
    }

    if (mob.isLevelBoss) {
      onLevelBossKilled();
    }

    const points =
      mob.type === 'heart'
        ? 0
        : mob.isLevelBoss
          ? 100
          : mob.type === 'boss'
            ? 50
            : mob.type === 'heavy'
              ? 20
              : mob.type === 'tank'
                ? 5
                : mob.type === 'trailing_powerup'
                  ? 3
                  : mob.type === 'fast'
                    ? 2
                    : mob.type === 'bonus'
                      ? 8
                      : 1;
    addScore(points);
  });

  for (const unit of toRemoveUnits) {
    removeUnit(scene, unit);
  }
  for (const mob of toRemoveMobs) {
    removeMob(scene, mob);
  }
}

function onLevelBossKilled() {
  levelState = 'level_complete';
  hideBossWarning();

  setTimeout(() => {
    resetMobs(scene);
    resetUnits(scene);
  }, 400);

  showLevelComplete(currentLevel, () => {
    levelState = 'powerup_select';
    resetMobs(scene);
    resetUnits(scene);
    spawnPowerupPickups();
  });
}

function processMobsAtBase() {
  const reached = checkMobsReachedBase();
  for (const mob of reached) {
    if (mob.isLevelBoss) {
      lives = 0;
      updateLivesHUD(lives);
      removeMob(scene, mob);
      break;
    }

    if (mob.type === 'heart') {
      lives = Math.min(lives + 1, MAX_LIVES);
      updateLivesHUD(lives);
    } else if (mob.type !== 'bonus' && mob.type !== 'trailing_powerup') {
      const damage = mob.type === 'boss' ? 3 : mob.type === 'heavy' ? 2 : 1;
      lives -= damage;
      updateLivesHUD(lives);
    }
    removeMob(scene, mob);
  }

  if (lives <= 0) {
    gameRunning = false;
    showGameOver(score, () => {
      resetUnits(scene);
      resetMobs(scene);
      clearPowerupPickups();
      startGame('');
    });
  }
}

function applyBonusEffect(bonusKind) {
  if (bonusKind === 'rapid') {
    activateRapidFire();
    return;
  }
  if (bonusKind === 'pierce') {
    activatePiercingBonus();
    return;
  }
  if (bonusKind === 'shooter') {
    activateDoubleShotBonus();
    return;
  }
  activateRapidFire();
}

function addScore(points) {
  if (!Number.isFinite(points) || points <= 0) return;
  score += points;
  updateScoreHUD(score);
  sendScore(score);
}

// ── Power-Up Pickup System ─────────────────────────────────

const POWERUP_POOL = [
  { id: 'rapid', label: 'RAPID FIRE', color: 0x4dd6ff, activate: () => activateRapidFire(12000) },
  { id: 'double', label: 'DOUBLE SHOT', color: 0xffcc44, activate: () => activateDoubleShotBonus(13000) },
  { id: 'triple', label: 'TRIPLE SHOT', color: 0xff44aa, activate: () => activateTripleShotBonus(10500) },
  { id: 'pierce', label: 'PIERCING', color: 0xcc77ff, activate: () => activatePiercingBonus(9000) },
  { id: 'wide', label: 'WIDE CANNON', color: 0x44ff88, activate: () => activateWideCannon(12000) },
  { id: 'explosive', label: 'EXPLOSIVE', color: 0xff6600, activate: () => activateExplosiveShots(12000) },
];

const PICKUP_SPAWN_Z = -15;
const PICKUP_SPEED = 3.5;

function spawnPowerupPickups() {
  clearPowerupPickups();

  const shuffled = [...POWERUP_POOL].sort(() => Math.random() - 0.5);
  const chosen = shuffled.slice(0, 3);
  const xPositions = [-4, 0, 4];

  for (let i = 0; i < 3; i++) {
    const def = chosen[i];
    const group = new THREE.Group();

    const geo = new THREE.SphereGeometry(0.8, 16, 16);
    const mat = new THREE.MeshStandardMaterial({
      color: def.color,
      emissive: def.color,
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0.85,
    });
    const sphere = new THREE.Mesh(geo, mat);
    sphere.castShadow = true;
    group.add(sphere);

    const ringGeo = new THREE.TorusGeometry(1.1, 0.08, 8, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.5 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    group.add(ring);

    const badge = createPickupLabel(def.label, def.color);
    badge.position.set(0, 1.8, 0);
    group.add(badge);

    group.position.set(xPositions[i], 1.2, PICKUP_SPAWN_Z);
    scene.add(group);

    powerupPickups.push({
      mesh: group,
      def,
      baseY: 1.2,
      speed: PICKUP_SPEED,
      spawnTime: performance.now(),
    });
  }
}

function createPickupLabel(text, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 80;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(6, 12, 24, 0.85)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const hex = '#' + new THREE.Color(color).getHexString();
  ctx.strokeStyle = hex;
  ctx.lineWidth = 4;
  ctx.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);
  ctx.fillStyle = hex;
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(2.8, 0.7, 1);
  sprite.userData.disposeLabel = () => {
    texture.dispose();
    material.dispose();
  };
  return sprite;
}

function updatePowerupPickups(time, delta) {
  const dt = delta / 1000;
  for (const pickup of powerupPickups) {
    pickup.mesh.position.z += pickup.speed * dt;
    const age = (time - pickup.spawnTime) / 1000;
    pickup.mesh.position.y = pickup.baseY + Math.sin(age * 2.5) * 0.25;
    pickup.mesh.rotation.y += 0.02;
  }

  // Remove pickups that drift past the cannon without being collected
  const expired = powerupPickups.filter(p => p.mesh.position.z > 14);
  for (const p of expired) {
    p.mesh.traverse((child) => {
      if (typeof child.userData?.disposeLabel === 'function') {
        child.userData.disposeLabel();
      }
    });
    scene.remove(p.mesh);
  }
  if (expired.length > 0) {
    powerupPickups = powerupPickups.filter(p => p.mesh.position.z <= 14);
  }

  // If all pickups are gone without a pick, respawn a fresh set
  if (powerupPickups.length === 0 && levelState === 'powerup_select') {
    spawnPowerupPickups();
  }
}

function checkPowerupPickupCollision() {
  const cannonPos = getCannonPosition();
  const PICKUP_RADIUS = 2.0;

  for (const pickup of powerupPickups) {
    const dx = cannonPos.x - pickup.mesh.position.x;
    const dz = cannonPos.z - pickup.mesh.position.z;
    const distSq = dx * dx + dz * dz;

    if (distSq < PICKUP_RADIUS * PICKUP_RADIUS) {
      pickup.def.activate();
      clearPowerupPickups();
      startNextLevel();
      return;
    }
  }
}

function clearPowerupPickups() {
  for (const pickup of powerupPickups) {
    pickup.mesh.traverse((child) => {
      if (typeof child.userData?.disposeLabel === 'function') {
        child.userData.disposeLabel();
      }
    });
    scene.remove(pickup.mesh);
  }
  powerupPickups = [];
}

function startNextLevel() {
  currentLevel++;
  levelElapsed = 0;
  levelState = 'playing';
  setLevelFireRateBoost(currentLevel);
  updateLevelHUD(currentLevel);
  updateLevelTimer(LEVEL_DURATION_MS / 1000);
}

// ── Game Loop ──────────────────────────────────────────────

let lastTime = 0;
function gameLoop(timestamp) {
  if (!gameRunning) return;
  requestAnimationFrame(gameLoop);

  let lastStep = 'init';
  try {
    const delta = Math.min(timestamp - lastTime, 100);
    lastTime = timestamp;

    const canFire =
      levelState === 'playing' ||
      levelState === 'boss_warning' ||
      levelState === 'boss_fight';

    lastStep = 'updateCannon';
    updateCannon(scene, timestamp, canFire);
    lastStep = 'stepPhysics';
    stepPhysics();
    lastStep = 'syncUnits';
    syncUnits();

    if (levelState === 'playing' || levelState === 'boss_warning' || levelState === 'boss_fight') {
      lastStep = 'checkScoring';
      checkScoring();
      lastStep = 'updateRoadMotion';
      updateRoadMotion(delta);

      const canSpawn = levelState === 'playing';
      lastStep = 'updateMobs';
      updateMobs(scene, delta, getPlayerShotRate(timestamp), score, currentLevel, canSpawn);
      lastStep = 'updatePowerupsHUD';
      updatePowerupsHUD(getActivePowerups(timestamp));
      lastStep = 'processMobCollisions';
      processMobCollisions();
      lastStep = 'processMobsAtBase';
      processMobsAtBase();
      lastStep = 'cleanupFallenUnits';
      cleanupFallenUnits(scene);

      if (levelState === 'playing' || levelState === 'boss_warning') {
        levelElapsed += delta;
        const remaining = Math.max(0, (LEVEL_DURATION_MS - levelElapsed) / 1000);
        updateLevelTimer(remaining);
      }

      if (levelState === 'playing' && levelElapsed >= BOSS_WARNING_TIME_MS) {
        levelState = 'boss_warning';
        showBossWarning();
      }

      if (levelState === 'boss_warning' && levelElapsed >= LEVEL_DURATION_MS) {
        levelState = 'boss_fight';
        hideBossWarning();
        const remainingMobs = [...getActiveMobs()];
        for (const mob of remainingMobs) {
          removeMob(scene, mob);
        }
        spawnLevelBoss(scene, currentLevel);
        updateLevelTimer(0);

        const timerEl = document.getElementById('level-timer-value');
        if (timerEl) timerEl.textContent = 'BOSS FIGHT';
      }
    } else if (levelState === 'powerup_select') {
      lastStep = 'updatePowerupPickups';
      updatePowerupPickups(timestamp, delta);
      checkPowerupPickupCollision();
      updateRoadMotion(delta);
    }

    lastStep = 'render';
    renderer.render(scene, camera);
  } catch (err) {
    console.error('gameLoop error at', lastStep, ':', err);
    gameRunning = false;
    showError(err.message);
  }
}

initUI(startGame);
