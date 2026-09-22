// three.js подключается через three.min.js (глобальный объект THREE)

try {
  const ok = !!THREE && !!THREE.WebGLRenderer;
  if (!ok) throw new Error('no three');
  document.getElementById('load-warn').classList.add('hidden');
} catch (e) {
  document.getElementById('load-warn').classList.remove('hidden');
}

// ============================================================ SCENE
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fb8de);
scene.fog = new THREE.Fog(0x8fb8de, 60, 160);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 400);
camera.rotation.order = 'YXZ';
scene.add(camera);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0x8fb8de);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// lights
const hemi = new THREE.HemisphereLight(0xcfe4ff, 0x7a6752, 0.95);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0cc, 1.15);
sun.position.set(40, 55, 25);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -45;
sun.shadow.camera.right = 45;
sun.shadow.camera.top = 45;
sun.shadow.camera.bottom = -45;
sun.shadow.camera.far = 160;
scene.add(sun);

// ============================================================ SHARED GEO / MAT
const shared = {
  box: new THREE.BoxGeometry(1, 1, 1),
};
const mats = {
  ground: new THREE.MeshStandardMaterial({ color: 0x8d9186, roughness: 1 }),
  gravel: new THREE.MeshStandardMaterial({ color: 0xa6a79c, roughness: 1 }),
  wood: new THREE.MeshStandardMaterial({ color: 0xb08950, roughness: 0.9 }),
  woodDark: new THREE.MeshStandardMaterial({ color: 0x8a6538, roughness: 0.9 }),
  concrete: new THREE.MeshStandardMaterial({ color: 0x9a9aa0, roughness: 0.85 }),
  metalRed: new THREE.MeshStandardMaterial({ color: 0xa04a3a, roughness: 0.55, metalness: 0.4 }),
  metalBlue: new THREE.MeshStandardMaterial({ color: 0x4a5f7a, roughness: 0.55, metalness: 0.4 }),
  barrier: new THREE.MeshStandardMaterial({ color: 0xc2b280, roughness: 0.9 }),
  column: new THREE.MeshStandardMaterial({ color: 0x9d9bb3, roughness: 0.6, metalness: 0.2 }),
};

const colliders = [];       // static OBB (axis aligned) for physics
const envMeshes = [];       // meshes for raycasts (hitscan)
const ARENA = 60;

function addBox(x, y, z, w, h, d, mat, { raycast = true, shadow = true } = {}) {
  const mesh = new THREE.Mesh(shared.box, mat);
  mesh.scale.set(w, h, d);
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  scene.add(mesh);
  if (raycast) envMeshes.push(mesh);
  colliders.push({
    min: { x: x - w / 2, y, z: z - d / 2 },
    max: { x: x + w / 2, y: y + h, z: z + d / 2 },
    mesh,
  });
  return mesh;
}

// ground
const ground = new THREE.Mesh(shared.box, mats.ground);
ground.scale.set(ARENA * 1.3, 1, ARENA * 1.3);
ground.position.y = -0.6;
ground.receiveShadow = true;
scene.add(ground);
envMeshes.push(ground);

// border walls
const WL = ARENA / 2;
addBox(0, 0, -WL - 0.5, ARENA + 2, 6, 1, mats.concrete);
addBox(0, 0, WL + 0.5, ARENA + 2, 6, 1, mats.concrete);
addBox(-WL - 0.5, 0, 0, 1, 6, ARENA + 2, mats.concrete);
addBox(WL + 0.5, 0, 0, 1, 6, ARENA + 2, mats.concrete);

// ---- cover layout (x, z, w, d, h, mat)
const covers = [
  // ===== ЦЕНТРАЛЬНАЯ ЛОКАЦИЯ (кольцо с 4 входами) =====
  // северная стена (проход по центру, x: -1.5..1.5)
  [-4.5, -7, 6, 1, 2.2, mats.concrete],
  [4.5, -7, 6, 1, 2.2, mats.concrete],
  // южная стена
  [-4.5, 7, 6, 1, 2.2, mats.concrete],
  [4.5, 7, 6, 1, 2.2, mats.concrete],
  // западная стена (проход по центру, z: -1.5..1.5)
  [-7, -4, 1, 5, 2.2, mats.concrete],
  [-7, 4, 1, 5, 2.2, mats.concrete],
  // восточная стена
  [7, -4, 1, 5, 2.2, mats.concrete],
  [7, 4, 1, 5, 2.2, mats.concrete],
  // ядро в центре
  [0, 0, 3, 3, 2.2, mats.metalRed],
  // низкие укрытия-нычки вокруг ядра
  [0, -3.5, 4, 1, 1.2, mats.barrier],
  [0, 3.5, 4, 1, 1.2, mats.barrier],
  [-3.5, 0, 1, 4, 1.2, mats.barrier],
  [3.5, 0, 1, 4, 1.2, mats.barrier],
  // ящики в углах (нычки для приседания)
  [-4.5, -4.5, 2, 2, 1.6, mats.wood],
  [4.5, -4.5, 2, 2, 1.6, mats.wood],
  [-4.5, 4.5, 2, 2, 1.6, mats.wood],
  [4.5, 4.5, 2, 2, 1.6, mats.wood],
  // ===== /ЦЕНТРАЛЬНАЯ ЛОКАЦИЯ =====
  // long low walls
  [-10, -8, 7, 1, 1.7, mats.concrete],
  [10, -8, 7, 1, 1.7, mats.concrete],
  [-10, 8, 7, 1, 1.7, mats.concrete],
  [10, 8, 7, 1, 1.7, mats.concrete],
  // tall cover with gaps (corridors)
  [-20, 0, 1, 9, 2.8, mats.metalBlue],
  [20, 0, 1, 9, 2.8, mats.metalBlue],
  [0, -18, 9, 1, 2.8, mats.metalBlue],
  [0, 18, 9, 1, 2.8, mats.metalBlue],
  // crates
  [-6, 4, 2, 2, 1.8, mats.wood],
  [6, -4, 2, 2, 1.8, mats.wood],
  [-6, -14, 2, 2, 1.8, mats.wood],
  [6, 14, 2, 2, 1.8, mats.wood],
  [-16, 14, 2, 2, 1.2, mats.woodDark],
  [16, -14, 2, 2, 1.2, mats.woodDark],
  [-16, -6, 1.2, 1.2, 2.2, mats.wood],   // tall stack
  [16, 6, 1.2, 1.2, 2.2, mats.wood],
  [-24, 12, 3, 1, 1.1, mats.barrier],
  [24, 12, 3, 1, 1.1, mats.barrier],
  [-24, -12, 3, 1, 1.1, mats.barrier],
  [24, -12, 3, 1, 1.1, mats.barrier],
  [-14, -16, 1, 1, 2.2, mats.metalRed],
  [14, 16, 1, 1, 2.2, mats.metalRed],
  [-18, 4, 1, 1, 2.2, mats.metalRed],
  [18, -4, 1, 1, 2.2, mats.metalRed],
  // corner bunkers
  [-26, -26, 6, 6, 1.6, mats.concrete],
  [26, -26, 6, 6, 1.6, mats.concrete],
  [-26, 26, 6, 6, 1.6, mats.concrete],
  [26, 26, 6, 6, 1.6, mats.concrete],
  // area boundary walls inside (openings)
  [-12, -22, 16, 1, 2, mats.concrete],
  [12, 22, 16, 1, 2, mats.concrete],
];
for (const c of covers) addBox(c[0], 0, c[1], c[2], c[3], c[4], c[5]);

// decorative columns
for (let a = 0; a < 6; a++) {
  const ang = (a / 6) * Math.PI * 2;
  addBox(Math.cos(ang) * 27, 0, Math.sin(ang) * 27, 1, 4.2, 1, mats.column, { shadow: false });
}

// spawn points
// центральная локация — сюда боты падают чаще всего
const centerSpawns = [
  [0, -6], [0, 6], [-6, 0], [6, 0],              // входы в хаб
  [-2.5, -6], [2.5, -6], [-2.5, 6], [2.5, 6],    // у северного/южного входа
  [-6, -2.5], [6, -2.5], [-6, 2.5], [6, 2.5],    // у западного/восточного входа
  [-5, -1.5], [5, -1.5], [-5, 1.5], [5, 1.5],    // угловые нычки внутри кольца
];
const edgeSpawns = [
  [-26, -20], [26, -20], [-26, 20], [26, 20],
  [-20, -26], [20, -26], [-20, 26], [20, 26],
  [0, -26], [0, 26], [-26, 0], [26, 0],
];
const CENTER_SPAWN_CHANCE = 0.7; // 70% ботов появляются в центре

function pickSpawnPoint() {
  const arr = Math.random() < CENTER_SPAWN_CHANCE ? centerSpawns : edgeSpawns;
  return arr[Math.floor(Math.random() * arr.length)];
}

// ============================================================ PLAYER
const player = {
  pos: new THREE.Vector3(0, 0, 12),
  vel: new THREE.Vector3(0, 0, 0),
  yaw: Math.PI,
  pitch: 0,
  radius: 0.45,
  height: 1.7,
  eye: 1.55,
  health: 100,
  maxHealth: 100,
  grounded: true,
  crouch: 0,
  dead: false,
  walkT: 0,
};

const keys = {};
let mouseDown = false;
let mouseDX = 0;
let mouseDY = 0;

addEventListener('keydown', (e) => {
  keys[e.code] = true;
  const digitCodes = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4, Digit6: 5 };
  if (digitCodes[e.code] !== undefined) switchWeapon(digitCodes[e.code]);
  if (e.code === 'KeyR') startReload();
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight', 'KeyC', 'KeyR', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'].includes(e.code)) {
    e.preventDefault();
  }
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('wheel', (e) => {
  if (!running) return;
  selectNextWeapon(e.deltaY > 0 ? 1 : -1);
}, { passive: true });

addEventListener('mousedown', (e) => {
  if (e.button === 0 && locked) mouseDown = true;
});
addEventListener('mouseup', (e) => { if (e.button === 0) mouseDown = false; });

