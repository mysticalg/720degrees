const assert = require("assert/strict"),
  fx = require("../src/original-gate-contact.js"),
  fs = require("fs"),
  vm = require("vm"),
  ctx = { window: { Skate720: {} } };
vm.runInNewContext(
  fs.readFileSync(
    require("path").join(__dirname, "../src/terrain-data.js"),
    "utf8",
  ),
  ctx,
);
const bytes = ctx.window.Skate720.TERRAIN_TABLES.bytes[0x7908],
  read = (a) => bytes[a - 0x7908];
for (const kind of [19, 20])
  for (let direction = 0; direction < 16; direction++) {
    let s = {
      heading: direction,
      speed: 900,
      vertical: 170,
      movementState: 0,
      contactProfile: 254,
    };
    assert(fx.contact(s, kind, read));
    assert.equal(s.heading, direction ^ 8);
    assert.equal(s.speed, 352);
    assert.equal(s.vertical, 0);
    assert.equal(s.mode, 2);
    assert.equal(s.clock, 6);
    assert(!fx.contact(s, kind, read));
    s.currentProfile = 0;
    for (let i = 0; i < 5; i++) fx.steer(s, s.heading);
    assert.equal(s.mode, 2);
    fx.steer(s, s.heading);
    assert.equal(s.mode, 0);
  }
// Source63 flips signed coasting without replacing body heading; FF is an
// input-release sentinel, never an invalid sprite direction.
let s = {
  heading: 1,
  speed: 900,
  vertical: 0,
  movementState: 1,
  action: 0,
  contactProfile: 254,
};
fx.contact(s, 20, read);
assert.equal(s.speed, -352);
assert.equal(s.target, 1);
s = {
  heading: 8,
  speed: 900,
  vertical: 0,
  movementState: 1,
  action: 0,
  contactProfile: 254,
};
fx.contact(s, 20, read);
assert.equal(s.target, -1);
fx.steer(s, 8);
assert.equal(s.mode, 0);
assert.equal(s.heading, 8);
s = {
  heading: 0,
  target: 4,
  speed: 900,
  movementState: 1,
  mode: 1,
  clock: 8,
  contactProfile: 7,
  currentProfile: 7,
};
for (let i = 0; i < 4; i++) fx.steer(s, 0);
assert.equal(s.heading, 4);
assert.equal(s.clock, 8);
s.currentProfile = 0;
for (let i = 0; i < 8; i++) fx.steer(s, 0);
assert.equal(s.mode, 0);
console.log(
  "PASS32 airborne gate responses, exact6/8tick release, signed reversal and FF steering sentinel",
);
