const assert = require("node:assert/strict"),
  C = require("../src/curb-grind.js");
function mesh(edges) {
  const buckets = new Map();
  for (const e of edges)
    for (
      let y = Math.floor(Math.min(e.a.y, e.b.y) / 32);
      y <= Math.floor(Math.max(e.a.y, e.b.y) / 32);
      y++
    ) {
      if (!buckets.has(y)) buckets.set(y, []);
      buckets.get(y).push(e);
    }
  return { segments: edges, buckets };
}
const m = mesh([
  { a: { x: 0, y: 0 }, b: { x: 40, y: 20 } },
  { a: { x: 40, y: 20 }, b: { x: 80, y: 40 } },
  { a: { x: 80, y: 40 }, b: { x: 80, y: 60 } },
]);
for (const sign of [1, -1]) {
  let s = C.acquire(m, { x: 40, y: 20, vx: 200 * sign, vy: 100 * sign });
  assert(s);
  for (let n = 0; n < 120 && !s.finished; n++) C.step(s, 1 / 60);
  assert(s.finished);
  assert(Math.abs(s.x - (sign > 0 ? 80 : 0)) < 1e-7);
  assert(Math.abs(s.y - (sign > 0 ? 40 : 0)) < 1e-7);
}
assert(!C.acquire(m, { x: 20, y: 10, vx: 200, vy: -100 }));
assert(!C.acquire(m, { x: 20, y: 10, vx: 20, vy: 10 }));
assert(!C.acquire(m, { x: -25, y: -12.5, vx: 200, vy: 100 }));
assert(!C.acquire(m, { x: 20, y: 50, vx: 200, vy: 100 }));
assert(
  !C.acquire(m, { x: 20, y: 10, vx: 200, vy: 100, air: true, z: 20, vz: -10 }),
);
assert(
  !C.acquire(m, { x: 20, y: 10, vx: 200, vy: 100, air: true, z: 5, vz: 10 }),
);
assert(
  C.acquire(m, { x: 20, y: 10, vx: 200, vy: 100, air: true, z: 5, vz: -10 }),
);
console.log(
  "PASS curb grind: bidirectional continuous joins, sharp corner/end exit, finite range, speed/alignment and airborne clearance",
);