addEventListener('mousemove', (e) => {
  if (locked) {
    mouseDX += e.movementX || 0;
    mouseDY += e.movementY || 0;
  }
});

// ============================================================ WEAPONS
const WEAPON_DEFS = [
  { id: 'knife', name: 'НОЖ', type: 'melee', dmg: 80, range: 2.9, rate: 2.0, magCap: 0, reserveCap: 0, reloadTime: 0, spread: 0, auto: false, punch: 0, gunshot: 'knife' },
  { id: 'deagle', name: 'DESERT EAGLE', type: 'hitscan', dmg: 60, rate: 3.4, magCap: 7, reserveCap: 28, reloadTime: 1.7, spread: 0.0028, auto: false, punch: 0.9, falloff: 0.8, gunshot: 'deagle' },
  { id: 'ak', name: 'AK-47', type: 'hitscan', dmg: 26, rate: 9.5, magCap: 30, reserveCap: 90, reloadTime: 2.2, spread: 0.007, auto: true, punch: 0.55, falloff: 0.55, gunshot: 'ak' },
  { id: 'shotgun', name: 'ДРОБОВИК', type: 'hitscan', dmg: 12, pellets: 9, rate: 1.15, magCap: 6, reserveCap: 48, reloadTime: 2.1, spread: 0.052, auto: false, punch: 1.3, falloff: 0.5, gunshot: 'shotgun' },
  { id: 'sniper', name: 'ВИНТОВКА', type: 'hitscan', dmg: 120, rate: 0.9, magCap: 5, reserveCap: 25, reloadTime: 2.9, spread: 0.0009, auto: false, punch: 1.7, falloff: 0.92, gunshot: 'sniper' },
  { id: 'minigun', name: 'МИНИГАН', type: 'hitscan', dmg: 23, rate: 14, magCap: 100, reserveCap: 999, reloadTime: 3.4, spread: 0.02, auto: true, punch: 0.3, falloff: 0.5, gunshot: 'ak' },
];

const weapons = WEAPON_DEFS.map((d) => ({
  ...d,
  mag: d.magCap,
  reserve: d.reserveCap,
}));

const WPN_NAMES = ['НОЖ', 'DEAGLE', 'AK-47', 'ДРОБОВИК', 'ВИНТОВКА', 'МИНИГАН'];
const WPN_PRICES = [0, 0, 0, 250, 450, 500];
const unlocked = [true, true, true, false, false, false];

let currentWeapon = 2;
let reloading = false;
let reloadT = 0;
let lastFire = 0;
let holdTime = 0;
let recoil = 0;
let recoilPitch = 0;

// ============================================================ ECONOMY (монеты, магазин)
const SAVE_KEY = '3dshooter_save_v1';
let coins = 0;
const owned = { cap: false, glasses: false, balaclava: false, helmet: false };
const worn = { cap: false, glasses: false, balaclava: false, helmet: false };

function saveData() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ coins, owned, worn, unlocked }));
  } catch (e) { /* ignore */ }
}

function loadData() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    coins = (typeof s.coins === 'number' && s.coins >= 0) ? s.coins : 0;
    const d = { cap: false, glasses: false, balaclava: false, helmet: false };
    Object.assign(owned, d, s.owned || {});
    Object.assign(worn, d, s.worn || {});
    if (s.unlocked) for (let i = 0; i < unlocked.length; i++) if (s.unlocked[i]) unlocked[i] = true;
  } catch (e) { /* ignore */ }
}

// ---- viewmodels
const weaponHolder = new THREE.Group();
camera.add(weaponHolder);

function makeBox(w, h, d, color, matOpts = {}) {
  const m = new THREE.Mesh(shared.box, new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.2, ...matOpts }));
  m.scale.set(w, h, d);
  return m;
}

function buildKnife() {
  const g = new THREE.Group();
  const blade = makeBox(0.03, 0.05, 0.5, 0xd8d8da, { metalness: 0.85, roughness: 0.2 });
  blade.position.set(0, 0, -0.28);
  g.add(blade);
  const guard = makeBox(0.05, 0.09, 0.03, 0x333);
  guard.position.set(0, 0, -0.04);
  g.add(guard);
  const handle = makeBox(0.045, 0.06, 0.22, 0x2a2a2a);
  handle.position.set(0, 0, 0.08);
  g.add(handle);
  const pommel = makeBox(0.05, 0.07, 0.05, 0x444);
  pommel.position.set(0, 0, 0.2);
  g.add(pommel);
  g.position.set(0.28, -0.16, -0.42);
  g.rotation.y = 0.6;
  g.rotation.z = -0.08;
  g.userData.basePos = [0.28, -0.16, -0.42];
  g.userData.baseRotY = 0.6;
  return g;
}

function buildDeagle() {
  const g = new THREE.Group();
  const slide = makeBox(0.07, 0.11, 0.34, 0xb0b0b0, { metalness: 0.7, roughness: 0.25 });
  slide.position.set(0, 0.03, -0.16);
  g.add(slide);
  const frame = makeBox(0.06, 0.05, 0.22, 0x222);
  frame.position.set(0, -0.05, -0.06);
  g.add(frame);
  const grip = makeBox(0.06, 0.16, 0.08, 0x111);
  grip.position.set(0, -0.15, 0.06);
  grip.rotation.x = 0.12;
  g.add(grip);
  const barrel = makeBox(0.05, 0.06, 0.12, 0xddd, { metalness: 0.8, roughness: 0.2 });
  barrel.position.set(0, 0.03, -0.38);
  g.add(barrel);
  const front = makeBox(0.03, 0.09, 0.05, 0x333);
  front.position.set(0, 0.08, -0.34);
  g.add(front);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.04, -0.42);
  g.add(muzzle);
  g.muzzle = muzzle;
  g.position.set(0.3, -0.22, -0.5);
  g.rotation.y = 0.1;
  g.userData.basePos = [0.3, -0.22, -0.5];
  g.userData.baseRotY = 0.1;
  return g;
}

function buildAK() {
  const g = new THREE.Group();
  const woodT = { roughness: 0.8, metalness: 0.05 };
  // stock
  const stock = makeBox(0.05, 0.11, 0.34, 0x8a5a2b, woodT);
  stock.position.set(-0.015, -0.01, 0.18);
  stock.rotation.y = 0.12;
  g.add(stock);
  // receiver / body
  const receiver = makeBox(0.08, 0.1, 0.42, 0x333);
  receiver.position.set(0, 0.01, -0.05);
  g.add(receiver);
  // dust cover
  const dust = makeBox(0.075, 0.03, 0.24, 0x222);
  dust.position.set(0, 0.075, -0.08);
  g.add(dust);
  // barrel
  const barrel = makeBox(0.026, 0.026, 0.5, 0x1a1a1a);
  barrel.position.set(0, 0.015, -0.4);
  g.add(barrel);
  // gas tube
  const gas = makeBox(0.03, 0.04, 0.24, 0x444);
  gas.position.set(0, 0.065, -0.22);
  g.add(gas);
  // handguard (wood)
  const guard = makeBox(0.07, 0.07, 0.18, 0x8a5a2b, woodT);
  guard.position.set(0, 0.0, -0.24);
  g.add(guard);
  // grip
  const grip = makeBox(0.06, 0.12, 0.07, 0x2b1b0f, woodT);
  grip.position.set(0, -0.1, 0.02);
  grip.rotation.x = 0.25;
  g.add(grip);
  // magazine (curved)
  const mag = makeBox(0.06, 0.2, 0.08, 0x111);
  mag.position.set(0, -0.13, -0.1);
  mag.rotation.x = 0.32;
  g.add(mag);
  // front sight
  const font = makeBox(0.04, 0.1, 0.04, 0x333);
  font.position.set(0, 0.06, -0.3);
  g.add(font);
  // muzzle
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.015, -0.65);
  g.add(muzzle);
  g.muzzle = muzzle;
  g.position.set(0.29, -0.24, -0.52);
  g.rotation.y = 0.06;
  g.userData.basePos = [0.29, -0.24, -0.52];
  g.userData.baseRotY = 0.06;
  return g;
}

function buildShotgun() {
  const g = new THREE.Group();
  const woodT = { roughness: 0.8, metalness: 0.05 };
  const rec = makeBox(0.07, 0.1, 0.3, 0x1c1c1c);
  rec.position.set(0, 0, -0.05);
  g.add(rec);
  const bar = makeBox(0.035, 0.035, 0.55, 0x333);
  bar.position.set(0.02, 0.01, -0.35);
  g.add(bar);
  const tube = makeBox(0.022, 0.022, 0.5, 0x444);
  tube.position.set(-0.02, 0.01, -0.32);
  g.add(tube);
  const pump = makeBox(0.06, 0.06, 0.18, 0x8a5a2b, woodT);
  pump.position.set(0, -0.015, -0.32);
  g.add(pump);
  const stock = makeBox(0.06, 0.12, 0.3, 0x8a5a2b, woodT);
  stock.position.set(0, -0.03, 0.14);
  g.add(stock);
  const grip = makeBox(0.05, 0.09, 0.09, 0x4a3720, woodT);
  grip.position.set(0, -0.08, 0.02);
  grip.rotation.x = 0.3;
  g.add(grip);
  const fs = makeBox(0.02, 0.05, 0.03, 0x333);
  fs.position.set(0.02, 0.05, -0.4);
  g.add(fs);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0.02, 0.02, -0.63);
  g.add(muzzle);
  g.muzzle = muzzle;
  g.position.set(0.3, -0.23, -0.5);
  g.rotation.y = 0.05;
  g.userData.basePos = [0.3, -0.23, -0.5];
  g.userData.baseRotY = 0.05;
  return g;
}

