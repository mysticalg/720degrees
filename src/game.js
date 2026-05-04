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
    playerImageScale: 1.45,
    boardLength: 50,
    note: 'Measured against city_scroll: broad offscreen streets/sidewalks with the player below center.',
  },
  events: {
    RAMP: { tileW: 178, tileH: 89, anchorX: 0.53, anchorY: 0.58, deadZone: 0.03, follow: 0.24, maxCameraStep: 0.095, cameraEase: 0.24, playerSpriteScale: 3, playerImageScale: 1.45 },
    DOWNHILL: { tileW: 170, tileH: 85, anchorX: 0.51, anchorY: 0.60, deadZone: 0.035, follow: 0.24, maxCameraStep: 0.095, cameraEase: 0.24, playerSpriteScale: 3, playerImageScale: 1.45 },
    SLALOM: { tileW: 174, tileH: 87, anchorX: 0.52, anchorY: 0.60, deadZone: 0.035, follow: 0.24, maxCameraStep: 0.095, cameraEase: 0.24, playerSpriteScale: 3, playerImageScale: 1.45 },
    JUMP: { tileW: 172, tileH: 86, anchorX: 0.52, anchorY: 0.60, deadZone: 0.035, follow: 0.24, maxCameraStep: 0.095, cameraEase: 0.24, playerSpriteScale: 3, playerImageScale: 1.45 },
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
  DOWNHILL: {
    length: 72,
    startY: 4.5,
    finishY: 67,
    minX: 5.5,
    maxX: 30.5,
    autoSpeed: 2.35,
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
    autoSpeed: 2.12,
    checkpoints: [
      { y: 14, points: 150 },
      { y: 28, points: 180 },
      { y: 42, points: 220 },
      { y: 58, points: 280 },
    ],
    ramps: [
      { x: 18.5, y: 13.2, w: 6.5, h: 2.2, points: 220 },
      { x: 13.6, y: 27.4, w: 6.2, h: 2.2, points: 260 },
      { x: 22.0, y: 43.2, w: 6.6, h: 2.2, points: 320 },
      { x: 16.5, y: 59.4, w: 7.0, h: 2.4, points: 420 },
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
const DIRECTION_LABELS = ['E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW', 'N', 'NNE', 'NE', 'ENE'];
const SKATER_SPRITES = createSkaterSprites();
const SKATER_ATLAS = createSkaterAtlas();
const TEXTURES = createTextureCache();
const ATLAS = createPixelAtlas();

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
  return {
    id: eventId,
    progress: 0,
    checkpoints: new Set(),
    obstacles: new Set(),
    ramps: new Set(),
    targets: new Set(),
    wasAirborne: false,
  };
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
      minY: 1.5,
      maxY: course.length - 1.5,
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
  return SKATER_ATLAS.roll.ready && SKATER_ATLAS.jump.ready && SKATER_ATLAS.bail.ready;
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
  state.player.x = CENTER.x;
  state.player.y = state.eventRun ? EVENT_COURSES[eventDef.id].startY : CENTER.y + 4;
  state.player.vx = 0;
  state.player.vy = state.eventRun ? 0.12 : -0.18;
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
  const id = course === EVENT_COURSES.DOWNHILL ? 'DOWNHILL' : 'JUMP';
  const autoSpeed = course.autoSpeed + Math.min(0.35, state.classLevel * 0.025);

  if (p.bail <= 0) {
    p.y = Math.min(course.length - 1.5, p.y + autoSpeed * dt);
  }

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
    if (p.z < 0.35 && dist(p.x, p.y, obstacle.x, obstacle.y) < (obstacle.type === 'barrier' ? 1.1 : 0.75)) {
      run.obstacles.add(index);
      p.vx *= -0.5;
      p.vy *= -0.45;
      courseCrash('WIPEOUT', 140);
    }
  });

  course.ramps?.forEach((ramp, index) => {
    if (run.ramps.has(index)) return;
    if (p.z <= 0.05 && pointInCourseRect(p.x, p.y, ramp)) {
      run.ramps.add(index);
      p.z = 0.04;
      p.vz = shops[1].bought ? 9.6 : 8.4;
      p.spinScore = 0;
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
    course.targets?.forEach((target, index) => {
      if (run.targets.has(index)) return;
      if (dist(p.x, p.y, target.x, target.y) <= target.r) {
        run.targets.add(index);
        awardScore(target.points, 'TARGET');
      }
    });
  }
  run.wasAirborne = p.z > 0.02;
  run.progress = clamp((p.y - course.startY) / (course.finishY - course.startY), 0, 1);
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
  drawIsoTexturedRect(0, 0, WORLD_W, WORLD_H, TEXTURES.concrete, '#ffffff10', '#8f9298', 2);
  drawConcreteSeams(0, 0, WORLD_W, WORLD_H, 5.6, '#9ca0a866');

  drawIsoTexturedRect(0, 15.45, WORLD_W, 5.1, TEXTURES.asphalt, '#00000018', '#0f141d', 2);
  drawIsoTexturedRect(15.45, 0, 5.1, WORLD_H, TEXTURES.asphalt, '#00000022', '#0f141d', 2);
  drawIsoTexturedRect(0, 8.7, WORLD_W, 2.35, TEXTURES.asphalt, '#00000016', '#151923', 2);
  drawIsoTexturedRect(0, 25.1, WORLD_W, 2.35, TEXTURES.asphalt, '#00000016', '#151923', 2);
  drawIsoTexturedRect(8.7, 0, 2.35, WORLD_H, TEXTURES.asphalt, '#00000016', '#151923', 2);
  drawIsoTexturedRect(25.1, 0, 2.35, WORLD_H, TEXTURES.asphalt, '#00000016', '#151923', 2);
  drawRoadCurbs();
  drawRoadDashes();

  drawIsoRect(0, 0, 5.8, 9.8, '#07520c', '#032807', 2);
  drawIsoRect(30.1, 0, 5.9, 9.8, '#07520c', '#032807', 2);
  drawIsoRect(0, 27.2, 8.2, 8.8, '#07520c', '#032807', 2);
  drawIsoRect(27.2, 27.1, 8.8, 8.9, '#07520c', '#032807', 2);

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

function drawReferenceCityDetails() {
  drawSidewalkCurb(13.2, 13.2, 3.7, 1.1);
  drawSidewalkCurb(19.6, 21.7, 4.2, 1.1);
  drawSidewalkCurb(12.3, 19.4, 1.1, 4.2);
  drawSidewalkCurb(22.7, 12.2, 1.1, 4.5);
  drawIsoTexturedRect(5.6, 18.7, 3.1, 2.1, TEXTURES.water, '#0ad6e744', '#056f80', 2);
  drawIsoTexturedRect(27.0, 13.8, 3.3, 2.2, TEXTURES.water, '#0ad6e744', '#056f80', 2);
  drawCyanBowl(8.6, 27.4, 2.4, 1.55);
  drawCyanBowl(28.0, 8.4, 2.8, 1.75);
  drawArcadeSign(14.2, 20.3, ['SKATE', 'OR DIE!']);
  drawArcadeSign(25.7, 15.2, ['SKATE', 'OR DIE!']);
  drawPayHerePad(30.5, 7.9, 'PAY HERE');
  drawPayHerePad(6.2, 29.4, 'PAY HERE');
}

function drawCyanBowl(x, y, rw, rh) {
  const p = worldToScreen(x, y);
  const projection = activeProjection();
  drawFacetedPool(p.x, p.y - 10, rw * projection.tileW * 0.36, rh * projection.tileH * 0.62);
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
  ctx.drawImage(ATLAS.payPad, p.x - 54, p.y - 72, 108, 34);
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
  ctx.drawImage(ATLAS.payPad, p.x - 50, p.y - 20, 100, 32);
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
  drawIsoTexturedRect(1.5, 0, 33.5, 36, TEXTURES.ramp, '#d8934a18', '#9c6f55', 2);
  drawConcreteSeams(1.5, 0, 33.5, 36, 3.2, '#ac806a88');
  drawSpeckleField(2, 0, 32, 36, '#755e5866', 170);

  drawIsoWall(1.6, 3.2, 9.2, 6.9, 156, '#b93734', '#8e2528', '#641923');
  drawBrickFace(1.6, 10.1, 9.2, 156);
  drawIsoWall(21.3, 3.8, 10.6, 5.4, 118, '#b93734', '#8e2528', '#641923');
  drawBrickFace(21.3, 9.2, 10.6, 118);

  drawIsoTexturedRect(5.1, 8.4, 26.4, 24.8, TEXTURES.tan, '#9c542d22', '#7e4d35', 2);
  drawIsoTexturedRect(6.5, 9.7, 23.4, 22.2, TEXTURES.ramp, '#f3cf9d30', '#a9775d', 2);
  drawIsoTexturedRect(9.4, 12.3, 17.8, 16.6, TEXTURES.ramp, '#ffe1b533', '#c89170', 2);

  drawRampTransitionBand(7.2, 9.4, 22.6, false);
  drawRampTransitionBand(7.2, 31.0, 22.6, true);
  drawIsoRect(7.0, 9.1, 23.0, 1.0, '#f3b118', '#8e5b14', 2);
  drawIsoRect(7.0, 31.1, 23.0, 1.0, '#f3b118', '#8e5b14', 2);
  for (let i = 0; i < 9; i++) {
    const y = 12.2 + i * 1.85;
    drawIsoLine(9.2, y, 27.1, y);
  }

  drawRampLattice(4.2, 8.8, 31.2, 8.8, 62);
  drawRampLattice(4.2, 32.2, 31.2, 32.2, -62);
  drawWoodRail(4.2, 8.4, 31.2, 8.4);
  drawWoodRail(4.2, 32.5, 31.2, 32.5);
  drawIsoTexturedRect(5.4, 19.2, 26.2, 4.0, TEXTURES.tan, '#c36a2d28', '#8f5435', 2);
  drawIsoTexturedRect(7.0, 23.0, 22.8, 7.2, TEXTURES.ramp, '#ffe0ac38', '#bc876a', 2);
  drawIsoRect(7.2, 22.1, 22.8, 0.95, '#f2b218', '#865717', 2);
  drawIsoRect(7.2, 30.1, 22.8, 0.95, '#f2b218', '#865717', 2);
  drawRampLattice(4.8, 21.9, 31.0, 21.9, 50);
  drawRampLattice(4.8, 30.8, 31.0, 30.8, -50);
  drawWoodRail(4.8, 21.6, 31.0, 21.6);
  drawWoodRail(4.8, 31.0, 31.0, 31.0);
  drawRampArrow(17.8, 25.6, false);
  drawEventDeckPatch(18, 20.5, '#f0a04a');
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
  drawIsoTexturedRect(0, 0, 36, course.length, TEXTURES.wall, '#9c9bb722', null, 0);
  drawCourseRibbon('DOWNHILL', 0, course.length, 3.2, TEXTURES.tan, '#cf73352b', '#7b3b29');
  drawCourseInnerLine('DOWNHILL', 2, course.length - 2, 5.4, '#f4b518');
  drawCourseRails('DOWNHILL', 0, course.length, 4);

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
  drawIsoTexturedRect(5.4, 1.6, 25.2, 32.8, TEXTURES.tan, '#65281f22', '#64281f', 2);
  drawIsoTexturedRect(6, 2, 24, 32, TEXTURES.tan, '#c5743d22', '#87432b', 2);
  drawIsoTexturedRect(10, 2, 6, 32, TEXTURES.tan, '#f0a04728', '#a95a30', 1);
  drawIsoTexturedRect(16.5, 2, 3.0, 32, TEXTURES.tan, '#ffb34a33', '#aa6332', 1);
  drawIsoTexturedRect(20, 2, 5, 32, TEXTURES.tan, '#b8613728', '#8d3f2b', 1);
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
  drawIsoTexturedRect(0, 0, 36, course.length, TEXTURES.wall, '#c8c9d922', null, 0);
  drawCourseRibbon('JUMP', 0, course.length, 3.8, TEXTURES.tan, '#d9893b26', '#8f552f');
  drawCourseRails('JUMP', 0, course.length, 4.5);

  course.water.forEach((pool) => {
    drawIsoTexturedRect(pool.x - pool.w * 0.5, pool.y - pool.h * 0.5, pool.w, pool.h, TEXTURES.water, '#1f93d433', '#164e7d', 2);
    drawIsoTexturedRect(pool.x - pool.w * 0.36, pool.y - pool.h * 0.36, pool.w * 0.72, pool.h * 0.72, TEXTURES.water, '#2faee833', '#1978a8', 1);
  });

  course.ramps.forEach((ramp, index) => {
    drawIsoRect(ramp.x - ramp.w * 0.5, ramp.y - ramp.h * 0.5, ramp.w, ramp.h, '#e8c12e', '#8b6818', 2);
    drawTurnArrowMark(ramp.x, ramp.y + 0.4, index % 2 === 0);
  });
  course.targets.forEach((target, index) => drawLandingTarget(target.x, target.y, index === course.targets.length - 1 ? 1.05 : 0.82));
  course.checkpoints.forEach((checkpoint, index) => {
    const center = eventCourseCenter('JUMP', checkpoint.y);
    drawIsoRect(center - 3.2, checkpoint.y - 0.45, 6.4, 0.9, index % 2 ? '#c7cbd3' : '#e6e9ef', '#6f7480', 1);
  });
  drawCourseInnerLine('JUMP', 5, course.length - 4, 7.2, '#d5d9df');
  drawFinishPad('JUMP', course.finishY);
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
  drawCheckpointStripes(center - half * 0.72, y - 0.9, half * 1.44, 1.8);
  drawBitmapTextShadow('FINISH', worldToScreen(center, y).x, worldToScreen(center, y).y - 52, 4, '#f6d04f', 'center');
}

function drawCourseObstacle(obstacle) {
  const p = worldToScreen(obstacle.x, obstacle.y);
  if (obstacle.type === 'barrier') {
    drawIsoRect(obstacle.x - 1.25, obstacle.y - 0.35, 2.5, 0.7, '#562a1e', '#2b120f', 1);
    ctx.fillStyle = '#f4d34b';
    ctx.fillRect(p.x - 20, p.y - 36, 40, 8);
    ctx.fillStyle = '#672015';
    ctx.fillRect(p.x - 18, p.y - 34, 8, 4);
    ctx.fillRect(p.x + 4, p.y - 34, 8, 4);
    return;
  }
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
  const stripeW = w / 9;
  for (let i = 0; i < 9; i++) {
    drawIsoRect(x + i * stripeW, y, stripeW * 0.72, h, i % 2 ? '#5e281b' : '#ffd033', null, 0);
  }
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
    ctx.drawImage(ATLAS.orangeRamp, -38, -14, 76, 28);
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
  drawIsoRect(shop.x - 1.9, shop.y - 0.82, 3.8, 1.5, '#182332', '#e5edf4', 2);
  drawIsoWall(shop.x - 1.72, shop.y - 1.58, 0.88, 1.72, closed ? 70 : 98, closed ? '#777f8a' : '#16cbd4', '#0f8490', '#0a5c6e');
  drawIsoWall(shop.x - 0.72, shop.y - 1.75, 0.92, 1.86, closed ? 78 : 116, closed ? '#707984' : '#1edbe4', '#1098a2', '#0d687b');
  drawIsoWall(shop.x + 0.35, shop.y - 1.55, 0.92, 1.68, closed ? 68 : 94, closed ? '#6d7580' : '#12b5c7', '#0d7f8b', '#0b5c70');
  drawShopWindows(p, closed);
  drawShopPad(shop.x, shop.y + 0.88, label);
  drawBitmapTextShadow(closed ? 'SOLD' : label, p.x, p.y - 112, label.length > 8 ? 3 : 4, closed ? '#c7ccd4' : '#fff45e', 'center');
}

function drawShopWindows(p, closed) {
  const windowColor = closed ? '#394454' : '#1e3f72';
  ctx.fillStyle = '#0b223e';
  ctx.fillRect(p.x - 58, p.y - 108, 96, 18);
  ctx.fillStyle = windowColor;
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(p.x - 52 + i * 18, p.y - 101, 10, 22);
  }
  ctx.fillStyle = closed ? '#8b929c' : '#8cff42';
  for (let i = 0; i < 8; i++) {
    ctx.fillRect(p.x - 56 + i * 13, p.y - 72, 4, 5);
    if (i % 2 === 0) ctx.fillRect(p.x - 54 + i * 13, p.y - 60, 4, 5);
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
  } else if (airborne) {
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
  const imageScale = activeProjection().playerImageScale || 1;
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
  ctx.fillStyle = '#2442b4';
  ctx.fillRect(VIEW.x, VIEW.y, VIEW.w, VIEW.h);
  ctx.translate(VIEW.x + VIEW.w / 2, VIEW.y + VIEW.h / 2);
  ctx.rotate(-0.34);
  fillScreenPoly(0, 0, [
    [-390, -18],
    [-332, -100],
    [-210, -146],
    [-12, -168],
    [178, -148],
    [314, -90],
    [390, -14],
    [364, 64],
    [210, 134],
    [12, 168],
    [-210, 148],
    [-346, 92],
  ], '#e6e11a', '#b3a909', 5);

  ctx.strokeStyle = '#4d4d5e';
  ctx.lineWidth = 18;
  ctx.beginPath();
  ctx.moveTo(-330, 0);
  ctx.lineTo(330, 0);
  ctx.stroke();
  for (const wx of [-345, 345]) {
    for (const wy of [-95, 95]) drawMapTruck(wx, wy);
  }

  ctx.rotate(0.34);
  const blocks = [
    [-160, -60, '#dc3934', 'DOWNHILL'],
    [-100, 18, '#6aa9e9', 'JUMP'],
    [88, -55, '#6aa9e9', 'RAMP'],
    [155, 18, '#dc3934', 'SLALOM'],
  ];
  ctx.textAlign = 'center';
  for (const [bx, by] of blocks) {
    drawMapCourseSlats(bx, by);
  }
  for (const [bx, by, color, label] of blocks) {
    drawMapCourseBlock(bx, by, color, label);
  }

  const px = (state.player.x / WORLD_W - 0.5) * 520;
  const py = (state.player.y / WORLD_H - 0.5) * 230;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(px, py, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#10235e';
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = '#0525d8';
  ctx.fillRect(VIEW.x + 610, 520, 285, 132);
  ctx.strokeStyle = '#07135d';
  ctx.lineWidth = 4;
  ctx.strokeRect(VIEW.x + 610, 520, 285, 132);
  drawBitmapText('EQUIPMENT LEVELS:', VIEW.x + 752, 536, 4, '#ffffff', 'center');
  shops.forEach((s, i) => {
    drawBitmapText(`${s.id}: ${s.bought ? 1 : 0}`, VIEW.x + 752, 570 + i * 24, 4, '#ffffff', 'center');
  });
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
  const eventProgress = activeCourse
    ? clamp((state.player.y - activeCourse.startY) / (activeCourse.finishY - activeCourse.startY), 0, 1)
    : 0;
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
    },
    currentEvent: state.event?.id || null,
    eventRun: state.eventRun ? {
      id: state.eventRun.id,
      progress: Number(eventProgress.toFixed(3)),
      checkpoints: Array.from(state.eventRun.checkpoints),
      ramps: Array.from(state.eventRun.ramps),
      targets: Array.from(state.eventRun.targets),
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
  } else if (name.startsWith('event-')) {
    const eventId = name.replace('event-', '').toUpperCase();
    const eventDef = events.find((e) => e.id === eventId) || events[0];
    const course = EVENT_COURSES[eventDef.id];
    state.mode = 'event';
    state.event = eventDef;
    state.eventRun = makeEventRun(eventDef.id);
    state.eventTimer = eventDef.seconds * 0.62;
    const sampleY = course
      ? eventDef.id === 'JUMP'
        ? course.ramps[1].y
        : course.startY + 18
      : CENTER.y + 6.8;
    state.player.x = course ? eventCourseCenter(eventDef.id, sampleY) : CENTER.x + 1.4;
    state.player.y = sampleY;
    if (course) state.eventRun.progress = clamp((sampleY - course.startY) / (course.finishY - course.startY), 0, 1);
    state.player.facing = course ? Math.PI / 2 : -Math.PI / 2;
    setCameraPosition(state.player.x, state.player.y);
    state.message = `${eventDef.id} PARK`;
    state.messageTimer = 1.4;
  }
  updateCamera();
  render();
  return renderGameToText();
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
