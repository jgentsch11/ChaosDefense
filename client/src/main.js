import * as THREE from 'three';
import { initPhysics, stepPhysics, getWorld, createStaticBody } from './physics.js';
import { initUI, updateScoreHUD } from './ui.js';
import { sendScore } from './network.js';
import { createCannon, setupControls, updateCannon } from './cannon.js';
import { createGates, processGateCollisions } from './gates.js';
import { createEnemyBase, getEndZoneSensor } from './enemies.js';
import { syncUnits, cleanupFallenUnits, getActiveUnits, removeUnit } from './units.js';

let scene, camera, renderer;
let score = 0;
let gameRunning = false;

async function startGame(username) {
  await initPhysics();

  initScene();
  buildLane();
  createCannon(scene);
  createGates(scene);
  createEnemyBase(scene);
  setupControls(renderer.domElement);

  gameRunning = true;
  requestAnimationFrame(gameLoop);
}

function initScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a1a);
  scene.fog = new THREE.Fog(0x0a0a1a, 30, 60);

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 14, 16);
  camera.lookAt(0, 0, -4);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  const ambientLight = new THREE.AmbientLight(0x334466, 0.6);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffeedd, 1.2);
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

  const laneGeo = new THREE.BoxGeometry(laneWidth, 0.2, laneLength);
  const laneMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a2e,
    roughness: 0.8,
  });
  const lane = new THREE.Mesh(laneGeo, laneMat);
  lane.position.set(0, -0.1, -4);
  lane.receiveShadow = true;
  scene.add(lane);

  createStaticBody(getWorld(), { x: 0, y: -0.1, z: -4 }, { x: laneWidth / 2, y: 0.1, z: laneLength / 2 });

  const wallHeight = 0.8;
  const wallThickness = 0.15;
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x0f3460, transparent: true, opacity: 0.5 });

  const wallGeo = new THREE.BoxGeometry(wallThickness, wallHeight, laneLength);

  const leftWall = new THREE.Mesh(wallGeo, wallMat);
  leftWall.position.set(-laneWidth / 2, wallHeight / 2, -4);
  scene.add(leftWall);
  createStaticBody(getWorld(), { x: -laneWidth / 2, y: wallHeight / 2, z: -4 }, { x: wallThickness / 2, y: wallHeight / 2, z: laneLength / 2 });

  const rightWall = new THREE.Mesh(wallGeo, wallMat);
  rightWall.position.set(laneWidth / 2, wallHeight / 2, -4);
  scene.add(rightWall);
  createStaticBody(getWorld(), { x: laneWidth / 2, y: wallHeight / 2, z: -4 }, { x: wallThickness / 2, y: wallHeight / 2, z: laneLength / 2 });

  addLaneMarkings(laneWidth, laneLength);
}

function addLaneMarkings(laneWidth, laneLength) {
  const lineGeo = new THREE.PlaneGeometry(0.05, 1.2);
  const lineMat = new THREE.MeshBasicMaterial({ color: 0x223355, side: THREE.DoubleSide });

  for (let z = 10; z > -19; z -= 3) {
    const line = new THREE.Mesh(lineGeo, lineMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(0, 0.01, z);
    scene.add(line);
  }
}

function checkScoring() {
  const units = getActiveUnits();
  const endZone = getEndZoneSensor();
  if (!endZone) return;

  for (const unit of [...units]) {
    if (unit.scored) continue;

    const unitColliders = [];
    unit.body.forEachCollider((c) => unitColliders.push(c));
    if (unitColliders.length === 0) continue;

    const world = getWorld();
    if (world.intersectionPair(endZone, unitColliders[0])) {
      unit.scored = true;
      score += unit.type === 'tank' ? 10 : 1;
      updateScoreHUD(score);
      sendScore(score);

      setTimeout(() => removeUnit(scene, unit), 300);
    }
  }
}

let lastTime = 0;
function gameLoop(timestamp) {
  if (!gameRunning) return;
  requestAnimationFrame(gameLoop);

  const delta = timestamp - lastTime;
  lastTime = timestamp;

  updateCannon(scene, timestamp);
  stepPhysics();
  syncUnits();
  processGateCollisions(scene);
  checkScoring();
  cleanupFallenUnits(scene);

  renderer.render(scene, camera);
}

initUI(startGame);