function buildSniper() {
  const g = new THREE.Group();
  const bar = makeBox(0.03, 0.03, 0.85, 0x1a1a1a);
  bar.position.set(0, 0.01, -0.55);
  g.add(bar);
  const tip = makeBox(0.045, 0.045, 0.2, 0x333);
  tip.position.set(0, 0.01, -0.95);
  g.add(tip);
  const rec = makeBox(0.07, 0.11, 0.35, 0x222);
  rec.position.set(0, 0.02, -0.1);
  g.add(rec);
  const scope = makeBox(0.05, 0.05, 0.34, 0x111);
  scope.position.set(0, 0.07, -0.12);
  g.add(scope);
  const lens = makeBox(0.045, 0.045, 0.03, 0x0044aa, { emissive: 0x003377, emissiveIntensity: 1 });
  lens.position.set(0, 0.07, -0.3);
  g.add(lens);
  const stock = makeBox(0.06, 0.13, 0.36, 0x6b4a2e, { roughness: 0.8, metalness: 0.05 });
  stock.position.set(0, -0.02, 0.2);
  g.add(stock);
  const grip = makeBox(0.05, 0.1, 0.08, 0x2b1b0f, { roughness: 0.8, metalness: 0.05 });
  grip.position.set(0, -0.09, 0.06);
  grip.rotation.x = 0.32;
  g.add(grip);
  const mag = makeBox(0.05, 0.16, 0.09, 0x111);
  mag.position.set(0, -0.1, -0.06);
  mag.rotation.x = 0.18;
  g.add(mag);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.01, -1.0);
  g.add(muzzle);
  g.muzzle = muzzle;
  g.position.set(0.3, -0.24, -0.5);
  g.rotation.y = 0.03;
  g.userData.basePos = [0.3, -0.24, -0.5];
  g.userData.baseRotY = 0.03;
  return g;
}

function buildMinigun() {
  const g = new THREE.Group();
  const body = makeBox(0.16, 0.16, 0.5, 0x2a2a2a, { metalness: 0.6, roughness: 0.35 });
  body.position.set(0, 0, -0.15);
  g.add(body);
  const barrels = new THREE.Group();
  const n = 6;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const b = makeBox(0.028, 0.028, 0.65, 0x111, { metalness: 0.7, roughness: 0.3 });
    b.position.set(Math.cos(a) * 0.055, Math.sin(a) * 0.055, -0.5);
    barrels.add(b);
  }
  g.add(barrels);
  g.userData.barrels = barrels;
  const box = makeBox(0.14, 0.2, 0.16, 0x3a3a3a);
  box.position.set(0, -0.16, -0.02);
  g.add(box);
  const belt = makeBox(0.05, 0.02, 0.3, 0x6a5a12);
  belt.position.set(-0.05, -0.1, -0.12);
  g.add(belt);
  const grip = makeBox(0.05, 0.11, 0.08, 0x222);
  grip.position.set(0, -0.1, 0.1);
  grip.rotation.x = 0.25;
  g.add(grip);
  const handle = makeBox(0.04, 0.08, 0.1, 0x333);
  handle.position.set(0, 0.13, -0.02);
  g.add(handle);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0, -0.85);
  g.add(muzzle);
  g.muzzle = muzzle;
  g.position.set(0.32, -0.22, -0.5);
  g.rotation.y = 0.02;
  g.userData.basePos = [0.32, -0.22, -0.5];
  g.userData.baseRotY = 0.02;
  return g;
}

const viewGroups = [buildKnife(), buildDeagle(), buildAK(), buildShotgun(), buildSniper(), buildMinigun()];
viewGroups.forEach((g) => weaponHolder.add(g));

// muzzle flash sprite
const flashMat = new THREE.SpriteMaterial({
  map: makeFlashTexture(),
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  transparent: true,
  color: 0xffcc66,
});
const flashSprite = new THREE.Sprite(flashMat);
flashSprite.scale.set(0.42, 0.42, 1);
flashSprite.visible = false;
scene.add(flashSprite);
let flashTime = 0;

function makeFlashTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const grd = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,210,1)');
  grd.addColorStop(0.35, 'rgba(255,200,90,0.9)');
  grd.addColorStop(1, 'rgba(255,120,20,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  return t;
}

function switchWeapon(i) {
  if (i === currentWeapon) return;
  if (!unlocked[i] && weapons[i].id !== 'knife') {
    dom.wpnName.textContent = `${WPN_NAMES[i]} — ${WPN_PRICES[i]} МОН.`;
    dom.wpnName.style.color = '#ffd54f';
    setTimeout(() => { if (!unlocked[i]) { dom.wpnName.textContent = weapons[currentWeapon].name; dom.wpnName.style.color = ''; } }, 1200);
    playUi.locked();
    return;
  }
  currentWeapon = i;
  reloading = false;
  reloadT = 0;
  holdTime = 0;
  viewGroups.forEach((g, k) => { g.visible = k === i; });
  flashSprite.visible = false;
  dom.wpnName.style.color = '';
  updateSelectorUI();
  playUi.switch();
}

function selectNextWeapon(dir) {
  const n = weapons.length;
  let i = currentWeapon;
  for (let s = 0; s < n; s++) {
    i = (i + dir + n) % n;
    if (unlocked[i]) break;
  }
  if (currentWeapon !== i) switchWeapon(i);
}

function startReload() {
  const w = weapons[currentWeapon];
  if (w.type !== 'hitscan') return;
  if (reloading) return;
  if (w.mag >= w.magCap || w.reserve <= 0 || w.magCap === 0) return;
  reloading = true;
  reloadT = w.reloadTime;
  playUi.reload();
}

// ============================================================ SOUND
let AC = null;
let cachedNoise = null;
function ac() {
  if (!AC) {
    AC = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (AC.state === 'suspended') AC.resume();
  return AC;
}

function noiseBuffer(ctx, dur) {
  if (cachedNoise && cachedNoise.duration >= dur) return cachedNoise;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  if (!cachedNoise || dur > cachedNoise.duration) cachedNoise = buf;
  return buf;
}

let masterGain = null;
function master() {
  if (!masterGain) {
    const ctx = ac();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.42;
    masterGain.connect(ctx.destination);
  }
  return masterGain;
}

function playGun(kind) {
  if (!running) return;
  try {
    const ctx = ac();
    const t = ctx.currentTime;
    const cfg = kind === 'deagle' ? { d: 0.22, f: 900, g: 0.9, oF: 120 }
      : kind === 'ak' ? { d: 0.13, f: 1500, g: 0.55, oF: 220 }
      : kind === 'shotgun' ? { d: 0.26, f: 700, g: 1.0, oF: 90 }
      : kind === 'sniper' ? { d: 0.3, f: 480, g: 1.1, oF: 70 }
      : { d: 0.09, f: 2000, g: 0.5, oF: 300 };
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, cfg.d);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cfg.f, t);
    filter.frequency.exponentialRampToValueAtTime(100, t + cfg.d);
    const g = ctx.createGain();
    g.gain.setValueAtTime(cfg.g, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + cfg.d);
    src.connect(filter); filter.connect(g); g.connect(master());
    src.start(t); src.stop(t + cfg.d + 0.05);
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(cfg.oF, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.1);
    const og = ctx.createGain();
    og.gain.setValueAtTime(cfg.g * 0.9, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(og); og.connect(master());
    o.start(t); o.stop(t + 0.12);
  } catch (e) { /* ignore */ }
}

function playKnife() {
  try {
    const ctx = ac();
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, 0.16);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 2400;
    f.Q.value = 1.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.45, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    src.connect(f); f.connect(g); g.connect(master());
    src.start(t); src.stop(t + 0.18);
  } catch (e) { /* ignore */ }
}

function blip(freq = 1200, dur = 0.05, vol = 0.3) {
  try {
    const ctx = ac();
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master());
    o.start(t); o.stop(t + dur + 0.02);
  } catch (e) { /* ignore */ }
}

const playUi = {
  switch: () => { if (!started) return; blip(700, 0.06, 0.25); },
  reload: () => { if (!started) return; blip(420, 0.07, 0.3); setTimeout(() => blip(620, 0.07, 0.3), 120); setTimeout(() => blip(820, 0.07, 0.3), 260); },
  hitmarker: () => blip(1500, 0.045, 0.4),
  locked: () => { if (!started) return; blip(140, 0.08, 0.25); },
  coin: () => blip(1100, 0.06, 0.15),
  buy: () => { blip(200, 0.07, 0.25); setTimeout(() => blip(400, 0.07, 0.25), 100); },
};

function playerHurtSound() {
  try {
    const ctx = ac();
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(70, t + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    o.connect(g); g.connect(master());
    o.start(t); o.stop(t + 0.22);
  } catch (e) { /* ignore */ }
}

function enemyHurtSound() {
  try {
    const ctx = ac();
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(520, t);
    o.frequency.exponentialRampToValueAtTime(200, t + 0.08);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    o.connect(g); g.connect(master());
    o.start(t); o.stop(t + 0.1);
  } catch (e) { /* ignore */ }
}

function enemyGunSound() {
  try {
    const ctx = ac();
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, 0.16);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(1000, t);
    f.frequency.exponentialRampToValueAtTime(200, t + 0.16);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.28, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    src.connect(f); f.connect(g); g.connect(master());
    src.start(t); src.stop(t + 0.2);
  } catch (e) { /* ignore */ }
}

// ============================================================ FX (tracers, particles)
const fx = [];

function addTracer(from, to, color = 0xffd37a) {
  const geo = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95, depthTest: false });
  const line = new THREE.Line(geo, mat);
  scene.add(line);
  fx.push({ type: 'tracer', obj: line, t: 0, life: 0.07, geom: geo, mat });
}

