const assert = require("node:assert/strict"),
  vm = require("node:vm"),
  fs = require("node:fs");
const context = { window: { Skate720: {} } };
vm.runInNewContext(
  fs.readFileSync(require.resolve("../src/world.js"), "utf8"),
  context,
);
const loop = context.window.Skate720.CityLoop;
// ROM directory 0180..0A80, stride0060; south restarts at0194,
// north from0180 restarts at0A6C: both preserve the ten-block offset.
assert.equal(loop.height, 24 * 128);
assert.equal(loop.shift, ((0x194 - 0x180) / 2) * 128);
for (const x of [1600, 2720, 4000, 4700])
  for (const y of [-32, -0.25, 0, 32, 3071.75, 3072, 3104]) {
    const p = loop.point(x, y);
    assert(p.y >= 0 && p.y < 3072);
    assert.equal(p.x - x, Math.floor(y / 3072) * 1280);
    const inverse = loop.point(p.x - 1280, p.y + 3072);
    assert.equal(inverse.x, p.x);
    assert.equal(inverse.y, p.y);
  }
console.log(
  "PASS ROM north/south city directory skew, fractional overshoot and inverse joins",
);
