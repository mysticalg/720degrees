const assert = require("node:assert/strict");
const terrain = require("../src/terrain-collision.js");
for (let band = 0; band < 8; band++)
  for (let incline = 0; incline < 8; incline++) {
    const profile = band * 8 + incline;
    const level = {
      columns: 16,
      rows: 16,
      sample(x, y) {
        return {
          profile: x >= 32 && x < 96 && y >= 32 && y < 96 ? profile : 24,
          blocked: false,
          type: 0,
        };
      },
    };
    const support = terrain.debugMesh(level),
      walls = terrain.debugMesh(level, true);
    assert.equal(
      terrain.blocked(level, 64, 64, "slopes"),
      incline >= 1 && incline <= 6,
    );
    assert.equal(terrain.blocked(level, 8, 8, "slopes"), false);
    assert.equal(
      terrain.debugMesh(level),
      support,
      "diagnostic mesh must not replace support geometry",
    );
    assert.equal(
      terrain.debugMesh(level, true),
      walls,
      "diagnostic mesh must not replace wall geometry",
    );
  }
const gap = {
  columns: 16,
  rows: 16,
  sample() {
    return { profile: 2, blocked: true, type: 18 };
  },
};
assert.equal(terrain.blocked(gap, 64, 64, "slopes"), false);
console.log(
  "PASS slope overlay: all64 incline/orientation fields, flat/face/void exclusion and independent geometry caches",
);
