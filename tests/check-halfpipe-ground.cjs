const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ground = require("../src/original-ground.js");
const pipe = require("../src/halfpipe.js");
const sandbox = { window: { Skate720: {} } };
vm.runInNewContext(
  fs.readFileSync(__dirname + "/../src/terrain-data.js", "utf8"),
  sandbox,
);
const reader = ground.terrainTableReader(
  sandbox.window.Skate720.TERRAIN_TABLES,
);
// 9BCE-9BDA doubles the orientation band before adding the coping table base.
// Checking independent literal indices catches a missing ASL on the south wall.
for (const [profile, direction, index] of [
  [7, 2, 546],
  [23, 10, 586],
  [15, 6, 566],
  [31, 14, 606],
  [63, 15, 671],
]) {
  const coefficients = ground.surfaceCoefficients(
    direction,
    profile,
    1,
    3,
    2000,
    0,
    reader.readByte,
    reader.readWord,
  );
  assert.equal(coefficients.index, index);
  if (profile === 7 || profile === 23)
    assert.equal(coefficients.vertical, 16384);
}
// A synthetic lane has flat floor, a curved wall and a coping platform.
const level = {
  sample(x) {
    return { profile: x < 0 ? 24 : x < 100 ? 1 : 120 };
  },
};
assert.equal(pipe.wallAt(level, -1, 0), null);
assert.equal(pipe.wallAt(level, 10, 0).profile, 1);
assert.equal(pipe.wallAt(level, 90, 0).profile, 6);
assert.equal(pipe.wallAt(level, 90, 0).returnDirection, 10);
assert(Math.abs(pipe.wallAt(level, 90, 0).lip.x - 100) < 0.02);
for (let direction = 0; direction < 16; direction++) {
  assert.equal(
    pipe.heading(
      Math.atan2(-ground.tables.y[direction], ground.tables.x[direction]),
      ground.tables,
    ),
    direction,
  );
}
console.log(
  "PASS original coping coefficient indices on both walls, decoded-wall inclination and sixteen sprite headings",
);

// Two-stage native coverage preserves all six original incline entries.
assert.equal(pipe.inclination(0), 1);
assert.equal(pipe.inclination(pipe.VERT_START - 1e-6), 4);
assert.equal(pipe.inclination(pipe.VERT_START), 5);
assert.equal(pipe.inclination(1), 6);
assert.equal(pipe.heightProgress(0), 0);
assert(Math.abs(pipe.heightProgress(1) - 1) < 1e-12);
const join = pipe.VERT_START,
  eps = 1e-5;
const left =
  (pipe.heightProgress(join) - pipe.heightProgress(join - eps)) / eps;
const right =
  (pipe.heightProgress(join + eps) - pipe.heightProgress(join)) / eps;
assert(
  Math.abs(left - right) < 1e-4,
  "no slope/height seam at curve-to-vert join",
);
assert(
  right > ((pipe.heightProgress(eps) - pipe.heightProgress(0)) / eps) * 1.8,
);
for (let n = 1; n <= 100; n++)
  assert(pipe.heightProgress(n / 100) > pipe.heightProgress((n - 1) / 100));
assert.equal(pipe.wallAt(level, 69, 0).stage, "curve");
assert.equal(pipe.wallAt(level, 71, 0).stage, "vert");
console.log(
  "PASS two-stage halfpipe: curved approach, upper vert, continuous join and exact floor/coping endpoints",
);

assert.equal(pipe.widthProgress(0), 0);
assert.equal(pipe.widthProgress(pipe.VERT_START), 1);
assert.equal(pipe.widthProgress(1), 1);
assert(
  Math.abs((pipe.widthProgress(join) - pipe.widthProgress(join - eps)) / eps) <
    1e-4,
);
assert.equal(
  pipe.travelScale({ name: "ramp-1" }, { rawProfile: 17 }),
  48 / 216,
);
assert.equal(pipe.travelScale({ name: "ramp-1" }, { rawProfile: 1 }), 1);
console.log(
  "PASS south curved approach reaches an actual vertical tangent and shared north/south travel scale",
);
