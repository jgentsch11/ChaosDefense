import * as THREE from 'three';
import { initPhysics, stepPhysics, getWorld, createStaticBody } from './physics.js';
import { initUI, updateScoreHUD, updateLivesHUD, showGameOver } from './ui.js';
import { sendScore } from './network.js';
import { createCannon, setupControls, updateCannon } from './cannon.js';
import { createGates, processGateCollisions } from './gates.js';
import { createEnemyBase, getEndZoneZ } from './enemies.js';
import { syncUnits, cleanupFallenUnits, getActiveUnits, removeUnit } from './units.js';
import {
  updateMobs,
  checkMobUnitCollisions,
  checkMobsReachedBase,
  removeMob,
  resetMobs,
} from './mobs.js';

let scene, camera, renderer;
let score = 0;
let lives = 20;
let gameRunning = false;

async function startGame(username) {
  try {
    await initPhysics();

    score = 0;
    lives = 20;
    updateScoreHUD(score);
    updateLivesHUD(lives);

    initScene();
    buildLane();
    createCannon(scene);
    createGates(scene);
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
  scene.fog = new THREE.Fog(0x151525, 35, 65);

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 14, 16);
  camera.lookAt(0, 0, -4);

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
  const laneLength = 30;
  const laneWidth = 6;
  const halfWidth = laneWidth / 2;

  // Left half floor — horde side (dark red tint)
  const leftGeo = new THREE.BoxGeometry(halfWidth, 0.2, laneLength);
  const leftMat = new THREE.MeshStandardMaterial({ color: 0x3a2030, roughness: 0.7 });
  const leftFloor = new THREE.Mesh(leftGeo, leftMat);
  leftFloor.position.set(-halfWidth / 2, -0.1, -4);
  leftFloor.receiveShadow = true;
  scene.add(leftFloor);

  // Right half floor — bonus side (dark green tint)
  const rightGeo = new THREE.BoxGeometry(halfWidth, 0.2, laneLength);
  const rightMat = new THREE.MeshStandardMaterial({ color: 0x203a30, roughness: 0.7 });
  const rightFloor = new THREE.Mesh(rightGeo, rightMat);
  rightFloor.position.set(halfWidth / 2, -0.1, -4);
  rightFloor.receiveShadow = true;
  scene.add(rightFloor);

  // Physics body for full lane floor
  createStaticBody(getWorld(), { x: 0, y: -0.1, z: -4 }, { x: halfWidth, y: 0.1, z: laneLength / 2 });

  // Center divider line
  const divGeo = new THREE.PlaneGeometry(0.08, laneLength);
  const divMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
  const divider = new THREE.Mesh(divGeo, divMat);
  divider.rotation.x = -Math.PI / 2;
  divider.position.set(0, 0.02, -4);
  scene.add(divider);

  // Side labels near the cannon end
  addLaneLabel(scene, 'HORDE', -1.5, 7, '#e94560');
  addLaneLabel(scene, 'BONUS', 1.5, 7, '#00cc66');

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

  for (let z = 10; z > -19; z -= 3) {
    // Left side dashes
    const lineL = new THREE.Mesh(lineGeo, lineMat);
    lineL.rotation.x = -Math.PI / 2;
    lineL.position.set(-1.5, 0.01, z);
    scene.add(lineL);

    // Right side dashes
    const lineR = new THREE.Mesh(lineGeo, lineMat);
    lineR.rotation.x = -Math.PI / 2;
    lineR.position.set(1.5, 0.01, z);
    scene.add(lineR);
  }
}

function checkScoring() {
  const units = getActiveUnits();
  const scoreZ = getEndZoneZ() + 2;

  for (const unit of [...units]) {
    if (unit.scored || !unit.body) continue;

    const pos = unit.body.translation();
    if (pos.z < scoreZ) {
      unit.scored = true;
      score += unit.type === 'tank' ? 10 : 1;
      updateScoreHUD(score);
      sendScore(score);

      setTimeout(() => removeUnit(scene, unit), 300);
    }
  }
}

function processMobCollisions() {
  const units = getActiveUnits();

  const { toRemoveUnits, toRemoveMobs } = checkMobUnitCollisions(scene, units, (mob) => {
    const points = mob.type === 'tank' ? 5 : mob.type === 'fast' ? 2 : 1;
    score += points;
    updateScoreHUD(score);
    sendScore(score);
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
    lives--;
    updateLivesHUD(lives);
    removeMob(scene, mob);
  }

  if (lives <= 0) {
    gameRunning = false;
    showGameOver(score, () => {
      resetMobs(scene);
      startGame('');
    });
  }
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
    lastStep = 'processGateCollisions';
    processGateCollisions(scene);
    lastStep = 'checkScoring';
    checkScoring();

    lastStep = 'updateMobs';
    updateMobs(scene, delta);
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