function addParticle(pos, color, vel, life) {
  const mesh = new THREE.Mesh(shared.box, new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
  mesh.scale.setScalar(0.09);
  mesh.position.copy(pos);
  scene.add(mesh);
  fx.push({ type: 'part', obj: mesh, pos: pos.clone(), vel, t: 0, life: life || 0.5, mat: mesh.material, spin: Math.random() * 8 + 2 });
}

function burst(pos, color, count, speed, life, { up = true } = {}) {
  for (let i = 0; i < count; i++) {
    const v = new THREE.Vector3((Math.random() - 0.5) * speed, (Math.random() - 0.5) * speed * (up ? 0.7 : 1) + (up ? speed * 0.35 : 0), (Math.random() - 0.5) * speed);
    addParticle(pos, color, v, life * (0.6 + Math.random() * 0.7));
  }
}

function updateFx(dt) {
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i];
    f.t += dt;
    if (f.t >= f.life) {
      scene.remove(f.obj);
      f.geom && f.geom.dispose();
      f.mat && f.mat.dispose();
      fx.splice(i, 1);
      continue;
    }
    if (f.type === 'part') {
      f.vel.y -= 14 * dt;
      f.pos.addScaledVector(f.vel, dt);
      f.obj.position.copy(f.pos);
      f.obj.rotation.x += f.spin * dt;
      f.obj.rotation.z += f.spin * 0.7 * dt;
      const k = 1 - f.t / f.life;
      f.obj.scale.setScalar(0.09 * Math.max(0.01, k));
    } else if (f.type === 'tracer') {
      f.mat.opacity = 0.95 * (1 - f.t / f.life);
    } else if (f.type === 'txt') {
      f.pos.y += 0.8 * dt;
      f.obj.position.y = f.pos.y;
      f.mat.opacity = 1 - f.t / f.life;
      const s = 1 + f.t * 0.3;
      f.obj.scale.set(1.6 * s, 0.4 * s, 1);
    }
  }
}

function addFloatText(text, pos, color = '#ffd54f') {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.font = 'bold 42px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 8;
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.strokeText(text, 128, 32);
  ctx.fillStyle = color;
  ctx.fillText(text, 128, 32);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(1.6, 0.4, 1);
  sp.position.set(pos.x, pos.y + 1.2, pos.z);
  scene.add(sp);
  fx.push({ type: 'txt', obj: sp, pos: sp.position.clone(), t: 0, life: 0.9, mat });
}

// ============================================================ ENEMIES
const enemies = [];
const enemyBullets = [];
const medkits = [];
let kills = 0;
let wave = 1;
let spawnTimer = 2;
let totalSpawned = 0;

function buildEnemy(enemy) {
  const g = new THREE.Group();
  const meshes = [];
  const mk = (w, h, d, color, x, y, z, opts = {}) => {
    const m = new THREE.Mesh(shared.box, new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...opts }));
    m.scale.set(w, h, d);
    m.position.set(x, y, z);
    m.castShadow = true;
    g.add(m);
    meshes.push(m);
    return m;
  };
  mk(0.22, 0.55, 0.22, 0x2a2a2a, -0.17, 0.275, 0);
  mk(0.22, 0.55, 0.22, 0x2a2a2a, 0.17, 0.275, 0);
  mk(0.95, 0.6, 0.45, 0x8b2f2f, 0, 0.85, 0);
  mk(0.9, 0.52, 0.42, 0x5a1e1e, 0, 0.86, 0.012);
  mk(0.7, 0.22, 0.3, 0x3d5a80, 0, 1.22, 0);
  mk(0.4, 0.4, 0.4, 0xd9a066, 0, 1.42, 0);
  const visor = mk(0.36, 0.14, 0.06, 0x0a0a0a, 0, 1.44, -0.21);
  visor.material.emissive.setHex(0xff0000);
  visor.material.emissiveIntensity = 1.4;
  mk(0.14, 0.14, 0.8, 0x141414, 0, 1.05, 0.45);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 1.05, 0.88);
  g.add(muzzle);
  enemy.muzzle = muzzle;
  enemy.meshes = meshes;
  enemy.mats = meshes.map((m) => m.material);

  // hp bar
  enemy.hpCanvas = document.createElement('canvas');
  enemy.hpCanvas.width = 96; enemy.hpCanvas.height = 12;
  const tex = new THREE.CanvasTexture(enemy.hpCanvas);
  const hpMat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
  const hp = new THREE.Sprite(hpMat);
  hp.scale.set(1.3, 0.16, 1);
  hp.position.set(0, 1.95, 0);
  g.add(hp);
  enemy.hpSprite = hp;

  g.userData.enemy = enemy;
  enemy.group = g;
  return g;
}

function updateEnemyHpBar(e) {
  const ctx = e.hpCanvas.getContext('2d');
  const w = 96, h = 12;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, w, h);
  const r = Math.max(0, e.hp / e.maxHp);
  ctx.fillStyle = r > 0.5 ? '#3ddc54' : r > 0.25 ? '#ffc107' : '#ff3b30';
  ctx.fillRect(1, 1, (w - 2) * r, h - 2);
  e.hpSprite.material.map.needsUpdate = true;
}

function spawnEnemy() {
  const p = pickSpawnPoint();
  const e = {
    pos: new THREE.Vector3(p[0], 0, p[1]),
    hp: 50 + wave * 8,
    maxHp: 50 + wave * 8,
    vel: new THREE.Vector3(),
    attackCd: 1.2 + Math.random() * 1.2,
    meleeCd: 1.5,
    flash: 0,
    dead: false,
    deadT: 0,
    speed: Math.min(3.2 + wave * 0.18, 5.2),
    heading: Math.random() * Math.PI * 2,
    turnSpeed: Math.min(18, (3.4 + wave * 0.3) * 3),
    lockT: 0,
    aimTime: 0.35 + Math.random() * 0.3,
  };
  scene.add(buildEnemy(e));
  enemies.push(e);
  totalSpawned++;
  e.group.scale.setScalar(0.01);
  e.spawnScale = 0.01;
  updateEnemyHpBar(e);
}

function findEnemyOnHit(obj) {
  let o = obj;
  while (o) {
    if (o.userData && o.userData.enemy) return o.userData.enemy;
    o = o.parent;
  }
  return null;
}

function damageEnemy(e, dmg, dir) {
  if (e.dead) return;
  e.hp -= dmg;
  e.flash = 1;
  updateEnemyHpBar(e);
  enemyHurtSound();
  if (e.hp <= 0) {
    killEnemy(e, dir);
  } else {
    // knockback
    e.pos.addScaledVector(dir, 0.12);
    burst(new THREE.Vector3(e.pos.x, 1.1, e.pos.z), 0xcc2222, dmg > 40 ? 8 : 5, 4, 0.4);
  }
}

function killEnemy(e, dir) {
  e.dead = true;
  e.deadT = 0;
  kills++;
  totalScore += 100;
  if (kills % 10 === 0) spawnMedkit(e.pos.x, e.pos.z);
  const drop = 3 + Math.floor(Math.random() * 6);
  coins += drop;
  addFloatText(`+${drop} мон.`, new THREE.Vector3(e.pos.x, 0.35, e.pos.z), '#ffd54f');
  burst(new THREE.Vector3(e.pos.x, 1.1, e.pos.z), 0xcc2222, 14, 6, 0.7);
  burst(new THREE.Vector3(e.pos.x, 1.1, e.pos.z), 0x888, 6, 4, 0.5);
  addFloatText('+100', new THREE.Vector3(e.pos.x, 0, e.pos.z), '#ffe082');
  updateHUD();
  addKillFeed();
  saveData();
  const hc = e.hpSprite;
  hc && (hc.visible = false);
  e.faceDir = dir;
}

function enemyMeshesFlat() {
  const list = [];
  for (const e of enemies) if (!e.dead) list.push(...e.meshes);
  return list;
}

function getEnemyLOS(from, to) {
  const dir = to.clone().sub(from);
  const dist = dir.length();
  if (dist < 0.01) return true;
  dir.normalize();
  const ray = new THREE.Raycaster(from, dir, 0.01, dist - 0.05);
  const hits = ray.intersectObjects(envMeshes, false);
  return hits.length === 0;
}

function rayPointDistance(origin, dir, p) {
  const ab = p.clone().sub(origin);
  const t = Math.max(0, ab.dot(dir));
  return origin.clone().addScaledVector(dir, t).distanceTo(p);
}

function closestPointOnSegment(a, b, p) {
  const ab = b.clone().sub(a);
  const lenSq = ab.lengthSq() || 1;
  const t = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / lenSq));
  return a.clone().addScaledVector(ab, t);
}

// вражеские пули — летят с конечной скоростью, от них можно увернуться
function spawnEnemyBullet(from, dir, spd, origDist) {
  if (enemyBullets.length > 25) return;
  const mat = new THREE.MeshBasicMaterial({ color: 0xffc46b });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), mat);
  mesh.position.copy(from);
  mesh.scale.setScalar(0.55 + Math.random() * 0.3);
  scene.add(mesh);
  enemyBullets.push({
    pos: from.clone(),
    prev: from.clone(),
    vel: dir.clone().multiplyScalar(spd),
    life: 2.2,
    mesh, mat,
    origDist,
    hit: false,
  });
}

