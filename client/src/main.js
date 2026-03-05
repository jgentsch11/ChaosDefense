import * as THREE from 'three';
import { initPhysics, stepPhysics, getWorld, createStaticBody } from './physics.js';
import { initUI, updateScoreHUD, updateLivesHUD, updateLevelHUD, updatePowerupsHUD, showGameOver } from './ui.js';
import { sendScore } from './network.js';
import {
  createCannon,
  setupControls,
  updateCannon,
  activateRapidFire,
  activatePiercingBonus,
  activateDoubleShotBonus,
  activateTripleShotBonus,
  setLevelFireRateBoost,
  getActivePowerups,
  getPlayerShotRate,
} from './cannon.js';
import { createEnemyBase, getEndZoneZ } from './enemies.js';
import { syncUnits, cleanupFallenUnits, getActiveUnits, removeUnit, resetUnits } from './units.js';
import {
  updateMobs,
  checkMobUnitCollisions,
  checkMobsReachedBase,
  removeMob,
  resetMobs,
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

async function startGame(username) {
  try {
    if (scene) {
      resetUnits(scene);
      resetMobs(scene);
    }

    await initPhysics();

    score = 0;
    lives = 5;
    currentLevel = 1;
    updateScoreHUD(score);
    updateLivesHUD(lives);
    updateLevelHUD(currentLevel, getNextLevelScore(currentLevel));
    setLevelFireRateBoost(currentLevel);
    updatePowerupsHUD([]);

    initScene();
    buildLane();
    createCannon(scene);
    createEnemyBase(scene);
    setupControls();

    gameRunning = true;
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
  } catch (err) {
    // #region agent log
    fetch('http://127.0.0.1:7330/ingest/cb392d2b-0b6c-48b4-9afd-15916ccaf411',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'bd77b5'},body:JSON.stringify({sessionId:'bd77b5',location:'main.js:startGame',message:'startGame failed',data:{errMsg:err.message},hypothesisId:'C',timestamp:Date.now()})}).catch(()=>{});
    // #endregion
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

  // Left half floor — horde side (dark red tint)
  const leftGeo = new THREE.BoxGeometry(halfWidth, 0.2, laneLength);
  const leftMat = new THREE.MeshStandardMaterial({ color: 0x3a2030, roughness: 0.7 });
  const leftFloor = new THREE.Mesh(leftGeo, leftMat);
  leftFloor.position.set(-halfWidth / 2, -0.1, -4);
  leftFloor.receiveShadow = true;
  scene.add(leftFloor);

  // Right half floor — enemy lane accent
  const rightGeo = new THREE.BoxGeometry(halfWidth, 0.2, laneLength);
  const rightMat = new THREE.MeshStandardMaterial({ color: 0x2d243e, roughness: 0.7 });
  const rightFloor = new THREE.Mesh(rightGeo, rightMat);
  rightFloor.position.set(halfWidth / 2, -0.1, -4);
  rightFloor.receiveShadow = true;
  scene.add(rightFloor);

  // Physics body for full lane floor
  createStaticBody(getWorld(), { x: 0, y: -0.1, z: -4 }, { x: halfWidth, y: 0.1, z: laneLength / 2 });

  // Keep center lane visually clear so shots have no perceived obstruction.

  // Side labels near the cannon end
  addLaneLabel(scene, 'HORDE', -4.0, 10, '#e94560');
  addLaneLabel(scene, 'ENEMY', 4.0, 10, '#8b7dff');

  // Walls
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
    // Left side dashes
    const lineL = new THREE.Mesh(lineGeo, lineMat);
    lineL.rotation.x = -Math.PI / 2;
    lineL.position.set(-laneCenterOffset, 0.01, z);
    scene.add(lineL);
    roadMarkings.push(lineL);

    // Right side dashes
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
  // Score/remove units ahead of the base collider so they cannot pile up at spawn.
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

    if (mob.type === 'bonus') {
      applyBonusEffect(mob.bonusKind);
    }

    const points =
      mob.type === 'heart'
        ? 0
        : mob.type === 'boss'
          ? 50
          : mob.type === 'heavy'
            ? 20
            : mob.type === 'tank'
              ? 5
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

function processMobsAtBase() {
  const reached = checkMobsReachedBase();
  for (const mob of reached) {
    if (mob.type === 'heart') {
      lives = Math.min(lives + 1, MAX_LIVES);
      updateLivesHUD(lives);
    } else if (mob.type !== 'bonus') {
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

  // Safety fallback in case a bonus type is missing or malformed.
  activateRapidFire();
}

function addScore(points) {
  if (!Number.isFinite(points) || points <= 0) return;
  score += points;
  updateScoreHUD(score);
  sendScore(score);
  checkLevelUps();
}

function getLevelForScore(value) {
  if (value < 100) return 1;
  return 2 + Math.floor((value - 100) / 200);
}

function getNextLevelScore(level) {
  if (level < 1) return 100;
  if (level === 1) return 100;
  return 100 + (level - 1) * 200;
}

function grantLevelUpPowerup(level) {
  const lowTier = ['rapid', 'double', 'pierce'];
  const highTier = ['rapid', 'double', 'pierce', 'triple'];
  const pool = level >= 3 ? highTier : lowTier;
  const roll = pool[Math.floor(Math.random() * pool.length)];

  if (roll === 'rapid') {
    activateRapidFire(12000);
    return;
  }
  if (roll === 'pierce') {
    activatePiercingBonus(12000);
    return;
  }
  if (roll === 'triple') {
    activateTripleShotBonus(10500);
    return;
  }
  activateDoubleShotBonus(13000);
}

function checkLevelUps() {
  const computedLevel = getLevelForScore(score);
  while (currentLevel < computedLevel) {
    currentLevel++;
    setLevelFireRateBoost(currentLevel);
    grantLevelUpPowerup(currentLevel);
  }
  updateLevelHUD(currentLevel, getNextLevelScore(currentLevel));
}

let lastTime = 0;
function gameLoop(timestamp) {
  if (!gameRunning) return;
  requestAnimationFrame(gameLoop);

  let lastStep = 'init';
  try {
    const delta = Math.min(timestamp - lastTime, 100);
    lastTime = timestamp;

    lastStep = 'updateCannon';
    updateCannon(scene, timestamp);
    lastStep = 'stepPhysics';
    stepPhysics();
    lastStep = 'syncUnits';
    syncUnits();
    lastStep = 'checkScoring';
    checkScoring();
    lastStep = 'updateRoadMotion';
    updateRoadMotion(delta);

    lastStep = 'updateMobs';
    updateMobs(scene, delta, getPlayerShotRate(timestamp), score);
    lastStep = 'updatePowerupsHUD';
    updatePowerupsHUD(getActivePowerups(timestamp));
    lastStep = 'processMobCollisions';
    processMobCollisions();
    lastStep = 'processMobsAtBase';
    processMobsAtBase();

    lastStep = 'cleanupFallenUnits';
    cleanupFallenUnits(scene);

    lastStep = 'render';
    renderer.render(scene, camera);
  } catch (err) {
    // #region agent log
    fetch('http://127.0.0.1:7330/ingest/cb392d2b-0b6c-48b4-9afd-15916ccaf411',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'bd77b5'},body:JSON.stringify({sessionId:'bd77b5',location:'main.js:gameLoop',message:'gameLoop error',data:{lastStep,errMsg:err.message,errName:err?.name},hypothesisId:'E',timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    console.error('gameLoop error:', err);
    gameRunning = false;
    showError(err.message);
  }
}

initUI(startGame);
