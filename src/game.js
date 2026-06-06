const canvas = document.getElementById('gameCanvas');
const screenCtx = canvas.getContext('2d');
screenCtx.imageSmoothingEnabled = false;
const LOW_RES = { w: 512, h: 384 };
const renderCanvas = document.createElement('canvas');
renderCanvas.width = LOW_RES.w;
renderCanvas.height = LOW_RES.h;
const ctx = renderCanvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
const VIEW = { x: 160, y: 0, w: 960, h: 720 };
const LOW_SCALE_X = LOW_RES.w / VIEW.w;
const LOW_SCALE_Y = LOW_RES.h / VIEW.h;
const PLAYER_IMAGE_SCALE = 2.25;

const hud = {
  tickets: document.getElementById('hudTickets'),
  score: document.getElementById('hudScore'),
  cash: document.getElementById('hudCash'),
  course: document.getElementById('hudCourse'),
  time: document.getElementById('hudTime'),
  difficulty: document.getElementById('hudDifficulty'),
};

const REFERENCE_CALIBRATION = {
  source: 'E:/Downloads/YTDown_YouTube_Atari-720-NEW-Top-Score-300-900-Finally-_Media_sPxeoEYiZDs_001_1080p.mp4',
  backbuffer: { w: LOW_RES.w, h: LOW_RES.h },
  hud: {
    playerPanel: { x: 26, y: 24, w: 215, h: 68 },
    cashPanel: { x: 26, y: 96, w: 215, h: 62 },
    ticketStrip: { x: 26, y: 164, w: 64, h: 190 },
    timer: { x: 348, y: 38, w: 265, h: 62 },
    bottomBanner: { x: 220, y: 682, w: 520, h: 30 },
  },
  city: {
    tileW: 150,
    tileH: 75,
    anchorX: 0.54,
    anchorY: 0.62,
    deadZone: 0.035,
    follow: 0.18,
    maxCameraStep: 0.09,
    cameraEase: 0.22,
    playerSpriteScale: 3,
    playerImageScale: PLAYER_IMAGE_SCALE,
    boardLength: 50,
    note: 'Measured against city_scroll: broad offscreen streets/sidewalks with the player below center.',
  },
  events: {
    RAMP: { tileW: 150, tileH: 56, anchorX: 0.53, anchorY: 0.60, deadZone: 0.03, follow: 0.24, maxCameraStep: 0.095, cameraEase: 0.24, playerSpriteScale: 3, playerImageScale: PLAYER_IMAGE_SCALE },
    DOWNHILL: { tileW: 170, tileH: 85, anchorX: 0.51, anchorY: 0.60, deadZone: 0.035, follow: 0.24, maxCameraStep: 0.095, cameraEase: 0.24, playerSpriteScale: 3, playerImageScale: PLAYER_IMAGE_SCALE },
    SLALOM: { tileW: 174, tileH: 87, anchorX: 0.52, anchorY: 0.60, deadZone: 0.035, follow: 0.24, maxCameraStep: 0.095, cameraEase: 0.24, playerSpriteScale: 3, playerImageScale: PLAYER_IMAGE_SCALE },
    JUMP: { tileW: 172, tileH: 86, anchorX: 0.52, anchorY: 0.60, deadZone: 0.035, follow: 0.24, maxCameraStep: 0.095, cameraEase: 0.24, playerSpriteScale: 3, playerImageScale: PLAYER_IMAGE_SCALE },
  },
};
const TILE_W = REFERENCE_CALIBRATION.city.tileW;
const TILE_H = REFERENCE_CALIBRATION.city.tileH;
const WORLD_W = 36;
const WORLD_H = 36;
const CENTER = { x: WORLD_W / 2, y: WORLD_H / 2 };
const CITY_TIME = 52;
const TICKET_STEP = 3000;
const STARTING_TICKETS = 2;
const CAMERA_STEP = 1 / 96;
const CAMERA_DEAD_ZONE = REFERENCE_CALIBRATION.city.deadZone;
const TURN_RATE = 4.35;
const AIR_TURN_MULT = 1.08;
const VISUAL_SPIN_RATE = 6.8;
const TRICK_SCORE_SPIN_RATE = 8.5;
const BASE_MAX_SPEED = 0.205;
const BOARD_SPEED_MULT = 1.12;
const PUSH_IMPULSE = 0.026;
const AIR_PUSH_IMPULSE = 0.010;
const GROUND_FRICTION = 0.976;
const AIR_FRICTION = 1;

const events = [
  { id: 'RAMP', x: 18, y: 3.2, color: '#f6c64b', score: 4200, cash: 100, seconds: 22 },
  { id: 'DOWNHILL', x: 32.8, y: 18, color: '#50c7ef', score: 5200, cash: 150, seconds: 24 },
  { id: 'SLALOM', x: 18, y: 32.8, color: '#79db72', score: 6200, cash: 200, seconds: 26 },
  { id: 'JUMP', x: 3.2, y: 18, color: '#ef6fb0', score: 7600, cash: 250, seconds: 28 },
];

const EVENT_COURSES = {
  RAMP: {
    length: 38,
    startY: 20.4,
    finishY: 20.4,
    minX: 4.4,
    maxX: 31.6,
    minY: 6.4,
    maxY: 33.6,
    halfpipe: {
      xMin: 5.2,
      xMax: 30.8,
      centerY: 20.4,
      flatHalf: 2.25,
      lipHalf: 6.9,
      copingTopY: 13.5,
      copingBottomY: 27.3,
    },
  },
  DOWNHILL: {
    length: 72,
    startY: 4.5,
    finishY: 67,
    minX: 5.5,
    maxX: 30.5,
    autoSpeed: 3.25,
    minSpeed: 2.6,
    maxSpeed: 7.6,
    duckSpeed: 5.55,
    slopeBands: [
      { y0: 4, y1: 15, grade: 1.65, label: 'DROP' },
      { y0: 15, y1: 27, grade: 0.74, label: 'TURN' },
      { y0: 27, y1: 45, grade: 1.45, label: 'CHUTE' },
      { y0: 45, y1: 58, grade: 0.82, label: 'BANK' },
      { y0: 58, y1: 69, grade: 1.85, label: 'FINISH' },
    ],
    checkpoints: [
      { y: 11, points: 120 },
      { y: 21, points: 160 },
      { y: 32, points: 180 },
      { y: 44, points: 220 },
      { y: 57, points: 260 },
    ],
    obstacles: [
      { type: 'cone', x: 14.4, y: 16.5 },
      { type: 'barrier', x: 20.5, y: 28.5 },
      { type: 'cone', x: 13.3, y: 40.5 },
      { type: 'barrier', x: 18.7, y: 53.4 },
    ],
  },
  JUMP: {
    length: 76,
    startY: 4.5,
    finishY: 71,
    minX: 4.5,
    maxX: 31.5,
    autoSpeed: 3.05,
    minSpeed: 2.4,
    maxSpeed: 7.2,
    slopeBands: [
      { y0: 4, y1: 13.8, grade: 1.55, label: 'APPROACH' },
      { y0: 13.8, y1: 20.5, grade: 0.52, label: 'DROP' },
      { y0: 20.5, y1: 28.2, grade: 1.48, label: 'APPROACH' },
      { y0: 28.2, y1: 36.0, grade: 0.50, label: 'DROP' },
      { y0: 36.0, y1: 43.9, grade: 1.62, label: 'APPROACH' },
      { y0: 43.9, y1: 52.2, grade: 0.48, label: 'DROP' },
      { y0: 52.2, y1: 60.2, grade: 1.72, label: 'APPROACH' },
      { y0: 60.2, y1: 71.0, grade: 0.55, label: 'LANDING' },
    ],
    checkpoints: [
      { y: 14, points: 150 },
      { y: 28, points: 180 },
      { y: 42, points: 220 },
      { y: 58, points: 280 },
    ],
    ramps: [
      { x: 18.5, y: 13.2, w: 6.8, h: 2.6, approach: 7.8, landingY: 18.0, points: 220 },
      { x: 13.6, y: 27.4, w: 6.4, h: 2.7, approach: 7.0, landingY: 32.4, points: 260 },
      { x: 22.0, y: 43.2, w: 7.0, h: 2.8, approach: 7.4, landingY: 48.1, points: 320 },
      { x: 16.5, y: 59.4, w: 7.4, h: 3.0, approach: 8.0, landingY: 65.0, points: 420 },
    ],
    targets: [
      { x: 18.2, y: 18.0, r: 1.5, points: 350 },
      { x: 13.0, y: 32.4, r: 1.45, points: 420 },
      { x: 22.5, y: 48.1, r: 1.55, points: 520 },
      { x: 16.2, y: 65.0, r: 1.7, points: 700 },
    ],
    water: [
      { x: 8.4, y: 16.0, w: 6.7, h: 8.2 },
      { x: 21.0, y: 28.5, w: 7.4, h: 9.2 },
      { x: 7.2, y: 44.2, w: 7.6, h: 9.0 },
      { x: 22.0, y: 60.4, w: 7.0, h: 8.6 },
    ],
  },
};

const shops = [
  { id: 'BOARD', x: 7.5, y: 8, color: '#f8d055', price: 100, desc: 'speed', bought: false },
  { id: 'SHOES', x: 28.4, y: 8.4, color: '#60cff2', price: 150, desc: 'jump', bought: false },
  { id: 'PADS', x: 7.8, y: 28.1, color: '#70e27b', price: 150, desc: 'recovery', bought: false },
  { id: 'HELMET', x: 28, y: 28, color: '#f07ab4', price: 200, desc: 'bails', bought: false },
];

const mapIcons = [
  { x: 13.5, y: 13.4 },
  { x: 22.5, y: 13.4 },
  { x: 13.5, y: 22.6 },
  { x: 22.5, y: 22.6 },
];

const hazards = [
  { type: 'car', x: 2, y: 16.2, vx: 4.8, vy: 0, color: '#e25247' },
  { type: 'car', x: 33, y: 19.8, vx: -4.1, vy: 0, color: '#42aee8' },
  { type: 'bmx', x: 11, y: 2, vx: 0, vy: 4.2, color: '#f2df73' },
  { type: 'frisbee', x: 4, y: 9, vx: 3.6, vy: 2.3, color: '#fff0a8' },
  { type: 'thug', x: 29, y: 13, vx: -2.1, vy: 1.9, color: '#9b6bed' },
];

const ramps = [
  { x: 11, y: 16.5, dir: 0 },
  { x: 24.5, y: 19.5, dir: Math.PI },
  { x: 15, y: 10.5, dir: Math.PI / 2 },
  { x: 21, y: 25.5, dir: -Math.PI / 2 },
  { x: 29.2, y: 22.2, dir: Math.PI / 4 },
];

const rails = [
  { x1: 9, y1: 20.4, x2: 14, y2: 20.4 },
  { x1: 22, y1: 15.6, x2: 27, y2: 15.6 },
  { x1: 16, y1: 27, x2: 20, y2: 23 },
];

const water = [
  { x: 10.5, y: 25.5, r: 1.35 },
  { x: 25.4, y: 10.4, r: 1.25 },
];

const SPRITE_SCALE = REFERENCE_CALIBRATION.city.playerSpriteScale;
const SKATER_ROLL_FRAMES = 8;
const SKATER_JUMP_FRAMES = 8;
const SKATER_DUCK_FRAMES = 4;
const SKATER_TRICK_FRAMES = 6;
const DIRECTION_LABELS = ['E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW', 'N', 'NNE', 'NE', 'ENE'];
const SKATER_SPRITES = createSkaterSprites();
const SKATER_ATLAS = createSkaterAtlas();
const TEXTURES = createTextureCache();
const ATLAS = createPixelAtlas();
const GENERATED_ENV = createGeneratedEnvironmentAtlas();

const state = {
  screen: 'splash',
  mode: 'city',
  keys: new Set(),
  score: 0,
  cash: 0,
  tickets: STARTING_TICKETS,
  nextTicketScore: TICKET_STEP,
  classLevel: 1,
  cityTimer: CITY_TIME,
  eventTimer: 0,
  event: null,
  message: 'PRESS ENTER',
  messageTimer: 0,
  gateCooldown: 0,
  mapTimer: 0,
  eventRun: null,
  shake: 0,
  animTime: 0,
  bees: [],
  highScores: loadHighScores(),
  camera: { x: CENTER.x, y: CENTER.y, vx: 0, vy: 0 },
  player: makePlayer(),
};

const audio = createAudio();

function makePlayer() {
  return {
    x: CENTER.x,
    y: CENTER.y,
    vx: 0,
    vy: 0,
    facing: -Math.PI / 2,
    z: 0,
    vz: 0,
    spin: 0,
    spinScore: 0,
    grind: 0,
    anim: 0,
    pushTimer: 0,
    invuln: 0,
    bail: 0,
  };
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function normalizeAngle(angle) {
  let a = angle;
  while (a <= -Math.PI) a += Math.PI * 2;
  while (a > Math.PI) a -= Math.PI * 2;
  return a;
}

function dist(a, b, x, y) {
  return Math.hypot(a - x, b - y);
}

function beginLowResFrame() {
  ctx.setTransform(LOW_SCALE_X, 0, 0, LOW_SCALE_Y, -VIEW.x * LOW_SCALE_X, -VIEW.y * LOW_SCALE_Y);
  ctx.imageSmoothingEnabled = false;
}

function presentFrame() {
  screenCtx.setTransform(1, 0, 0, 1, 0, 0);
  screenCtx.imageSmoothingEnabled = false;
  screenCtx.fillStyle = '#000000';
  screenCtx.fillRect(0, 0, canvas.width, canvas.height);
  screenCtx.drawImage(renderCanvas, 0, 0, LOW_RES.w, LOW_RES.h, VIEW.x, VIEW.y, VIEW.w, VIEW.h);
}

function snapCamera(v) {
  return Math.round(v / CAMERA_STEP) * CAMERA_STEP;
}

function snapScreenX(x) {
  return VIEW.x + Math.round((x - VIEW.x) * LOW_SCALE_X) / LOW_SCALE_X;
}

function snapScreenY(y) {
  return VIEW.y + Math.round((y - VIEW.y) * LOW_SCALE_Y) / LOW_SCALE_Y;
}

function activeProjection() {
  if (state?.mode === 'event') {
    return REFERENCE_CALIBRATION.events[state.event?.id] || REFERENCE_CALIBRATION.events.RAMP;
  }
  return REFERENCE_CALIBRATION.city;
}

function projectedScreenVector(angle) {
  const projection = activeProjection();
  const vx = Math.cos(angle);
  const vy = Math.sin(angle);
  return {
    x: (vx - vy) * projection.tileW * 0.5,
    y: (vx + vy) * projection.tileH * 0.5,
  };
}

function angleToSpriteDir(angle) {
  return Math.round((((angle + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2)) * 16) % 16;
}

function worldToScreen(x, y) {
  const projection = activeProjection();
  const camX = snapCamera(state.camera.x);
  const camY = snapCamera(state.camera.y);
  const dx = x - camX;
  const dy = y - camY;
  return {
    x: snapScreenX(VIEW.x + VIEW.w * projection.anchorX + (dx - dy) * projection.tileW * 0.5),
    y: snapScreenY(VIEW.y + VIEW.h * projection.anchorY + (dx + dy) * projection.tileH * 0.5),
  };
}

function makeCanvas(w, h, painter) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  painter(g, c.width, c.height);
  return c;
}

function createTextureCache() {
  const build = (name, w, h, colors, density, seed = 1) => makeCanvas(w, h, (g, width, height) => {
    g.fillStyle = colors[0];
    g.fillRect(0, 0, width, height);
    const dots = Math.floor(width * height * density);
    for (let i = 0; i < dots; i++) {
      const n = (i * 1103515245 + seed * 12345 + name.length * 97) >>> 0;
      const px = (n >>> 8) % width;
      const py = (n >>> 19) % height;
      g.fillStyle = colors[1 + (n % Math.max(1, colors.length - 1))];
      g.fillRect(px, py, 1 + (n % 2), 1);
    }
    if (name.includes('asphalt')) {
      g.strokeStyle = '#111722';
      for (let y = 5; y < height; y += 9) {
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(width, y - 2);
        g.stroke();
      }
    }
    if (name.includes('concrete')) {
      g.strokeStyle = '#a5a8b0';
      for (let x = 0; x < width; x += 18) {
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x + 8, height);
        g.stroke();
      }
    }
  });
  return {
    asphalt: build('asphalt', 96, 64, ['#202631', '#151a23', '#2e3440', '#111722'], 0.08, 3),
    concrete: build('concrete', 96, 64, ['#c7c9ce', '#dadde2', '#aeb3bd', '#9fa5af'], 0.06, 7),
    wall: build('wall', 72, 96, ['#53586f', '#464b61', '#60657b', '#3a4054'], 0.05, 13),
    hud: build('hud', 80, 80, ['#008e3f', '#0aaa4a', '#006c31', '#0c7b3b'], 0.12, 17),
    sign: build('sign', 80, 32, ['#351315', '#4a1719', '#1d0b0d', '#6d1c21'], 0.08, 21),
    blueUi: build('blueUi', 80, 48, ['#0527d7', '#1237ff', '#031583', '#0b2caf'], 0.09, 25),
    tan: build('tan', 96, 64, ['#c9793d', '#d98b46', '#ad5b34', '#e1a257'], 0.07, 29),
    ramp: build('ramp', 96, 64, ['#d8b08e', '#e8c5a5', '#b9876a', '#c79b7b'], 0.07, 31),
    water: build('water', 80, 48, ['#21bcca', '#38e1d6', '#159aa8', '#2caed6'], 0.08, 37),
  };
}

function drawTextureRect(texture, x, y, w, h) {
  ctx.drawImage(texture, x, y, w, h);
}

function createGeneratedEnvironmentAtlas() {
  const img = new Image();
  const atlas = {
    img,
    ready: false,
    error: false,
    crops: {
      asphalt: [38, 56, 115, 104],
      sidewalk: [38, 183, 130, 78],
      shopCanopy: [444, 56, 170, 106],
      shopWide: [628, 56, 225, 116],
      shopFront: [629, 188, 225, 118],
      payPadGrid: [48, 407, 104, 85],
      payPadPlain: [172, 407, 106, 104],
      deckCrate: [450, 338, 168, 116],
      deckTile: [628, 348, 138, 82],
      rampLeft: [348, 461, 174, 148],
      rampRight: [544, 461, 174, 150],
      railStraight: [714, 480, 263, 58],
      railCurve: [724, 554, 258, 83],
      waterCurve: [42, 534, 152, 91],
      waterRect: [214, 533, 121, 92],
      waterPool: [42, 662, 262, 99],
      arrowRight: [318, 643, 101, 72],
      arrowLeft: [568, 643, 156, 72],
      targetRound: [636, 742, 110, 84],
      targetSmall: [746, 652, 87, 76],
      cone: [900, 63, 66, 95],
      barrelCrate: [840, 166, 126, 155],
      spike: [842, 779, 116, 86],
    },
  };
  img.onload = () => { atlas.ready = true; };
  img.onerror = () => {
    atlas.error = true;
    console.error('Failed to load generated environment atlas');
  };
  img.src = 'src/assets/generated-environment-atlas.png';
  return atlas;
}

function drawGeneratedEnvAsset(name, x, y, w, h, alpha = 1) {
  if (!GENERATED_ENV.ready) return false;
  const crop = GENERATED_ENV.crops[name];
  if (!crop) return false;
  const [sx, sy, sw, sh] = crop;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = alpha;
  ctx.drawImage(GENERATED_ENV.img, sx, sy, sw, sh, Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  ctx.restore();
  return true;
}

function drawGeneratedWaterPatch(cx, cy, w, h, name = 'waterPool', alpha = 0.72) {
  const projection = activeProjection();
  const p = worldToScreen(cx, cy);
  const screenW = w * projection.tileW * 0.34;
  const screenH = h * projection.tileH * 0.54;
  return drawGeneratedEnvAsset(name, p.x - screenW * 0.5, p.y - screenH * 0.58, screenW, screenH, alpha);
}

function createPixelAtlas() {
  return {
    mapIcon: makeCanvas(18, 13, (g) => {
      g.fillStyle = '#fff2a8';
      g.fillRect(0, 0, 18, 13);
      g.fillStyle = '#27324a';
      g.fillRect(4, 3, 2, 7);
      g.fillRect(12, 3, 2, 7);
      g.fillRect(6, 4, 2, 2);
      g.fillRect(10, 4, 2, 2);
      g.fillRect(8, 6, 2, 2);
    }),
    payPad: makeCanvas(54, 18, (g) => {
      g.fillStyle = '#31e92b';
      g.fillRect(0, 0, 54, 18);
      g.fillStyle = '#8dff47';
      g.fillRect(5, 3, 44, 9);
      g.fillStyle = '#0a7819';
      g.fillRect(0, 15, 54, 3);
    }),
    orangeRamp: makeCanvas(38, 14, (g) => {
      g.fillStyle = '#9a5d22';
      g.fillRect(0, 8, 38, 6);
      g.fillStyle = '#e39b49';
      g.fillRect(2, 2, 34, 8);
      g.fillStyle = '#ffe0a0';
      g.fillRect(3, 0, 32, 3);
    }),
    rail: makeCanvas(44, 8, (g) => {
      g.fillStyle = '#f0f5ff';
      g.fillRect(0, 2, 44, 3);
      g.fillStyle = '#8b949f';
      for (let x = 3; x < 44; x += 10) g.fillRect(x, 5, 2, 3);
    }),
    carRed: makeCanvas(34, 20, (g) => paintCar(g, '#e25247')),
    carBlue: makeCanvas(34, 20, (g) => paintCar(g, '#42aee8')),
    frisbee: makeCanvas(20, 10, (g) => {
      g.fillStyle = '#f1df9c';
      g.fillRect(3, 2, 14, 6);
      g.fillStyle = '#232323';
      g.fillRect(5, 1, 10, 1);
      g.fillStyle = '#d17f2e';
      g.fillRect(6, 4, 8, 2);
    }),
  };
}

function paintCar(g, color) {
  g.fillStyle = '#0008';
  g.fillRect(3, 15, 28, 3);
  g.fillStyle = color;
  g.fillRect(3, 7, 28, 8);
  g.fillRect(8, 3, 16, 6);
  g.fillStyle = '#252a5e';
  g.fillRect(12, 4, 8, 5);
  g.fillStyle = '#f4f4f4';
  g.fillRect(5, 15, 5, 4);
  g.fillRect(24, 15, 5, 4);
  g.fillStyle = '#111111';
  g.fillRect(7, 16, 2, 2);
  g.fillRect(26, 16, 2, 2);
}

const BITMAP_FONT = {
  A: ['111', '101', '111', '101', '101'],
  B: ['110', '101', '110', '101', '110'],
  C: ['111', '100', '100', '100', '111'],
  D: ['110', '101', '101', '101', '110'],
  E: ['111', '100', '110', '100', '111'],
  F: ['111', '100', '110', '100', '100'],
  G: ['111', '100', '101', '101', '111'],
  H: ['101', '101', '111', '101', '101'],
  I: ['111', '010', '010', '010', '111'],
  J: ['001', '001', '001', '101', '111'],
  K: ['101', '101', '110', '101', '101'],
  L: ['100', '100', '100', '100', '111'],
  M: ['101', '111', '111', '101', '101'],
  N: ['101', '111', '111', '111', '101'],
  O: ['111', '101', '101', '101', '111'],
  P: ['111', '101', '111', '100', '100'],
  Q: ['111', '101', '101', '111', '001'],
  R: ['111', '101', '111', '110', '101'],
  S: ['111', '100', '111', '001', '111'],
  T: ['111', '010', '010', '010', '010'],
  U: ['101', '101', '101', '101', '111'],
  V: ['101', '101', '101', '101', '010'],
  W: ['101', '101', '111', '111', '101'],
  X: ['101', '101', '010', '101', '101'],
  Y: ['101', '101', '010', '010', '010'],
  Z: ['111', '001', '010', '100', '111'],
  0: ['111', '101', '101', '101', '111'],
  1: ['010', '110', '010', '010', '111'],
  2: ['111', '001', '111', '100', '111'],
  3: ['111', '001', '111', '001', '111'],
  4: ['101', '101', '111', '001', '001'],
  5: ['111', '100', '111', '001', '111'],
  6: ['111', '100', '111', '101', '111'],
  7: ['111', '001', '010', '010', '010'],
  8: ['111', '101', '111', '101', '111'],
  9: ['111', '101', '111', '001', '111'],
  '$': ['111', '110', '111', '011', '111'],
  ':': ['0', '1', '0', '1', '0'],
  '!': ['1', '1', '1', '0', '1'],
  '-': ['0', '0', '1', '0', '0'],
  '+': ['0', '1', '1', '1', '0'],
  '/': ['001', '001', '010', '100', '100'],
  '.': ['0', '0', '0', '0', '1'],
  ',': ['0', '0', '0', '1', '1'],
};

function bitmapTextWidth(text, scale = 4) {
  return String(text).toUpperCase().split('').reduce((width, ch) => {
    if (ch === ' ') return width + scale * 4;
    const glyph = BITMAP_FONT[ch] || BITMAP_FONT['?'] || BITMAP_FONT.A;
    return width + (glyph[0].length + 1) * scale;
  }, 0);
}

function drawBitmapText(text, x, y, scale = 4, color = '#ffffff', align = 'left') {
  const value = String(text).toUpperCase();
  let px = align === 'center' ? x - bitmapTextWidth(value, scale) / 2 : align === 'right' ? x - bitmapTextWidth(value, scale) : x;
  ctx.fillStyle = color;
  for (const ch of value) {
    if (ch === ' ') {
      px += scale * 4;
      continue;
    }
    const glyph = BITMAP_FONT[ch] || BITMAP_FONT.A;
    for (let row = 0; row < glyph.length; row++) {
      for (let col = 0; col < glyph[row].length; col++) {
        if (glyph[row][col] === '1') ctx.fillRect(Math.round(px + col * scale), Math.round(y + row * scale), scale, scale);
      }
    }
    px += (glyph[0].length + 1) * scale;
  }
}

function drawBitmapTextShadow(text, x, y, scale, color, align = 'left') {
  drawBitmapText(text, x + scale, y + scale, scale, '#000000', align);
  drawBitmapText(text, x, y, scale, color, align);
}

function loadHighScores() {
  const fallback = [
    { name: 'ACE', score: 28000 },
    { name: 'CAB', score: 22000 },
    { name: 'SK8', score: 15000 },
    { name: 'AIR', score: 11000 },
  ];
  try {
    return JSON.parse(localStorage.getItem('skate_city_720_scores')) || fallback;
  } catch {
    return fallback;
  }
}

function saveHighScores() {
  localStorage.setItem('skate_city_720_scores', JSON.stringify(state.highScores));
}

function createAudio() {
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  const ac = AudioCtor ? new AudioCtor() : null;
  const beep = (freq, time, type = 'square', gain = 0.04) => {
    if (!ac) return;
    if (ac.state === 'suspended') ac.resume();
    const osc = ac.createOscillator();
    const amp = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    amp.gain.setValueAtTime(gain, ac.currentTime);
    amp.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + time);
    osc.connect(amp).connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + time);
  };
  return {
    start: () => [180, 260, 370].forEach((f, i) => setTimeout(() => beep(f, 0.08, 'triangle'), i * 55)),
    ticket: () => [620, 820, 1040].forEach((f, i) => setTimeout(() => beep(f, 0.05), i * 35)),
    hit: () => beep(90, 0.22, 'sawtooth', 0.07),
    msg: () => beep(320, 0.06, 'triangle', 0.035),
    event: () => [450, 560, 700, 920].forEach((f, i) => setTimeout(() => beep(f, 0.08), i * 60)),
  };
}

