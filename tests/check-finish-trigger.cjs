const assert = require("node:assert/strict"),
  F = require("../src/finish-trigger.js"),
  B = require("../src/board-geometry.js");
const flags = new Uint8Array(8192);
flags[3] = 10;
const p = F.create(Uint16Array.from([3, 0]), 2, flags, B.hull);
assert(
  !F.crosses(p, { x: 4, y: 4 }, { x: 4, y: 4 }),
  "paint itself must not finish",
);
assert(
  !F.crosses(p, { x: 8, y: 8 }, { x: 8, y: 8 }),
  "far edge of paint is still before trigger",
);
assert(
  F.crosses(p, { x: 12, y: 10 }, { x: 12, y: 10 }),
  "just beyond the line finishes",
);
assert(
  F.crosses(p, { x: -100, y: -100 }, { x: 100, y: 100 }),
  "fast crossing cannot skip strip",
);
assert(
  !F.crosses(p, { x: -100, y: -100 }, { x: -50, y: -50 }),
  "approach does not finish",
);
assert(
  !F.crosses(p, { x: 1000, y: 1000 }, { x: 1000, y: 1000 }),
  "distant point misses",
);
for (const sign of [-1, 1]) {
  const columns = 12,
    cells = new Uint16Array(12 * 12),
    tiles = [];
  for (let n = 0; n < 6; n++) {
    const x = sign === -1 ? n + 2 : 8 - n,
      y = Math.floor(n / 2) + 2;
    cells[y * columns + x] = 3;
    tiles.push({ x: x * 8, y: y * 8 });
  }
  const strip = F.create(cells, columns, flags, B.hull);
  const originalFar = Math.max(
    ...tiles.map((p) => sign * p.x + 2 * p.y + (sign > 0 ? 24 : 16)),
  );
  assert.equal(
    Math.min(...strip.map((p) => sign * p.x + 2 * p.y)),
    originalFar + 4,
  );
  assert.equal(
    Math.max(...strip.map((p) => sign * p.x + 2 * p.y)),
    originalFar + 52,
  );
  const middle = strip.reduce(
    (a, p) => ({ x: a.x + p.x / 4, y: a.y + p.y / 4 }),
    { x: 0, y: 0 },
  );
  assert(
    !F.crosses(
      strip,
      { x: middle.x - sign * 100, y: middle.y - 50 },
      { x: middle.x - sign * 40, y: middle.y - 20 },
    ),
  );
  assert(
    F.crosses(
      strip,
      { x: middle.x - sign * 100, y: middle.y - 50 },
      { x: middle.x + sign * 100, y: middle.y + 50 },
    ),
  );
}
assert.equal(F.create(Uint16Array.from([0, 0]), 2, flags, B.hull), null);
assert(!F.crosses(null, { x: 0, y: 0 }, { x: 0, y: 0 }));
console.log(
  "PASS finish strips after paint in both diagonals, no early finish, side padding and swept fast/airborne ground crossings",
);
