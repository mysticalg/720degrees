/**
 * Skate 720: Park Circuit
 * -------------------------------------------------
 * Large isometric skatepark game with colorful park zones,
 * four course loops, shop progression, and animated 360 skater rendering.
 *
 * Implementation notes:
 * - Keeps rendering efficient by drawing only visible map tiles.
 * - Uses camera tracking so the map can be much larger than the viewport.
 * - Includes inline comments for maintainability and easy customization.
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const hud = {
  tickets: document.getElementById('hudTickets'),
  score: document.getElementById('hudScore'),
  course: document.getElementById('hudCourse'),
  time: document.getElementById('hudTime'),
  difficulty: document.getElementById('hudDifficulty'),
};

// Zoomed-in playfield scaling to better match arcade feel.
const TILE_W = 112;
const TILE_H = 56;
const WORLD_W = 30;
const WORLD_H = 30;

const difficulties = {
  easy: { speed: 3.1, timer: 180, ticketMultiplier: 1.25 },
  normal: { speed: 3.7, timer: 150, ticketMultiplier: 1 },
  hard: { speed: 4.25, timer: 130, ticketMultiplier: 0.82 },
};

const courses = [
  { id: 'A', color: '#56ddff', name: 'Street Warmup' },
  { id: 'B', color: '#ffa36a', name: 'Bowl Circuit' },
  { id: 'C', color: '#80ffa9', name: 'Ramp Matrix' },
  { id: 'D', color: '#ff7de0', name: 'Pro Gauntlet' },
];

const PARK_CENTER = { x: WORLD_W * 0.5, y: WORLD_H * 0.5 };

const state = {
  screen: 'splash',
  optionDifficulty: 'normal',
  optionTicketBase: 8,
  courseIndex: 0,
  timeLeft: 150,
  tickets: 0,
  score: 0,
  keys: new Set(),
  boost: 0,
  flash: 0,
  camera: { x: PARK_CENTER.x, y: PARK_CENTER.y },
  mapStyle: [],
  shops: [],
  gates: [],
  ticketsOnMap: [],
  highScores: loadHighScores(),
  player: {
    x: PARK_CENTER.x,
    y: PARK_CENTER.y,
    vx: 0,
    vy: 0,
    facing: 0,
    frame: 0,
    spin: 0,
    spinVel: 0,
    z: 0,
    vz: 0,
    airSpin: 0,
    animTick: 0,
    dirIndex: 0,
  },
};

const audio = createAudio();
const skaterSprites = createSkaterSpriteAtlas();

/** Convert world isometric coordinates into screen coordinates with camera tracking. */
function worldToScreen(x, y) {
  const dx = x - state.camera.x;
  const dy = y - state.camera.y;
  return {
    x: canvas.width * 0.5 + (dx - dy) * TILE_W * 0.5,
    // Keep skater lower on screen so forward area is visible while scrolling.
    y: canvas.height * 0.62 + (dx + dy) * TILE_H * 0.5,
  };
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function loadHighScores() {
  const fallback = [
    { name: 'ACE', score: 22000 },
    { name: 'PIX', score: 18000 },
    { name: 'SK8', score: 14500 },
    { name: 'AIR', score: 11000 },
    { name: 'RAD', score: 8500 },
  ];
  try {
    return JSON.parse(localStorage.getItem('skate720_highscores')) ?? fallback;
  } catch {
    return fallback;
  }
}

function saveHighScores() {
  localStorage.setItem('skate720_highscores', JSON.stringify(state.highScores));
}

function normalizeAngle(a) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

/**
 * Build a tiny procedural sprite atlas so character animation stays smooth.
 * 16 direction slices × 6 movement frames.
 *
 * The skater now has clearer personality details (face, backwards cap, shorts,
 * and shoes) so the rider is easier to read while moving and spinning.
 */
function createSkaterSpriteAtlas() {
  const dirs = 16;
  const frames = 6;
  const atlas = Array.from({ length: dirs }, () => []);

  for (let dir = 0; dir < dirs; dir++) {
    const angle = (Math.PI * 2 * dir) / dirs;
    const fx = Math.cos(angle);
    const fy = Math.sin(angle);

    for (let frame = 0; frame < frames; frame++) {
      const c = document.createElement('canvas');
      c.width = 112;
      c.height = 112;
      const g = c.getContext('2d');
      g.translate(56, 63);

      const stride = Math.sin((frame / frames) * Math.PI * 2);
      const arm = stride * 5;
      const leg = stride * 4;

      // Board styling tuned to match the reference look: warm orange deck,
      // subtle underside, and very low-contrast wheels.
      g.save();
      g.rotate(angle);
      g.fillStyle = '#d2872a';
      g.fillRect(-31, 31, 62, 8);
      g.fillStyle = '#b46c18';
      g.fillRect(-31, 37, 62, 3);
      g.fillStyle = '#6a3d0f';
      g.fillRect(-22, 40, 44, 2);
      g.fillStyle = '#46301a';
      [[-21, 42], [-13, 44], [13, 44], [21, 42]].forEach(([x, y]) => g.fillRect(x, y, 5, 3));
      g.restore();

      // Shirt mirrors the sample: green body with yellow center and red side accents.
      g.fillStyle = '#2eaf50';
      g.fillRect(-11, -22, 22, 23);
      g.fillStyle = '#f2cc40';
      g.fillRect(-1, -21, 3, 21);
      g.fillStyle = '#e2342f';
      g.fillRect(-10, -19, 3, 17);
      g.fillRect(7, -17, 3, 15);
      g.fillStyle = '#1e8b3f';
      g.fillRect(-11, -22, 2, 23);
      g.fillRect(9, -22, 2, 23);

      // Red/white striped shorts and legs like the screenshot outfit.
      g.fillStyle = '#ffffff';
      g.fillRect(-10, 1, 20, 9);
      g.fillStyle = '#db3434';
      for (let px = -10; px <= 8; px += 4) g.fillRect(px, 1, 2, 9);

      const leftLegY = 10 + leg * 0.34;
      const rightLegY = 10 - leg * 0.34;
      g.fillStyle = '#ffffff';
      g.fillRect(-10, leftLegY, 6, 17);
      g.fillRect(4, rightLegY, 6, 17);
      g.fillStyle = '#db3434';
      [-9, -6].forEach((x) => g.fillRect(x, leftLegY, 1, 17));
      [5, 8].forEach((x) => g.fillRect(x, rightLegY, 1, 17));

      // Chunky red shoes with bright yellow soles to match the sample silhouette.
      g.fillStyle = '#d92f2f';
      g.fillRect(-15, 26 + leg * 0.34, 11, 4);
      g.fillRect(4, 26 - leg * 0.34, 11, 4);
      g.fillStyle = '#f0ba3f';
      g.fillRect(-15, 30 + leg * 0.34, 11, 2);
      g.fillRect(4, 30 - leg * 0.34, 11, 2);

      // Thinner arms and small hands to preserve the retro sprite style.
      g.fillStyle = '#f2cfb2';
      g.fillRect(-31, -15 - arm * 0.18, 11, 3);
      g.fillRect(20, -15 + arm * 0.18, 11, 3);
      g.fillRect(-36, -13 - arm * 0.1, 5, 3);
      g.fillRect(31, -13 + arm * 0.1, 5, 3);

      // Head/hair/cap combo tuned to the screenshot proportions.
      g.fillStyle = '#f1cfab';
      g.beginPath();
      g.arc(0, -33, 9, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#d59a4d';
      g.fillRect(-8, -38, 14, 6);
      g.fillStyle = '#2f2116';
      g.fillRect(-3, -33, 2, 2);
      g.fillRect(2, -33, 2, 2);

      // Bright red cap that leans back, matching the provided reference.
      g.fillStyle = '#e02722';
      g.fillRect(-8, -45, 16, 6);
      g.fillRect(6, -43, 3, 4);

      // Direction cue highlight
      g.fillStyle = '#ffffff88';
      g.beginPath();
      g.arc(fx * 6, -33 + fy * 2, 2.4, 0, Math.PI * 2);
      g.fill();

      atlas[dir][frame] = c;
    }
  }

  return { dirs, frames, atlas };
}

function angleToDirectionIndex(angle, dirs = 16) {
  const a = (angle + Math.PI * 2) % (Math.PI * 2);
  return Math.round((a / (Math.PI * 2)) * dirs) % dirs;
}

function createAudio() {
  const ac = new (window.AudioContext || window.webkitAudioContext)();

  const beep = (freq, duration, type = 'square', gain = 0.035) => {
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    const amp = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    amp.gain.setValueAtTime(gain, now);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(amp).connect(ac.destination);
    osc.start(now);
    osc.stop(now + duration);
  };

  return {
    start() {
      if (ac.state === 'suspended') ac.resume();
      [220, 320, 430].forEach((f, i) => setTimeout(() => beep(f, 0.09, 'triangle', 0.04), i * 45));
    },
    ticket() {
      beep(680, 0.045, 'square', 0.05);
      beep(920, 0.065, 'triangle', 0.03);
    },
    crash() {
      beep(115, 0.17, 'sawtooth', 0.05);
    },
    menu() {
      beep(360, 0.06, 'triangle', 0.03);
    },
    courseClear() {
      [430, 560, 690, 870].forEach((f, i) => setTimeout(() => beep(f, 0.09, 'square', 0.04), i * 65));
    },
    spin() {
      beep(540, 0.05, 'sawtooth', 0.03);
    },
  };
}

/**
 * Park style map:
 * 0 = asphalt, 1 = bowl paint, 2 = vert zone, 3 = plaza, 4 = grass edge
 */
function buildParkStyleMap() {
  state.mapStyle = Array.from({ length: WORLD_H }, () => Array(WORLD_W).fill(0));

  for (let y = 0; y < WORLD_H; y++) {
    for (let x = 0; x < WORLD_W; x++) {
      const d = Math.hypot(x - PARK_CENTER.x, y - PARK_CENTER.y);
      if (d > 13.5) state.mapStyle[y][x] = 4;
      if (d < 9.5) state.mapStyle[y][x] = 3;
      if (d < 6.7) state.mapStyle[y][x] = 2;
      if (d < 3.8) state.mapStyle[y][x] = 1;

      // Add colorful diagonals to make the park feel designed.
      if ((x + y) % 7 === 0 && d < 12.5) state.mapStyle[y][x] = 1;
      if ((x - y + WORLD_W) % 9 === 0 && d < 11.5) state.mapStyle[y][x] = 2;
    }
  }
}

/** Build large park entities: shops, gates, and ticket paths for all courses. */
function buildPark() {
  buildParkStyleMap();

  state.shops = [
    { x: 6, y: 7, name: 'Deck Shop', color: '#8bd4ff', sold: false },
    { x: 23, y: 7, name: 'Shoe Shop', color: '#f7c87a', sold: false },
    { x: 7, y: 23, name: 'Pad Shop', color: '#7dffa7', sold: false },
    { x: 23, y: 23, name: 'Trick Shop', color: '#ff7bc5', sold: false },
  ];

  state.gates = [
    { x: PARK_CENTER.x, y: 3, course: 0 },
    { x: WORLD_W - 4, y: PARK_CENTER.y, course: 1 },
    { x: PARK_CENTER.x, y: WORLD_H - 4, course: 2 },
    { x: 3, y: PARK_CENTER.y, course: 3 },
  ];

  // Ticket ribbons: each course has a broad ring path with many pickups.
  state.ticketsOnMap = [];
  for (let c = 0; c < 4; c++) {
    const steps = 26 + c * 8;
    const radius = 4 + c * 2.9;
    for (let i = 0; i < steps; i++) {
      const angle = (Math.PI * 2 * i) / steps;
      const wobble = Math.sin(i * 0.75 + c) * 0.5;
      const x = PARK_CENTER.x + Math.cos(angle) * (radius + wobble);
      const y = PARK_CENTER.y + Math.sin(angle) * (radius * 0.75 + wobble * 0.4);
      state.ticketsOnMap.push({ x, y, active: true, course: c });
    }
  }
}

function resetRun() {
  const profile = difficulties[state.optionDifficulty];
  state.courseIndex = 0;
  state.timeLeft = profile.timer;
  state.tickets = 0;
  state.score = 0;
  state.flash = 0;
  state.player = {
    x: PARK_CENTER.x,
    y: PARK_CENTER.y,
    vx: 0,
    vy: 0,
    facing: 0,
    frame: 0,
    spin: 0,
    spinVel: 0,
    z: 0,
    vz: 0,
    airSpin: 0,
    animTick: 0,
    dirIndex: 0,
  };
  state.camera = { x: PARK_CENTER.x, y: PARK_CENTER.y };
  buildPark();
  hud.difficulty.textContent = capitalize(state.optionDifficulty);
}

function capitalize(s) {
  return s[0].toUpperCase() + s.slice(1);
}

function drawDiamond(x, y, w, h, fill, stroke = '#0008') {
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

function tileColor(tileType, x, y) {
  if (tileType === 4) return (x + y) % 2 ? '#355a3c' : '#2d4f35'; // grass
  if (tileType === 3) return (x + y) % 2 ? '#5d6d87' : '#55657d'; // plaza
  if (tileType === 2) return (x + y) % 2 ? '#4a7ed1' : '#4276c8'; // vert paint
  if (tileType === 1) return (x + y) % 2 ? '#f27fbf' : '#d86ea8'; // bowl paint
  return (x + y) % 2 ? '#4f596d' : '#444e61'; // asphalt
}

/** Draw a more realistic-looking skatepark with bowls, ramps, rails and painted lanes. */
function drawPark() {
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, '#214273');
  grad.addColorStop(1, '#0c1530');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw only visible map region for performance.
  const range = 12;
  const startX = clamp(Math.floor(state.camera.x - range), 0, WORLD_W - 1);
  const endX = clamp(Math.ceil(state.camera.x + range), 0, WORLD_W - 1);
  const startY = clamp(Math.floor(state.camera.y - range), 0, WORLD_H - 1);
  const endY = clamp(Math.ceil(state.camera.y + range), 0, WORLD_H - 1);

  for (let y = startY; y <= endY; y++) {
    for (let x = startX; x <= endX; x++) {
      const p = worldToScreen(x, y);
      const tileType = state.mapStyle[y][x];
      drawDiamond(p.x, p.y, TILE_W, TILE_H, tileColor(tileType, x, y), '#24364f');

      // Add little railings/ramps to give skatepark identity.
      if (tileType === 2 && (x + y) % 5 === 0) {
        ctx.strokeStyle = '#d4e1ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x - 14, p.y - 6);
        ctx.lineTo(p.x + 14, p.y - 6);
        ctx.stroke();
      }
      if (tileType === 1 && (x - y + WORLD_W) % 6 === 0) {
        ctx.fillStyle = '#ffd37a';
        ctx.fillRect(p.x - 3, p.y - 13, 6, 10);
      }
    }
  }

  // Course paths are colorful and scaled to the larger park.
  courses.forEach((course, idx) => {
    const radius = 95 + idx * 56;
    const center = worldToScreen(PARK_CENTER.x, PARK_CENTER.y);
    ctx.strokeStyle = course.color;
    ctx.lineWidth = 5;
    ctx.setLineDash([16, 9]);
    ctx.beginPath();
    ctx.ellipse(center.x, center.y, radius * 1.45, radius * 0.84, 0, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.setLineDash([]);

  // Shops with signs.
  for (const shop of state.shops) {
    const p = worldToScreen(shop.x, shop.y);
    drawDiamond(p.x, p.y - 16, TILE_W * 0.86, TILE_H * 0.86, '#222f4f', '#97b8ff');
    ctx.fillStyle = shop.color;
    ctx.fillRect(p.x - 42, p.y - 76, 84, 34);
    ctx.fillStyle = '#0b1020';
    ctx.font = 'bold 14px Trebuchet MS';
    ctx.textAlign = 'center';
    ctx.fillText(shop.name, p.x, p.y - 56);
    if (!shop.sold) {
      ctx.fillStyle = '#fff190';
      ctx.fillText('OPEN', p.x, p.y - 33);
    }
  }

  // Course gates.
  for (const gate of state.gates) {
    const p = worldToScreen(gate.x, gate.y);
    const c = courses[gate.course];
    ctx.strokeStyle = c.color;
    ctx.lineWidth = 5;
    ctx.strokeRect(p.x - 28, p.y - 90, 56, 90);
    ctx.fillStyle = c.color;
    ctx.fillRect(p.x - 35, p.y - 104, 70, 14);
    ctx.fillStyle = '#111f36';
    ctx.font = 'bold 13px Trebuchet MS';
    ctx.fillText(`COURSE ${c.id}`, p.x, p.y - 93);
  }

  // Tickets for active course.
  for (const ticket of state.ticketsOnMap) {
    if (!ticket.active || ticket.course !== state.courseIndex) continue;
    const p = worldToScreen(ticket.x, ticket.y);
    const bob = Math.sin(performance.now() * 0.008 + ticket.x) * 4;
    ctx.fillStyle = '#ffe366';
    ctx.strokeStyle = '#8f6d16';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y - 28 + bob, 13, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#664900';
    ctx.font = 'bold 14px Trebuchet MS';
    ctx.fillText('T', p.x, p.y - 24 + bob);
  }
}

/**
 * Draw the skater with directional/rotational animation.
 * The character can spin fully (360 degrees) and has directional leaning.
 */
function drawSkater() {
  const p = worldToScreen(state.player.x, state.player.y);
  const speed = Math.hypot(state.player.vx, state.player.vy);
  const jumpLift = state.player.z * 30;
  const bounce = Math.sin(state.player.animTick) * Math.min(3.2, speed * 18) * (state.player.z > 0 ? 0.25 : 1);

  // 16-direction sprite selection (N, NNE, NE, ...).
  const renderFacing = normalizeAngle(state.player.facing + state.player.airSpin);
  const dirIndex = angleToDirectionIndex(renderFacing, skaterSprites.dirs);
  state.player.dirIndex = dirIndex;

  // Choose animation frame: slow-roll, run-cycle, and airborne frame.
  let frameIndex = Math.floor(state.player.animTick) % skaterSprites.frames;
  if (speed < 0.025) frameIndex = 0;
  if (state.player.z > 0.02) frameIndex = 3;

  const shadowScale = 1 + state.player.z * 0.45;
  ctx.fillStyle = '#0007';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y - 8, 24 * shadowScale, 10 * shadowScale * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(p.x, p.y - 48 - jumpLift + bounce);
  if (state.player.z > 0.02 && Math.abs(state.player.spinVel) > 0.01) {
    // Rotate the rider+board together so tricks clearly read as body rotation,
    // not just a deck-only visual flip.
    ctx.rotate(state.player.airSpin);
  }
  ctx.drawImage(skaterSprites.atlas[dirIndex][frameIndex], -56, -56, 112, 112);

  // Small ollie board accent for better air readability.
  if (state.player.z > 0.02) {
    ctx.fillStyle = '#f4d57b';
    ctx.fillRect(-22, 25 - state.player.z * 10, 44, 4);
  }
  ctx.restore();
}

function drawPanel(title, lines) {
  ctx.fillStyle = '#051128dd';
  ctx.fillRect(170, 92, 940, 540);
  ctx.strokeStyle = '#5f87d8';
  ctx.lineWidth = 4;
  ctx.strokeRect(170, 92, 940, 540);
  ctx.textAlign = 'center';

  ctx.fillStyle = '#ffe286';
  ctx.font = 'bold 52px Trebuchet MS';
  ctx.fillText(title, canvas.width / 2, 172);

  ctx.font = '26px Trebuchet MS';
  ctx.fillStyle = '#e9f1ff';
  lines.forEach((line, i) => {
    ctx.fillText(line, canvas.width / 2, 250 + i * 48);
  });
}

function updatePlaying(dt) {
  const profile = difficulties[state.optionDifficulty];
  state.timeLeft -= dt;
  if (state.timeLeft <= 0) return endRun();

  const accel = profile.speed * (state.boost > 0 ? 1.6 : 1);
  let ax = 0;
  let ay = 0;

  if (state.keys.has('ArrowUp') || state.keys.has('w')) ay -= accel;
  if (state.keys.has('ArrowDown') || state.keys.has('s')) ay += accel;
  if (state.keys.has('ArrowLeft') || state.keys.has('a')) ax -= accel;
  if (state.keys.has('ArrowRight') || state.keys.has('d')) ax += accel;

  // Velocity smoothing for responsive but stable control.
  state.player.vx = state.player.vx * 0.84 + ax * dt;
  state.player.vy = state.player.vy * 0.84 + ay * dt;
  state.player.x = clamp(state.player.x + state.player.vx, 1.3, WORLD_W - 1.3);
  state.player.y = clamp(state.player.y + state.player.vy, 1.3, WORLD_H - 1.3);

  const speed = Math.hypot(state.player.vx, state.player.vy);
  if (speed > 0.015) {
    const targetFacing = Math.atan2(state.player.vy, state.player.vx);
    // Smooth facing update for cleaner 360 directional animation.
    const delta = Math.atan2(Math.sin(targetFacing - state.player.facing), Math.cos(targetFacing - state.player.facing));
    state.player.facing = normalizeAngle(state.player.facing + delta * 0.22);
    state.player.frame += Math.min(0.8, speed * 16);
    state.player.animTick += Math.min(0.62, speed * 9);
  } else {
    state.player.animTick += 0.04;
  }

  // Vertical jump physics for ollie.
  state.player.vz -= 17.5 * dt;
  state.player.z = Math.max(0, state.player.z + state.player.vz * dt);
  if (state.player.z <= 0) {
    if (state.player.vz < -2.2) {
      state.score += Math.min(180, Math.floor(Math.abs(state.player.vz) * 11));
      audio.menu();
    }
    state.player.z = 0;
    state.player.vz = 0;
    state.player.airSpin = 0;
  }

  // Air spin animation while airborne.
  if (state.player.z > 0.01 && Math.abs(state.player.spinVel) > 0.01) {
    state.player.airSpin += state.player.spinVel * dt;
    state.player.spinVel *= 0.985;
    if (Math.abs(state.player.spinVel) < 0.16) {
      state.score += 220;
      state.player.spinVel = 0;
    }
  }

  if (state.boost > 0) state.boost -= dt;

  // Camera follow with look-ahead gives original-style scrolling momentum.
  const lookAhead = clamp(speed * 42, 0, 2.1);
  const camTargetX = state.player.x + Math.cos(state.player.facing) * lookAhead;
  const camTargetY = state.player.y + Math.sin(state.player.facing) * lookAhead;
  state.camera.x = lerp(state.camera.x, camTargetX, 0.14);
  state.camera.y = lerp(state.camera.y, camTargetY, 0.14);

  // Ticket collection.
  for (const ticket of state.ticketsOnMap) {
    if (!ticket.active || ticket.course !== state.courseIndex) continue;
    if (Math.hypot(state.player.x - ticket.x, state.player.y - ticket.y) < 0.58) {
      ticket.active = false;
      state.tickets += 1;
      state.score += Math.floor(220 * profile.ticketMultiplier);
      state.flash = 0.2;
      audio.ticket();
    }
  }

  // Shops.
  for (const shop of state.shops) {
    if (shop.sold) continue;
    if (Math.hypot(state.player.x - shop.x, state.player.y - shop.y) < 1.0) {
      shop.sold = true;
      state.score += 1350;
      state.timeLeft += 9;
      audio.menu();
    }
  }

  // Gates and progression.
  for (const gate of state.gates) {
    if (gate.course !== state.courseIndex) continue;
    if (Math.hypot(state.player.x - gate.x, state.player.y - gate.y) < 0.9) {
      const required = Math.floor((state.optionTicketBase + state.courseIndex * 3) * profile.ticketMultiplier);
      if (state.tickets >= required) {
        state.score += 3200;
        state.courseIndex += 1;
        state.tickets = 0;
        state.timeLeft += 24;
        state.player.x = PARK_CENTER.x;
        state.player.y = PARK_CENTER.y;
        state.camera.x = PARK_CENTER.x;
        state.camera.y = PARK_CENTER.y;
        audio.courseClear();

        if (state.courseIndex >= courses.length) {
          state.timeLeft = 0;
          endRun(true);
        }
      } else {
        state.player.vx *= -0.35;
        state.player.vy *= -0.35;
        state.score = Math.max(0, state.score - 75);
        audio.crash();
      }
    }
  }
}

function endRun(completed = false) {
  state.highScores.push({ name: 'YOU', score: state.score + (completed ? 5000 : 0) });
  state.highScores.sort((a, b) => b.score - a.score);
  state.highScores = state.highScores.slice(0, 10);
  saveHighScores();
  state.screen = 'gameOver';
}

function renderPlaying() {
  drawPark();
  drawSkater();

  if (state.flash > 0) {
    ctx.fillStyle = `rgba(255,255,200,${state.flash * 0.45})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    state.flash -= 0.02;
  }

  hud.tickets.textContent = String(state.tickets);
  hud.score.textContent = String(state.score);
  hud.course.textContent = courses[state.courseIndex]?.id ?? 'DONE';
  hud.time.textContent = String(Math.max(0, Math.ceil(state.timeLeft)));
}

function renderMenu() {
  drawPark();
  drawPanel('SKATE 720: PARK CIRCUIT', [
    'Press Enter to Start',
    'Press O for Options (tickets and difficulty)',
    'Press H for High Scores',
    '16-direction character frames + smooth ollie and in-air spin',
  ]);
}

function renderOptions() {
  drawPark();
  drawPanel('OPTIONS', [
    `Difficulty: ${capitalize(state.optionDifficulty)}  (Left/Right)`,
    `Ticket target base: ${state.optionTicketBase}  (Up/Down)`,
    'Space = Ollie. Press Space again in air to add spin.',
    'Press Enter to return to menu',
  ]);
}

function renderHighScores() {
  drawPark();
  drawPanel('HIGH SCORES', state.highScores.slice(0, 8).map((s, i) => `${i + 1}. ${s.name.padEnd(3, ' ')}  ${s.score}`));
  ctx.fillStyle = '#d2e4ff';
  ctx.font = '22px Trebuchet MS';
  ctx.textAlign = 'center';
  ctx.fillText('Press Enter to return', canvas.width / 2, 604);
}

function renderSplash() {
  drawPark();
  drawPanel('WELCOME TO SKATE 720', [
    'Large colorful skatepark with shops, 4 courses, tickets, and highscores',
    'Skater uses 16-direction frames plus ollie and in-air spin animation',
    'Press Enter to continue',
  ]);
}

function renderGameOver() {
  drawPark();
  drawPanel('RUN COMPLETE', [
    `Final Score: ${state.score}`,
    'Press Enter to return to menu',
    'Press H to inspect high-score table',
  ]);
}

function tick(ts) {
  if (!tick.last) tick.last = ts;
  const dt = Math.min(0.033, (ts - tick.last) / 1000);
  tick.last = ts;

  switch (state.screen) {
    case 'playing':
      updatePlaying(dt);
      renderPlaying();
      break;
    case 'menu':
      renderMenu();
      break;
    case 'options':
      renderOptions();
      break;
    case 'highScores':
      renderHighScores();
      break;
    case 'splash':
      renderSplash();
      break;
    case 'gameOver':
      renderGameOver();
      break;
    case 'paused':
      renderPlaying();
      drawPanel('PAUSED', ['Press P to continue']);
      break;
    default:
      renderMenu();
  }

  requestAnimationFrame(tick);
}

function handleKeyDown(e) {
  if (e.key === ' ') {
    // Space: ollie from ground, or add spin while airborne.
    if (!e.repeat && state.screen === 'playing') {
      if (state.player.z <= 0.001) {
        state.player.vz = 8.6;
        state.player.z = 0.01;
        state.boost = 0.2;
        audio.menu();
      } else {
        state.player.spinVel = clamp(state.player.spinVel + Math.PI * 4.6, -Math.PI * 14, Math.PI * 14);
        audio.spin();
      }
    }
    e.preventDefault();
  }

  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();

  state.keys.add(e.key);
  const k = e.key.toLowerCase();
  state.keys.add(k);

  if (k === 'p' && (state.screen === 'playing' || state.screen === 'paused')) {
    state.screen = state.screen === 'playing' ? 'paused' : 'playing';
    audio.menu();
  }

  if (k === 'escape') state.screen = 'menu';

  if (state.screen === 'splash' && e.key === 'Enter') {
    state.screen = 'menu';
    audio.start();
    return;
  }

  if (state.screen === 'menu') {
    if (e.key === 'Enter') {
      resetRun();
      state.screen = 'playing';
      audio.start();
    }
    if (k === 'o') {
      state.screen = 'options';
      audio.menu();
    }
    if (k === 'h') {
      state.screen = 'highScores';
      audio.menu();
    }
  } else if (state.screen === 'options') {
    if (e.key === 'ArrowLeft') {
      state.optionDifficulty = state.optionDifficulty === 'hard' ? 'normal' : 'easy';
    }
    if (e.key === 'ArrowRight') {
      state.optionDifficulty = state.optionDifficulty === 'easy' ? 'normal' : 'hard';
    }
    if (e.key === 'ArrowUp') state.optionTicketBase = clamp(state.optionTicketBase + 1, 4, 24);
    if (e.key === 'ArrowDown') state.optionTicketBase = clamp(state.optionTicketBase - 1, 4, 24);
    if (e.key === 'Enter') state.screen = 'menu';
  } else if (state.screen === 'highScores' || state.screen === 'gameOver') {
    if (e.key === 'Enter') state.screen = 'menu';
    if (k === 'h') state.screen = 'highScores';
  }
}

function handleKeyUp(e) {
  state.keys.delete(e.key);
  state.keys.delete(e.key.toLowerCase());
}

window.addEventListener('keydown', handleKeyDown);
window.addEventListener('keyup', handleKeyUp);

buildPark();
requestAnimationFrame(tick);
