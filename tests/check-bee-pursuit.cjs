const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm"),
  path = require("node:path");
const E = require("../src/original-effects.js"),
  S = {};
vm.runInNewContext(
  fs.readFileSync(path.join(__dirname, "../src/actor-table-data.js"), "utf8"),
  { window: { Skate720: S } },
);
const motion = Buffer.from(S.ACTOR_TABLE_DATA.motion, "base64"),
  rw = (a) => motion.readUInt16LE(a - 0x3ff8),
  word = (n) => n & 65535,
  signed = (n) => (n << 16) >> 16;
const cases = [
  [0, 1000, 4],
  [0, -1000, 12],
  [1000, 0, 0],
  [-1000, 0, 8],
  [1000, 1000, 2],
  [-1000, 1000, 6],
  [-1000, -1000, 10],
  [1000, -1000, 14],
  [511, 1000, 4],
  [512, 1000, 2],
  [-32768, 1000, 4],
];
const player = (x, y, frame = 0) => ({
  x: word(x - 0x500 - (frame & 511)),
  y: word(y - 0x500),
  height: 0,
  dx: 37,
  dy: -21,
  dz: 9,
});
for (const [x, y, d] of cases)
  for (const frame of [0, 511, 512])
    assert.equal(E.beeHeading({ x: 0, y: 0 }, player(x, y, frame), frame), d);
for (const [x, y, d] of cases.slice(0, 8))
  for (let stage = 1; stage <= 7; stage++) {
    const s = {
      x: 0,
      y: 0,
      delay: 1,
      speedClock: 20,
      stage,
      direction: 255,
      appearance: 4,
      form: 0,
      animationFrames: 8,
    };
    E.tickBeePursuit(s, player(x, y), { x: 0, y: 0 }, 0, 1, rw, () => 31);
    const i = (d * 8 + stage) * 2;
    assert.equal(s.dx, signed(rw(0x4138 + i) * 2));
    assert.equal(s.dy, signed(rw(0x4238 + i) * 2));
    assert.equal(s.direction, d);
    assert.equal(s.delay, 31);
    assert.equal(s.form, stage >= 4 ? 4 : 0);
    assert.equal(s.animationFrames, 1);
  }
let s = {
  x: 0,
  y: 0,
  delay: 50,
  speedClock: 1,
  stage: 1,
  direction: 255,
  appearance: 6,
  form: 0,
  animationFrames: 0,
};
E.tickBeePursuit(
  s,
  player(1000, 1000),
  { x: word(-0x8300), y: 0 },
  0,
  10,
  rw,
  () => {
    throw Error("Offscreen retarget cannot use entropy");
  },
);
assert.equal(s.stage, 2);
assert.equal(s.speedClock, 150);
assert.equal(s.delay, 5);
assert.equal(s.dx, signed(rw(0x4138 + (2 * 8 + 2) * 2) * 2 + 37));
assert.equal(s.dy, signed(rw(0x4238 + (2 * 8 + 2) * 2) * 2 - 12));
for (const dx of [-1, 0])
  for (const dy of [-1, 0]) {
    const a = E.beginBeePursuit(100, 200, dx, dy, 4);
    assert.equal(a.x, word(100 + (dx < 0 ? 0x8e00 : 0xf200)));
    assert.equal(a.y, word(-200 + (dy < 0 ? 0x6e00 : 0x1200)));
  }
s = {
  x: 0,
  y: 0,
  delay: 2,
  speedClock: 20,
  stage: 4,
  direction: 2,
  appearance: 6,
  form: 0,
  animationFrames: 8,
  dx: 10,
  dy: 20,
};
E.tickBeePursuit(s, player(1000, 1000), { x: 0, y: 0 }, 0, 1, rw, () => 0);
assert.equal(s.delay, 1);
assert.equal(s.x, 10);
assert.equal(s.y, 20);
assert.equal(s.animationFrames, 9);
const spawnClock = E.beginBeePursuit(0, 0, 0, 0, 4);
E.tickBeePursuit(
  spawnClock,
  player(1000, 1000),
  { x: 0, y: 0 },
  0,
  1,
  rw,
  () => 0,
);
assert.equal(spawnClock.speedClock, 250);
E.tickBeePursuit(
  spawnClock,
  player(1000, 1000),
  { x: 0, y: 0 },
  1,
  1,
  rw,
  () => 0,
);
assert.equal(spawnClock.speedClock, 249);
console.log(
  "PASS original bee8way bias/wrap boundaries,56 ROM velocity combinations, inherited motion, cooldown, speed stage and spawn edges",
);