function makeEventRun(eventId) {
  const course = EVENT_COURSES[eventId];
  if (!course) return null;
  const run = {
    id: eventId,
    progress: 0,
    checkpoints: new Set(),
    obstacles: new Set(),
    ramps: new Set(),
    targets: new Set(),
    wasAirborne: false,
    courseSpeed: course.autoSpeed || 0,
    pose: 'roll',
    trick: null,
    trickTimer: 0,
    ducking: false,
    sectionIndex: 0,
    landingStatus: '',
  };
  if (eventId === 'RAMP') {
    run.courseSpeed = 0;
    run.ramp = {
      along: CENTER.x,
      cross: course.halfpipe.centerY,
      alongVel: 0,
      crossVel: 3.2,
      airZ: 0,
      airVz: 0,
      surface: 0,
      lip: null,
      lastLip: null,
      grindSide: null,
      grindAward: 0,
      pumpCooldown: 0,
      launchSide: null,
      landedClean: true,
    };
  }
  return run;
}

function getEventCourse() {
  return state.mode === 'event' ? EVENT_COURSES[state.event?.id] || null : null;
}

function eventCourseCenter(id, y) {
  if (id === 'DOWNHILL') {
    return CENTER.x + Math.sin(y * 0.23) * 3.5 + (y > 44 ? -2.0 : y > 24 ? 1.3 : 0);
  }
  if (id === 'JUMP') {
    return CENTER.x + Math.sin(y * 0.18 + 0.8) * 3.0 + (y > 50 ? -1.1 : y > 28 ? 1.4 : 0);
  }
  return CENTER.x;
}

function eventCourseHalfWidth(id, y) {
  if (id === 'DOWNHILL') return y < 18 ? 6.3 : y < 50 ? 4.7 : 5.8;
  if (id === 'JUMP') return y < 18 ? 8.6 : y < 52 ? 7.2 : 8.1;
  return 12;
}

function activeWorldBounds() {
  const course = getEventCourse();
  if (course) {
    return {
      minX: course.minX,
      maxX: course.maxX,
      minY: course.minY ?? 1.5,
      maxY: course.maxY ?? course.length - 1.5,
    };
  }
  return { minX: 1.5, maxX: WORLD_W - 1.5, minY: 1.5, maxY: WORLD_H - 1.5 };
}

function createSkaterSprites() {
  const screenCue = (dir) => {
    const a = (dir / 16) * Math.PI * 2;
    const sx = (Math.cos(a) - Math.sin(a)) * REFERENCE_CALIBRATION.city.tileW * 0.5;
    const sy = (Math.cos(a) + Math.sin(a)) * REFERENCE_CALIBRATION.city.tileH * 0.5;
    const len = Math.max(1, Math.hypot(sx, sy));
    return {
      sx: sx / len,
      sy: sy / len,
      face: sx >= 0 ? 1 : -1,
      away: sy < -0.25,
    };
  };
  const mirror = (commands) => commands.map(([x, y, w, h, color]) => [-x - w, y, w, h, color]);
  const stamp = (commands, dir, type, feetX, feetY) => {
    commands.dir = dir;
    commands.type = type;
    commands.feet = { x: feetX, y: feetY };
    return commands;
  };
  const tintGreen = (color, away) => {
    if (color !== '#18b947') return color;
    return away ? '#0d7b38' : '#18b947';
  };
  const orient = (commands, dir) => {
    const cue = screenCue(dir);
    const posed = cue.face < 0 ? mirror(commands) : commands.map((cmd) => cmd.slice());
    return posed.map(([x, y, w, h, color]) => [x, y, w, h, tintGreen(color, cue.away)]);
  };
  const baseBody = (lean = 0, crouch = 0) => [
    [-2 + lean, -16 + crouch, 6, 2, '#e52824'],
    [3 + lean, -17 + crouch, 4, 2, '#f7d641'],
    [-1 + lean, -14 + crouch, 5, 5, '#f0caa6'],
    [3 + lean, -13 + crouch, 2, 2, '#2b1a15'],
    [-4 + lean, -9 + crouch, 8, 8 - Math.min(crouch, 2), '#18b947'],
    [-1 + lean, -9 + crouch, 2, 8 - Math.min(crouch, 2), '#f6d338'],
    [-5 + lean, -8 + crouch, 3, 2, '#f0caa6'],
    [3 + lean, -7 + crouch, 4, 2, '#f0caa6'],
  ];
  const legs = (frame, crouch = 0) => {
    const phase = frame % 4;
    const front = phase === 0 || phase === 3 ? 1 : 0;
    const rear = phase === 1 || phase === 2 ? 1 : 0;
    return [
      [-3, -2 + crouch, 3, 7 + rear, '#ffffff'],
      [-2, -1 + crouch, 1, 7 + rear, '#df2525'],
      [-5, 5 + crouch + rear, 6, 2, '#df2525'],
      [1, -2 + crouch, 3, 8 + front, '#ffffff'],
      [3, -1 + crouch, 1, 7 + front, '#df2525'],
      [0, 6 + crouch + front, 7, 2, '#df2525'],
    ];
  };
  const makeRoll = (dir, frame) => {
    const cue = screenCue(dir);
    const lean = Math.round(cue.sx * 1.2);
    const bob = frame === 1 || frame === 2 ? 1 : 0;
    return stamp(orient([
      ...baseBody(lean, bob),
      ...legs(frame, bob),
    ], dir), dir, 'roll', 0, 8 + bob);
  };
  const makePush = (dir, frame) => {
    const cue = screenCue(dir);
    const lean = Math.round(cue.sx * 1.7);
    const kick = frame % 2 === 0 ? 2 : 0;
    return stamp(orient([
      ...baseBody(lean, 1),
      [-3, -1, 3, 8, '#ffffff'],
      [-2, 0, 1, 7, '#df2525'],
      [-5, 6, 6, 2, '#df2525'],
      [1 + kick, 0, 3, 9, '#ffffff'],
      [3 + kick, 1, 1, 8, '#df2525'],
      [1 + kick, 9, 7, 2, '#df2525'],
    ], dir), dir, 'push', 0, 9);
  };
  const makeCrouch = (dir) => {
    const cue = screenCue(dir);
    const lean = Math.round(cue.sx);
    return stamp(orient([
      ...baseBody(lean, 4),
      [-6 + lean, -4, 4, 2, '#f0caa6'],
      [3 + lean, -4, 4, 2, '#f0caa6'],
      [-4, 1, 4, 5, '#ffffff'],
      [-3, 2, 1, 5, '#df2525'],
      [1, 1, 4, 5, '#ffffff'],
      [3, 2, 1, 5, '#df2525'],
      [-5, 6, 11, 2, '#df2525'],
    ], dir), dir, 'crouch', 0, 8);
  };
  const makeAir = (dir, spin = false) => {
    const cue = screenCue(dir);
    const lean = Math.round(cue.sx * 2);
    return stamp(orient([
      ...baseBody(lean, -1),
      [-7 + lean, -8, 5, 2, '#f0caa6'],
      [3 + lean, -9, 6, 2, '#f0caa6'],
      [-5, -1, 4, 7, '#ffffff'],
      [-4, 0, 1, 7, '#df2525'],
      [1, -2, 4, 8, '#ffffff'],
      [3, -1, 1, 7, '#df2525'],
      [-6, 5, 6, 2, '#df2525'],
      [1, 6, 7, 2, '#df2525'],
      ...(spin ? [[-4 + lean, -19, 9, 2, '#f7d641']] : []),
    ], dir), dir, spin ? 'spin' : 'air', 0, 8);
  };
  const makeLand = (dir) => offsetCommands(makeCrouch(dir), 0, 2);
  const sprites = {
    bail: stamp([
      [-9, 5, 17, 3, '#f0a228'],
      [-8, -7, 8, 7, '#18b947'],
      [-2, -7, 2, 7, '#f6d338'],
      [1, -6, 7, 3, '#f0caa6'],
      [-12, -5, 5, 2, '#f0caa6'],
      [-6, 0, 5, 5, '#ffffff'],
      [0, 0, 5, 5, '#ffffff'],
      [-6, -13, 5, 4, '#f0caa6'],
      [-7, -16, 9, 2, '#e52824'],
    ], 0, 'bail', 0, 7),
  };
  for (let dir = 0; dir < 16; dir++) {
    sprites[`crouch_${dir}`] = makeCrouch(dir);
    sprites[`land_${dir}`] = makeLand(dir);
    sprites[`air_${dir}`] = makeAir(dir, false);
    sprites[`spin_${dir}`] = makeAir(dir, true);
    for (let frame = 0; frame < 4; frame++) {
      sprites[`roll_${dir}_${frame}`] = makeRoll(dir, frame);
      sprites[`push_${dir}_${frame}`] = makePush(dir, frame);
    }
  }
  return sprites;
}

function createSkaterAtlas() {
  const makeSheet = (src, cols, rows) => {
    const img = new Image();
    const sheet = {
      img,
      src,
      cols,
      rows,
      footAnchors: null,
      ready: false,
      error: false,
    };
    img.onload = () => {
      sheet.footAnchors = src.includes('skater-bail')
        ? null
        : analyzeSkaterAtlasFootAnchors(img, cols, rows);
      sheet.ready = true;
    };
    img.onerror = () => {
      sheet.error = true;
      console.error(`Failed to load skater atlas: ${src}`);
    };
    img.src = src;
    return sheet;
  };

  return {
    cellW: 48,
    cellH: 48,
    anchorX: 24,
    anchorY: 43,
    roll: makeSheet('src/assets/skater-roll-atlas.png', SKATER_ROLL_FRAMES, 16),
    jump: makeSheet('src/assets/skater-jump-atlas.png', SKATER_JUMP_FRAMES, 16),
    duck: makeSheet('src/assets/skater-duck-atlas.png', SKATER_DUCK_FRAMES, 16),
    trick: makeSheet('src/assets/skater-trick-atlas.png', SKATER_TRICK_FRAMES, 16),
    bail: makeSheet('src/assets/skater-bail-atlas.png', 3, 1),
  };
}

function analyzeSkaterAtlasFootAnchors(img, cols, rows) {
  const cellW = 48;
  const cellH = 48;
  const c = document.createElement('canvas');
  c.width = img.naturalWidth || img.width;
  c.height = img.naturalHeight || img.height;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingEnabled = false;
  g.drawImage(img, 0, 0);
  const anchors = [];
  for (let row = 0; row < rows; row++) {
    const rowAnchors = [];
    for (let col = 0; col < cols; col++) {
      let minX = cellW;
      let maxX = 0;
      let minY = cellH;
      let maxY = 0;
      let count = 0;
      const points = [];
      const data = g.getImageData(col * cellW, row * cellH, cellW, cellH).data;
      for (let y = 24; y < cellH; y++) {
        for (let x = 0; x < cellW; x++) {
          const index = (y * cellW + x) * 4;
          const r = data[index];
          const gg = data[index + 1];
          const b = data[index + 2];
          const a = data[index + 3];
          const shoe = a > 0 && r > 120 && gg < 95 && b < 95;
          if (!shoe) continue;
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
          count++;
          points.push({ x, y });
        }
      }
      if (count > 3) {
        const keptPoints = dominantShoePoints(points);
        const bounds = boundsForPoints(keptPoints);
        const anchor = {
          x: (bounds.minX + bounds.maxX) / 2,
          y: bounds.maxY,
          minX: bounds.minX,
          maxX: bounds.maxX,
          minY: bounds.minY,
          maxY: bounds.maxY,
          count: keptPoints.length,
          points: keptPoints,
        };
        rowAnchors.push(anchor);
      } else {
        rowAnchors.push({ x: SKATER_ATLAS.anchorX, y: SKATER_ATLAS.anchorY, minX: 19, maxX: 29, minY: 38, maxY: 43, count: 0, points: [] });
      }
    }
    anchors.push(rowAnchors);
  }
  return anchors;
}

function dominantShoePoints(points) {
  const pointSet = new Set(points.map((pt) => `${pt.x},${pt.y}`));
  const seen = new Set();
  const components = [];
  for (const point of points) {
    const key = `${point.x},${point.y}`;
    if (seen.has(key)) continue;
    const queue = [point];
    const component = [];
    seen.add(key);
    while (queue.length) {
      const current = queue.pop();
      component.push(current);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const next = { x: current.x + dx, y: current.y + dy };
          const nextKey = `${next.x},${next.y}`;
          if (!pointSet.has(nextKey) || seen.has(nextKey)) continue;
          seen.add(nextKey);
          queue.push(next);
        }
      }
    }
    components.push(component);
  }
  components.sort((a, b) => b.length - a.length);
  const kept = components.slice(0, 2).flat();
  return kept.length >= 4 ? kept : points;
}

function boundsForPoints(points) {
  let minX = SKATER_ATLAS.cellW;
  let maxX = 0;
  let minY = SKATER_ATLAS.cellH;
  let maxY = 0;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }
  return { minX, maxX, minY, maxY };
}

function skaterAtlasReady() {
  return SKATER_ATLAS.roll.ready
    && SKATER_ATLAS.jump.ready
    && SKATER_ATLAS.duck.ready
    && SKATER_ATLAS.trick.ready
    && SKATER_ATLAS.bail.ready;
}

function offsetCommands(commands, dx, dy) {
  const shifted = commands.map(([x, y, w, h, color]) => [x + dx, y + dy, w, h, color]);
  if (commands.feet) shifted.feet = { x: commands.feet.x + dx, y: commands.feet.y + dy };
  if (commands.dir !== undefined) shifted.dir = commands.dir;
  if (commands.type) shifted.type = commands.type;
  return shifted;
}

function postMessage(text, seconds = 2) {
  state.message = text;
  state.messageTimer = seconds;
  audio.msg();
}

function startRun() {
  state.mode = 'city';
  state.screen = 'playing';
  state.score = 0;
  state.cash = 0;
  state.tickets = STARTING_TICKETS;
  state.nextTicketScore = TICKET_STEP;
  state.classLevel = 1;
  state.cityTimer = CITY_TIME;
  state.eventTimer = 0;
  state.event = null;
  state.eventRun = null;
  state.animTime = 0;
  state.bees = [];
  state.player = makePlayer();
  setCameraPosition(state.player.x, state.player.y);
  shops.forEach((s) => { s.bought = false; });
  postMessage('NEXT PARK TICKET AT 3000 POINTS', 3);
  audio.start();
}

function awardScore(points, label) {
  state.score += points;
  if (label) postMessage(`${label} +${points}`, 1.1);
  while (state.score >= state.nextTicketScore) {
    state.tickets += 1;
    state.nextTicketScore += TICKET_STEP + state.classLevel * 900;
    postMessage(`PARK TICKET! NEXT AT ${state.nextTicketScore}`, 2.5);
    audio.ticket();
  }
}

function enterEvent(eventDef) {
  if (state.tickets <= 0) {
    if (state.gateCooldown > 0) return;
    state.gateCooldown = 1.25;
    postMessage('NEED PARK TICKET', 1.5);
    bumpBack();
    return;
  }
  state.tickets -= 1;
  state.mode = 'event';
  state.event = eventDef;
  state.eventRun = makeEventRun(eventDef.id);
  state.eventTimer = eventDef.seconds;
  state.cityTimer = CITY_TIME + state.classLevel * 4;
  state.player.x = state.eventRun?.ramp ? state.eventRun.ramp.along : CENTER.x;
  state.player.y = state.eventRun?.ramp ? state.eventRun.ramp.cross : state.eventRun ? EVENT_COURSES[eventDef.id].startY : CENTER.y + 4;
  state.player.vx = 0;
  state.player.vy = state.eventRun?.ramp ? 0 : state.eventRun ? 0.12 : -0.18;
  state.player.facing = state.eventRun ? Math.PI / 2 : -Math.PI / 2;
  state.player.z = 0;
  state.player.vz = 0;
  setCameraPosition(state.player.x, state.player.y);
  postMessage(`${eventDef.id} PARK`, 2);
  audio.event();
}

function finishEvent() {
  const e = state.event;
  awardScore(e.score, `${e.id} MEDAL`);
  state.cash += e.cash;
  state.classLevel += 1;
  state.mode = 'city';
  state.event = null;
  state.eventRun = null;
  state.cityTimer = CITY_TIME + state.classLevel * 2;
  state.player.x = CENTER.x;
  state.player.y = CENTER.y;
  state.player.vx = 0;
  state.player.vy = 0;
  state.player.z = 0;
  state.player.vz = 0;
  state.player.spin = 0;
  state.player.spinScore = 0;
  postMessage(`CASH $${e.cash} - CLASS ${state.classLevel}`, 2.5);
}

function gameOver(reason) {
  state.screen = 'gameOver';
  state.mode = 'over';
  state.message = reason;
  state.highScores.push({ name: 'YOU', score: state.score });
  state.highScores.sort((a, b) => b.score - a.score);
  state.highScores = state.highScores.slice(0, 10);
  saveHighScores();
}

function bumpBack() {
  state.player.vx *= -0.9;
  state.player.vy *= -0.9;
  state.shake = 0.18;
}

function updatePlayer(dt) {
  const p = state.player;
  if (p.bail > 0) {
    p.bail -= dt;
    p.vx *= 0.92;
    p.vy *= 0.92;
    p.x += p.vx;
    p.y += p.vy;
    return;
  }

  const eventCourse = getEventCourse();
  if (state.mode === 'event' && state.event?.id === 'RAMP' && eventCourse) {
    updateRampPlayer(dt, eventCourse);
    return;
  }
  if (state.mode === 'event' && eventCourse && (state.event?.id === 'DOWNHILL' || state.event?.id === 'JUMP')) {
    updateEventCoursePlayer(dt);
    return;
  }

  const boardBoost = shops[0].bought ? BOARD_SPEED_MULT : 1;
  const shoeBoost = shops[1].bought ? 1.25 : 1;
  const maxSpeed = BASE_MAX_SPEED * boardBoost;
  const left = state.keys.has('arrowleft') || state.keys.has('a');
  const right = state.keys.has('arrowright') || state.keys.has('d');
  const turn = (left ? -1 : 0) + (right ? 1 : 0);
  const airborne = p.z > 0.01;
  if (turn !== 0) {
    p.facing = normalizeAngle(p.facing + turn * TURN_RATE * dt * (airborne ? AIR_TURN_MULT : 1));
  }
  if (p.pushTimer > 0) p.pushTimer = Math.max(0, p.pushTimer - dt);

  const frameScale = dt * 60;
  if (!airborne) {
    const friction = Math.pow(GROUND_FRICTION, frameScale);
    p.vx *= friction;
    p.vy *= friction;
  }

  let speed = Math.hypot(p.vx, p.vy);
  if (speed > 0.002 && !airborne) {
    const desiredVx = Math.cos(p.facing) * speed;
    const desiredVy = Math.sin(p.facing) * speed;
    const align = 1 - Math.pow(0.90, frameScale);
    p.vx += (desiredVx - p.vx) * align;
    p.vy += (desiredVy - p.vy) * align;
  } else if (speed <= 0.002) {
    p.vx = 0;
    p.vy = 0;
  }
  speed = Math.hypot(p.vx, p.vy);
  if (speed > maxSpeed) {
    p.vx = (p.vx / speed) * maxSpeed;
    p.vy = (p.vy / speed) * maxSpeed;
    speed = maxSpeed;
  }
  if (speed > 0.01) p.anim += Math.max(0.05, speed * 10);

  const bounds = activeWorldBounds();
  p.x = clamp(p.x + p.vx, bounds.minX, bounds.maxX);
  p.y = clamp(p.y + p.vy, bounds.minY, bounds.maxY);

  p.vz -= 18 * dt;
  p.z = Math.max(0, p.z + p.vz * dt);
  if (p.z <= 0) {
    if (p.spinScore >= Math.PI * 3.7) awardScore(720, '720');
    else if (p.spinScore >= Math.PI * 1.7) awardScore(360, '360');
    p.z = 0;
    p.vz = 0;
    p.spin = 0;
    p.spinScore = 0;
  } else {
    const turn = (state.keys.has('arrowleft') || state.keys.has('a') ? -1 : 0) + (state.keys.has('arrowright') || state.keys.has('d') ? 1 : 0);
    p.spin += turn * dt * VISUAL_SPIN_RATE;
    p.spinScore += Math.abs(turn) * dt * TRICK_SCORE_SPIN_RATE;
  }

  if (p.invuln > 0) p.invuln -= dt;

  if (state.mode === 'city') {
    for (const ramp of ramps) {
      if (p.z <= 0 && speed > 0.09 && dist(p.x, p.y, ramp.x, ramp.y) < 0.85) {
        p.vz = 7.4 * shoeBoost;
        awardScore(140, 'AIR');
      }
    }

    for (const rail of rails) {
      const d = distanceToSegment(p.x, p.y, rail.x1, rail.y1, rail.x2, rail.y2);
      if (p.z < 0.2 && speed > 0.08 && d < 0.28) {
        p.grind += dt;
        if (p.grind > 0.7) {
          awardScore(260, 'GRIND');
          p.grind = 0;
        }
      }
    }
  }
}