function updateEnemyBullets(dt) {
  const bodyY = player.pos.y + player.eye - 0.45;
  const bodyC = new THREE.Vector3(player.pos.x, bodyY, player.pos.z);
  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    const b = enemyBullets[i];
    b.prev.copy(b.pos);
    b.pos.addScaledVector(b.vel, dt);
    b.life -= dt;
    if (b.life <= 0) {
      scene.remove(b.mesh);
      enemyBullets.splice(i, 1);
      continue;
    }

    // короткий трассер за пулей
    const tGeo = new THREE.BufferGeometry().setFromPoints([b.prev.clone(), b.pos.clone()]);
    const tMat = new THREE.LineBasicMaterial({ color: 0xffaa55, transparent: true, opacity: 0.7 });
    const tl = new THREE.Line(tGeo, tMat);
    scene.add(tl);
    fx.push({ type: 'tracer', obj: tl, t: 0, life: 0.12, geom: tGeo, mat: tMat });

    // столкновение с укрытием / землёй
    const seg = b.pos.clone().sub(b.prev);
    const segLen = seg.length();
    seg.normalize();
    const ray = new THREE.Raycaster(b.prev, seg, 0, segLen);
    const hits = ray.intersectObjects(envMeshes, false);
    if (hits.length) {
      const hp = hits[0].point;
      b.mesh.position.copy(hp);
      burst(hp, 0x8a8a8a, 4, 3, 0.3, { up: false });
      scene.remove(b.mesh);
      enemyBullets.splice(i, 1);
      continue;
    }

    // пересечение с телом игрока — вот здесь можно увернуться
    const closest = closestPointOnSegment(b.prev, b.pos, bodyC);
    if (closest.distanceTo(bodyC) < 0.6) {
      b.mesh.position.copy(bodyC);
      burst(bodyC, 0xaa2222, 5, 3.5, 0.4);
      let dmg = 9 * (1.3 - (b.origDist / 30)) * (0.8 + Math.random() * 0.5);
      dmg = Math.round(Math.max(4, dmg));
      damagePlayer(dmg, b.pos);
      scene.remove(b.mesh);
      enemyBullets.splice(i, 1);
      continue;
    }

    b.mesh.position.copy(b.pos);
  }
}

// ============================================================ MEDKITS
const crossMat = new THREE.MeshStandardMaterial({ color: 0xd32f2f, emissive: 0x991111, emissiveIntensity: 0.8 });

function spawnMedkit(x, z) {
  if (medkits.length > 8) return;
  const g = new THREE.Group();
  const body = new THREE.Mesh(shared.box, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 }));
  body.scale.set(0.46, 0.32, 0.18);
  body.position.y = 0.16;
  g.add(body);
  const c1 = new THREE.Mesh(shared.box, crossMat);
  c1.scale.set(0.07, 0.26, 0.2);
  c1.position.y = 0.16;
  g.add(c1);
  const c2 = new THREE.Mesh(shared.box, crossMat);
  c2.scale.set(0.2, 0.07, 0.2);
  c2.position.y = 0.16;
  g.add(c2);
  g.position.set(x, 0, z);
  g.castShadow = true;
  scene.add(g);
  medkits.push({ group: g, x, z, t: Math.random() * 10, baseY: 0.34 });
}

function updateMedkits(dt) {
  for (let i = medkits.length - 1; i >= 0; i--) {
    const m = medkits[i];
    m.t += dt;
    m.group.position.set(m.x, m.baseY + Math.sin(m.t * 2.2) * 0.08, m.z);
    m.group.rotation.y += dt * 2;
    if (player.dead) continue;
    const dx = player.pos.x - m.x, dz = player.pos.z - m.z;
    if (dx * dx + dz * dz < 1.1 * 1.1) {
      const healed = Math.min(60, player.maxHealth - player.health);
      if (healed > 0) {
        player.health += healed;
        addFloatText('+' + healed + ' HP', new THREE.Vector3(m.x, 0.4, m.z), '#7ee838');
        burst(new THREE.Vector3(m.x, 0.5, m.z), 0x7ee838, 10, 3, 0.5);
        blip(880, 0.09, 0.35);
        setTimeout(() => blip(1320, 0.09, 0.3), 80);
        updateHUD();
        scene.remove(m.group);
        medkits.splice(i, 1);
      }
    }
  }
}

function updateEnemies(dt) {
  if (enemies.length < Math.min(3 + wave, 10) && spawnTimer <= 0) {
    spawnEnemy();
    spawnTimer = Math.max(1.2, 2.4 - wave * 0.15);
  }
  spawnTimer -= dt;

  for (const e of enemies) {
    if (e.dead) {
      e.deadT += dt;
      if (e.deadT > 0.5) {
        scene.remove(e.group);
        enemies.splice(enemies.indexOf(e), 1);
      }
      continue;
    }
    // grow in
    e.spawnScale = Math.min(1, e.spawnScale + dt * 6);
    e.group.scale.setScalar(e.spawnScale);

    // flash decay
    if (e.flash > 0) {
      e.flash -= dt * 8;
      const k = Math.max(0, Math.min(1, e.flash));
      for (const m of e.mats) {
        m.emissive.setRGB(k, k * 0.35, k * 0.2);
        m.emissiveIntensity = 1;
      }
      if (k <= 0) for (const m of e.mats) { m.emissive.setRGB(0, 0, 0); m.emissiveIntensity = 0; }
    }
    const visorM = e.meshes[6] && e.meshes[6].material;
    if (visorM) visorM.emissiveIntensity = e.dead ? 0 : 1.4;

    const toPlayer = player.pos.clone().sub(e.pos);
    const dist = toPlayer.length();
    toPlayer.y = 0;
    const dir2 = toPlayer.clone();
    const d2 = dir2.length();
    if (d2 > 0.01) dir2.normalize();

    // поворот с инерцией — враг разворачивается не мгновенно, а в сторону игрока
    const tH = d2 > 0.01 ? Math.atan2(dir2.x, dir2.z) : e.heading;
    let dA = tH - e.heading;
    while (dA > Math.PI) dA -= Math.PI * 2;
    while (dA < -Math.PI) dA += Math.PI * 2;
    if (Math.abs(dA) > 1e-4) e.heading += Math.sign(dA) * Math.min(e.turnSpeed * dt, Math.abs(dA));
    e.group.rotation.y = e.heading;
    // остаточный угол до цели после поворота за этот кадр
    let dAL = tH - e.heading;
    while (dAL > Math.PI) dAL -= Math.PI * 2;
    while (dAL < -Math.PI) dAL += Math.PI * 2;
    const facingShoot = Math.abs(dAL) < 0.35;   // ~20° — можно прицеливаться
    const facingMelee = Math.abs(dAL) < 0.7;    // ~40° — можно ударить

    // move toward player
    if (dist > 1.5) {
      e.pos.x += dir2.x * e.speed * dt;
      e.pos.z += dir2.z * e.speed * dt;
      for (const b of colliders) pushPointOutOfBox(e.pos, 0.45, b);
    }
    // push out of player
    const pl = new THREE.Vector3(player.pos.x, 0, player.pos.z);
    const diff = e.pos.clone().sub(pl);
    const dL = diff.length();
    if (dL < 1.0 && dL > 0.001) {
      diff.normalize().multiplyScalar(0.3 * dt);
      e.pos.x += diff.x; e.pos.z += diff.z;
    }

    e.group.position.set(e.pos.x, 0, e.pos.z);

    // attacks
    e.attackCd -= dt;
    e.meleeCd -= dt;
    if (!player.dead) {
      const eye = camera.getWorldPosition(new THREE.Vector3());
      // цель видна и в зоне стрельбы — накапливаем «прицеливание»
      const canAim = dist > 1.6 && dist < 14 && getEnemyLOS(e.muzzle.getWorldPosition(new THREE.Vector3()), eye) && facingShoot;
      if (canAim) {
        e.lockT += dt;
      } else {
        e.lockT = Math.max(0, e.lockT - dt * 2);
      }
      if (canAim && e.lockT >= e.aimTime && e.attackCd <= 0) {
        e.attackCd = Math.max(0.75, 1.6 - wave * 0.1) * (0.75 + Math.random() * 0.5);
        const from = e.muzzle.getWorldPosition(new THREE.Vector3());
        const baseAim = eye.clone().sub(from).normalize();
        // разброс: растёт с дистанцией, точность растёт с волной
        const skill = Math.min(0.9, 0.5 + wave * 0.04);
        const err = (0.03 + Math.max(0, dist - 4) * 0.006) * (1.1 - skill) * (0.6 + Math.random() * 0.8);
        const aim = baseAim.clone();
        aim.x += (Math.random() - 0.5) * err;
        aim.y += (Math.random() - 0.5) * err;
        aim.z += (Math.random() - 0.5) * err * 0.6;
        aim.normalize();
        // реальная летящая пуля — у неё есть время полёта, от неё можно уйти
        const spd = Math.min(38, 24 + wave * 1.5 + Math.random() * 6);
        spawnEnemyBullet(from, aim, spd, eye.distanceTo(from));
        enemyGunSound();
      } else if (dist <= 1.8 && facingMelee && e.meleeCd <= 0) {
        e.meleeCd = 1.4;
        damagePlayer(13, e.pos);
      }
    }
  }

  // separation between enemies
  for (let i = 0; i < enemies.length; i++) {
    if (enemies[i].dead) continue;
    for (let j = i + 1; j < enemies.length; j++) {
      if (enemies[j].dead) continue;
      const a = enemies[i].pos, b = enemies[j].pos;
      const dx = b.x - a.x, dz = b.z - a.z;
      const d2s = dx * dx + dz * dz;
      if (d2s < 0.7 * 0.7 && d2s > 1e-6) {
        const d = Math.sqrt(d2s);
        const push = (0.7 - d) * 0.5;
        const ux = dx / d, uz = dz / d;
        a.x -= ux * push * 0.5; a.z -= uz * push * 0.5;
        b.x += ux * push * 0.5; b.z += uz * push * 0.5;
      }
    }
    if (!enemies[i].dead) {
      enemies[i].group.position.set(enemies[i].pos.x, 0, enemies[i].pos.z);
    }
  }
}

// ============================================================ HITS CAN / MELEE
function applySpread(dir, rad) {
  dir.x += (Math.random() - 0.5) * rad;
  dir.y += (Math.random() - 0.5) * rad;
  dir.z += (Math.random() - 0.5) * rad * 0.4;
  dir.normalize();
}

function getSpread() {
  const w = weapons[currentWeapon];
  let s = w.spread;
  const spd = Math.hypot(player.vel.x, player.vel.z);
  s += spd * 0.006;
  s += recoil * 0.004;
  if (player.crouch) s *= 0.75;
  if (w.auto) s += Math.min(0.014, holdTime * 0.005);
  if (!player.grounded) s += 0.02;
  return s;
}

