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
