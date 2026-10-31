const assert = require("node:assert/strict"),
  T = require("../src/terrain-collision.js");
const level = {
  name: "city",
  kind: "city",
  columns: 32,
  rows: 32,
  sample(x, y) {
    return { profile: x >= 128 ? 71 : 0, type: 0, blocked: false };
  },
};
for (const speed of [120, 600]) {
  const result = T.sweep(
    level,
    { x: 100, y: 100 },
    { x: 160, y: 100 },
    { x: speed, y: 0 },
    { barriersOnly: true, bounce: true },
  );
  assert(result.hits);
  assert(result.x < 128);
  assert(result.vx < 0);
  assert(Math.abs(result.vx + speed * 0.9) < speed * 0.002);
  assert(Math.abs(result.vy) < speed * 0.02);
}
const slide = T.sweep(
  level,
  { x: 100, y: 100 },
  { x: 160, y: 120 },
  { x: 200, y: 100 },
  { barriersOnly: true },
);
const normal = T.debugMesh(level, true).segments[0].normal;
assert(Math.abs(slide.vx * normal.x + slide.vy * normal.y) < 1e-6);
assert(Math.abs(slide.vy - 100) < 5);
assert(
  !T.sweep(
    level,
    { x: 40, y: 100 },
    { x: 80, y: 100 },
    { x: 200, y: 0 },
    { barriersOnly: true, bounce: true },
  ).hits,
);
console.log(
  "PASS airborne fence sweep: fast crossings rebound90%, remain inside, grounded sliding unchanged and open space unaffected",
);