function fireWeapon() {
  const w = weapons[currentWeapon];
  if (reloading) return;
  if (w.type === 'melee') {
    if (nowW < lastFire) return;
    if (w.cooling) return;
    w.cooling = true;
    w.coolT = 0.4;
    playKnife();
    // swing anim triggers in update loop via w.animT
    w.animT = 0.001;
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const from = camera.position.clone();
    let best = null, bestD = w.range;
    for (const e of enemies) {
      if (e.dead) continue;
      const c = new THREE.Vector3(e.pos.x, 1.1, e.pos.z);
      const to = c.clone().sub(from);
      const d = to.length();
      if (d < bestD) {
        to.normalize();
        if (dir.dot(to) > Math.cos(THREE.MathUtils.degToRad(38))) {
          best = e; bestD = d;
        }
      }
    }
    if (best) {
      damageEnemy(best, w.dmg, dir);
      hitmarker();
    }
    return;
  }

  // hitscan
  if (w.mag <= 0) {
    if (w.reserve > 0) startReload();
    return;
  }
  if (nowW - lastFire < 1 / w.rate) return;
  lastFire = nowW;
  w.mag--;
  recoil += w.punch;
  recoilPitch += w.punch * 0.16;
  holdTime++;
  playGun(w.gunshot);

  // muzzle flash
  const vg = viewGroups[currentWeapon];
  const muzzleW = (vg.muzzle ? vg.muzzle.getWorldPosition(new THREE.Vector3()) : camera.position.clone());
  if (vg.muzzle) {
    flashSprite.position.copy(muzzleW);
    flashSprite.visible = true;
    flashTime = 0.045;
    if (flashSprite.material.map !== flashMat.map) flashSprite.material.map = flashMat.map;
  }

  const pellets = w.pellets || 1;
  const baseDir = new THREE.Vector3();
  camera.getWorldDirection(baseDir);

  for (let p = 0; p < pellets; p++) {
    const dir = baseDir.clone();
    applySpread(dir, getSpread());

    const raycaster = new THREE.Raycaster(camera.position.clone(), dir, 0.05, 300);
    const targets = [...envMeshes, ...enemyMeshesFlat()];
    const hits = raycaster.intersectObjects(targets, false);
    const h = hits[0];

    if (h) {
      const e = findEnemyOnHit(h.object);
      addTracer(muzzleW, h.point);
      if (e) {
        const dmg = w.dmg * (1 - Math.max(0, h.distance - 8) / 90 * (w.falloff === undefined ? 0.6 : w.falloff));
        damageEnemy(e, Math.max(4, Math.round(dmg)), dir);
        hitmarker();
      } else {
        burst(h.point, 0x8a8a8a, 5, 3.5, 0.35, { up: false });
        h.point.clone().addScaledVector(h.face ? h.face.normal : new THREE.Vector3(0, 1, 0), 0.02);
      }
    } else {
      addTracer(muzzleW, camera.position.clone().addScaledVector(dir, 150));
    }
  }

  if (w.mag <= 0 && w.reserve > 0) startReload();
  updateHUD();
}

const hitT = { v: 0 };
function hitmarker() {
  const el = document.getElementById('hitmarker');
  el.classList.remove('on');
  // fast flip
  void el.offsetWidth;
  el.classList.add('on');
  playUi.hitmarker();
}

let totalScore = 0;

function damagePlayer(dmg, fromPos) {
  if (player.dead) return;
  player.health -= dmg;
  if (player.health <= 0) {
    player.health = 0;
    killPlayer();
    return;
  }
  const vg = document.getElementById('dmg-vignette');
  vg.classList.add('on');
  setTimeout(() => vg.classList.remove('on'), 90);
  shake(0.15, 0.04);
  playerHurtSound();
  updateHUD();
  // blood direction puffs
  burst(new THREE.Vector3(camera.position.x, camera.position.y - 0.5, camera.position.z), 0xaa2222, 3, 1.5, 0.3);
  const _fp = fromPos;
}

function killPlayer() {
  player.dead = true;
  running = false;
  document.exitPointerLock && document.exitPointerLock();
  locked = false;
  setRunning(false);
  showScreen('death');
  const di = document.getElementById('death-info');
  if (di) di.textContent = `Волна ${wave} · Убийств: ${kills} · Счёт: ${totalScore}`;
  saveData();
  playerHurtSound();
  burst(camera.position.clone(), 0xaa2222, 16, 5, 0.8);
}

// ============================================================ HUD
const dom = {
  crosshair: document.getElementById('crosshair'),
  ammo: document.getElementById('ammo'),
  wpnName: document.getElementById('wpn-name'),
  hpbar: document.getElementById('hpbar').querySelector('span'),
  hpval: document.getElementById('hpval'),
  kills: document.getElementById('kills'),
  wave: document.getElementById('wave'),
  coins: document.getElementById('coins'),
  till: document.getElementById('till'),
  reloadMsg: document.getElementById('reload-msg'),
  selectors: [...document.querySelectorAll('.sel')],
  killFeed: document.getElementById('kill-feed'),
};

function updateHUD() {
  const w = weapons[currentWeapon];
  dom.wpnName.textContent = w.name;
  if (w.type === 'melee') {
    dom.ammo.textContent = '—';
    dom.ammo.classList.remove('low');
  } else {
    dom.ammo.textContent = `${w.mag} / ${w.reserve}`;
    dom.ammo.classList.toggle('low', w.mag <= Math.min(4, Math.ceil(w.magCap / 3)));
  }
  const hp = Math.max(0, player.health / player.maxHealth * 100);
  dom.hpbar.style.width = `${hp}%`;
  dom.hpbar.style.background = hp > 50 ? 'linear-gradient(90deg,#22d15b,#7ee838)' : hp > 25 ? 'linear-gradient(90deg,#f0a500,#ffd54f)' : 'linear-gradient(90deg,#e03333,#ff5a5a)';
  dom.hpval.textContent = Math.round(hp);
  dom.kills.textContent = `УБИЙСТВ: ${kills}`;
  dom.wave.textContent = `ВОЛНА: ${wave}  ·  ОЧКИ: ${totalScore}`;
  dom.coins.textContent = `МОНЕТЫ: ${coins}`;
  dom.till.textContent = `АПТЕЧКА ЧЕРЕЗ: ${10 - (kills % 10)}`;
  const mmc = document.getElementById('mm-coins');
  if (mmc) mmc.textContent = coins;
}

function updateSelectorUI() {
  dom.selectors.forEach((s, i) => {
    s.classList.toggle('active', i === currentWeapon);
    s.classList.toggle('locked', !unlocked[i]);
    s.textContent = `${i + 1} · ${WPN_NAMES[i]}${unlocked[i] ? '' : ' · ' + WPN_PRICES[i] + 'М'}`;
  });
}

function addKillFeed() {
  const d = document.createElement('div');
  d.textContent = `✕ Уничтожен враг (+100)`;
  dom.killFeed.appendChild(d);
  setTimeout(() => d.remove(), 2500);
}

// ============================================================ PHYSICS
function pushPointOutOfBox(p, r, b) {
  const cx = Math.max(b.min.x, Math.min(p.x, b.max.x));
  const cz = Math.max(b.min.z, Math.min(p.z, b.max.z));
  const dx = p.x - cx, dz = p.z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 < r * r) {
    if (d2 > 1e-9) {
      const d = Math.sqrt(d2);
      const push = (r - d) / d;
      p.x += dx * push;
      p.z += dz * push;
    } else {
      const l = Math.min(p.x - b.min.x, b.max.x - p.x, p.z - b.min.z, b.max.z - p.z);
      if (l === p.x - b.min.x) p.x = b.min.x - r;
      else if (l === b.max.x - p.x) p.x = b.max.x + r;
      else if (l === p.z - b.min.z) p.z = b.min.z - r;
      else p.z = b.max.z + r;
    }
  }
}

function groundAt(x, z, minY) {
  let g = 0;
  for (const b of colliders) {
    if (x > b.min.x && x < b.max.x && z > b.min.z && z < b.max.z) {
      if (b.max.y > minY) g = Math.max(g, b.max.y);
    }
  }
  return g;
}

