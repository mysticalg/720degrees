const assert = require("node:assert/strict");
const probe = require("../src/original-terrain-probe.js");
for (let profile = 0; profile < 256; profile++)
  for (let flags = 0; flags < 256; flags++) {
    const signed = (profile << 24) >> 24;
    assert.equal(
      probe.resolveProfile(profile, flags, 2),
      flags & 128 ? flags & 127 : signed & 65535,
    );
    assert.equal(probe.resolveProfile(profile, flags, 0), signed & 65535);
  }
assert.equal(probe.resolveProfile(48, 0x84, 2), 4);
assert.equal(probe.resolveProfile(48, 0x92, 2), 18);
assert.equal(probe.resolveProfile(48, 0xf8, 2), 120);
const terrain = require("../src/terrain-collision.js");
const level = {
  columns: 16,
  rows: 16,
  sample(x, y) {
    return x < 0 || y < 0 || x >= 128 || y >= 128
      ? { profile: 24, type: 0, blocked: false }
      : { profile: 48, type: x < 64 ? 0x84 : 0x92, blocked: false };
  },
  surfaceProfile(s) {
    return probe.resolveProfile(s.profile, s.type, 2);
  },
};
assert(terrain.blocked(level, 32, 64, "slopes"));
assert(terrain.blocked(level, 96, 64, "slopes"));
const divisions = terrain.slopeDivisions(level);
assert(divisions.some((e) => e.a.x === 64 && e.b.x === 64));
assert.equal(
  terrain.blocked(level, 64, 64),
  false,
  "the ridge divider is not a wall",
);
assert.equal(
  terrain.slopeDivisions(level),
  divisions,
  "cache the diagnostic divisions",
);
console.log(
  "PASS131072 original primary/mode2 profile combinations, two face profiles/ridge and diagnostic-only division",
);