function inputTurn() {
  const left = state.keys.has('arrowleft') || state.keys.has('a');
  const right = state.keys.has('arrowright') || state.keys.has('d');
  return (left ? -1 : 0) + (right ? 1 : 0);
}

function updateEventCoursePlayer(dt) {
  const p = state.player;
  const run = state.eventRun;
  const turn = inputTurn();
  const airborne = p.z > 0.01;
  if (p.pushTimer > 0) p.pushTimer = Math.max(0, p.pushTimer - dt);
  if (turn !== 0 && airborne) {
    p.spin += turn * dt * VISUAL_SPIN_RATE;
    p.spinScore += Math.abs(turn) * dt * TRICK_SCORE_SPIN_RATE;
  }
  p.vz -= 18 * dt;
  p.z = Math.max(0, p.z + p.vz * dt);
  if (p.z <= 0) {
    if (p.spinScore >= Math.PI * 3.7) awardScore(720, '720');
    else if (p.spinScore >= Math.PI * 1.7) awardScore(360, '360');
    p.z = 0;
    p.vz = 0;
    p.spin = 0;
    p.spinScore = 0;
  }
  if (p.invuln > 0) p.invuln -= dt;
  const courseSpeed = run?.courseSpeed || 0;
  const ducking = state.event?.id === 'DOWNHILL' && p.z <= 0.02 && courseSpeed > (getEventCourse()?.duckSpeed || 5.4);
  if (run) {
    run.ducking = ducking;
    run.pose = ducking ? 'duck' : p.z > 0.02 ? 'air' : 'roll';
  }
  p.anim += Math.max(0.08, courseSpeed * dt * 2.4);
}

function updateRampPlayer(dt, course) {
  const p = state.player;
  const run = state.eventRun || makeEventRun('RAMP');
  state.eventRun = run;
  const ramp = run.ramp;
  const hp = course.halfpipe;
  const turn = inputTurn();
  const airborne = ramp.airZ > 0.01;

  if (p.pushTimer > 0) p.pushTimer = Math.max(0, p.pushTimer - dt);
  if (ramp.pumpCooldown > 0) ramp.pumpCooldown = Math.max(0, ramp.pumpCooldown - dt);
  if (run.trickTimer > 0) run.trickTimer = Math.max(0, run.trickTimer - dt);

  if (run.trick === 'handplant') {
    ramp.crossVel += (hp.centerY - ramp.cross) * dt * 2.2;
    ramp.cross += ramp.crossVel * dt;
    ramp.along += ramp.alongVel * dt * 0.35;
    if (run.trickTimer <= 0) {
      run.trick = null;
      run.pose = 'roll';
      ramp.crossVel = Math.sign(hp.centerY - ramp.cross || 1) * 4.2;
    }
  } else if (run.trick === 'rock') {
    ramp.crossVel += (hp.centerY - ramp.cross) * dt * 3.4;
    ramp.cross += ramp.crossVel * dt;
    ramp.along += ramp.alongVel * dt * 0.45;
    if (run.trickTimer <= 0) {
      run.trick = null;
      run.pose = 'roll';
      ramp.crossVel = Math.sign(hp.centerY - ramp.cross || 1) * 5.0;
    }
  } else if (run.trick === 'grind') {
    ramp.alongVel += turn * dt * 5.2;
    ramp.alongVel *= Math.pow(0.988, dt * 60);
    ramp.alongVel = clamp(ramp.alongVel, -5.8, 5.8);
    ramp.along += ramp.alongVel * dt;
    ramp.cross = ramp.grindSide < 0 ? hp.copingTopY : hp.copingBottomY;
    ramp.crossVel = 0;
    ramp.grindAward += Math.abs(ramp.alongVel) * dt;
    if (ramp.grindAward > 2.2) {
      awardScore(320, 'COPING GRIND');
      ramp.grindAward = 0;
    }
    if (Math.abs(turn) === 0 && Math.abs(ramp.alongVel) < 0.75) {
      run.trick = null;
      run.pose = 'roll';
      ramp.crossVel = -ramp.grindSide * 3.4;
    }
  } else if (airborne) {
    ramp.airVz -= 16.5 * dt;
    ramp.airZ = Math.max(0, ramp.airZ + ramp.airVz * dt);
    ramp.cross += ramp.crossVel * dt * 0.82;
    ramp.along += ramp.alongVel * dt;
    p.spin += turn * dt * VISUAL_SPIN_RATE;
    p.spinScore += Math.abs(turn) * dt * TRICK_SCORE_SPIN_RATE;
    run.pose = Math.abs(p.spin) > 0.7 ? 'air-spin' : 'air';
    if (ramp.airZ <= 0) {
      const surface = rampSurfaceAt(ramp.cross, course);
      const offRamp = ramp.cross < hp.copingTopY - 1.2 || ramp.cross > hp.copingBottomY + 1.2;
      if (offRamp || Math.abs(p.spin) > 1.1 && Math.abs(normalizeAngle(p.spin)) > 0.65) {
        courseCrash('BAD LANDING', 180);
        ramp.cross = hp.centerY;
        ramp.crossVel = 2.6;
      } else {
        awardScore(p.spinScore >= Math.PI * 1.7 ? 360 : 180, 'CLEAN AIR');
        ramp.crossVel *= 0.9;
        ramp.cross = clamp(ramp.cross, hp.copingTopY + 0.25, hp.copingBottomY - 0.25);
        run.landingStatus = 'clean';
      }
      ramp.airZ = 0;
      ramp.airVz = 0;
      p.spin = 0;
      p.spinScore = 0;
      run.pose = 'roll';
      ramp.surface = surface.height;
    }
  } else {
    const surface = rampSurfaceAt(ramp.cross, course);
    const gravity = -Math.sign(surface.offset || 0) * surface.height * 9.6;
    ramp.crossVel += gravity * dt;
    ramp.crossVel *= Math.pow(surface.height > 0 ? 0.994 : 0.986, dt * 60);
    ramp.alongVel += turn * dt * (surface.height > 0.65 ? 4.6 : 3.0);
    ramp.alongVel *= Math.pow(0.982, dt * 60);
    ramp.crossVel = clamp(ramp.crossVel, -8.6, 8.6);
    ramp.alongVel = clamp(ramp.alongVel, -5.6, 5.6);
    ramp.cross += ramp.crossVel * dt;
    ramp.along += ramp.alongVel * dt;
    ramp.surface = surface.height;
    run.pose = 'roll';
    const lipSide = rampLipSide(ramp.cross, course);
    if (lipSide && Math.abs(ramp.alongVel) > 2.0 && Math.abs(ramp.crossVel) < 2.4) {
      run.trick = 'grind';
      run.pose = 'grind';
      run.trickTimer = 0;
      ramp.grindSide = lipSide;
      ramp.cross = lipSide < 0 ? hp.copingTopY : hp.copingBottomY;
      ramp.grindAward = 0;
      awardScore(180, 'GRIND');
    } else if (lipSide && Math.sign(ramp.crossVel) === lipSide && Math.abs(ramp.crossVel) > 6.2) {
      ramp.airZ = 0.08;
      ramp.airVz = 5.0 + Math.abs(ramp.crossVel) * 0.38;
      ramp.launchSide = lipSide;
      run.pose = 'air';
      p.spinScore = 0;
      awardScore(180, 'AIR');
    }
    if (ramp.cross < hp.copingTopY - 1.7 || ramp.cross > hp.copingBottomY + 1.7) {
      courseCrash('OVER THE DECK', 180);
      ramp.cross = hp.centerY;
      ramp.crossVel = -Math.sign(ramp.cross - hp.centerY || 1) * 2.8;
    }
  }

  ramp.along = clamp(ramp.along, hp.xMin + 0.8, hp.xMax - 0.8);
  if (ramp.along <= hp.xMin + 0.85 || ramp.along >= hp.xMax - 0.85) ramp.alongVel *= -0.35;
  p.x = ramp.along;
  p.y = ramp.cross;
  p.z = ramp.airZ;
  p.vx = ramp.alongVel * dt;
  p.vy = ramp.crossVel * dt;
  if (Math.abs(ramp.alongVel) + Math.abs(ramp.crossVel) > 0.05) p.facing = Math.atan2(ramp.crossVel, ramp.alongVel || 0.001);
  p.anim += Math.max(0.08, Math.hypot(ramp.alongVel, ramp.crossVel) * dt * 2.6);
  run.courseSpeed = Math.hypot(ramp.alongVel, ramp.crossVel);
  run.progress = clamp((state.event.seconds - state.eventTimer) / state.event.seconds, 0, 1);
  if (p.invuln > 0) p.invuln -= dt;
}

function rampSurfaceAt(cross, course) {
  const hp = course.halfpipe;
  const offset = cross - hp.centerY;
  const absOffset = Math.abs(offset);
  const height = clamp((absOffset - hp.flatHalf) / (hp.lipHalf - hp.flatHalf), 0, 1);
  return { offset, height };
}

function rampLipSide(cross, course) {
  const hp = course.halfpipe;
  if (cross <= hp.copingTopY + 0.55) return -1;
  if (cross >= hp.copingBottomY - 0.55) return 1;
  return 0;
}

function rampPump() {
  const course = getEventCourse();
  const run = state.eventRun;
  const ramp = run?.ramp;
  if (!course || !ramp || ramp.pumpCooldown > 0 || state.player.bail > 0) return;
  const surface = rampSurfaceAt(ramp.cross, course);
  const direction = Math.sign(ramp.crossVel) || Math.sign(ramp.cross - course.halfpipe.centerY) || 1;
  const gain = surface.height > 0.22 ? 1.05 + surface.height * 0.72 : 0.34;
  ramp.crossVel = clamp(ramp.crossVel + direction * gain, -8.8, 8.8);
  ramp.pumpCooldown = 0.14;
  state.player.pushTimer = 0.18;
  state.player.anim += 0.7;
}

function rampContextAction(course) {
  const p = state.player;
  const run = state.eventRun;
  const ramp = run?.ramp;
  if (!ramp || run.trick) return;
  const lipSide = rampLipSide(ramp.cross, course);
  if (!lipSide) {
    p.z = 0.02;
    p.vz = 5.8;
    ramp.airZ = p.z;
    ramp.airVz = p.vz;
    p.spinScore = 0;
    run.pose = 'air';
    audio.msg();
    return;
  }
  const speed = Math.hypot(ramp.crossVel, ramp.alongVel);
  if (speed > 5.2 && Math.sign(ramp.crossVel) === lipSide) {
    ramp.airZ = 0.08;
    ramp.airVz = 5.6 + Math.abs(ramp.crossVel) * 0.45;
    ramp.crossVel *= 0.56;
    p.z = ramp.airZ;
    p.vz = ramp.airVz;
    p.spinScore = 0;
    run.pose = 'air';
    run.trick = null;
    awardScore(220, 'VERT AIR');
  } else if (Math.sign(ramp.crossVel) === -lipSide && speed > 2.3) {
    run.trick = 'rock';
    run.pose = 'rock';
    run.trickTimer = 0.58;
    ramp.cross = lipSide < 0 ? course.halfpipe.copingTopY : course.halfpipe.copingBottomY;
    ramp.crossVel = -lipSide * 1.2;
    awardScore(300, 'ROCK ROLL');
  } else {
    run.trick = 'handplant';
    run.pose = 'handplant';
    run.trickTimer = 0.72;
    ramp.cross = lipSide < 0 ? course.halfpipe.copingTopY : course.halfpipe.copingBottomY;
    ramp.crossVel = 0;
    awardScore(360, 'HANDPLANT');
  }
  audio.msg();
}

function distanceToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = dx * dx + dy * dy;
  const t = len === 0 ? 0 : clamp(((px - x1) * dx + (py - y1) * dy) / len, 0, 1);
  return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
}

function updateCity(dt) {
  state.cityTimer -= dt;
  if (state.cityTimer < 10 && state.cityTimer > 0 && state.messageTimer <= 0) {
    postMessage('SKATE OR DIE', 1.2);
  }
  if (state.cityTimer <= 0) updateBees(dt);

  for (const h of hazards) {
    h.x += h.vx * dt;
    h.y += h.vy * dt;
    if (h.x < 1 || h.x > WORLD_W - 1) h.vx *= -1;
    if (h.y < 1 || h.y > WORLD_H - 1) h.vy *= -1;
    if (state.player.invuln <= 0 && state.player.z < 0.35 && dist(state.player.x, state.player.y, h.x, h.y) < 0.75) {
      bail('WIPEOUT');
    }
  }

  for (const pond of water) {
    if (state.player.z < 0.15 && dist(state.player.x, state.player.y, pond.x, pond.y) < pond.r) bail('SPLASH');
  }

  for (const e of events) {
    if (dist(state.player.x, state.player.y, e.x, e.y) < 1.15) enterEvent(e);
  }

  for (const s of shops) {
    if (!s.bought && dist(state.player.x, state.player.y, s.x, s.y + 0.88) < 1) {
      if (state.cash >= s.price) {
        state.cash -= s.price;
        s.bought = true;
        postMessage(`${s.id} UPGRADE: ${s.desc}`, 2);
      } else {
        postMessage(`${s.id} SHOP $${s.price}`, 1.4);
      }
    }
  }

  for (const m of mapIcons) {
    if (dist(state.player.x, state.player.y, m.x, m.y) < 0.8) state.mapTimer = 3.5;
  }
}

function updateBees(dt) {
  if (state.bees.length === 0) {
    for (let i = 0; i < 10; i++) {
      state.bees.push({ x: state.player.x + 6 + Math.random() * 3, y: state.player.y - 6 + Math.random() * 3 });
    }
    postMessage('SKATE OR DIE', 2);
  }
  for (const bee of state.bees) {
    const a = Math.atan2(state.player.y - bee.y, state.player.x - bee.x);
    bee.x += Math.cos(a) * dt * 5.8;
    bee.y += Math.sin(a) * dt * 5.8;
    if (dist(state.player.x, state.player.y, bee.x, bee.y) < 0.45) gameOver('STUNG BY BEES');
  }
}

function updateEvent(dt) {
  state.eventTimer -= dt;
  const course = getEventCourse();
  if (course) {
    if (state.event?.id === 'RAMP') {
      if (state.eventTimer <= 0) finishEvent();
      return;
    }
    updateCourseRun(dt, course);
    if (state.player.y >= course.finishY || state.eventTimer <= 0) finishEvent();
    return;
  }

  const p = state.player;
  const targetY = 4 + (state.event.seconds - state.eventTimer) * 1.05;
  if (p.y < targetY) p.y += dt * 2.5;
  for (let i = 0; i < 6; i++) {
    const gateY = 7 + i * 3.4;
    if (Math.abs(p.y - gateY) < 0.2 && Math.abs(p.x - (CENTER.x + Math.sin(i) * 3)) < 2.2) {
      awardScore(55, 'GATE');
    }
  }
  if (state.eventTimer <= 0 || p.y > WORLD_H - 3) finishEvent();
}

function updateCourseRun(dt, course) {
  const p = state.player;
  const run = state.eventRun || makeEventRun(state.event.id);
  state.eventRun = run;
  const id = state.event?.id === 'DOWNHILL' ? 'DOWNHILL' : 'JUMP';
  const turn = inputTurn();
  const band = eventSlopeBand(course, p.y);
  const grade = band?.grade ?? 1;
  const pump = run.pendingPump || 0;
  run.pendingPump = 0;
  const drag = id === 'DOWNHILL' ? 0.16 : 0.20;
  const gradeAccel = id === 'DOWNHILL' ? 1.55 : 1.35;
  run.courseSpeed = clamp(
    (run.courseSpeed || course.autoSpeed) + (grade * gradeAccel - drag * (run.courseSpeed || course.autoSpeed)) * dt + pump,
    course.minSpeed || 2,
    course.maxSpeed || 7,
  );
  run.sectionIndex = Math.max(0, course.slopeBands?.indexOf(band) ?? 0);

  if (p.bail <= 0) {
    p.x += turn * dt * (2.0 + run.courseSpeed * 0.45);
    p.y = Math.min(course.length - 1.5, p.y + run.courseSpeed * dt);
  }
  p.vx = turn * dt * (2.0 + run.courseSpeed * 0.45);
  p.vy = run.courseSpeed * dt;
  p.facing = Math.atan2(run.courseSpeed, turn * (2.0 + run.courseSpeed * 0.45) || 0.001);

  const center = eventCourseCenter(id, p.y);
  const halfWidth = eventCourseHalfWidth(id, p.y);
  const left = center - halfWidth;
  const right = center + halfWidth;
  if (p.x < left || p.x > right) {
    p.x = clamp(p.x, left, right);
    p.vx *= -0.25;
    if (p.invuln <= 0 && p.z < 0.35) courseCrash('EDGE', 80);
  }

  course.checkpoints?.forEach((checkpoint, index) => {
    if (p.y >= checkpoint.y && !run.checkpoints.has(index)) {
      run.checkpoints.add(index);
      awardScore(checkpoint.points, 'CHECKPOINT');
    }
  });

  course.obstacles?.forEach((obstacle, index) => {
    if (run.obstacles.has(index)) return;
    const duckBonus = run.ducking ? 0.75 : 1;
    if (p.z < 0.35 && dist(p.x, p.y, obstacle.x, obstacle.y) < (obstacle.type === 'barrier' ? 1.1 : 0.75) * duckBonus) {
      run.obstacles.add(index);
      run.courseSpeed *= 0.52;
      courseCrash('WIPEOUT', 140);
    }
  });

  course.ramps?.forEach((ramp, index) => {
    if (run.ramps.has(index)) return;
    const onApproach = p.y >= ramp.y - ramp.approach && p.y < ramp.y - ramp.h * 0.5 && Math.abs(p.x - ramp.x) < ramp.w * 0.72;
    if (onApproach) run.sectionIndex = index;
    if (p.z <= 0.05 && p.y >= ramp.y - ramp.h * 0.55 && p.y <= ramp.y + ramp.h * 0.75 && Math.abs(p.x - ramp.x) < ramp.w * 0.55) {
      run.ramps.add(index);
      p.z = 0.04;
      p.vz = (shops[1].bought ? 5.2 : 4.5) + run.courseSpeed * 0.86;
      p.spinScore = 0;
      run.launchIndex = index;
      run.landingStatus = 'airborne';
      awardScore(ramp.points, 'LAUNCH');
    }
  });

  course.water?.forEach((pool, index) => {
    if (p.z < 0.35 && pointInCourseRect(p.x, p.y, pool) && p.invuln <= 0) {
      run.obstacles.add(`water_${index}`);
      p.x = eventCourseCenter(id, p.y);
      courseCrash('SPLASH', 180);
    }
  });

  if (run.wasAirborne && p.z <= 0.02) {
    let hitTarget = false;
    course.targets?.forEach((target, index) => {
      if (run.targets.has(index)) return;
      if (dist(p.x, p.y, target.x, target.y) <= target.r) {
        run.targets.add(index);
        hitTarget = true;
        run.landingStatus = 'target';
        awardScore(target.points, 'TARGET');
      }
    });
    if (id === 'JUMP' && !hitTarget) {
      const inWater = course.water?.some((pool) => pointInCourseRect(p.x, p.y, pool));
      const launch = Number.isFinite(run.launchIndex) ? course.ramps[run.launchIndex] : null;
      const shortLanding = launch && p.y < launch.landingY - 1.4;
      if (inWater || shortLanding) {
        run.landingStatus = inWater ? 'splash' : 'short';
        p.x = launch ? launch.x : eventCourseCenter(id, p.y);
        p.y = launch ? launch.landingY - 0.6 : p.y;
        courseCrash(inWater ? 'SPLASH' : 'SHORT LANDING', 180);
      } else {
        run.landingStatus = 'deck';
        awardScore(90, 'LANDING');
      }
    }
  }
  run.wasAirborne = p.z > 0.02;
  run.progress = clamp((p.y - course.startY) / (course.finishY - course.startY), 0, 1);
}

function eventSlopeBand(course, y) {
  return course.slopeBands?.find((band) => y >= band.y0 && y < band.y1) || course.slopeBands?.[course.slopeBands.length - 1] || null;
}

function pointInCourseRect(x, y, rect) {
  return x >= rect.x - rect.w * 0.5
    && x <= rect.x + rect.w * 0.5
    && y >= rect.y - rect.h * 0.5
    && y <= rect.y + rect.h * 0.5;
}

function courseCrash(label, penalty) {
  const p = state.player;
  p.invuln = 0.8;
  p.bail = shops[2].bought ? 0.25 : 0.45;
  p.z = 0;
  p.vz = 0;
  if (state.eventRun) {
    state.eventRun.pose = 'bail';
    state.eventRun.trick = null;
    state.eventRun.landingStatus = label.toLowerCase();
    if (state.eventRun.ramp) {
      state.eventRun.ramp.airZ = 0;
      state.eventRun.ramp.airVz = 0;
    }
  }
  state.score = Math.max(0, state.score - penalty);
  state.shake = 0.18;
  postMessage(label, 0.75);
  audio.hit();
}

function bail(label) {
  const p = state.player;
  p.bail = shops[2].bought ? 0.7 : 1.2;
  p.invuln = shops[3].bought ? 2.0 : 1.1;
  p.vx *= -0.45;
  p.vy *= -0.45;
  p.z = 0;
  p.vz = 0;
  state.score = Math.max(0, state.score - 250);
  state.shake = 0.3;
  postMessage(label, 1);
  audio.hit();
}

function update(dt) {
  if (state.screen !== 'playing') return;
  state.animTime += dt;
  updatePlayer(dt);
  if (state.mode === 'city') updateCity(dt);
  if (state.mode === 'event') updateEvent(dt);
  updateCamera();
  if (state.messageTimer > 0) state.messageTimer -= dt;
  if (state.gateCooldown > 0) state.gateCooldown -= dt;
  if (state.mapTimer > 0) state.mapTimer -= dt;
  if (state.shake > 0) state.shake -= dt;
  updateHud();
}

function updateCamera() {
  const projection = activeProjection();
  const follow = projection.follow;
  const dead = projection.deadZone;
  const maxStep = projection.maxCameraStep || 0.1;
  const ease = projection.cameraEase || 0.22;
  const dx = state.player.x - state.camera.x;
  const dy = state.player.y - state.camera.y;
  const desiredX = Math.abs(dx) > dead ? clamp((dx - Math.sign(dx) * dead) * follow, -maxStep, maxStep) : 0;
  const desiredY = Math.abs(dy) > dead ? clamp((dy - Math.sign(dy) * dead) * follow, -maxStep, maxStep) : 0;
  if (!Number.isFinite(state.camera.vx)) state.camera.vx = 0;
  if (!Number.isFinite(state.camera.vy)) state.camera.vy = 0;
  state.camera.vx += (desiredX - state.camera.vx) * ease;
  state.camera.vy += (desiredY - state.camera.vy) * ease;
  if (desiredX === 0) state.camera.vx *= 0.72;
  if (desiredY === 0) state.camera.vy *= 0.72;
  state.camera.x += state.camera.vx;
  state.camera.y += state.camera.vy;
  const bounds = activeWorldBounds();
  state.camera.x = clamp(state.camera.x, bounds.minX, bounds.maxX);
  state.camera.y = clamp(state.camera.y, bounds.minY, bounds.maxY);
  if (state.camera.x === bounds.minX || state.camera.x === bounds.maxX) state.camera.vx = 0;
  if (state.camera.y === bounds.minY || state.camera.y === bounds.maxY) state.camera.vy = 0;
}

function setCameraPosition(x, y) {
  state.camera.x = x;
  state.camera.y = y;
  state.camera.vx = 0;
  state.camera.vy = 0;
}