function updatePlayer(dt) {
  const k = keys;
  const fwd = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  const right = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));

  let ix = (k['KeyD'] || k['ArrowRight'] ? 1 : 0) - (k['KeyA'] || k['ArrowLeft'] ? 1 : 0);
  let iz = (k['KeyW'] || k['ArrowUp'] ? 1 : 0) - (k['KeyS'] || k['ArrowDown'] ? 1 : 0);

  const wantCrouch = !!k['KeyC'];
  player.crouch += ((wantCrouch ? 1 : 0) - player.crouch) * Math.min(1, dt * 12);
  const hScale = player.crouch;
  player.height = 1.7 - 0.45 * hScale;
  player.eye = 1.55 - 0.4 * hScale;

  const sprint = (k['ShiftLeft'] || k['ShiftRight']) && !wantCrouch;
  const speed = wantCrouch ? 3.2 : sprint ? 11 : 7;
  const dir = new THREE.Vector3().addScaledVector(right, ix).addScaledVector(fwd, iz);
  const moving = dir.lengthSq() > 0;
  if (moving) dir.normalize();

  // accel
  const targetVx = dir.x * speed, targetVz = dir.z * speed;
  const lerp = Math.min(1, dt * 12);
  player.vel.x += (targetVx - player.vel.x) * lerp;
  player.vel.z += (targetVz - player.vel.z) * lerp;

  // gravity / jump
  if (k['Space'] && player.grounded) {
    player.vel.y = 7.4;
    player.grounded = false;
  }
  if (!player.grounded) player.vel.y -= 22 * dt;

  player.pos.x += player.vel.x * dt;
  player.pos.z += player.vel.z * dt;
  player.pos.y += player.vel.y * dt;

  // collide with boxes
  for (const b of colliders) {
    const r = player.radius;
    const minX = b.min.x - r, maxX = b.max.x + r;
    const minZ = b.min.z - r, maxZ = b.max.z + r;
    if (player.pos.x > minX && player.pos.x < maxX && player.pos.z > minZ && player.pos.z < maxZ) {
      const pB = player.pos.y, pT = player.pos.y + player.height;
      if (pB < b.max.y && pT > b.min.y) {
        const dx1 = player.pos.x - minX, dx2 = maxX - player.pos.x;
        const dz1 = player.pos.z - minZ, dz2 = maxZ - player.pos.z;
        const penT = b.max.y - pB, penB = pT - b.min.y;
        const minH = Math.min(dx1, dx2, dz1, dz2);
        const minV = Math.min(penT > 0 ? penT : Infinity, penB > 0 ? penB : Infinity);
        if (minV <= minH) {
          if (penT <= penB) {
            player.pos.y = b.max.y;
            player.vel.y = Math.min(player.vel.y, 0);
            player.grounded = true;
          } else {
            player.pos.y = b.min.y - player.height;
            player.vel.y = Math.max(player.vel.y, 0);
          }
        } else {
          if (dx1 === minH) player.pos.x = minX;
          else if (dx2 === minH) player.pos.x = maxX;
          else if (dz1 === minH) player.pos.z = minZ;
          else player.pos.z = maxZ;
          if (dx1 === minH || dx2 === minH) player.vel.x = 0;
          else player.vel.z = 0;
        }
      }
    }
  }

  // ground
  const g = groundAt(player.pos.x, player.pos.z, player.pos.y - 0.1);
  if (player.pos.y <= g) {
    player.pos.y = g;
    player.grounded = true;
    if (player.vel.y < 0) player.vel.y = 0;
  } else {
    player.grounded = false;
  }

  // clamp inside arena
  const lim = ARENA / 2 - 1;
  player.pos.x = Math.max(-lim, Math.min(lim, player.pos.x));
  player.pos.z = Math.max(-lim, Math.min(lim, player.pos.z));

  // camera
  player.yaw -= mouseDX * 0.0021;
  player.pitch -= mouseDY * 0.0021;
  player.pitch = Math.max(-1.55, Math.min(1.55, player.pitch));

  recoilPitch += (0 - recoilPitch) * Math.min(1, dt * 8);
  recoil += (0 - recoil) * Math.min(1, dt * 7);

  // bob
  if (moving && player.grounded) {
    player.walkT += dt * speed * 1.5;
  } else {
    player.walkT *= (1 - Math.min(1, dt * 8));
  }
  const bobAmp = moving && player.grounded ? Math.min(0.045, speed * 0.004) : 0;
  const bobY = Math.sin(player.walkT) * bobAmp;
  const bobX = Math.cos(player.walkT * 0.5) * bobAmp * 0.6;

  camera.position.set(player.pos.x, player.pos.y + player.eye + bobY, player.pos.z);
  camera.rotation.set(player.pitch + recoilPitch, player.yaw, bobX * 2);
  camera.updateMatrixWorld();
}

// camera shake
let shakeT = 0, shakeAmp = 0;
function shake(t, a) { shakeT = Math.max(shakeT, t); shakeAmp = Math.max(shakeAmp, a); }

// ============================================================ WEAPON ANIM
let nowW = 0;
function updateWeaponAnim(dt) {
  const vg = viewGroups[currentWeapon];

  // Idle sway
  const t = performance.now() / 1000;
  const swayX = Math.sin(t * 1.1) * 0.006;
  const swayY = Math.sin(t * 1.4) * 0.005;
  const spd = Math.hypot(player.vel.x, player.vel.z);
  const bobAmp = spd > 0.5 && player.grounded ? Math.min(0.02, spd * 0.0013) : 0;
  const bobXw = Math.sin(player.walkT) * bobAmp;
  const bobYw = Math.abs(Math.cos(player.walkT)) * bobAmp;

  // base position
  const bp = vg.userData.basePos || [0.3, -0.22, -0.5];
  vg.position.set(
    bp[0] + swayX + mouseDX * 0.00016 + bobXw,
    bp[1] + swayY + bobYw * 0.5,
    bp[2] + recoil * 0.06
  );
  vg.rotation.set(recoil * 0.2, vg.userData.baseRotY || vg.rotation.y, 0);
  mouseDX = 0; mouseDY = 0;

  // minigun barrel spin
  if (currentWeapon === 5 && vg.userData.barrels) {
    const spin = mouseDown ? 22 : Math.max(0, 22 - (nowW - lastFire) * 20);
    if (spin > 0.1) vg.userData.barrels.rotation.z += dt * spin;
  }

  // knife swing anim
  const kw = weapons[0];
  if (kw.animT > 0 && kw.animT < 1) {
    kw.animT += dt / 0.4;
    if (kw.animT >= 1) kw.animT = 1;
    const s = Math.sin(kw.animT * Math.PI);
    const kvg = viewGroups[0];
    kvg.rotation.x = -1.1 * s;
    kvg.position.z = bp[2] - 0.25 * s;
  }
  kw.coolT = (kw.coolT || 0) - dt;
  if (kw.coolT && kw.coolT <= 0) { kw.cooling = false; kw.animT = 0; }

  // muzzle flash
  if (flashTime > 0) {
    flashTime -= dt;
    flashSprite.visible = flashTime > 0;
    const k = flashTime / 0.045;
    flashSprite.material.opacity = k;
    flashSprite.scale.setScalar(0.42 * (0.6 + 0.4 * k));
  }
}

// ============================================================ GAME FLOW
let running = false, locked = false, started = false, menuActive = true;

const overlay = document.getElementById('overlay');
const screens = {
  shop: document.getElementById('shop-screen'),
  pause: document.getElementById('pause-screen'),
  death: document.getElementById('death-screen'),
};

function showScreen(k) {
  for (const key in screens) screens[key].classList.toggle('hidden', key !== k);
  menuActive = (k === 'shop');
  overlay.style.display = 'flex';
  const hud = document.getElementById('hud');
  if (hud) hud.style.opacity = menuActive ? '0' : '1';
  if (menuActive) updateShowcase(0);
}

function hideOverlay() {
  overlay.style.display = 'none';
  const hud = document.getElementById('hud');
  if (hud) hud.style.opacity = '1';
}

function setRunning(v) { running = v; }

function showOverlay(mode) {
  if (mode === 'pause') showScreen('pause');
  else if (mode === 'death') showScreen('death');
  else showScreen('shop');
}

function requestLock() {
  try {
    const p = renderer.domElement.requestPointerLock({ unadjustedMovement: true });
    if (p && p.catch) p.catch(() => {});
  } catch (e) {
    renderer.domElement.requestPointerLock();
  }
}

// ============================================================ МЕНЮ / ВИТРИНА 3D
const showScene = new THREE.Scene();
showScene.background = new THREE.Color(0x0d1117);
showScene.fog = new THREE.Fog(0x0d1117, 8, 16);
const showCam = new THREE.PerspectiveCamera(58, 1, 0.1, 100);
showCam.position.set(2.7, 1.9, 3.4);
showCam.lookAt(0, 1.35, 0);

const showLight = new THREE.AmbientLight(0xffffff, 0.75);
showScene.add(showLight);
const showKey = new THREE.DirectionalLight(0xffd9a0, 1.1);
showKey.position.set(3, 4, 4);
showScene.add(showKey);
const showFill = new THREE.DirectionalLight(0x4466ff, 0.35);
showFill.position.set(-3, 2, -2);
showScene.add(showFill);

// подиум
const podium = new THREE.Group();
const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.85, 0.2, 40), new THREE.MeshStandardMaterial({ color: 0x22303c, roughness: 0.6, metalness: 0.4 }));
disc.position.y = -0.1;
podium.add(disc);
const ring = new THREE.Mesh(new THREE.RingGeometry(1.9, 2.05, 48), new THREE.MeshBasicMaterial({ color: 0xffd54f, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
ring.rotation.x = -Math.PI / 2;
ring.position.y = 0.02;
podium.add(ring);
showScene.add(podium);

// мягкое свечение сзади
const glowTex = makeFlashTexture();
const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffb84d, transparent: true, opacity: 0.35, depthWrite: false }));
glow.position.set(0, 1.4, -1.4);
glow.scale.set(5, 5, 1);
showScene.add(glow);

const makeShowMat = (c, extra) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.7, metalness: 0.1 }, extra || {}));
const charGroup = new THREE.Group();
const accGroups = { cap: null, glasses: null, balaclava: null, helmet: null };
let charParts = {};

function buildCharacterShow() {
  const root = new THREE.Group();
  const legs = new THREE.Group();
  legs.position.y = 0.9;
  legs.userData.anchor = 'legs';
  const lm = makeShowMat(0x8a4a2b);
  [-1, 1].forEach((side) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.92, 10), lm);
    leg.position.set(side * 0.13, -0.46, 0);
    legs.add(leg);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.34), makeShowMat(0x222));
    shoe.position.set(side * 0.13, -0.93, 0.06);
    legs.add(shoe);
  });
  const torso = new THREE.Group();
  torso.position.y = 1.42;
  torso.userData.anchor = 'torso';
  const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.27, 0.55, 10), makeShowMat(0x22557a));
  torso.add(chest);
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.1, 10), makeShowMat(0x1b1b1b));
  belt.position.y = -0.3;
  torso.add(belt);
  [-1, 1].forEach((side) => {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.62, 8), makeShowMat(0x2c2c2c));
    arm.position.set(side * 0.3, -0.05, 0);
    arm.rotation.z = side * 0.12;
    torso.add(arm);
  });
  const head = new THREE.Group();
  head.position.y = 0.46;
  head.userData.anchor = 'head';
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.18, 20, 14), makeShowMat(0xd9a066));
  head.add(skull);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.1, 8), makeShowMat(0xd9a066));
  neck.position.y = -0.21;
  head.add(neck);
  torso.add(head);
  root.add(legs, torso);
  root.userData.parts = { legs, torso, head };
  return root;
}

