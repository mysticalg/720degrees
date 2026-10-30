const assert = require("node:assert/strict");
const collision = require("../src/terrain-collision.js");
for (const profile of [2, 10, 18, 26, 34, 42, 50, 58]) {
  // A finite diagonal strip has two parallel edges and two end caps.
  const level = {
    name: "city",
    columns: 32,
    rows: 32,
    sample(x, y) {
      const col = Math.floor(x / 8),
        row = Math.floor(y / 8);
      const curb =
        col >= 4 && col < 24 && col + 2 * row >= 28 && col + 2 * row < 34;
      return { profile: curb ? profile : 24, type: 0, blocked: false };
    },
  };
  const mesh = collision.debugMesh(level, "curbs");
  assert(mesh.paths.length > 0);
  assert(mesh.paths.every((path) => path.length >= 4));
  assert(
    mesh.segments.some(
      (edge) =>
        Math.abs(edge.a.x - edge.b.x) > 24 &&
        Math.abs(edge.a.y - edge.b.y) > 12,
    ),
  );
  let changes = 0;
  for (let y = 32; y < 128; y += 2)
    for (let x = 16; x < 216; x += 2) {
      const sample = collision.surface(level, x, y),
        inside = collision.blocked(level, x, y, "curbs");
      assert.equal((sample.profile & 7) === 2, inside);
      assert.equal(sample.blocked, false);
      if (sample.profile !== level.sample(x, y).profile) changes++;
    }
  assert(
    changes > 0,
    "replace the square staircase rather than only drawing it",
  );
  const motion = collision.sweep(
    level,
    { x: 20, y: 80 },
    { x: 210, y: 80 },
    { x: 190, y: 0 },
  );
  assert.equal(motion.hits, 0, "rideable curbs must not become fences");
  assert.equal(motion.x, 210);
  assert.equal(
    collision.blocked(level, 220, 80, "curbs"),
    false,
    "finite curb ends",
  );
}
console.log(
  "PASS eight curb orientations: shared diagonal physics/overlay, finite end caps and unrestricted crossing",
);

for (const sign of [-1, 1]) {
  const make = (gap = false) => ({
    name: "city",
    columns: 40,
    rows: 24,
    sample(x, y) {
      const col = Math.floor(x / 8),
        row = Math.floor(y / 8),
        start = sign === 1 ? 4 + 2 * row : 36 - 2 * row;
      const on =
        row >= 3 &&
        row < 15 &&
        (!gap || row !== 9) &&
        col >= start &&
        col < start + 2;
      return {
        profile: on ? (sign === 1 ? 18 : 26) : 24,
        type: 0,
        blocked: false,
      };
    },
  });
  const mesh = collision.debugMesh(make(), "curbs");
  assert.equal(
    mesh.paths.length,
    1,
    "corner-touching curb stones form one strip",
  );
  assert(mesh.segments.some((e) => Math.abs(e.a.x - e.b.x) > 100));
  assert.equal(
    collision.debugMesh(make(true), "curbs").paths.length,
    2,
    "retain an actual missing row/gap",
  );
}
console.log(
  "PASS matching diagonal curb saddles join into one piece; real gaps remain open",
);