function updateHud() {
  hud.tickets.textContent = state.tickets;
  hud.score.textContent = state.score;
  hud.cash.textContent = `$${state.cash}`;
  hud.course.textContent = state.classLevel;
  hud.time.textContent = state.mode === 'event' ? Math.ceil(state.eventTimer) : Math.max(0, Math.ceil(state.cityTimer));
  hud.difficulty.textContent = state.mode === 'event' ? state.event.id : state.cityTimer <= 0 ? 'SKATE OR DIE' : 'City';
}

function drawDiamond(x, y, w, h, fill, stroke = '#1d2638') {
  ctx.beginPath();
  ctx.moveTo(x, y - h / 2);
  ctx.lineTo(x + w / 2, y);
  ctx.lineTo(x, y + h / 2);
  ctx.lineTo(x - w / 2, y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.stroke();
}

function isoPoint(x, y, z = 0) {
  const p = worldToScreen(x, y);
  return { x: p.x, y: p.y - z };
}

function drawIsoPoly(points, fill, stroke = null, lineWidth = 2) {
  ctx.beginPath();
  points.forEach((pt, i) => {
    const p = Array.isArray(pt) ? isoPoint(pt[0], pt[1], pt[2] || 0) : pt;
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

function drawIsoRect(x, y, w, h, fill, stroke = null, lineWidth = 2) {
  drawIsoPoly([
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ], fill, stroke, lineWidth);
}

function drawIsoTexturedRect(x, y, w, h, texture, tint, stroke = null, lineWidth = 2) {
  const pts = [
    isoPoint(x, y),
    isoPoint(x + w, y),
    isoPoint(x + w, y + h),
    isoPoint(x, y + h),
  ];
  const minX = Math.min(...pts.map((p) => p.x));
  const maxX = Math.max(...pts.map((p) => p.x));
  const minY = Math.min(...pts.map((p) => p.y));
  const maxY = Math.max(...pts.map((p) => p.y));
  ctx.save();
  ctx.beginPath();
  pts.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.closePath();
  ctx.clip();
  const pattern = ctx.createPattern(texture, 'repeat');
  ctx.fillStyle = pattern || '#c7c9ce';
  ctx.fillRect(minX, minY, maxX - minX, maxY - minY);
  if (tint) {
    ctx.fillStyle = tint;
    ctx.fillRect(minX, minY, maxX - minX, maxY - minY);
  }
  ctx.restore();
  if (stroke) {
    ctx.beginPath();
    pts.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

function drawIsoDither(x, y, w, h, color, count, z = 0, seed = 1) {
  ctx.save();
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const n = (i * 1664525 + seed * 1013904223 + Math.round(x * 73 + y * 137)) >>> 0;
    const px = x + ((n >>> 7) % 1000) / 1000 * w;
    const py = y + ((n >>> 19) % 1000) / 1000 * h;
    const p = isoPoint(px, py, z);
    const size = (n & 3) === 0 ? 2 : 1;
    ctx.fillRect(p.x, p.y, size, size);
  }
  ctx.restore();
}

function drawIsoHatch(x, y, w, h, color, step = 1.2, z = 0) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  for (let t = -h; t < w; t += step) {
    const x1 = x + clamp(t, 0, w);
    const y1 = y + clamp(-t, 0, h);
    const x2 = x + clamp(t + h, 0, w);
    const y2 = y + clamp(h - t, 0, h);
    drawIsoLineZ(x1, y1, z, x2, y2, z);
  }
  ctx.restore();
}

function drawIsoWall(x, y, w, h, height, top, sideA, sideB) {
  drawIsoRect(x, y, w, h, top, '#6e6c77', 2);
  drawIsoPoly([[x, y + h], [x + w, y + h], [x + w, y + h, height], [x, y + h, height]], sideA, '#5c3f42', 2);
  drawIsoPoly([[x + w, y], [x + w, y + h], [x + w, y + h, height], [x + w, y, height]], sideB, '#5c3f42', 2);
}

function tileType(x, y) {
  const inRoadH = Math.abs(y - 18) < 2.2 || Math.abs(y - 10) < 1.25 || Math.abs(y - 26) < 1.25;
  const inRoadV = Math.abs(x - 18) < 2.2 || Math.abs(x - 10) < 1.25 || Math.abs(x - 26) < 1.25;
  if (inRoadH || inRoadV) return 'road';
  if (x < 5 || y < 5 || x > WORLD_W - 5 || y > WORLD_H - 5) return 'edge';
  if ((Math.floor(x / 4) + Math.floor(y / 4)) % 2 === 0) return 'plaza';
  return 'concrete';
}

function drawWorld() {
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (state.mode === 'event') {
    ctx.save();
    ctx.beginPath();
    ctx.rect(VIEW.x, VIEW.y, VIEW.w, VIEW.h);
    ctx.clip();
    drawEventArena();
    drawPlayer();
    ctx.restore();
    drawOverlayText();
    drawArcadeHud();
    return;
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(VIEW.x, VIEW.y, VIEW.w, VIEW.h);
  ctx.clip();

  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, '#243a68');
  grad.addColorStop(1, '#111728');
  ctx.fillStyle = grad;
  ctx.fillRect(VIEW.x, VIEW.y, VIEW.w, VIEW.h);

  drawCityFloor();
  drawReferenceCityDetails();
  drawWater();
  drawRailsAndRamps();
  if (state.mapTimer > 0 || state.keys.has('m')) drawCityMap();
  else {
    drawCityEntities();
  }
  ctx.restore();
  if (state.mapTimer > 0 || state.keys.has('m')) {
    drawMapScreenHud();
  } else {
    drawOverlayText();
    drawArcadeHud();
  }
}

function drawCityEntities() {
  const items = [];
  let order = 0;
  const add = (entity) => {
    items.push({
      feetY: entity.feetY,
      z: entity.z || 0,
      layer: entity.layer || 0,
      order: order++,
      draw: entity.draw,
    });
  };
  for (const s of shops) {
    add({ feetY: s.y + 0.55, layer: 2, draw: () => drawShopBuilding(s) });
  }
  for (const e of events) {
    add({ feetY: e.y + 0.15, layer: 1, draw: () => drawCourseGate(e) });
  }
  for (const m of mapIcons) {
    add({ feetY: m.y, layer: 0, draw: () => drawMapIcon(m) });
  }
  for (const h of hazards) {
    add({ feetY: h.y + 0.05, layer: 1, draw: () => drawStreetSprite(h.type, h.x, h.y, h.color) });
  }
  for (let i = 0; i < state.bees.length; i++) {
    const bee = state.bees[i];
    add({ feetY: bee.y + 0.05, z: 1, layer: 3, draw: () => drawBee(bee, i) });
  }
  add({ feetY: state.player.y + 0.12, z: state.player.z, layer: 2, draw: () => drawPlayer() });
  items.sort((a, b) => a.layer - b.layer || a.feetY - b.feetY || a.z - b.z || a.order - b.order);
  for (const item of items) item.draw();
}

function drawSpeckles(px, py, x, y, type) {
  if (type === 'edge') return;
  ctx.fillStyle = type === 'road' ? '#9aa0a966' : '#7d7f8766';
  for (let i = 0; i < 5; i++) {
    const ox = ((x * 37 + y * 17 + i * 23) % 70) - 35;
    const oy = ((x * 19 + y * 43 + i * 11) % 30) - 15;
    ctx.fillRect(px + ox, py + oy, 2, 2);
  }
}

function drawCityFloor() {
  drawIsoTexturedRect(0, 0, WORLD_W, WORLD_H, TEXTURES.asphalt, '#181d2a66', '#252a35', 1);
  drawIsoDither(0, 0, WORLD_W, WORLD_H, '#aab0bc66', 780, 0, 41);
  drawIsoDither(0, 0, WORLD_W, WORLD_H, '#070b12aa', 520, 0, 42);

  drawSourceSidewalkIsland(-1.8, -0.9, 13.2, 8.0);
  drawSourceSidewalkIsland(22.3, -1.2, 15.8, 8.8);
  drawSourceSidewalkIsland(-1.6, 27.8, 12.8, 10.2);
  drawSourceSidewalkIsland(24.2, 24.5, 14.0, 12.4);
  drawSourceSidewalkIsland(10.6, 10.8, 14.7, 3.7);
  drawSourceSidewalkIsland(10.9, 21.9, 14.1, 3.4);
  drawSourceTealRetainer(1.5, 2.2, 8.8, 4.2);
  drawSourceTealRetainer(25.0, 3.0, 8.0, 4.4);
  drawSourceTealRetainer(2.0, 28.8, 8.6, 4.0);
  drawSourceTealRetainer(25.0, 27.1, 8.2, 4.2);

  drawIsoTexturedRect(0, 15.45, WORLD_W, 5.1, TEXTURES.asphalt, '#00000018', '#0f141d', 2);
  drawIsoTexturedRect(15.45, 0, 5.1, WORLD_H, TEXTURES.asphalt, '#00000022', '#0f141d', 2);
  drawIsoTexturedRect(0, 8.7, WORLD_W, 2.35, TEXTURES.asphalt, '#00000016', '#151923', 2);
  drawIsoTexturedRect(0, 25.1, WORLD_W, 2.35, TEXTURES.asphalt, '#00000016', '#151923', 2);
  drawIsoTexturedRect(8.7, 0, 2.35, WORLD_H, TEXTURES.asphalt, '#00000016', '#151923', 2);
  drawIsoTexturedRect(25.1, 0, 2.35, WORLD_H, TEXTURES.asphalt, '#00000016', '#151923', 2);
  drawRoadCurbs();
  drawRoadDashes();
  drawIsoHatch(0, 15.45, WORLD_W, 5.1, '#30374455', 1.35);
  drawIsoHatch(15.45, 0, 5.1, WORLD_H, '#30374444', 1.35);

  drawIsoRect(0, 0, 5.8, 9.8, '#07520cdd', '#032807', 2);
  drawIsoRect(30.1, 0, 5.9, 9.8, '#07520cdd', '#032807', 2);
  drawIsoRect(0, 27.2, 8.2, 8.8, '#07520cdd', '#032807', 2);
  drawIsoRect(27.2, 27.1, 8.8, 8.9, '#07520cdd', '#032807', 2);

  drawIsoTexturedRect(3.2, 3.4, 7.7, 5.4, TEXTURES.tan, '#d9313122', '#6f2230', 2);
  drawIsoTexturedRect(24.1, 3.8, 7.8, 5.2, TEXTURES.water, '#0ad6e744', '#056f80', 2);
  drawIsoTexturedRect(3.7, 26.0, 7.0, 5.6, TEXTURES.tan, '#e0275d22', '#6f2230', 2);
  drawIsoTexturedRect(24.5, 25.4, 7.3, 5.6, TEXTURES.ramp, '#d8a5372a', '#6f4f20', 2);

  drawIsoWall(4.8, 4.3, 5.7, 3.5, 82, '#db3d37', '#a42a2a', '#711c28');
  drawIsoWall(24.2, 4.9, 4.9, 3.3, 105, '#18bfcd', '#0b8795', '#0c6476');
  drawIsoWall(4.8, 26.5, 5.6, 3.7, 78, '#d34c78', '#9a3152', '#702640');
  drawIsoWall(25.1, 26.1, 4.6, 3.6, 90, '#e0b23f', '#b6812e', '#865e20');

  drawSidewalkCurb(11.7, 11.6, 5.7, 1.35);
  drawSidewalkCurb(18.5, 22.0, 5.8, 1.25);
  drawSidewalkCurb(11.7, 11.6, 1.25, 5.7);
  drawSidewalkCurb(22.6, 18.0, 1.25, 5.6);
  drawIsoWall(12.9, 5.6, 6.8, 2.5, 74, '#60657a', '#484e62', '#343a4c');
  drawIsoWall(21.7, 11.1, 5.6, 2.2, 62, '#5a6076', '#43485d', '#303548');
  drawIsoDither(12.9, 5.6, 6.8, 2.5, '#c3c9d355', 80, 0, 44);
  drawIsoDither(21.7, 11.1, 5.6, 2.2, '#c3c9d355', 60, 0, 45);
}

function drawSourceSidewalkIsland(x, y, w, h) {
  drawIsoTexturedRect(x, y, w, h, TEXTURES.concrete, '#d9dce5cc', '#858b96', 2);
  drawIsoRect(x + 0.22, y + 0.22, Math.max(0.4, w - 0.44), Math.max(0.4, h - 0.44), '#c4c9d3aa', '#a2a7b2', 1);
  drawIsoDither(x + 0.18, y + 0.18, Math.max(0.4, w - 0.36), Math.max(0.4, h - 0.36), '#6f778566', Math.round(w * h * 3.5), 0, 57);
  ctx.save();
  ctx.strokeStyle = '#eef2f8aa';
  ctx.lineWidth = 1;
  for (let i = 1; i < Math.max(2, Math.floor(w)); i += 2) drawIsoLine(x + i, y + 0.3, x + i, y + h - 0.3);
  for (let i = 1; i < Math.max(2, Math.floor(h)); i += 2) drawIsoLine(x + 0.3, y + i, x + w - 0.3, y + i);
  ctx.restore();
  drawIsoRect(x, y + h - 0.28, w, 0.28, '#8d939bcc', '#676d75', 1);
  drawIsoRect(x + w - 0.28, y, 0.28, h, '#9aa0aacc', '#676d75', 1);
}

function drawSourceTealRetainer(x, y, w, h) {
  drawIsoTexturedRect(x, y, w, h, TEXTURES.water, '#0fcfd444', '#086875', 2);
  drawIsoWall(x + 0.35, y + 0.35, w - 0.7, h - 0.7, 56, '#12d8d9', '#07909a', '#05616f');
  drawIsoDither(x + 0.35, y + 0.35, w - 0.7, h - 0.7, '#063f4888', Math.round(w * h * 4.5), 0, 63);
  ctx.save();
  ctx.strokeStyle = '#075b63';
  ctx.lineWidth = 2;
  for (let i = -2; i < w + h; i += 1.25) {
    drawIsoLine(x + clamp(i, 0, w), y + clamp(i - w, 0, h), x + clamp(i - h, 0, w), y + clamp(i, 0, h));
  }
  ctx.restore();
}

function drawConcreteSeams(x, y, w, h, step, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  for (let ix = x; ix <= x + w; ix += step) {
    const a = isoPoint(ix, y);
    const b = isoPoint(ix, y + h);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  for (let iy = y; iy <= y + h; iy += step) {
    const a = isoPoint(x, iy);
    const b = isoPoint(x + w, iy);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
}

function drawSpeckleField(x, y, w, h, color, count) {
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const wx = x + ((i * 7.37) % w);
    const wy = y + ((i * 11.91) % h);
    const p = worldToScreen(wx, wy);
    ctx.fillRect(p.x + ((i * 13) % 11) - 5, p.y + ((i * 17) % 9) - 4, 2, 2);
  }
}

function drawPixelNoiseRect(x, y, w, h, colors, density = 0.1) {
  const key = `${Math.round(w)}x${Math.round(h)}:${density}:${colors.join(',')}`;
  if (!TEXTURES.dynamic) TEXTURES.dynamic = new Map();
  if (!TEXTURES.dynamic.has(key)) {
    TEXTURES.dynamic.set(key, makeCanvas(Math.max(4, Math.round(w * LOW_SCALE_X)), Math.max(4, Math.round(h * LOW_SCALE_Y)), (g, width, height) => {
      g.fillStyle = colors[0];
      g.fillRect(0, 0, width, height);
      const dots = Math.floor(width * height * density * 0.32);
      for (let i = 0; i < dots; i++) {
        const n = (i * 1664525 + width * 97 + height * 193) >>> 0;
        g.fillStyle = colors[(n % Math.max(1, colors.length - 1)) + 1] || colors[0];
        g.fillRect((n >>> 8) % width, (n >>> 17) % height, 1, 1);
      }
    }));
  }
  ctx.drawImage(TEXTURES.dynamic.get(key), x, y, w, h);
}

function drawRoadDashes() {
  ctx.strokeStyle = '#f0dc74';
  ctx.lineWidth = 3;
  for (let x = 2; x < WORLD_W; x += 3.7) {
    drawIsoLine(x, 18, x + 0.8, 18);
    drawIsoLine(x, 10, x + 0.7, 10);
    drawIsoLine(x, 26.3, x + 0.7, 26.3);
  }
  for (let y = 2; y < WORLD_H; y += 3.7) {
    drawIsoLine(18, y, 18, y + 0.8);
    drawIsoLine(10, y, 10, y + 0.7);
    drawIsoLine(26.3, y, 26.3, y + 0.7);
  }
}

function drawRoadCurbs() {
  const curb = (x1, y1, x2, y2) => {
    const a = worldToScreen(x1, y1);
    const b = worldToScreen(x2, y2);
    ctx.strokeStyle = '#c6ccd4bb';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.strokeStyle = '#6f778180';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y + 1);
    ctx.lineTo(b.x, b.y + 1);
    ctx.stroke();
  };
  for (const [y1, y2] of [[15.6, 20.4], [8.8, 11], [25.2, 27.4]]) {
    curb(0, y1, WORLD_W, y1);
    curb(0, y2, WORLD_W, y2);
  }
  for (const [x1, x2] of [[15.6, 20.4], [8.8, 11], [25.2, 27.4]]) {
    curb(x1, 0, x1, WORLD_H);
    curb(x2, 0, x2, WORLD_H);
  }
}

function drawIsoLine(x1, y1, x2, y2) {
  const a = worldToScreen(x1, y1);
  const b = worldToScreen(x2, y2);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

function drawIsoLineZ(x1, y1, z1, x2, y2, z2) {
  const a = isoPoint(x1, y1, z1);
  const b = isoPoint(x2, y2, z2);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

function drawReferenceCityDetails() {
  drawSourceLogoPad(3.6, 4.2, 5.8, 2.6, ['DOWNHILL', 'PARK'], '#711724', '#ffd942');
  drawSourceLogoPad(26.1, 4.7, 4.9, 2.1, ['RAMP', 'PARK'], '#711724', '#ffd942');
  drawSourceLogoPad(4.4, 27.0, 5.1, 2.3, ['JUMP', 'PARK'], '#1934a8', '#f4f7ff');
  drawSourceLogoPad(25.6, 26.2, 5.4, 2.4, ['SLALOM', 'PARK'], '#711724', '#ffd942');
  drawSidewalkCurb(13.2, 13.2, 3.7, 1.1);
  drawSidewalkCurb(19.6, 21.7, 4.2, 1.1);
  drawSidewalkCurb(12.3, 19.4, 1.1, 4.2);
  drawSidewalkCurb(22.7, 12.2, 1.1, 4.5);
  drawIsoTexturedRect(5.6, 18.7, 3.1, 2.1, TEXTURES.water, '#0ad6e744', '#056f80', 2);
  drawIsoTexturedRect(27.0, 13.8, 3.3, 2.2, TEXTURES.water, '#0ad6e744', '#056f80', 2);
  drawGeneratedWaterPatch(7.15, 19.75, 3.1, 2.1, 'waterRect', 0.62);
  drawGeneratedWaterPatch(28.65, 14.9, 3.3, 2.2, 'waterRect', 0.62);
  drawCyanBowl(8.6, 27.4, 2.4, 1.55);
  drawCyanBowl(28.0, 8.4, 2.8, 1.75);
  drawArcadeSign(14.2, 20.3, ['SKATE', 'OR DIE!']);
  drawArcadeSign(25.7, 15.2, ['SKATE', 'OR DIE!']);
  drawPayHerePad(30.5, 7.9, 'PAY HERE');
  drawPayHerePad(6.2, 29.4, 'PAY HERE');
}

function drawSourceLogoPad(x, y, w, h, lines, fill, textColor) {
  drawIsoTexturedRect(x, y, w, h, TEXTURES.sign, '#ffffff10', '#172034', 2);
  drawIsoRect(x + 0.15, y + 0.15, w - 0.3, h - 0.3, fill + 'dd', '#f6d34a', 1);
  const p = worldToScreen(x + w * 0.5, y + h * 0.52);
  lines.forEach((line, index) => {
    drawBitmapTextShadow(line, p.x, p.y - 20 + index * 18, line.length > 7 ? 3 : 4, textColor, 'center');
  });
}

function drawCyanBowl(x, y, rw, rh) {
  const p = worldToScreen(x, y);
  const projection = activeProjection();
  const drawn = drawGeneratedWaterPatch(x, y, rw, rh, rw > 2.6 ? 'waterPool' : 'waterCurve', 0.88);
  if (!drawn) drawFacetedPool(p.x, p.y - 10, rw * projection.tileW * 0.36, rh * projection.tileH * 0.62);
}

function drawFacetedPool(cx, cy, rx, ry) {
  const outer = [
    [-rx, -ry * 0.12],
    [-rx * 0.72, -ry * 0.82],
    [-rx * 0.18, -ry],
    [rx * 0.68, -ry * 0.78],
    [rx, -ry * 0.1],
    [rx * 0.72, ry * 0.78],
    [rx * 0.05, ry],
    [-rx * 0.72, ry * 0.76],
  ];
  const mid = outer.map(([x, y]) => [x * 0.67, y * 0.62]);
  const inner = outer.map(([x, y]) => [x * 0.34, y * 0.32]);
  fillScreenPoly(cx, cy, outer, '#149ba8', '#047081', 3);
  fillScreenPoly(cx, cy, mid, '#3bd9d2', '#13aab0', 2);
  fillScreenPoly(cx, cy, inner, '#cfcdd0', '#8c9098', 2);
  ctx.strokeStyle = '#0c7b86';
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const a = outer[i];
    const b = mid[i];
    ctx.beginPath();
    ctx.moveTo(cx + a[0], cy + a[1]);
    ctx.lineTo(cx + b[0], cy + b[1]);
    ctx.stroke();
  }
}

function fillScreenPoly(cx, cy, points, fill, stroke, lineWidth) {
  ctx.beginPath();
  points.forEach(([x, y], i) => {
    if (i === 0) ctx.moveTo(cx + x, cy + y);
    else ctx.lineTo(cx + x, cy + y);
  });
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

function drawArcadeSign(x, y, lines) {
  const p = worldToScreen(x, y);
  const flash = Math.floor(state.animTime * 7 + x + y) % 2 === 0;
  ctx.save();
  ctx.translate(p.x, p.y - 58);
  ctx.rotate(-0.08);
  ctx.drawImage(TEXTURES.sign, -48, -20, 96, 40);
  ctx.strokeStyle = flash ? '#ffdf31' : '#dd4b3c';
  ctx.lineWidth = 3;
  ctx.strokeRect(-48, -20, 96, 40);
  ctx.fillStyle = flash ? '#ff3838' : '#f4d35b';
  for (let i = 0; i < 6; i++) {
    ctx.fillRect(-42 + i * 17, -17, 5, 4);
    ctx.fillRect(-42 + i * 17, 13, 5, 4);
  }
  lines.forEach((line, index) => drawBitmapTextShadow(line, 0, -10 + index * 18, 4, '#f4d35b', 'center'));
  ctx.restore();
}

function drawPayHerePad(x, y, label) {
  const p = worldToScreen(x, y);
  const flash = Math.floor(state.animTime * 6 + x) % 2 === 0;
  drawIsoRect(x - 1.5, y - 0.55, 3, 1.1, '#5dff2f', '#178918', 2);
  if (!drawGeneratedEnvAsset('payPadPlain', p.x - 58, p.y - 84, 116, 58)) {
    ctx.drawImage(ATLAS.payPad, p.x - 54, p.y - 72, 108, 34);
  }
  if (!flash) {
    ctx.fillStyle = '#00000022';
    ctx.fillRect(p.x - 54, p.y - 72, 108, 34);
  }
  drawBitmapTextShadow(label, p.x, p.y - 60, 4, '#1771c8', 'center');
}

function drawShopPad(x, y, label) {
  const p = worldToScreen(x, y);
  drawIsoRect(x - 1.65, y - 0.55, 3.3, 1.1, '#4aff24', '#187b18', 2);
  drawIsoRect(x - 1.25, y - 0.35, 2.5, 0.7, '#7dff42', '#2a9a22', 1);
  if (!drawGeneratedEnvAsset('payPadGrid', p.x - 50, p.y - 34, 100, 48)) {
    ctx.drawImage(ATLAS.payPad, p.x - 50, p.y - 20, 100, 32);
  }
  drawBitmapTextShadow(label, p.x, p.y - 7, label.length > 8 ? 3 : 4, '#174ecb', 'center');
}

function drawSidewalkCurb(x, y, w, h) {
  drawIsoRect(x, y, w, h, '#d5d7dc', '#8e949d', 2);
  drawIsoRect(x + 0.1, y + 0.1, Math.max(0.2, w - 0.2), Math.max(0.2, h - 0.2), '#bfc3ca', '#9da2aa', 1);
}

function drawEventArena() {
  const base = state.event?.id || 'RAMP';
  ctx.fillStyle = base === 'RAMP' ? '#04320b' : '#a8a6bc';
  ctx.fillRect(VIEW.x, VIEW.y, VIEW.w, VIEW.h);
  if (base === 'RAMP') {
    drawRampArena();
  } else if (base === 'DOWNHILL') {
    drawDownhillArena();
  } else if (base === 'SLALOM') {
    drawSlalomArena();
  } else {
    drawJumpArena();
  }

  ctx.fillStyle = '#231a1f';
  ctx.fillRect(VIEW.x + 342, 48, 286, 62);
  ctx.strokeStyle = '#5c5661';
  ctx.lineWidth = 4;
  ctx.strokeRect(VIEW.x + 342, 48, 286, 62);
  drawBitmapText('MEDAL METER', VIEW.x + 485, 58, 4, '#d2c0a2', 'center');
  ctx.fillStyle = '#45343a';
  ctx.fillRect(VIEW.x + 365, 82, 240, 16);
  ctx.fillStyle = '#c78d42';
  ctx.fillRect(VIEW.x + 365, 82, clamp((state.event?.seconds - state.eventTimer) / (state.event?.seconds || 1), 0, 1) * 240, 16);
}

function drawRampArena() {
  const hp = EVENT_COURSES.RAMP.halfpipe;
  drawIsoTexturedRect(0, 0, 36, 38, TEXTURES.wall, '#9ea0ba66', null, 0);
  drawIsoRect(0, 0, 36, 38, '#0a3b0e55', null, 0);
  drawRampBackWall(hp, hp.copingTopY - 0.45, 132, true);
  drawRampBackWall(hp, hp.copingBottomY + 0.62, 112, false);
  drawRampBrickLip(hp.xMin - 1.25, hp.copingTopY - 0.85, hp.xMax - hp.xMin + 2.5, 92, true);

  drawIsoTexturedRect(hp.xMin - 1.35, hp.copingTopY - 0.95, hp.xMax - hp.xMin + 2.7, hp.copingBottomY - hp.copingTopY + 1.9, TEXTURES.tan, '#b5622e22', '#7b3e2f', 2);
  drawIsoRect(hp.xMin - 1.1, hp.copingTopY - 0.7, hp.xMax - hp.xMin + 2.2, hp.copingBottomY - hp.copingTopY + 1.4, '#d4925c88', '#763525', 2);
  drawCurvedHalfpipeScreen(hp);
  drawHalfpipeDeckFace(hp.xMin - 0.95, hp.copingTopY - 0.75, hp.xMax - hp.xMin + 1.9, 1.55, '#f4cf70', '#8a372b');
  drawHalfpipeDeckFace(hp.xMin - 0.95, hp.copingBottomY - 0.95, hp.xMax - hp.xMin + 1.9, 1.75, '#d37a38', '#66222a');
  drawRampBrickLip(hp.xMin - 1.25, hp.copingBottomY + 0.65, hp.xMax - hp.xMin + 2.5, 76, false);

  drawRampLattice(hp.xMin - 0.95, hp.copingTopY - 0.45, hp.xMax + 0.95, hp.copingTopY - 0.45, 96);
  drawRampLattice(hp.xMin - 0.95, hp.copingBottomY + 0.45, hp.xMax + 0.95, hp.copingBottomY + 0.45, -96);
  drawWoodRail(hp.xMin - 0.5, hp.copingTopY - 0.45, hp.xMax + 0.5, hp.copingTopY - 0.45);
  drawWoodRail(hp.xMin - 0.5, hp.copingBottomY + 0.45, hp.xMax + 0.5, hp.copingBottomY + 0.45);
  drawVerticalRampEndWall(hp.xMin - 0.9, hp.copingTopY + 0.2, hp.copingBottomY - hp.copingTopY - 0.4, 78);
  drawVerticalRampEndWall(hp.xMax + 0.9, hp.copingTopY + 0.2, hp.copingBottomY - hp.copingTopY - 0.4, 78);
  drawRampArrow(7.5, hp.centerY, false);
  drawRampArrow(28.8, hp.centerY, true);
  drawBitmapTextShadow('RAMP', worldToScreen(18, hp.centerY).x, worldToScreen(18, hp.centerY).y - 88, 5, '#ffe15c', 'center');
}

function drawHalfpipeStrip(x, y, w, h, fill, stroke) {
  drawIsoTexturedRect(x, y, w, h, TEXTURES.ramp, '#ffd18c22', stroke, 1);
  drawIsoRect(x, y, w, h, fill + 'bb', stroke, 1);
}

function drawRampBackWall(hp, y, height, above) {
  const wallY = y + (above ? -2.0 : 0.4);
  const wallH = above ? 2.1 : 2.4;
  drawIsoWall(hp.xMin - 1.4, wallY, hp.xMax - hp.xMin + 2.8, wallH, height, '#bb3b32', '#8f272b', '#5c1724');
  drawBrickFace(hp.xMin - 1.4, wallY + wallH, hp.xMax - hp.xMin + 2.8, height);
  const p1 = worldToScreen(hp.xMin + 1.2, wallY + wallH * 0.5);
  const p2 = worldToScreen(hp.xMin + 6.0, wallY + wallH * 0.5);
  const baseY = Math.min(p1.y, p2.y) - height * 0.55;
  ctx.save();
  ctx.fillStyle = '#8b9099';
  ctx.strokeStyle = '#5e6470';
  ctx.lineWidth = 3;
  for (let i = 0; i < 3; i++) {
    const x = p1.x + i * 72;
    ctx.fillRect(x, baseY, 48, 58);
    ctx.strokeRect(x, baseY, 48, 58);
    ctx.strokeStyle = '#dde4ef';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 10, baseY + 43);
    ctx.lineTo(x + 25, baseY + 16);
    ctx.moveTo(x + 25, baseY + 43);
    ctx.lineTo(x + 41, baseY + 18);
    ctx.stroke();
    ctx.strokeStyle = '#5e6470';
    ctx.lineWidth = 3;
  }
  ctx.restore();
}

function drawCurvedHalfpipeScreen(hp) {
  const yStart = hp.copingTopY;
  const yEnd = hp.copingBottomY;
  const steps = 18;
  const colors = ['#f1ca70', '#e7b466', '#d89155', '#c77a42', '#d89155', '#e7b466', '#f1ca70'];
  ctx.save();
  for (let i = 0; i < steps; i++) {
    const t0 = i / steps;
    const t1 = (i + 1) / steps;
    const y0 = yStart + (yEnd - yStart) * t0;
    const y1 = yStart + (yEnd - yStart) * t1;
    const z0 = rampSurfaceDrawHeight(y0, hp);
    const z1 = rampSurfaceDrawHeight(y1, hp);
    const curve = Math.max(z0, z1) / 74;
    const shade = Math.min(colors.length - 1, Math.floor(t0 * colors.length));
    const fill = curve < 0.08 ? '#c9773f' : colors[shade];
    drawIsoPoly([
      [hp.xMin + 0.25, y0, z0],
      [hp.xMax - 0.25, y0, z0],
      [hp.xMax - 0.25, y1, z1],
      [hp.xMin + 0.25, y1, z1],
    ], fill, '#895031', i % 3 === 0 ? 2 : 1);
    drawHalfpipeBandDither(hp, y0, y1, z0, z1, curve > 0.18 ? '#fff0c766' : '#3d1e1644', 44, i + 7);
    if (i % 2 === 0) {
      ctx.strokeStyle = curve > 0.22 ? '#f8dda0aa' : '#70402a66';
      ctx.lineWidth = 1;
      drawIsoLineZ(hp.xMin + 0.7, y0, z0 + 1, hp.xMax - 0.7, y0, z0 + 1);
    }
  }
  ctx.strokeStyle = '#f8e0a2';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 7; i++) {
    const t = i / 7;
    const x1 = hp.xMin + 1.2 + (hp.xMax - hp.xMin - 2.4) * t;
    drawIsoLineZ(
      x1,
      hp.copingTopY + 0.7,
      rampSurfaceDrawHeight(hp.copingTopY + 0.7, hp) + 1,
      x1 + 0.38,
      hp.copingBottomY - 0.7,
      rampSurfaceDrawHeight(hp.copingBottomY - 0.7, hp) + 1,
    );
  }
  drawIsoRect(hp.xMin + 0.25, hp.centerY - hp.flatHalf * 0.46, hp.xMax - hp.xMin - 0.5, hp.flatHalf * 0.92, '#bd6d3ecc', '#653225', 2);
  drawHalfpipeContours(hp);
  ctx.restore();
}

function drawHalfpipeBandDither(hp, y0, y1, z0, z1, color, count, seed) {
  ctx.save();
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const n = (i * 1664525 + seed * 1013904223) >>> 0;
    const tx = ((n >>> 8) % 1000) / 1000;
    const ty = ((n >>> 20) % 1000) / 1000;
    const x = hp.xMin + 0.7 + (hp.xMax - hp.xMin - 1.4) * tx;
    const y = y0 + (y1 - y0) * ty;
    const z = z0 + (z1 - z0) * ty;
    const p = isoPoint(x, y, z + 1);
    ctx.fillRect(p.x, p.y, (n & 3) === 0 ? 2 : 1, 1);
  }
  ctx.restore();
}

function rampSurfaceDrawHeight(y, hp) {
  const surface = rampSurfaceAt(y, { halfpipe: hp });
  const eased = surface.height * surface.height * (3 - 2 * surface.height);
  return Math.round(eased * 74);
}

function drawVerticalRampEndWall(x, y, h, height) {
  drawIsoWall(x - 0.28, y, 0.56, h, height, '#d7a166', '#9f5a32', '#6e2d24');
  ctx.save();
  ctx.strokeStyle = '#efd09a77';
  ctx.lineWidth = 2;
  for (let yy = y + 1; yy < y + h; yy += 2.0) drawIsoLine(x - 0.22, yy, x + 0.22, yy);
  ctx.restore();
}

function drawRampBrickLip(x, y, w, height, above) {
  const a = worldToScreen(x, y);
  const b = worldToScreen(x + w, y);
  const dy = above ? -height : height;
  const skew = above ? -24 : 24;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(b.x + skew, b.y + dy);
  ctx.lineTo(a.x + skew, a.y + dy);
  ctx.closePath();
  ctx.fillStyle = '#a9332e';
  ctx.fill();
  ctx.strokeStyle = '#551721';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.clip();
  ctx.strokeStyle = '#dc8676';
  ctx.lineWidth = 1;
  const minY = Math.min(a.y, a.y + dy, b.y, b.y + dy) - 8;
  const maxY = Math.max(a.y, a.y + dy, b.y, b.y + dy) + 8;
  for (let yy = minY; yy <= maxY; yy += 9) {
    ctx.beginPath();
    ctx.moveTo(Math.min(a.x, b.x) - 80, yy);
    ctx.lineTo(Math.max(a.x, b.x) + 80, yy + (above ? -8 : 8));
    ctx.stroke();
  }
  for (let xx = Math.min(a.x, b.x) - 80; xx <= Math.max(a.x, b.x) + 80; xx += 18) {
    ctx.beginPath();
    ctx.moveTo(xx, minY);
    ctx.lineTo(xx + (above ? -16 : 16), maxY);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHalfpipeDeckFace(x, y, w, h, fill, stroke) {
  drawIsoRect(x, y, w, h, fill + 'cc', stroke, 2);
  const steps = 7;
  ctx.save();
  ctx.strokeStyle = '#6d2b27';
  ctx.lineWidth = 2;
  for (let i = 1; i < steps; i++) {
    const xx = x + (w / steps) * i;
    drawIsoLine(xx, y + 0.05, xx, y + h - 0.05);
  }
  ctx.restore();
}

function drawHalfpipeContours(hp) {
  const lines = [
    [hp.copingTopY + 1.1, '#7b3a2d', 3],
    [hp.copingTopY + 3.2, '#b86935', 2],
    [hp.copingTopY + 6.1, '#7e432e', 2],
    [hp.centerY - hp.flatHalf, '#663027', 3],
    [hp.centerY + hp.flatHalf, '#663027', 3],
    [hp.copingBottomY - 6.3, '#7e432e', 2],
    [hp.copingBottomY - 3.1, '#b86935', 2],
    [hp.copingBottomY - 1.0, '#7b3a2d', 3],
  ];
  ctx.save();
  lines.forEach(([y, color, width]) => {
    const z = rampSurfaceDrawHeight(y, hp) + 2;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    drawIsoLineZ(hp.xMin + 0.65, y, z, hp.xMax - 0.65, y, z);
  });
  ctx.strokeStyle = '#f6d96a';
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    const x = hp.xMin + 3.2 + i * 4.1;
    drawIsoLineZ(
      x,
      hp.copingTopY + 0.7,
      rampSurfaceDrawHeight(hp.copingTopY + 0.7, hp) + 1,
      x + 0.45,
      hp.copingBottomY - 0.8,
      rampSurfaceDrawHeight(hp.copingBottomY - 0.8, hp) + 1,
    );
  }
  ctx.restore();
}

function drawRampTransitionBand(x, y, w, lower) {
  const colorA = lower ? '#c87b3c' : '#d58b45';
  const colorB = lower ? '#f0b568' : '#e4a256';
  for (let i = 0; i < 5; i++) {
    drawIsoRect(x + i * (w / 5), y + i * 0.22, w / 5 + 0.05, 2.15, i % 2 ? colorA : colorB, '#875034', 1);
  }
}

function drawRampArrow(x, y, flip) {
  const p = worldToScreen(x, y);
  ctx.save();
  ctx.translate(p.x, p.y - 24);
  if (flip) ctx.scale(-1, 1);
  ctx.fillStyle = '#f7b600';
  ctx.beginPath();
  ctx.moveTo(-56, -10);
  ctx.lineTo(12, -10);
  ctx.lineTo(12, -27);
  ctx.lineTo(58, 0);
  ctx.lineTo(12, 27);
  ctx.lineTo(12, 10);
  ctx.lineTo(-56, 10);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawRampLattice(x1, y1, x2, y2, drop) {
  const a = worldToScreen(x1, y1);
  const b = worldToScreen(x2, y2);
  const topY = -24;
  ctx.strokeStyle = '#7f1425';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y + topY);
  ctx.lineTo(b.x, b.y + topY);
  ctx.stroke();
  ctx.strokeStyle = '#4a0d18';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y + topY + drop);
  ctx.lineTo(b.x, b.y + topY + drop);
  ctx.stroke();
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t + topY;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + drop);
    ctx.stroke();
    if (i < 12) {
      const t2 = (i + 1) / 12;
      const x2p = a.x + (b.x - a.x) * t2;
      const y2p = a.y + (b.y - a.y) * t2 + topY;
      ctx.beginPath();
      ctx.moveTo(x, y + drop);
      ctx.lineTo(x2p, y2p);
      ctx.stroke();
    }
  }
}

function drawBrickFace(x, y, w, height) {
  const a = worldToScreen(x, y);
  const b = worldToScreen(x + w, y);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(b.x, b.y - height);
  ctx.lineTo(a.x, a.y - height);
  ctx.closePath();
  ctx.clip();
  ctx.strokeStyle = '#d38b83';
  ctx.lineWidth = 1;
  for (let yy = a.y - height + 8; yy < a.y; yy += 9) {
    ctx.beginPath();
    ctx.moveTo(a.x - 40, yy);
    ctx.lineTo(b.x + 40, yy);
    ctx.stroke();
  }
  for (let xx = a.x - 20; xx < b.x + 40; xx += 18) {
    ctx.beginPath();
    ctx.moveTo(xx, a.y - height);
    ctx.lineTo(xx, a.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawWoodRail(x1, y1, x2, y2) {
  const a = worldToScreen(x1, y1);
  const b = worldToScreen(x2, y2);
  ctx.strokeStyle = '#8a3f30';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y - 22);
  ctx.lineTo(b.x, b.y - 22);
  ctx.stroke();
  ctx.strokeStyle = '#3a1b17';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    ctx.beginPath();
    ctx.moveTo(x, y - 22);
    ctx.lineTo(x, y + 48);
    ctx.stroke();
  }
}

function drawDownhillArena() {
  const course = EVENT_COURSES.DOWNHILL;
  drawIsoRect(-10, -6, 56, course.length + 14, '#a8a8c1', null, 0);
  drawMassiveCourseDeck('DOWNHILL', 1.5, course.length - 1.5, '#b76a35', '#7f3a28', 1.2);
  drawDeckSideFaces('DOWNHILL', 1.5, course.length - 1.5, 96);
  drawCourseRails('DOWNHILL', 1.5, course.length - 1.5, 7.0);
  drawCourseEdgeGutters('DOWNHILL', 3.5, course.length - 3.0, '#8f4c2f', '#e09a4c');
  drawWideLaneStripe('DOWNHILL', 7, course.length - 6);
  course.slopeBands.forEach((band, index) => {
    const y = (band.y0 + band.y1) * 0.5;
    const center = eventCourseCenter('DOWNHILL', y);
    const half = eventCourseHalfWidth('DOWNHILL', y);
    if (band.grade > 1.25) drawSlopeChevron(center, y, half * 0.95, index % 2 === 0);
    if (band.grade < 0.9) drawBankPatch('DOWNHILL', band.y0 + 1.4, band.y1 - 1.4, index % 2 === 0);
    drawDeckSeam('DOWNHILL', band.y0, '#7b3d2b');
  });

  course.checkpoints.forEach((checkpoint, index) => {
    const center = eventCourseCenter('DOWNHILL', checkpoint.y);
    const half = eventCourseHalfWidth('DOWNHILL', checkpoint.y);
    drawCheckpointStripes(center - half * 0.78, checkpoint.y - 0.5, half * 1.55, 1.05);
    drawTurnArrowMark(center + (index % 2 ? -1.8 : 1.8), checkpoint.y + 1.4, index % 2 === 0);
  });

  for (let y = 8; y < course.length - 6; y += 8.5) {
    drawTurnArrowMark(eventCourseCenter('DOWNHILL', y), y, Math.floor(y / 8) % 2 === 0);
  }
  course.obstacles.forEach(drawCourseObstacle);
  drawFinishPad('DOWNHILL', course.finishY);
}

function drawSlalomArena() {
  drawIsoRect(-8, -6, 52, 46, '#aaa9c0', null, 0);
  drawIsoTexturedRect(4.2, 0.8, 27.6, 35.2, TEXTURES.tan, '#b8683522', '#64281f', 2);
  drawIsoRect(5.0, 1.6, 26.0, 33.6, '#c8793dcc', '#7b3a2a', 2);
  drawIsoRect(10.2, 2.4, 5.8, 31.8, '#e7a14acc', '#9c552e', 1);
  drawIsoRect(16.4, 2.4, 3.3, 31.8, '#ffc24ecc', '#a76030', 1);
  drawIsoRect(20.3, 2.4, 5.8, 31.8, '#b65f35cc', '#743429', 1);
  drawDeckSideFacesFixed(4.2, 0.8, 27.6, 35.2, 72);
  for (let y = 5.2; y < 31; y += 4.8) drawEventDeckPatch(13.1, y, '#e4a047');
  for (let i = 0; i < 8; i++) {
    const x = CENTER.x + Math.sin(i * 1.3) * 4.2;
    const y = 5 + i * 3.2;
    drawSlalomGate(x, y, i % 2 === 0, i);
  }
  drawSlalomGate(CENTER.x - 3.8, 22.8, true, 8);
  drawSlalomGate(CENTER.x + 4.0, 26.2, false, 9);
  drawSlalomGate(CENTER.x - 2.7, 29.6, true, 10);
  drawTurnArrowMark(16.2, 24.2, true);
  drawEventRails(5.2, 2, 5.2, 34);
  drawEventRails(30.6, 2, 30.6, 34);
}

function drawJumpArena() {
  const course = EVENT_COURSES.JUMP;
  drawIsoRect(-10, -6, 56, course.length + 14, '#aaa9c0', null, 0);
  drawMassiveCourseDeck('JUMP', 1.5, course.length - 1.5, '#c7783b', '#8b4a2c', 1.4);
  drawDeckSideFaces('JUMP', 1.5, course.length - 1.5, 88);
  drawCourseRails('JUMP', 1.5, course.length - 1.5, 7.0);
  drawCourseEdgeGutters('JUMP', 3.5, course.length - 4.0, '#8c4a2e', '#e1a24c');
  drawJumpCourseLanes(course);

  course.water.forEach((pool) => {
    drawIsoWall(pool.x - pool.w * 0.5, pool.y - pool.h * 0.5, pool.w, pool.h, 36, '#1f93d4', '#156c91', '#124e73');
    drawIsoTexturedRect(pool.x - pool.w * 0.42, pool.y - pool.h * 0.42, pool.w * 0.84, pool.h * 0.84, TEXTURES.water, '#2faee866', '#1978a8', 1);
  });

  course.ramps.forEach((ramp, index) => {
    drawJumpApproach(ramp, index);
    drawJumpRampFace(ramp);
  });
  course.targets.forEach((target, index) => drawLandingTarget(target.x, target.y, index === course.targets.length - 1 ? 1.05 : 0.82));
  course.checkpoints.forEach((checkpoint, index) => {
    const center = eventCourseCenter('JUMP', checkpoint.y);
    drawIsoRect(center - 3.2, checkpoint.y - 0.45, 6.4, 0.9, index % 2 ? '#c7cbd3' : '#e6e9ef', '#6f7480', 1);
  });
  drawFinishPad('JUMP', course.finishY);
}

function drawCourseSlopeBands(id, course) {
  course.slopeBands?.forEach((band, index) => {
    const center = eventCourseCenter(id, (band.y0 + band.y1) * 0.5);
    const half = eventCourseHalfWidth(id, (band.y0 + band.y1) * 0.5);
    const fill = band.grade > 1.4
      ? (index % 2 ? '#a9552f' : '#c46b36')
      : band.grade < 0.75
        ? '#d99045'
        : '#bb6334';
    drawIsoTexturedRect(center - half - 1.2, band.y0, half * 2 + 2.4, band.y1 - band.y0, TEXTURES.tan, `${fill}55`, '#7c3f2d', 1);
    if (band.label) {
      const p = worldToScreen(center - half * 0.62, band.y0 + 1.6);
      drawBitmapTextShadow(band.label, p.x, p.y - 34, 3, '#ffd733', 'center');
    }
  });
}

function drawMassiveCourseDeck(id, yStart, yEnd, fill, stroke, extraWidth = 1.0) {
  const sections = id === 'JUMP'
    ? [[yStart, 20.2, '#d78c45'], [20.2, 36.2, '#c97839'], [36.2, 52.2, '#d98e45'], [52.2, yEnd, '#c77839']]
    : [[yStart, 24, '#bd6f37'], [24, 45, '#aa5e31'], [45, yEnd, '#bd6f37']];
  for (const [a, b, color] of sections) {
    drawCourseQuad(id, a, b, extraWidth, color || fill, stroke);
  }
  drawCourseWoodGrain(id, yStart, yEnd, extraWidth);
}

function drawCourseQuad(id, y0, y1, extraWidth, fill, stroke) {
  const c0 = eventCourseCenter(id, y0);
  const c1 = eventCourseCenter(id, y1);
  const h0 = eventCourseHalfWidth(id, y0) + extraWidth;
  const h1 = eventCourseHalfWidth(id, y1) + extraWidth;
  drawIsoPoly([
    [c0 - h0, y0],
    [c0 + h0, y0],
    [c1 + h1, y1],
    [c1 - h1, y1],
  ], fill, stroke, 2);
  drawCourseDither(id, y0, y1, extraWidth, '#2c140f44', Math.round((y1 - y0) * Math.max(h0, h1) * 2.8), 0, id.length * 47 + Math.round(y0 * 11));
  drawCourseDither(id, y0, y1, extraWidth, '#f1b96a33', Math.round((y1 - y0) * Math.max(h0, h1) * 1.6), 0, id.length * 53 + Math.round(y1 * 7));
}

function drawCourseDither(id, y0, y1, extraWidth, color, count, z = 0, seed = 1) {
  ctx.save();
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const n = (i * 1103515245 + seed * 12345) >>> 0;
    const t = ((n >>> 9) % 1000) / 1000;
    const y = y0 + (y1 - y0) * t;
    const center = eventCourseCenter(id, y);
    const half = eventCourseHalfWidth(id, y) + extraWidth - 0.45;
    const x = center + (((n >>> 21) % 1000) / 500 - 1) * half;
    const p = isoPoint(x, y, z);
    ctx.fillRect(p.x, p.y, (n & 3) === 0 ? 2 : 1, 1);
  }
  ctx.restore();
}

function drawCourseWoodGrain(id, y0, y1, extraWidth) {
  ctx.save();
  ctx.strokeStyle = '#6f392877';
  ctx.lineWidth = 2;
  for (let y = y0 + 1.4; y < y1; y += 2.6) {
    drawDeckSeam(id, y, '#6f392866');
  }
  ctx.strokeStyle = '#e5a75a66';
  ctx.lineWidth = 1;
  for (let y = y0 + 0.8; y < y1; y += 1.1) {
    const c = eventCourseCenter(id, y);
    const h = eventCourseHalfWidth(id, y) + extraWidth - 0.7;
    drawIsoLine(c - h, y, c + h, y + 0.22);
  }
  ctx.restore();
}

function drawCourseEdgeGutters(id, yStart, yEnd, dark, light) {
  ctx.save();
  ctx.lineWidth = 3;
  ctx.strokeStyle = light;
  for (let y = yStart; y < yEnd; y += 3.5) {
    const y2 = Math.min(yEnd, y + 2.8);
    const c0 = eventCourseCenter(id, y);
    const c1 = eventCourseCenter(id, y2);
    const h0 = eventCourseHalfWidth(id, y);
    const h1 = eventCourseHalfWidth(id, y2);
    drawIsoPoly([[c0 - h0 + 0.35, y], [c0 - h0 + 0.78, y], [c1 - h1 + 0.78, y2], [c1 - h1 + 0.35, y2]], dark, '#5b251d', 1);
    drawIsoPoly([[c0 + h0 - 0.78, y], [c0 + h0 - 0.35, y], [c1 + h1 - 0.35, y2], [c1 + h1 - 0.78, y2]], dark, '#5b251d', 1);
    ctx.strokeStyle = light;
    drawIsoLine(c0 - h0 + 1.15, y, c1 - h1 + 1.15, y2);
    drawIsoLine(c0 + h0 - 1.15, y, c1 + h1 - 1.15, y2);
  }
  ctx.restore();
}

function drawDeckSeam(id, y, color) {
  const c = eventCourseCenter(id, y);
  const h = eventCourseHalfWidth(id, y) + 1.1;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  drawIsoLine(c - h, y, c + h, y);
  ctx.restore();
}

function drawDeckSideFaces(id, yStart, yEnd, height) {
  for (let y = yStart; y < yEnd; y += 6.5) {
    const y2 = Math.min(yEnd, y + 6.5);
    drawCourseSideFace(id, y, y2, -1, height, '#7a2622');
    drawCourseSideFace(id, y, y2, 1, height, '#6b211f');
  }
}

function drawCourseSideFace(id, y0, y1, side, height, fill) {
  const c0 = eventCourseCenter(id, y0);
  const c1 = eventCourseCenter(id, y1);
  const h0 = eventCourseHalfWidth(id, y0) + 1.2;
  const h1 = eventCourseHalfWidth(id, y1) + 1.2;
  const x0 = c0 + h0 * side;
  const x1 = c1 + h1 * side;
  drawIsoPoly([[x0, y0], [x1, y1], [x1, y1, height], [x0, y0, height]], fill, '#3c1116', 2);
}

function drawDeckSideFacesFixed(x, y, w, h, height) {
  drawIsoPoly([[x, y + h], [x + w, y + h], [x + w, y + h, height], [x, y + h, height]], '#7a2622', '#3c1116', 2);
  drawIsoPoly([[x + w, y], [x + w, y + h], [x + w, y + h, height], [x + w, y, height]], '#5f1e1e', '#3c1116', 2);
}

function drawWideLaneStripe(id, y0, y1) {
  if (id === 'DOWNHILL') {
    for (let y = y0; y < y1; y += 2.2) {
      const y2 = Math.min(y1, y + 2.05);
      const c0 = eventCourseCenter(id, y);
      const c1 = eventCourseCenter(id, y2);
      drawIsoPoly([[c0 - 0.42, y], [c0 + 0.42, y], [c1 + 0.42, y2], [c1 - 0.42, y2]], '#ffd126cc', '#9b6917', 1);
    }
    for (let y = y0 + 7; y < y1; y += 13.5) {
      drawSlopeChevron(eventCourseCenter(id, y) - 1.25, y, 4.5, Math.floor(y / 13) % 2 === 0);
    }
    return;
  }
  for (let y = y0; y < y1; y += 12.5) {
    const c = eventCourseCenter(id, y);
    drawIsoRect(c - 1.0, y, 2.0, 6.8, '#ffd126bb', '#9b6917', 1);
  }
}

function drawJumpCourseLanes(course) {
  course.ramps.forEach((ramp, index) => {
    const approachStart = ramp.y - ramp.approach - 1.2;
    const approachEnd = ramp.y - 0.45;
    const laneW = 0.72;
    for (let y = approachStart; y < approachEnd; y += 1.85) {
      const y2 = Math.min(approachEnd, y + 1.7);
      const c0 = ramp.x + Math.sin((y + index) * 0.15) * 0.15;
      const c1 = ramp.x + Math.sin((y2 + index) * 0.15) * 0.15;
      drawIsoPoly([[c0 - laneW, y], [c0 + laneW, y], [c1 + laneW, y2], [c1 - laneW, y2]], y % 3.7 < 1.85 ? '#ffd126cc' : '#f5bd2dbb', '#9b6917', 1);
    }
    drawSlopeChevron(ramp.x, ramp.y - ramp.approach * 0.46, ramp.w * 1.35, index % 2 === 0);
    drawIsoRect(ramp.x - ramp.w * 0.9, ramp.landingY - 0.65, ramp.w * 1.8, 1.3, '#d7d9dfdd', '#7c8089', 1);
  });
}

function drawSlopeChevron(x, y, width, flip) {
  const p = worldToScreen(x, y);
  const w = width * 10;
  ctx.save();
  ctx.translate(p.x, p.y - 28);
  if (flip) ctx.scale(-1, 1);
  ctx.fillStyle = '#ffd12f';
  ctx.beginPath();
  ctx.moveTo(-w * 0.65, -8);
  ctx.lineTo(-w * 0.18, -25);
  ctx.lineTo(-w * 0.08, -12);
  ctx.lineTo(w * 0.45, -12);
  ctx.lineTo(w * 0.45, 4);
  ctx.lineTo(-w * 0.08, 4);
  ctx.lineTo(-w * 0.18, 18);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawBankPatch(id, y0, y1, left) {
  const mid = (y0 + y1) * 0.5;
  const center = eventCourseCenter(id, mid);
  const half = eventCourseHalfWidth(id, mid);
  const x = left ? center - half + 0.7 : center + half - 4.5;
  drawIsoTexturedRect(x, y0, 3.8, y1 - y0, TEXTURES.ramp, '#ffd64a55', '#9b6917', 1);
}

function drawJumpApproach(ramp, index) {
  const laneW = 0.82;
  drawIsoRect(ramp.x - ramp.w * 0.82, ramp.y - ramp.approach, ramp.w * 1.64, ramp.approach, '#b76534dd', '#6d3424', 2);
  drawIsoDither(ramp.x - ramp.w * 0.82, ramp.y - ramp.approach, ramp.w * 1.64, ramp.approach, '#e7a35a44', Math.round(ramp.w * ramp.approach * 3), 0, index + 77);
  drawIsoRect(ramp.x - laneW, ramp.y - ramp.approach + 0.9, laneW * 2, ramp.approach - 1.55, '#f7c633cc', '#9b6917', 1);
  drawIsoRect(ramp.x - laneW * 0.45, ramp.y - ramp.approach + 1.15, laneW * 0.9, ramp.approach - 2.05, '#fff2a2aa', null, 0);
  drawSlopeChevron(ramp.x, ramp.y - ramp.approach * 0.48, ramp.w * 1.22, index % 2 === 0);
}

function drawJumpRampFace(ramp) {
  drawIsoWall(ramp.x - ramp.w * 0.38, ramp.y - ramp.h * 0.58, ramp.w * 0.76, ramp.h * 1.08, 58, '#e0a53b', '#b06b2d', '#7d3923');
  drawIsoRect(ramp.x - ramp.w * 0.26, ramp.y - ramp.h * 0.18, ramp.w * 0.52, ramp.h * 0.48, '#ffe06a', '#9c781d', 1);
  const p = worldToScreen(ramp.x, ramp.y);
  const generatedW = 104;
  const generatedH = 82;
  drawGeneratedEnvAsset(ramp.x < CENTER.x ? 'rampLeft' : 'rampRight', p.x - generatedW * 0.5, p.y - generatedH + 6, generatedW, generatedH, 0.88);
  drawTurnArrowMark(ramp.x, ramp.y + 0.4, false);
}

function drawCourseRibbon(id, yStart, yEnd, step, texture, tint, stroke) {
  for (let y = yStart; y < yEnd; y += step) {
    const midY = y + step * 0.5;
    const center = eventCourseCenter(id, midY);
    const half = eventCourseHalfWidth(id, midY);
    drawIsoTexturedRect(center - half, y, half * 2, step + 0.18, texture, tint, stroke, 2);
    drawIsoRect(center - half, y, 0.42, step + 0.18, '#f4b518', '#9e6816', 1);
    drawIsoRect(center + half - 0.42, y, 0.42, step + 0.18, '#f4b518', '#9e6816', 1);
  }
}

function drawCourseRails(id, yStart, yEnd, step) {
  for (let y = yStart; y < yEnd; y += step) {
    const y2 = Math.min(yEnd, y + step);
    const centerA = eventCourseCenter(id, y);
    const centerB = eventCourseCenter(id, y2);
    const halfA = eventCourseHalfWidth(id, y);
    const halfB = eventCourseHalfWidth(id, y2);
    drawEventRails(centerA - halfA - 0.45, y, centerB - halfB - 0.45, y2);
    drawEventRails(centerA + halfA + 0.45, y, centerB + halfB + 0.45, y2);
  }
}

function drawCourseInnerLine(id, yStart, yEnd, step, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  for (let y = yStart; y < yEnd; y += step) {
    const center = eventCourseCenter(id, y);
    drawIsoLine(center - 1.0, y, center + 1.0, y + 0.8);
  }
}

function drawFinishPad(id, y) {
  const center = eventCourseCenter(id, y);
  const half = eventCourseHalfWidth(id, y);
  drawCheckpointStripes(center - half * 0.72, y - 0.45, half * 1.44, 0.9);
  drawBitmapTextShadow('FINISH', worldToScreen(center, y).x, worldToScreen(center, y).y - 52, 4, '#f6d04f', 'center');
}

function drawCourseObstacle(obstacle) {
  const p = worldToScreen(obstacle.x, obstacle.y);
  if (obstacle.type === 'barrier') {
    drawIsoRect(obstacle.x - 1.25, obstacle.y - 0.35, 2.5, 0.7, '#562a1e', '#2b120f', 1);
    if (drawGeneratedEnvAsset('railStraight', p.x - 42, p.y - 60, 84, 26, 0.96)) return;
    ctx.fillStyle = '#f4d34b';
    ctx.fillRect(p.x - 20, p.y - 36, 40, 8);
    ctx.fillStyle = '#672015';
    ctx.fillRect(p.x - 18, p.y - 34, 8, 4);
    ctx.fillRect(p.x + 4, p.y - 34, 8, 4);
    return;
  }
  if (drawGeneratedEnvAsset('cone', p.x - 17, p.y - 58, 34, 44, 0.96)) return;
  ctx.fillStyle = '#0007';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y - 5, 11, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f5b72b';
  ctx.fillRect(p.x - 5, p.y - 28, 10, 20);
  ctx.fillStyle = '#fff0a8';
  ctx.fillRect(p.x - 7, p.y - 28, 14, 4);
  ctx.fillStyle = '#7b2b18';
  ctx.fillRect(p.x - 8, p.y - 10, 16, 4);
}

function drawCheckpointStripes(x, y, w, h) {
  drawIsoRect(x, y, w, h, '#e1a33d88', '#7d3c24', 1);
  const stripeW = w / 17;
  for (let i = 0; i < 17; i += 2) drawIsoRect(x + i * stripeW, y + h * 0.12, stripeW * 0.55, h * 0.76, '#6a2b1f88', null, 0);
  drawIsoDither(x, y, w, h, '#ffe27a55', Math.round(w * h * 4), 0, 86);
}

function drawEventDeckPatch(x, y, color) {
  drawIsoRect(x - 1.05, y - 0.55, 2.1, 1.1, color, '#7d3d27', 1);
}

function drawTurnArrowMark(x, y, flip) {
  const p = worldToScreen(x, y);
  ctx.save();
  ctx.translate(p.x, p.y - 28);
  if (flip) ctx.scale(-1, 1);
  ctx.fillStyle = '#ffc523';
  ctx.beginPath();
  ctx.moveTo(-28, -4);
  ctx.lineTo(-10, -20);
  ctx.lineTo(-10, -9);
  ctx.lineTo(16, -9);
  ctx.lineTo(16, 5);
  ctx.lineTo(-10, 5);
  ctx.lineTo(-10, 17);
  ctx.lineTo(-28, -4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawLandingTarget(x, y, scale) {
  const p = worldToScreen(x, y);
  if (drawGeneratedEnvAsset('targetRound', p.x - 31 * scale, p.y - 49 * scale, 62 * scale, 48 * scale, 0.9)) return;
  const rings = [
    [42, '#ffd433'],
    [31, '#d88f29'],
    [21, '#ffd433'],
    [11, '#d88f29'],
  ];
  for (const [r, color] of rings) {
    fillScreenPoly(p.x, p.y - 26, [
      [0, -r * 0.52 * scale],
      [r * scale, 0],
      [0, r * 0.52 * scale],
      [-r * scale, 0],
    ], color, '#95651d', 2);
  }
}

function drawEventRails(x1, y1, x2, y2) {
  const a = worldToScreen(x1, y1);
  const b = worldToScreen(x2, y2);
  ctx.strokeStyle = '#6c1b27';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y - 12);
  ctx.lineTo(b.x, b.y - 12);
  ctx.stroke();
  ctx.strokeStyle = '#260d14';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    ctx.beginPath();
    ctx.moveTo(x, y - 8);
    ctx.lineTo(x, y + 28);
    ctx.stroke();
  }
  ctx.strokeStyle = '#7f1628';
  ctx.lineWidth = 3;
  for (let i = 0; i < 8; i++) {
    const t0 = i / 8;
    const t1 = (i + 1) / 8;
    const x0 = a.x + (b.x - a.x) * t0;
    const y0 = a.y + (b.y - a.y) * t0;
    const x1p = a.x + (b.x - a.x) * t1;
    const y1p = a.y + (b.y - a.y) * t1;
    ctx.beginPath();
    ctx.moveTo(x0, y0 + 28);
    ctx.lineTo(x1p, y1p - 8);
    ctx.stroke();
  }
}

function drawArrowMark(x, y) {
  const p = worldToScreen(x, y);
  ctx.fillStyle = '#ffc523';
  ctx.beginPath();
  ctx.moveTo(p.x, p.y - 38);
  ctx.lineTo(p.x + 36, p.y - 16);
  ctx.lineTo(p.x + 12, p.y - 14);
  ctx.lineTo(p.x + 12, p.y + 18);
  ctx.lineTo(p.x - 12, p.y + 18);
  ctx.lineTo(p.x - 12, p.y - 14);
  ctx.lineTo(p.x - 36, p.y - 16);
  ctx.closePath();
  ctx.fill();
}

function drawSlalomGate(x, y, flip, index = 0) {
  const p = worldToScreen(x, y);
  ctx.fillStyle = '#0006';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y - 7, 24, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = flip ? '#e84035' : '#f3d543';
  ctx.fillRect(p.x - 25, p.y - 46, 13, 34);
  ctx.fillRect(p.x + 12, p.y - 46, 13, 34);
  ctx.fillStyle = flip ? '#ff6b50' : '#fff06b';
  ctx.fillRect(p.x - 21, p.y - 43, 5, 27);
  ctx.fillRect(p.x + 16, p.y - 43, 5, 27);
  ctx.fillStyle = '#26202a';
  ctx.fillRect(p.x - 21, p.y - 12, 4, 20);
  ctx.fillRect(p.x + 17, p.y - 12, 4, 20);
  ctx.strokeStyle = index % 2 === 0 ? '#f3d543' : '#e84035';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(p.x - 19, p.y - 36);
  ctx.lineTo(p.x + 19, p.y - 36);
  ctx.stroke();
}

function drawWater() {
  for (const w of water) {
    const p = worldToScreen(w.x, w.y);
    const projection = activeProjection();
    drawFacetedWaterPatch(p.x, p.y, w.r * projection.tileW * 0.42, w.r * projection.tileH * 0.52);
  }
}

function drawFacetedWaterPatch(cx, cy, rx, ry) {
  const outer = [
    [-rx, -ry * 0.18],
    [-rx * 0.7, -ry * 0.82],
    [-rx * 0.18, -ry],
    [rx * 0.62, -ry * 0.74],
    [rx, -ry * 0.1],
    [rx * 0.72, ry * 0.7],
    [rx * 0.08, ry],
    [-rx * 0.72, ry * 0.72],
  ];
  const inner = outer.map(([x, y]) => [x * 0.62, y * 0.58]);
  fillScreenPoly(cx, cy, outer, '#234b92', '#8ad7ff', 2);
  fillScreenPoly(cx, cy, inner, '#2a86d2', '#185f9d', 2);
}

function drawRailsAndRamps() {
  for (const r of ramps) {
    const p = worldToScreen(r.x, r.y);
    ctx.save();
    ctx.translate(p.x, p.y - 15);
    ctx.rotate(r.dir * 0.35);
    if (!drawGeneratedEnvAsset('deckTile', -44, -30, 88, 52)) {
      ctx.drawImage(ATLAS.orangeRamp, -38, -14, 76, 28);
    }
    ctx.restore();
  }
  for (const rail of rails) {
    const a = worldToScreen(rail.x1, rail.y1);
    const b = worldToScreen(rail.x2, rail.y2);
    ctx.strokeStyle = '#e7f3ff';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y - 20);
    ctx.lineTo(b.x, b.y - 20);
    ctx.stroke();
    ctx.drawImage(ATLAS.rail, (a.x + b.x) / 2 - 22, (a.y + b.y) / 2 - 27, 44, 8);
  }
}

function drawShops() {
  for (const s of shops) {
    drawShopBuilding(s);
  }
}

function drawShopBuilding(shop) {
  const p = worldToScreen(shop.x, shop.y);
  const label = shop.id === 'SHOES' ? 'HOT SHOES' : shop.id === 'BOARD' ? 'HOT BOARD' : shop.id;
  const closed = shop.bought;
  const top = closed ? '#737c88' : '#15cfd7';
  const sideA = closed ? '#4f5965' : '#0b8794';
  const sideB = closed ? '#3b4450' : '#065f73';
  drawIsoRect(shop.x - 2.25, shop.y - 0.88, 4.5, 1.78, '#101722', '#ecf2f6', 2);
  drawIsoRect(shop.x - 2.05, shop.y - 0.66, 4.1, 1.24, '#263243', '#78818d', 1);
  drawShopShadow(shop.x, shop.y);
  drawIsoWall(shop.x - 2.05, shop.y - 1.72, 4.1, 2.25, closed ? 82 : 118, top, sideA, sideB);
  drawIsoRect(shop.x - 1.86, shop.y - 1.48, 3.72, 0.22, closed ? '#8b929b' : '#15b8c4cc', '#075f6b', 1);
  drawIsoRect(shop.x - 1.9, shop.y - 2.06, 3.8, 0.72, shop.id === 'BOARD' ? '#8c1622' : '#7d1d28', '#421016', 2);
  drawIsoDither(shop.x - 2.0, shop.y - 1.66, 4.0, 2.05, closed ? '#1d2530aa' : '#023d4588', 95, 0, shop.x * 17 + shop.y * 31);
  drawShopPanelLines(shop.x - 2.05, shop.y - 1.72, 4.1, 2.25, closed);
  drawGeneratedShopOverlay(shop, p, closed);
  drawShopWindows(p, closed);
  drawShopPad(shop.x, shop.y + 0.88, label);
  drawBitmapTextShadow(closed ? 'SOLD' : label, p.x, p.y - 128, label.length > 8 ? 3 : 4, closed ? '#c7ccd4' : '#fff45e', 'center');
}

function drawGeneratedShopOverlay(shop, p, closed) {
  if (closed) return;
  const crop = shop.id === 'BOARD'
    ? 'shopWide'
    : shop.id === 'SHOES'
      ? 'shopFront'
      : 'shopCanopy';
  const w = crop === 'shopCanopy' ? 138 : 156;
  const h = crop === 'shopCanopy' ? 88 : 78;
  drawGeneratedEnvAsset(crop, p.x - w * 0.5, p.y - h - 50, w, h, 0.88);
}

function drawShopShadow(x, y) {
  const p = worldToScreen(x, y);
  ctx.save();
  ctx.fillStyle = '#00000055';
  ctx.beginPath();
  ctx.ellipse(p.x + 4, p.y - 12, 95, 28, -0.04, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawShopPanelLines(x, y, w, h, closed) {
  ctx.save();
  ctx.strokeStyle = closed ? '#98a0aa99' : '#4beaf077';
  ctx.lineWidth = 2;
  for (let i = 0.9; i < w; i += 0.9) drawIsoLine(x + i, y + 0.18, x + i, y + h - 0.18);
  ctx.strokeStyle = closed ? '#303945aa' : '#064f5f99';
  ctx.lineWidth = 1;
  for (let i = -1.5; i < w + h; i += 1.25) {
    drawIsoLine(x + clamp(i, 0, w), y + clamp(i - w, 0, h), x + clamp(i - h, 0, w), y + clamp(i, 0, h));
  }
  ctx.restore();
}

function drawShopWindows(p, closed) {
  const windowColor = closed ? '#394454' : '#1e3f72';
  ctx.fillStyle = '#051623';
  ctx.fillRect(p.x - 68, p.y - 116, 116, 22);
  ctx.fillStyle = '#d3e8f0';
  ctx.fillRect(p.x - 66, p.y - 114, 112, 3);
  ctx.fillStyle = windowColor;
  for (let i = 0; i < 6; i++) {
    ctx.fillRect(p.x - 60 + i * 18, p.y - 106, 10, 26);
    ctx.fillStyle = closed ? '#74808c' : '#6effee';
    ctx.fillRect(p.x - 58 + i * 18, p.y - 104, 3, 9);
    ctx.fillStyle = windowColor;
  }
  ctx.fillStyle = closed ? '#8b929c' : '#8cff42';
  for (let i = 0; i < 10; i++) {
    ctx.fillRect(p.x - 63 + i * 12, p.y - 72, 4, 5);
    if (i % 2 === 0) ctx.fillRect(p.x - 61 + i * 12, p.y - 60, 4, 5);
  }
}

function drawEvents() {
  for (const e of events) {
    drawCourseGate(e);
  }
}

function drawCourseGate(eventDef) {
  const p = worldToScreen(eventDef.x, eventDef.y);
  ctx.strokeStyle = '#151821';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(p.x - 42, p.y - 8);
  ctx.lineTo(p.x - 42, p.y - 104);
  ctx.moveTo(p.x + 42, p.y - 8);
  ctx.lineTo(p.x + 42, p.y - 104);
  ctx.stroke();
  ctx.fillStyle = '#172033';
  ctx.fillRect(p.x - 70, p.y - 116, 140, 44);
  ctx.strokeStyle = eventDef.color;
  ctx.lineWidth = 4;
  ctx.strokeRect(p.x - 70, p.y - 116, 140, 44);
  ctx.fillStyle = '#070b12';
  ctx.fillRect(p.x - 58, p.y - 106, 116, 24);
  drawBitmapTextShadow(eventDef.id, p.x, p.y - 101, eventDef.id.length > 6 ? 4 : 5, '#f6d04f', 'center');
}

function drawMapIcons() {
  for (const m of mapIcons) {
    drawMapIcon(m);
  }
}

function drawMapIcon(m) {
  const p = worldToScreen(m.x, m.y);
  ctx.drawImage(ATLAS.mapIcon, p.x - 18, p.y - 36, 36, 26);
}

function drawHazards() {
  for (const h of hazards) {
    drawStreetSprite(h.type, h.x, h.y, h.color);
  }
}

function drawStreetSprite(type, x, y, color) {
  const p = worldToScreen(x, y);
  const tick = Math.floor(state.animTime * 10 + x + y);
  if (type === 'frisbee') {
    ctx.save();
    ctx.translate(p.x, p.y - 28);
    ctx.rotate((tick % 8) * Math.PI / 8);
    ctx.drawImage(ATLAS.frisbee, -20, -10, 40, 20);
    ctx.restore();
    return;
  }
  if (type === 'bmx' || type === 'thug') {
    const step = tick % 2 === 0 ? -1 : 1;
    ctx.fillStyle = '#0006';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y - 8, 15, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    const bodyColor = type === 'bmx' ? '#f3e24f' : '#b08aff';
    drawSpritePixels([
      [-3, -21, 6, 10, bodyColor],
      [-3, -25, 6, 4, '#f2cfad'],
      [-8, -12 + step, 16, 2, '#17171d'],
      [-5, -7 - step, 10, 2, '#17171d'],
      [-9, -6 + step, 3, 3, '#17171d'],
      [6, -6 - step, 3, 3, '#17171d'],
    ], Math.round(p.x), Math.round(p.y), 2);
    if (type === 'bmx') {
      ctx.strokeStyle = '#17171d';
      ctx.lineWidth = 2;
      for (const wx of [-13, 13]) {
        ctx.beginPath();
        ctx.arc(p.x + wx, p.y - 5, 7, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    return;
  }
  ctx.save();
  ctx.translate(p.x, p.y - 26);
  ctx.fillStyle = '#0008';
  ctx.beginPath();
  ctx.ellipse(0, 22, 30, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.drawImage(color === '#42aee8' ? ATLAS.carBlue : ATLAS.carRed, -34, -16, 68, 40);
  ctx.strokeStyle = tick % 2 === 0 ? '#ffffff' : '#111111';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-25, 17);
  ctx.lineTo(-15, 17);
  ctx.moveTo(15, 15);
  ctx.lineTo(25, 15);
  ctx.stroke();
  ctx.restore();
}

function drawBees() {
  for (let i = 0; i < state.bees.length; i++) {
    drawBee(state.bees[i], i);
  }
}

function drawBee(bee, index) {
  const p = worldToScreen(bee.x, bee.y);
  const flap = Math.floor(state.animTime * 16 + index) % 2 === 0 ? -1 : 1;
  ctx.fillStyle = '#0005';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y - 6, 11, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#cfe9ff88';
  ctx.beginPath();
  ctx.ellipse(p.x - 6, p.y - 36 + flap, 7, 4, -0.4, 0, Math.PI * 2);
  ctx.ellipse(p.x + 6, p.y - 36 - flap, 7, 4, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f5d230';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y - 30, 9, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#171717';
  ctx.fillRect(p.x - 5, p.y - 36, 3, 12);
  ctx.fillRect(p.x + 2, p.y - 36, 3, 12);
  ctx.strokeStyle = '#f5d230';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(p.x - 14, p.y - 31);
  ctx.lineTo(p.x + 14, p.y - 31);
  ctx.stroke();
}

function getPlayerVisualState() {
  const p = state.player;
  const speed = Math.hypot(p.vx, p.vy);
  const visualFacing = p.facing;
  const screenFacing = worldAngleToScreenAngle(visualFacing);
  const dir = angleToSpriteDir(screenFacing);
  const frame = Math.floor(p.anim) % SKATER_ROLL_FRAMES;
  const fallbackFrame = frame & 3;
  const airborne = p.z > 0.01;
  const boardAngle = screenFacing;
  const landing = airborne && p.vz < -1.2 && p.z < 0.55;
  const eventPose = state.mode === 'event' ? state.eventRun?.pose || null : null;
  const eventTrick = state.mode === 'event' ? state.eventRun?.trick || null : null;
  let sheet = 'roll';
  let atlasRow = dir;
  let atlasCol = frame;
  let spriteKey = `roll_${dir}_${frame}`;
  let fallbackKey = `roll_${dir}_${fallbackFrame}`;

  if (p.bail > 0) {
    sheet = 'bail';
    atlasRow = 0;
    atlasCol = p.bail > 0.72 ? 0 : p.bail > 0.3 ? 1 : 2;
    spriteKey = `bail_${atlasCol}`;
    fallbackKey = 'bail';
  } else if (eventTrick === 'grind' || eventTrick === 'handplant' || eventTrick === 'rock') {
    const trickCols = { grind: 0, handplant: 1, rock: 2 };
    sheet = 'trick';
    atlasCol = trickCols[eventTrick] || 0;
    spriteKey = `${eventTrick}_${dir}`;
    fallbackKey = eventTrick === 'handplant' ? `air_${dir}` : `crouch_${dir}`;
  } else if (airborne) {
    if (eventPose === 'air-spin') {
      sheet = 'trick';
      atlasCol = 4 + (Math.floor(Math.abs(p.spin) * 3) % 2);
      spriteKey = `ramp_spin_${dir}`;
      fallbackKey = `spin_${dir}`;
    } else {
      sheet = 'jump';
      if (landing) {
      atlasCol = 7;
      } else if (Math.abs(p.spin) > 0.55) {
      atlasCol = 4 + (Math.floor(Math.abs(p.spin) * 2.6) % 3);
      } else {
      atlasCol = p.vz > 2.6 ? 2 : p.vz > 0 ? 3 : 4;
      }
      spriteKey = `${landing ? 'land' : Math.abs(p.spin) > 0.55 ? 'spin' : 'air'}_${dir}`;
      fallbackKey = landing ? `land_${dir}` : Math.abs(p.spin) > 0.55 ? `spin_${dir}` : `air_${dir}`;
    }
  } else if (eventPose === 'duck') {
    sheet = 'duck';
    atlasCol = Math.floor(p.anim) % SKATER_DUCK_FRAMES;
    spriteKey = `duck_${dir}_${atlasCol}`;
    fallbackKey = `crouch_${dir}`;
  } else if (p.pushTimer > 0 && speed > 0.02) {
    sheet = 'roll';
    atlasCol = frame;
    spriteKey = `push_${dir}_${frame}`;
    fallbackKey = `push_${dir}_${fallbackFrame}`;
  }

  return {
    speed,
    visualFacing,
    screenFacing,
    dir,
    frame,
    airborne,
    eventPose,
    eventTrick,
    boardAngle,
    spriteKey,
    atlas: {
      sheet,
      row: atlasRow,
      col: atlasCol,
    },
    sprite: SKATER_SPRITES[fallbackKey] || SKATER_SPRITES[`roll_${dir}_${frame}`],
  };
}

function drawPlayer() {
  const p = state.player;
  const s = worldToScreen(p.x, p.y);
  const lift = p.z * 22;
  const visual = getPlayerVisualState();
  const sprite = visual.sprite;
  const spriteScale = activeProjection().playerSpriteScale || SPRITE_SCALE;
  const shadowScale = clamp(1 - p.z * 0.16, 0.52, 1);
  ctx.fillStyle = p.z > 0.01 ? '#0005' : '#0008';
  ctx.beginPath();
  ctx.ellipse(s.x, s.y - 4, 14 * shadowScale, 6 * shadowScale, 0, 0, Math.PI * 2);
  ctx.fill();

  const spriteX = Math.round(s.x);
  const groundY = Math.round(s.y - lift);
  let imageScale = activeProjection().playerImageScale || 1;
  if (visual.eventTrick === 'handplant') imageScale *= 1.18;
  if (canDrawSkaterAtlasSprite(visual)) {
    if (p.bail <= 0) {
      drawSkateboardForAtlasSprite(visual, spriteX, groundY, imageScale);
    }
    drawSkaterAtlasSprite(visual, spriteX, groundY, imageScale);
    return;
  }

  const spriteY = Math.round(s.y - 12 * spriteScale - lift);
  if (p.bail <= 0) {
    const feet = sprite.feet || { x: 0, y: 8 };
    const boardX = Math.round(spriteX + feet.x * spriteScale);
    const boardY = Math.round(spriteY + feet.y * spriteScale + (visual.airborne ? 8 : 10));
    drawSkateboardUnderFeet(boardX, boardY, visual.boardAngle, visual.airborne ? p.spin : 0, visual.airborne);
  }

  drawSpritePixels(sprite, spriteX, spriteY, spriteScale);
}

function canDrawSkaterAtlasSprite(visual) {
  const sheet = SKATER_ATLAS[visual.atlas.sheet];
  return Boolean(sheet && sheet.ready);
}

function atlasFootAnchor(visual) {
  const sheet = SKATER_ATLAS[visual.atlas.sheet];
  if (!sheet || !sheet.footAnchors) return null;
  const row = clamp(visual.atlas.row, 0, sheet.rows - 1);
  const col = clamp(visual.atlas.col, 0, sheet.cols - 1);
  return sheet.footAnchors[row]?.[col] || null;
}

function drawSkateboardForAtlasSprite(visual, x, y, scale) {
  const anchor = atlasFootAnchor(visual);
  const boardCenterCell = atlasBoardCenterFromFootAnchor(
    anchor || { x: SKATER_ATLAS.anchorX, y: SKATER_ATLAS.anchorY, minX: 18, maxX: 30, minY: 38, maxY: 43, points: [] },
    visual.boardAngle + (visual.airborne ? state.player.spin * 0.85 : 0),
  );
  const boardX = Math.round(x + (boardCenterCell.x - SKATER_ATLAS.anchorX) * scale);
  const boardY = Math.round(y + (boardCenterCell.y - SKATER_ATLAS.anchorY) * scale);
  drawSkateboardUnderFeet(boardX, boardY, visual.boardAngle, visual.airborne ? state.player.spin : 0, visual.airborne);
}

function atlasBoardCenterFromFootAnchor(anchor, angle) {
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const px = -uy;
  const py = ux;
  if (!anchor.points || anchor.points.length < 4) {
    return {
      x: anchor.x || SKATER_ATLAS.anchorX,
      y: (anchor.maxY || SKATER_ATLAS.anchorY) - 1,
    };
  }
  const samples = anchor.points;
  const along = samples.map((pt) => pt.x * ux + pt.y * uy).sort((a, b) => a - b);
  const edgeIndex = Math.max(0, Math.floor((along.length - 1) * 0.12));
  const minAlong = along[edgeIndex];
  const maxAlong = along[along.length - 1 - edgeIndex];
  const centerAlong = (minAlong + maxAlong) * 0.5;
  const centerPerp = samples.reduce((sum, pt) => sum + pt.x * px + pt.y * py, 0) / samples.length;
  return {
    x: centerAlong * ux + centerPerp * px,
    y: centerAlong * uy + centerPerp * py + 1.2,
  };
}

function drawSkaterAtlasSprite(visual, x, y, scale) {
  const sheet = SKATER_ATLAS[visual.atlas.sheet];
  if (!sheet || !sheet.ready) return false;
  const cellW = SKATER_ATLAS.cellW;
  const cellH = SKATER_ATLAS.cellH;
  const col = clamp(visual.atlas.col, 0, sheet.cols - 1);
  const row = clamp(visual.atlas.row, 0, sheet.rows - 1);
  const sx = col * cellW;
  const sy = row * cellH;
  const dx = Math.round(x - SKATER_ATLAS.anchorX * scale);
  const dy = Math.round(y - SKATER_ATLAS.anchorY * scale);
  const dw = Math.round(cellW * scale);
  const dh = Math.round(cellH * scale);
  ctx.drawImage(sheet.img, sx, sy, cellW, cellH, dx, dy, dw, dh);
  return true;
}

function worldAngleToScreenAngle(angle) {
  const v = projectedScreenVector(angle);
  return Math.atan2(v.y, v.x);
}

function drawSkateboardUnderFeet(x, y, angle, spin, airborne) {
  const boardScale = ((activeProjection().playerSpriteScale || SPRITE_SCALE) / 3) * (activeProjection().playerImageScale || 1);
  const deckW = (airborne ? 34 : 28) * boardScale;
  const deckH = (airborne ? 7 : 6) * boardScale;
  const wheelW = 3 * boardScale;
  const wheelH = 2 * boardScale;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.rotate(angle + (airborne ? spin * 0.85 : 0));
  ctx.fillStyle = '#0006';
  ctx.fillRect(-deckW / 2 + 3 * boardScale, deckH / 2 + 4 * boardScale, deckW - 6 * boardScale, 2 * boardScale);
  ctx.fillStyle = '#f0a228';
  ctx.fillRect(-deckW / 2, -deckH / 2, deckW, deckH);
  ctx.fillStyle = '#5d2a0d';
  ctx.fillRect(-deckW / 2, -deckH / 2, 4 * boardScale, deckH);
  ctx.fillStyle = '#ffe16d';
  ctx.fillRect(deckW / 2 - 5 * boardScale, -deckH / 2 - boardScale, 5 * boardScale, deckH + 2 * boardScale);
  ctx.fillStyle = '#ffd47a';
  ctx.fillRect(-deckW / 2 + 2 * boardScale, -deckH / 2, deckW - 4 * boardScale, 2 * boardScale);
  ctx.fillStyle = '#8d5515';
  ctx.fillRect(-deckW / 2 + 2 * boardScale, deckH / 2 - boardScale, deckW - 4 * boardScale, 2 * boardScale);
  ctx.fillStyle = '#171717';
  ctx.fillRect(-deckW / 2 + 4 * boardScale, deckH / 2 + 2 * boardScale, wheelW, wheelH);
  ctx.fillRect(deckW / 2 - 7 * boardScale, deckH / 2 + 2 * boardScale, wheelW, wheelH);
  ctx.fillStyle = '#e7edf4';
  ctx.fillRect(-deckW / 2 + 4 * boardScale, deckH / 2 + 2 * boardScale, boardScale, wheelH);
  ctx.fillRect(deckW / 2 - 5 * boardScale, deckH / 2 + 2 * boardScale, boardScale, wheelH);
  ctx.restore();
}

function drawSpritePixels(commands, x, y, scale) {
  for (const [sx, sy, w, h, color] of commands) {
    ctx.fillStyle = color;
    ctx.fillRect(x + sx * scale, y + sy * scale, w * scale, h * scale);
  }
}

function drawPx(x, y, w, h, color, scale = 1) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x * scale), Math.round(y * scale), Math.round(w * scale), Math.round(h * scale));
}

function drawCityMap() {
  ctx.save();
  ctx.fillStyle = '#272c3a';
  ctx.fillRect(VIEW.x, VIEW.y, VIEW.w, VIEW.h);
  ctx.fillStyle = '#b9bfcb88';
  for (let i = 0; i < 860; i++) {
    const x = VIEW.x + ((i * 37) % VIEW.w);
    const y = VIEW.y + ((i * 71) % VIEW.h);
    ctx.fillRect(x, y, 2, 2);
  }

  const cx = VIEW.x + VIEW.w * 0.52;
  const cy = VIEW.y + VIEW.h * 0.50;
  ctx.translate(cx, cy);
  ctx.rotate(-0.36);
  fillScreenPoly(0, 0, [
    [-360, -120], [-210, -196], [-10, -218], [202, -188],
    [360, -112], [384, 10], [250, 114], [36, 190],
    [-186, 172], [-354, 82],
  ], '#d9dce4', '#858b96', 5);
  fillScreenPoly(0, 0, [
    [-296, -80], [-174, -138], [-14, -156], [152, -132],
    [286, -68], [306, 4], [194, 74], [24, 124],
    [-154, 114], [-282, 58],
  ], '#f6f8fa', '#a1a7b2', 3);

  drawSourceMapPath(-260, -24, 520, 48);
  drawSourceMapPath(-26, -142, 52, 284);
  drawSourceMapPlaza(-170, -88, 118, 72, '#6c2525');
  drawSourceMapPlaza(54, -86, 118, 72, '#2f4b79');
  drawSourceMapPlaza(-176, 42, 128, 72, '#2f4b79');
  drawSourceMapPlaza(72, 38, 128, 76, '#6c2525');
  drawSourceMapCourse(-310, 66, 122, 84, '#234283');
  drawSourceMapCourse(214, 50, 120, 88, '#80501e');
  drawSourceMapCourse(-312, -158, 126, 72, '#8a3b24');
  drawSourceMapCourse(208, -154, 126, 72, '#9b2727');
  drawMapTruck(-362, -126);
  drawMapTruck(362, 116);
  ctx.restore();

  drawSourceMapLabel(VIEW.x + 112, VIEW.y + 398, ['BOARD', 'SHOP'], 'left');
  drawSourceMapLabel(VIEW.x + 206, VIEW.y + 560, ['JUMP', 'PARK', 'CLASS 1'], 'left');
  drawSourceMapLabel(VIEW.x + 840, VIEW.y + 520, ['SLALOM', 'PARK', 'CLASS 1'], 'right');
  drawSourceMapLabel(VIEW.x + 860, VIEW.y + 236, ['RAMP', 'PARK', 'CLASS 1'], 'right');
  drawSourceMapLabel(VIEW.x + 118, VIEW.y + 246, ['DOWNHILL', 'PARK', 'CLASS 1'], 'left');
  drawSourceMapLabel(VIEW.x + 500, VIEW.y + 188, ['HELMET', 'SHOP'], 'center');
  drawSourceMapLabel(VIEW.x + 884, VIEW.y + 392, ['SHOE', 'SHOP'], 'right');
  drawSourceMapLabel(VIEW.x + 560, VIEW.y + 622, ['PAD', 'SHOP'], 'center');
  drawSourceYouAreHere(VIEW.x + VIEW.w / 2, VIEW.y + VIEW.h / 2 + 58);

  const px = VIEW.x + 270 + (state.player.x / WORLD_W) * 420;
  const py = VIEW.y + 252 + (state.player.y / WORLD_H) * 210;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(px, py, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#0d1d5f';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = '#0525d8';
  ctx.fillRect(VIEW.x + 720, 590, 230, 106);
  ctx.strokeStyle = '#07135d';
  ctx.lineWidth = 4;
  ctx.strokeRect(VIEW.x + 720, 590, 230, 106);
  drawBitmapText('EQUIPMENT', VIEW.x + 835, 606, 4, '#ffffff', 'center');
  shops.forEach((s, i) => {
    drawBitmapText(`${s.id}: ${s.bought ? 1 : 0}`, VIEW.x + 835, 630 + i * 18, 3, '#ffffff', 'center');
  });
}

function drawSourceMapPath(x, y, w, h) {
  ctx.fillStyle = '#f1f2f5';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#6f7480';
  ctx.lineWidth = 4;
  ctx.strokeRect(x, y, w, h);
}

function drawSourceMapPlaza(x, y, w, h, fill) {
  ctx.fillStyle = '#1b2030';
  ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#ffffff22';
  for (let i = 0; i < w; i += 14) ctx.fillRect(x + i, y, 5, h);
}

function drawSourceMapCourse(x, y, w, h, fill) {
  ctx.fillStyle = '#1b2030';
  ctx.fillRect(x - 6, y - 6, w + 12, h + 12);
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#ffe04a';
  ctx.fillRect(x + 14, y + h * 0.5 - 6, w - 28, 12);
}

function drawSourceMapLabel(x, y, lines, align = 'center') {
  const width = Math.max(76, Math.max(...lines.map((line) => line.length)) * 12 + 18);
  const height = lines.length * 19 + 10;
  const left = align === 'right' ? x - width : align === 'center' ? x - width / 2 : x;
  drawPixelNoiseRect(left, y, width, height, ['#0525d8', '#1738ea', '#06157d'], 0.04);
  ctx.strokeStyle = '#06125a';
  ctx.lineWidth = 3;
  ctx.strokeRect(left, y, width, height);
  lines.forEach((line, index) => drawBitmapTextShadow(line, left + width / 2, y + 10 + index * 18, 4, '#ffffff', 'center'));
}

function drawSourceYouAreHere(x, y) {
  const w = 260;
  const h = 56;
  ctx.fillStyle = '#1b1112';
  ctx.fillRect(x - w / 2, y - h / 2, w, h);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.strokeRect(x - w / 2, y - h / 2, w, h);
  drawBitmapTextShadow('YOU ARE HERE', x - 18, y - 10, 6, '#ffffff', 'center');
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(x + 94, y);
  ctx.lineTo(x + 128, y - 18);
  ctx.lineTo(x + 128, y + 18);
  ctx.closePath();
  ctx.fill();
}

function drawMapTruck(x, y) {
  ctx.fillStyle = '#27cf43';
  ctx.fillRect(x - 36, y - 30, 72, 60);
  ctx.fillStyle = '#f5302f';
  ctx.fillRect(x - 18, y - 27, 36, 54);
  ctx.fillStyle = '#10356d';
  ctx.fillRect(x - 42, y - 9, 10, 18);
  ctx.fillRect(x + 32, y - 9, 10, 18);
}

function drawMapCourseSlats(x, y) {
  ctx.fillStyle = '#0e3960';
  for (let i = -3; i <= 3; i++) {
    ctx.fillRect(x + i * 34 - 10, y - 76, 22, 42);
    if (i % 2 === 0) ctx.fillRect(x + i * 34 - 10, y + 42, 22, 38);
  }
}

function drawMapCourseBlock(x, y, color, label) {
  ctx.fillStyle = '#121a2a';
  ctx.fillRect(x - 88, y - 41, 176, 82);
  ctx.fillStyle = color;
  ctx.fillRect(x - 80, y - 34, 160, 68);
  ctx.strokeStyle = '#13223b';
  ctx.lineWidth = 4;
  ctx.strokeRect(x - 80, y - 34, 160, 68);
  ctx.fillStyle = '#111827';
  ctx.fillRect(x - 68, y - 18, 136, 36);
  ctx.strokeStyle = '#f0d04f';
  ctx.lineWidth = 2;
  ctx.strokeRect(x - 68, y - 18, 136, 36);
  drawBitmapText(label, x + 2, y - 8, label.length > 6 ? 4 : 5, '#000000', 'center');
  drawBitmapText(label, x, y - 10, label.length > 6 ? 4 : 5, '#f5d94a', 'center');
}

function drawMapScreenHud() {
  ctx.fillStyle = '#0525d8';
  ctx.fillRect(VIEW.x + 70, 70, 250, 98);
  ctx.strokeStyle = '#07135d';
  ctx.lineWidth = 4;
  ctx.strokeRect(VIEW.x + 70, 70, 250, 98);
  drawBitmapText('PLAYER 1', VIEW.x + 86, 86, 7, '#ffffff');
  drawBitmapText(`SCORE: ${state.score.toLocaleString()}`, VIEW.x + 92, 130, 4, '#ffffff');
  drawBitmapText(`NEXT: ${state.nextTicketScore.toLocaleString()}`, VIEW.x + 92, 154, 4, '#ffffff');
}

function drawOverlayText() {
  const bottomOnly = state.message.startsWith('NEXT PARK TICKET');
  if ((state.messageTimer > 0 || state.screen !== 'playing') && !bottomOnly) {
    const isShop = state.message.includes('SHOP') || state.message.includes('UPGRADE');
    if (state.mode === 'event') {
      drawPixelNoiseRect(VIEW.x + 315, 520, 330, 72, ['#0525d8', '#1239ff', '#031a9a'], 0.08);
      ctx.strokeStyle = '#07135d';
      ctx.lineWidth = 4;
      ctx.strokeRect(VIEW.x + 315, 520, 330, 72);
      drawBitmapTextShadow(state.message, VIEW.x + VIEW.w / 2, 540, 5, '#ffffff', 'center');
      drawBitmapTextShadow('BEAT TIMER TO WIN MEDAL', VIEW.x + VIEW.w / 2, 570, 3, '#f5d94a', 'center');
    } else if (isShop) {
      drawPixelNoiseRect(VIEW.x + 310, 545, 340, 78, ['#0525d8', '#1239ff', '#031a9a'], 0.08);
      ctx.strokeStyle = '#061563';
      ctx.lineWidth = 4;
      ctx.strokeRect(VIEW.x + 310, 545, 340, 78);
      drawBitmapTextShadow(state.message, VIEW.x + VIEW.w / 2, 580, 5, '#ffffff', 'center');
    } else {
      const isSkateOrDie = state.message === 'SKATE OR DIE';
      const boxX = isSkateOrDie ? VIEW.x + 270 : VIEW.x + 85;
      const boxY = isSkateOrDie ? 116 : 58;
      const boxW = isSkateOrDie ? 420 : 790;
      const boxH = isSkateOrDie ? 66 : 86;
      ctx.fillStyle = isSkateOrDie ? '#120509e8' : '#07101edc';
      ctx.fillRect(boxX, boxY, boxW, boxH);
      ctx.strokeStyle = isSkateOrDie ? '#ff3838' : '#f0d06a';
      ctx.lineWidth = 3;
      ctx.strokeRect(boxX, boxY, boxW, boxH);
      drawBitmapTextShadow(state.message, VIEW.x + VIEW.w / 2, boxY + (isSkateOrDie ? 21 : 30), isSkateOrDie ? 7 : 6, isSkateOrDie ? '#ff3838' : '#f0d06a', 'center');
    }
  }
  if (state.mode === 'event') {
    ctx.fillStyle = '#e81f26';
    ctx.fillRect(VIEW.x + VIEW.w / 2 - 18, canvas.height - 38, 36, 24);
    ctx.strokeStyle = '#1b164e';
    ctx.lineWidth = 3;
    ctx.strokeRect(VIEW.x + VIEW.w / 2 - 18, canvas.height - 38, 36, 24);
    drawBitmapText(String(Math.max(0, Math.ceil(state.eventTimer))), VIEW.x + VIEW.w / 2, canvas.height - 32, 4, '#ffe83d', 'center');
  } else {
    drawPixelNoiseRect(VIEW.x + 220, canvas.height - 38, 520, 30, ['#07101e', '#111b31', '#020611'], 0.06);
    ctx.strokeStyle = '#e8eef8';
    ctx.lineWidth = 2;
    ctx.strokeRect(VIEW.x + 220, canvas.height - 38, 520, 30);
    drawBitmapText(`NEXT PARK TICKET AT ${state.nextTicketScore.toLocaleString()} POINTS`, VIEW.x + VIEW.w / 2, canvas.height - 29, 4, '#eef6ff', 'center');
  }
}

function drawArcadeHud() {
  const ox = VIEW.x;
  ctx.fillStyle = '#09201699';
  ctx.fillRect(ox + 32, 30, 215, 68);
  ctx.fillRect(ox + 32, 102, 215, 62);
  drawPixelNoiseRect(ox + 26, 24, 215, 68, ['#00883f', '#0aa04b', '#006f35'], 0.18);
  drawPixelNoiseRect(ox + 26, 96, 215, 62, ['#00883f', '#0aa04b', '#006f35'], 0.18);
  ctx.strokeStyle = '#ffdf21';
  ctx.lineWidth = 3;
  ctx.strokeRect(ox + 26, 24, 215, 68);
  ctx.strokeRect(ox + 26, 96, 215, 62);
  drawBitmapText('PLAYER 1', ox + 38, 42, 5, '#fff35b');
  drawBitmapText('CASH', ox + 38, 115, 5, '#fff35b');
  drawBitmapText(state.score.toLocaleString(), ox + 228, 57, 8, '#fff35b', 'right');
  drawBitmapText(`$${state.cash}`, ox + 228, 128, 7, '#fff35b', 'right');

  ctx.fillStyle = '#09201699';
  ctx.fillRect(ox + 32, 170, 64, 190);
  drawPixelNoiseRect(ox + 26, 164, 64, 190, ['#00883f', '#0aa04b', '#006f35'], 0.16);
  ctx.strokeStyle = '#ffdf21';
  ctx.strokeRect(ox + 26, 164, 64, 190);
  ctx.save();
  ctx.translate(ox + 52, 343);
  ctx.rotate(-Math.PI / 2);
  drawBitmapText('PARK TICKETS', 0, -7, 5, '#fff35b');
  ctx.restore();
  for (let i = 0; i < Math.min(state.tickets, 4); i++) {
    ctx.fillStyle = '#fff35b';
    ctx.fillRect(ox + 58, 177 + i * 42, 22, 34);
    ctx.fillStyle = '#e3342f';
    drawBitmapText('1', ox + 69, 187 + i * 42, 3, '#e3342f', 'center');
    drawBitmapText('P', ox + 69, 202 + i * 42, 3, '#e3342f', 'center');
  }

  const timerX = ox + 348;
  ctx.fillStyle = '#2b2b34';
  ctx.fillRect(timerX + 8, 46, 265, 62);
  drawPixelNoiseRect(timerX, 38, 265, 62, ['#e8e8e8', '#ffffff', '#c7c9ce'], 0.08);
  ctx.strokeStyle = '#1d1d24';
  ctx.lineWidth = 4;
  ctx.strokeRect(timerX, 38, 265, 62);
  const timerLabel = state.mode === 'event'
    ? state.event?.id === 'RAMP' ? 'MEDAL METER' : 'PARK TIMER'
    : 'TIMER';
  drawBitmapText(timerLabel, timerX + 132, 47, timerLabel.length > 7 ? 4 : 6, '#e4252b', 'center');
  ctx.fillStyle = '#cfd5dc';
  ctx.fillRect(timerX + 18, 70, 229, 19);
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 3;
  ctx.strokeRect(timerX + 18, 70, 229, 19);
  const timerValue = state.mode === 'event'
    ? state.eventTimer / (state.event?.seconds || 1)
    : Math.max(0, state.cityTimer) / (CITY_TIME + state.classLevel * 2);
  ctx.fillStyle = state.cityTimer <= 0 ? '#ffe536' : '#ed171e';
  ctx.fillRect(timerX + 21, 73, clamp(timerValue, 0, 1) * 223, 13);
  if (state.mode === 'event') {
    drawBitmapText('B', timerX + 34, 90, 3, '#f4d34b', 'center');
    drawBitmapText('S', timerX + 114, 90, 3, '#f4d34b', 'center');
    drawBitmapText('G', timerX + 196, 90, 3, '#f4d34b', 'center');
  }
}

function drawPanel(title, lines) {
  drawWorld();
  ctx.fillStyle = '#07101ee8';
  ctx.fillRect(VIEW.x + 70, 100, 820, 500);
  ctx.strokeStyle = '#f0d06a';
  ctx.lineWidth = 4;
  ctx.strokeRect(VIEW.x + 70, 100, 820, 500);
  drawBitmapTextShadow(title, VIEW.x + VIEW.w / 2, 150, 9, '#f0d06a', 'center');
  lines.forEach((line, i) => drawBitmapTextShadow(line, VIEW.x + VIEW.w / 2, 245 + i * 48, 5, '#eef6ff', 'center'));
}

function render() {
  beginLowResFrame();
  ctx.save();
  if (state.shake > 0) ctx.translate((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9);
  if (state.screen === 'splash') {
    drawPanel('720 SKATE CITY', [
      'Left / Right: Rotate board',
      'Tap Z: Kick for speed',
      'Tap X: Jump',
      'Score tricks to earn park tickets',
      'Reach Ramp, Downhill, Slalom, and Jump parks',
      'Press Enter or click to start',
    ]);
  } else if (state.screen === 'menu') {
    drawPanel('720 SKATE CITY', ['Enter / Click: Start', 'Left / Right: Rotate', 'Z: Kick', 'X: Jump', 'M: Map', 'P: Pause']);
  } else if (state.screen === 'highScores') {
    drawPanel('HIGH SCORES', state.highScores.map((s, i) => `${i + 1}. ${s.name}  ${s.score}`).concat('Enter: Menu'));
  } else if (state.screen === 'gameOver') {
    drawPanel('GAME OVER', [state.message, `Final Score: ${state.score}`, 'Enter: Menu', 'H: High Scores']);
  } else if (state.screen === 'paused') {
    drawPanel('PAUSED', ['Press P to continue']);
  } else {
    drawWorld();
  }
  ctx.restore();
  presentFrame();
}

function frame(ts) {
  const last = frame.last || ts;
  const dt = Math.min(0.033, (ts - last) / 1000);
  frame.last = ts;
  update(dt);
  render();
  requestAnimationFrame(frame);
}

function activatePrimaryAction() {
  if (state.screen === 'splash' || state.screen === 'menu') startRun();
  else if (state.screen === 'gameOver' || state.screen === 'highScores') state.screen = 'menu';
  else if (state.screen === 'paused') state.screen = 'playing';
}

function pushPlayer() {
  if (state.screen !== 'playing') return;
  const p = state.player;
  if (p.bail > 0) return;
  const course = getEventCourse();
  if (state.mode === 'event' && state.event?.id === 'RAMP' && course) {
    rampPump();
    return;
  }
  if (state.mode === 'event' && course && (state.event?.id === 'DOWNHILL' || state.event?.id === 'JUMP')) {
    const run = state.eventRun || makeEventRun(state.event.id);
    state.eventRun = run;
    run.pendingPump = (run.pendingPump || 0) + (p.z > 0.01 ? 0.08 : 0.32);
    p.pushTimer = 0.18;
    p.anim += 0.65;
    return;
  }
  const boardBoost = shops[0].bought ? BOARD_SPEED_MULT : 1;
  const maxSpeed = BASE_MAX_SPEED * boardBoost;
  const impulse = (p.z > 0.01 ? AIR_PUSH_IMPULSE : PUSH_IMPULSE) * boardBoost;
  p.vx += Math.cos(p.facing) * impulse;
  p.vy += Math.sin(p.facing) * impulse;
  const speed = Math.hypot(p.vx, p.vy);
  if (speed > maxSpeed) {
    p.vx = (p.vx / speed) * maxSpeed;
    p.vy = (p.vy / speed) * maxSpeed;
  }
  p.pushTimer = 0.18;
  p.anim += 0.65;
}

function jumpPlayer() {
  if (state.screen !== 'playing') return;
  const p = state.player;
  if (p.z > 0.01 || p.bail > 0) return;
  const course = getEventCourse();
  if (state.mode === 'event' && state.event?.id === 'RAMP' && course) {
    rampContextAction(course);
    return;
  }
  p.z = 0.02;
  p.vz = shops[1].bought ? 8.8 : 7.2;
  p.spinScore = 0;
  audio.msg();
}

function keyDown(e) {
  const k = e.key.toLowerCase();
  state.keys.add(k);
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'shift', 'z', 'x'].includes(k)) e.preventDefault();

  if (k === 'enter') activatePrimaryAction();
  if (k === 'h' && (state.screen === 'menu' || state.screen === 'gameOver')) state.screen = 'highScores';
  if (k === 'escape') state.screen = 'menu';
  if (k === 'p' && (state.screen === 'playing' || state.screen === 'paused')) state.screen = state.screen === 'playing' ? 'paused' : 'playing';
  if (k === 'm') state.mapTimer = 2.5;
  if ((k === 'z' || k === 'shift') && !e.repeat) pushPlayer();
  if ((k === 'x' || k === ' ') && !e.repeat) jumpPlayer();
}

function keyUp(e) {
  state.keys.delete(e.key.toLowerCase());
}

function pointerDown(e) {
  if (state.screen !== 'playing') {
    e.preventDefault();
    activatePrimaryAction();
  }
}

function renderGameToText() {
  const projection = activeProjection();
  const playerScreen = worldToScreen(state.player.x, state.player.y);
  const visual = getPlayerVisualState();
  const activeCourse = getEventCourse();
  const eventProgress = state.event?.id === 'RAMP'
    ? (state.eventRun?.progress || 0)
    : activeCourse
    ? clamp((state.player.y - activeCourse.startY) / (activeCourse.finishY - activeCourse.startY), 0, 1)
    : 0;
  const rampState = state.eventRun?.ramp || null;
  return JSON.stringify({
    coordinateSystem: 'world origin top-left, x right, y down; rendered isometric',
    screen: state.screen,
    mode: state.mode,
    score: state.score,
    cash: state.cash,
    tickets: state.tickets,
    nextTicketScore: state.nextTicketScore,
    classLevel: state.classLevel,
    timer: state.mode === 'event' ? state.eventTimer : state.cityTimer,
    message: state.messageTimer > 0 ? state.message : '',
    player: {
      x: Number(state.player.x.toFixed(2)),
      y: Number(state.player.y.toFixed(2)),
      vx: Number(state.player.vx.toFixed(3)),
      vy: Number(state.player.vy.toFixed(3)),
      z: Number(state.player.z.toFixed(2)),
      facing: Number(state.player.facing.toFixed(3)),
      speed: Number(Math.hypot(state.player.vx, state.player.vy).toFixed(3)),
      pushTimer: Number(state.player.pushTimer.toFixed(2)),
    },
    camera: {
      x: Number(state.camera.x.toFixed(3)),
      y: Number(state.camera.y.toFixed(3)),
    },
    projection: {
      tileW: projection.tileW,
      tileH: projection.tileH,
      anchorX: projection.anchorX,
      anchorY: projection.anchorY,
      maxCameraStep: projection.maxCameraStep,
    },
    visual: {
      playerScreenX: Number(playerScreen.x.toFixed(1)),
      playerScreenY: Number(playerScreen.y.toFixed(1)),
      spriteKey: visual.spriteKey,
      spriteSheet: visual.atlas.sheet,
      spriteRow: visual.atlas.row,
      spriteCol: visual.atlas.col,
      spriteAtlasReady: skaterAtlasReady(),
      direction: visual.dir,
      directionLabel: DIRECTION_LABELS[visual.dir],
      worldFacing: Number(visual.visualFacing.toFixed(3)),
      screenFacing: Number(visual.screenFacing.toFixed(3)),
      frame: visual.frame,
      boardAngle: Number(visual.boardAngle.toFixed(3)),
      airborne: visual.airborne,
      eventPose: visual.eventPose,
      eventTrick: visual.eventTrick,
    },
    currentEvent: state.event?.id || null,
    eventRun: state.eventRun ? {
      id: state.eventRun.id,
      progress: Number(eventProgress.toFixed(3)),
      checkpoints: Array.from(state.eventRun.checkpoints),
      ramps: Array.from(state.eventRun.ramps),
      targets: Array.from(state.eventRun.targets),
      pose: state.eventRun.pose,
      trick: state.eventRun.trick,
      courseSpeed: Number((state.eventRun.courseSpeed || 0).toFixed(3)),
      ducking: Boolean(state.eventRun.ducking),
      sectionIndex: state.eventRun.sectionIndex || 0,
      landingStatus: state.eventRun.landingStatus || '',
      ramp: rampState ? {
        cross: Number(rampState.cross.toFixed(2)),
        along: Number(rampState.along.toFixed(2)),
        crossVel: Number(rampState.crossVel.toFixed(2)),
        alongVel: Number(rampState.alongVel.toFixed(2)),
        surfaceHeight: Number(rampState.surface.toFixed(2)),
        airZ: Number(rampState.airZ.toFixed(2)),
      } : null,
    } : null,
    events: events.map((e) => ({ id: e.id, x: e.x, y: e.y })),
    shops: shops.map((s) => ({ id: s.id, x: s.x, y: s.y, bought: s.bought, price: s.price })),
    hazards: hazards.map((h) => ({ type: h.type, x: Number(h.x.toFixed(2)), y: Number(h.y.toFixed(2)) })),
    bees: state.bees.length,
  });
}

function setVisualCaptureScenario(name) {
  startRun();
  state.messageTimer = 0;
  state.gateCooldown = 0;
  state.mapTimer = 0;
  state.shake = 0;
  state.eventRun = null;
  state.player.vx = 0;
  state.player.vy = 0;
  state.player.z = 0;
  state.player.vz = 0;
  state.player.bail = 0;
  state.player.invuln = 0;
  state.player.facing = -Math.PI / 2;
  state.player.pushTimer = 0;
  setCameraPosition(CENTER.x, CENTER.y);

  if (name === 'shop') {
    state.player.x = shops[1].x;
    state.player.y = shops[1].y + 1.05;
    setCameraPosition(state.player.x, state.player.y);
    state.message = 'HOT SHOES SHOP $150';
    state.messageTimer = 2;
  } else if (name === 'airborne') {
    state.player.x = CENTER.x + 1.8;
    state.player.y = CENTER.y + 0.8;
    state.player.z = 1.7;
    state.player.spin = 1.4;
    state.player.facing = Math.PI / 4;
    state.player.anim = 3;
    setCameraPosition(state.player.x, state.player.y);
  } else if (name === 'bail') {
    state.player.x = CENTER.x + 2.2;
    state.player.y = CENTER.y + 1.1;
    state.player.bail = 1;
    state.message = 'WIPEOUT';
    state.messageTimer = 2;
    setCameraPosition(state.player.x, state.player.y);
  } else if (name === 'map') {
    state.mapTimer = 3;
  } else if (name === 'chase') {
    state.cityTimer = 0;
    state.message = 'SKATE OR DIE';
    state.messageTimer = 2;
    state.player.x = CENTER.x + 1.4;
    state.player.y = CENTER.y + 1.4;
    setCameraPosition(state.player.x, state.player.y);
    state.bees = Array.from({ length: 7 }, (_, i) => ({
      x: state.player.x + 2.4 + (i % 3) * 0.55,
      y: state.player.y - 2.1 + Math.floor(i / 3) * 0.5,
    }));
  } else if (name.startsWith('event-') || name.startsWith('ramp-') || name.startsWith('downhill-') || name.startsWith('jump-')) {
    const scenarioEvent = name.startsWith('ramp-')
      ? 'RAMP'
      : name.startsWith('downhill-')
        ? 'DOWNHILL'
        : name.startsWith('jump-')
          ? 'JUMP'
          : name.replace('event-', '').toUpperCase();
    const eventId = scenarioEvent;
    const eventDef = events.find((e) => e.id === eventId) || events[0];
    const course = EVENT_COURSES[eventDef.id];
    state.mode = 'event';
    state.event = eventDef;
    state.eventRun = makeEventRun(eventDef.id);
    state.eventTimer = eventDef.seconds * 0.62;
    const sampleY = course
      ? eventDef.id === 'RAMP'
        ? course.halfpipe.centerY
        : eventDef.id === 'JUMP'
          ? course.ramps[1].y
          : course.startY + 18
      : CENTER.y + 6.8;
    state.player.x = course ? eventCourseCenter(eventDef.id, sampleY) : CENTER.x + 1.4;
    state.player.y = sampleY;
    if (course) state.eventRun.progress = eventDef.id === 'RAMP'
      ? clamp((eventDef.seconds - state.eventTimer) / eventDef.seconds, 0, 1)
      : clamp((sampleY - course.startY) / (course.finishY - course.startY), 0, 1);
    state.player.facing = course ? Math.PI / 2 : -Math.PI / 2;
    if (eventDef.id === 'RAMP' && state.eventRun?.ramp) {
      const ramp = state.eventRun.ramp;
      const hp = course.halfpipe;
      ramp.along = CENTER.x;
      ramp.cross = hp.centerY;
      ramp.crossVel = 4.1;
      ramp.alongVel = 0.9;
      if (name === 'ramp-grind') {
        ramp.cross = hp.copingTopY;
        ramp.crossVel = 0;
        ramp.alongVel = 4.2;
        ramp.grindSide = -1;
        state.eventRun.trick = 'grind';
        state.eventRun.pose = 'grind';
      } else if (name === 'ramp-air') {
        ramp.cross = hp.copingBottomY - 0.9;
        ramp.crossVel = -3.8;
        ramp.airZ = 1.8;
        ramp.airVz = 2.6;
        state.player.z = ramp.airZ;
        state.player.vz = ramp.airVz;
        state.player.spin = 1.1;
        state.eventRun.pose = 'air-spin';
      } else if (name === 'ramp-handplant') {
        ramp.cross = hp.copingBottomY;
        ramp.crossVel = 0;
        state.eventRun.trick = 'handplant';
        state.eventRun.pose = 'handplant';
        state.eventRun.trickTimer = 0.5;
      } else if (name === 'ramp-rock') {
        ramp.cross = hp.copingTopY;
        ramp.crossVel = 1.0;
        state.eventRun.trick = 'rock';
        state.eventRun.pose = 'rock';
        state.eventRun.trickTimer = 0.5;
      }
      state.player.x = ramp.along;
      state.player.y = ramp.cross;
    }
    if (eventDef.id === 'DOWNHILL') {
      if (name === 'downhill-duck') {
        state.player.y = 36;
        state.player.x = eventCourseCenter('DOWNHILL', 36);
        state.eventRun.courseSpeed = 6.4;
        state.eventRun.ducking = true;
        state.eventRun.pose = 'duck';
      } else if (name === 'downhill-turn') {
        state.player.y = 24;
        state.player.x = eventCourseCenter('DOWNHILL', 24) + 3.2;
        state.eventRun.courseSpeed = 5.2;
      }
    }
    if (eventDef.id === 'JUMP') {
      if (name === 'jump-approach') {
        const ramp = course.ramps[0];
        state.player.x = ramp.x;
        state.player.y = ramp.y - ramp.approach * 0.55;
        state.eventRun.courseSpeed = 5.8;
      } else if (name === 'jump-launch') {
        const ramp = course.ramps[1];
        state.player.x = ramp.x;
        state.player.y = ramp.y;
        state.player.z = 0.8;
        state.player.vz = 5.6;
        state.eventRun.courseSpeed = 6.2;
        state.eventRun.launchIndex = 1;
        state.eventRun.landingStatus = 'airborne';
      } else if (name === 'jump-target') {
        const target = course.targets[2];
        state.player.x = target.x;
        state.player.y = target.y;
        state.eventRun.courseSpeed = 4.8;
        state.eventRun.targets.add(2);
        state.eventRun.landingStatus = 'target';
      }
    }
    markScenarioPassedCheckpoints(course);
    if (name.startsWith('ramp-') || name.startsWith('downhill-') || name.startsWith('jump-')) {
      state.messageTimer = 0;
    }
    setCameraPosition(state.player.x, state.player.y);
    if (state.messageTimer > 0) state.message = `${eventDef.id} PARK`;
  }
  updateCamera();
  render();
  return renderGameToText();
}

function markScenarioPassedCheckpoints(course) {
  if (!course?.checkpoints || !state.eventRun) return;
  course.checkpoints.forEach((checkpoint, index) => {
    if (state.player.y >= checkpoint.y - 1.6) state.eventRun.checkpoints.add(index);
  });
}

window.render_game_to_text = renderGameToText;
window.advanceTime = (ms) => {
  const steps = Math.max(1, Math.round(ms / (1000 / 60)));
  for (let i = 0; i < steps; i++) update(1 / 60);
  render();
};
window.__skate720_visualCapture = {
  scenario: setVisualCaptureScenario,
  assetsReady: skaterAtlasReady,
};

window.addEventListener('keydown', keyDown);
window.addEventListener('keyup', keyUp);
canvas.addEventListener('pointerdown', pointerDown);

updateHud();
requestAnimationFrame(frame);
