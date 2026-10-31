const assert = require("node:assert/strict");
const palette = require("../src/original-target-palette.js");
const state = {};
assert.equal(palette.phase(state), -1);
palette.trigger(state);
for (let i = 0; i < 3; i++) palette.tick(state);
assert.equal(palette.phase(state), -1, "7C5E arms; DD10 waits for fourth tick");
palette.tick(state);
assert.equal(state.targetPaletteTicks, 59);
assert.equal(palette.phase(state), 3);
const phases = [];
for (let i = 0; i < 12; i++) {
  palette.tick(state);
  if (!state.targetPaletteClock) phases.push(palette.phase(state));
}
assert.deepEqual(phases, [2, 1, 0]);
for (let i = 16; i < 240; i++) palette.tick(state);
assert.equal(palette.phase(state), -1, "restore static palette at zero");
palette.trigger(state);
for (let i = 0; i < 8; i++) palette.tick(state);
palette.trigger(state);
assert.equal(state.targetPaletteTicks, 60, "repeat landing resets countdown");
const fs = require("node:fs"),
  vm = require("node:vm"),
  sandbox = { window: { Skate720: {} } };
vm.runInNewContext(
  fs.readFileSync(require.resolve("../src/target-palette-data.js"), "utf8"),
  sandbox,
);
const data = sandbox.window.Skate720.TARGET_PALETTE_DATA;
assert.deepEqual(Array.from(data.cycle), [0xe00e, 0xee0e, 0xeeee, 0xe60e]);
assert.equal(Object.keys(data.patches).length, 6);
assert.equal(data.patches["jump-1"].length, 2);
console.log(
  "PASS original DD10 target palette cadence, phase, expiry, retrigger and six ROM maps",
);