function buildAcc(kind) {
  const g = new THREE.Group();
  if (kind === 'cap') {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.185, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2.2), makeShowMat(0xe53935));
    dome.position.y = 0.16;
    g.add(dome);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.03, 0.2), makeShowMat(0xb71c1c));
    brim.position.set(0, 0.16, 0.16);
    brim.rotation.x = -0.25;
    g.add(brim);
  } else if (kind === 'glasses') {
    const frames = makeShowMat(0x111, { metalness: 0.8, roughness: 0.3 });
    const lens = new THREE.MeshStandardMaterial({ color: 0x9ecbff, transparent: true, opacity: 0.45, roughness: 0.1, metalness: 0.9 });
    [-1, 1].forEach((side) => {
      const fr = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.014, 8, 14), frames);
      fr.position.set(side * 0.08, 0.05, 0.17);
      fr.rotation.x = Math.PI / 2;
      g.add(fr);
      const l = new THREE.Mesh(new THREE.CircleGeometry(0.05, 12), lens);
      l.position.set(side * 0.08, 0.05, 0.16);
      l.rotation.y = Math.PI / 2;
      g.add(l);
    });
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.03), frames);
    bridge.position.set(0, 0.05, 0.17);
    g.add(bridge);
  } else if (kind === 'balaclava') {
    const m = makeShowMat(0x212121);
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.195, 20, 14), m);
    g.add(hood);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.16, 10), m);
    neck.position.y = -0.18;
    g.add(neck);
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.035, 0.02), makeShowMat(0x111));
    const eyeR = eyeL.clone();
    eyeL.position.set(-0.055, 0.06, 0.195);
    eyeR.position.set(0.055, 0.06, 0.195);
    g.add(eyeL, eyeR);
  } else if (kind === 'helmet') {
    const m = makeShowMat(0x37474f, { metalness: 0.6, roughness: 0.4 });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2.1), m);
    dome.position.y = 0.17;
    g.add(dome);
    const strapL = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.02), m);
    strapL.position.set(-0.16, 0.02, 0.02);
    g.add(strapL);
    const strapR = strapL.clone();
    strapR.position.x = 0.16;
    g.add(strapR);
  }
  g.visible = false;
  g.userData.kind = kind;
  return g;
}

let showAngle = 0.35;
function updateShowcase(dt) {
  showAngle += dt * 0.5;
  charGroup.rotation.y = Math.sin(showAngle) * 0.35;
  charGroup.position.y = Math.sin(showAngle * 2) * 0.02;
  charParts.legs && (charParts.legs.rotation.x = Math.sin(showAngle * 2) * 0.05);
}

function initShowcase() {
  const root = buildCharacterShow();
  charParts = root.userData.parts;
  for (const kind in accGroups) {
    const a = buildAcc(kind);
    accGroups[kind] = a;
    charParts.head.add(a);
    if (worn[kind]) a.visible = true;
  }
  charGroup.add(root);
  showScene.add(charGroup);
}

// ============================================================ МАГАЗИН
const ACC_DEFS = [
  { id: 'cap', name: 'Кепка', desc: 'Спортивный стиль', price: 50 },
  { id: 'glasses', name: 'Очки', desc: 'Острый взгляд', price: 75 },
  { id: 'balaclava', name: 'Балаклава', desc: 'Никто не узнает', price: 120 },
  { id: 'helmet', name: 'Каска', desc: 'Милитари-шик', price: 150 },
];

function renderShops() {
  updateSelectorUI();
  const accList = document.getElementById('acc-list');
  accList.innerHTML = '';
  for (const a of ACC_DEFS) {
    const row = document.createElement('div');
    row.className = 'shop-item';
    const name = document.createElement('div');
    name.className = 'name';
    name.innerHTML = `<b>${a.name}</b><small>${a.desc}</small>`;
    row.appendChild(name);
    if (!owned[a.id]) {
      const btn = document.createElement('button');
      btn.className = 'buy';
      btn.textContent = `${a.price} мон.`;
      btn.disabled = coins < a.price;
      btn.addEventListener('click', () => {
        if (coins < a.price) return;
        coins -= a.price;
        owned[a.id] = true;
        worn[a.id] = true;
        accGroups[a.id].visible = true;
        saveData();
        renderShops();
        updateHUD();
      });
      row.appendChild(btn);
    } else {
      const btn = document.createElement('button');
      btn.className = 'wear' + (worn[a.id] ? ' on' : '');
      btn.textContent = worn[a.id] ? 'НАДЕТО' : 'НАДЕТЬ';
      btn.addEventListener('click', () => {
        worn[a.id] = !worn[a.id];
        accGroups[a.id].visible = worn[a.id];
        saveData();
        renderShops();
      });
      row.appendChild(btn);
    }
    accList.appendChild(row);
  }

  const wpnList = document.getElementById('wpn-list');
  wpnList.innerHTML = '';
  for (let i = 2; i < weapons.length; i++) {
    const w = weapons[i];
    const row = document.createElement('div');
    row.className = 'shop-item';
    const name = document.createElement('div');
    name.className = 'name';
    name.innerHTML = `<b>${WPN_NAMES[i]}</b><small>урон ${w.dmg} · скорострельность ${w.rate}шт/с</small>`;
    row.appendChild(name);
    if (!unlocked[i]) {
      const btn = document.createElement('button');
      btn.className = 'buy';
      btn.textContent = `${WPN_PRICES[i]} мон.`;
      btn.disabled = coins < WPN_PRICES[i];
      btn.addEventListener('click', () => {
        if (coins < WPN_PRICES[i]) return;
        coins -= WPN_PRICES[i];
        unlocked[i] = true;
        saveData();
        renderShops();
        updateHUD();
      });
      row.appendChild(btn);
    } else {
      const ok = document.createElement('span');
      ok.className = 'owned';
      ok.textContent = 'КУПЛЕНО';
      row.appendChild(ok);
    }
    wpnList.appendChild(row);
  }
  const mmc = document.getElementById('mm-coins');
  if (mmc) mmc.textContent = coins;
}

// ============================================================ КНОПКИ МЕНЮ
document.getElementById('mm-play').addEventListener('click', (e) => {
  e.stopPropagation();
  ac(); master();
  if (player.dead) { location.reload(); return; }
  started = true;
  menuActive = false;
  hideOverlay();
  updateHUD();
  renderShops();
  requestLock();
});

document.getElementById('ps-resume').addEventListener('click', (e) => {
  e.stopPropagation();
  ac(); master();
  menuActive = false;
  hideOverlay();
  updateHUD();
  requestLock();
});

document.getElementById('ps-shop').addEventListener('click', (e) => {
  e.stopPropagation();
  ac();
  updateHUD();
  renderShops();
  showScreen('shop');
});

document.getElementById('ps-menu').addEventListener('click', (e) => {
  e.stopPropagation();
  ac();
  started = true;
  if (player.dead) { location.reload(); return; }
  menuActive = true;
  updateHUD();
  renderShops();
  showScreen('shop');
});

document.getElementById('ps-retry').addEventListener('click', () => { location.reload(); });

// ============================================================ LOCK / FLOW
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === renderer.domElement;
  if (locked) {
    hideOverlay();
    menuActive = false;
    running = true;
  } else if (started && !player.dead && !menuActive) {
    running = false;
    showScreen('pause');
  }
});

document.addEventListener('pointerlockerror', () => {
  if (started && !player.dead) {
    hideOverlay();
    menuActive = false;
    running = true;
  }
});

// ============================================================ MAIN LOOP
const clock = new THREE.Clock();

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, clock.getDelta());
  nowW = performance.now() / 1000;

  if (running) {
    updatePlayer(dt);
    updateEnemies(dt);
    updateEnemyBullets(dt);
    updateMedkits(dt);

    // shooting
    const w = weapons[currentWeapon];
    if (mouseDown && !reloading) {
      if (w.auto) {
        if (nowW - lastFire >= 1 / w.rate) fireWeapon();
      } else if (w.type === 'hitscan') {
        if (nowW - lastFire >= 1 / w.rate) fireWeapon();
      } else {
        // knife handled on click-ish: fire when available
        if (!w.cooling && !w.animT) fireWeapon();
      }
    } else {
      holdTime = Math.max(0, holdTime - dt * 4);
    }

    // reload timer
    if (reloading) {
      reloadT -= dt;
      dom.reloadMsg.classList.add('on');
      if (reloadT <= 0) {
        const cw = weapons[currentWeapon];
        const need = cw.magCap - cw.mag;
        const take = Math.min(need, cw.reserve);
        cw.mag += take;
        cw.reserve -= take;
        reloading = false;
        dom.reloadMsg.classList.remove('on');
      }
    } else {
      dom.reloadMsg.classList.remove('on');
    }

    dom.reloadMsg.classList.toggle('on', reloading);
    updateWeaponAnim(dt);
    updateHUD();
  }

  // decaying shake
  if (shakeT > 0) {
    shakeT -= dt;
    const a = shakeAmp * Math.max(0, shakeT / 0.15);
    camera.position.x += (Math.random() - 0.5) * a;
    camera.position.y += (Math.random() - 0.5) * a;
    if (shakeT <= 0) shakeAmp = 0;
  }

  updateFx(dt);

  // crosshair gap
  const g = running ? Math.min(30, 6 + getSpread() * 4200) : 6;
  dom.crosshair.style.setProperty('--g', `${g}px`);

  if (menuActive) {
    updateShowcase(dt);
    renderer.render(showScene, showCam);
  } else {
    renderer.render(scene, camera);
  }
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  showCam.aspect = innerWidth / innerHeight;
  showCam.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// init
loadData();
initShowcase();
switchWeapon(2);
updateHUD();
updateSelectorUI();
renderShops();
showOverlay('menu');
// pre-warm weapons anim fields
weapons[0].animT = 0;
weapons[0].cooling = false;
weapons[0].coolT = 0;
tick();

// load guard
window.addEventListener('error', (e) => {
  if (/three|Script error|Import/i.test(e.message || '')) {
    document.getElementById('load-warn').classList.remove('hidden');
  }
});