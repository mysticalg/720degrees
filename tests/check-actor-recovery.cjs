const assert = require("node:assert/strict");
const c = require("../src/original-contact.js");
const state = { timer: 0, sprite: 255 };
const actor = {
  sprite: 20,
  kind: 50,
  duration: 3000,
  rate: 5,
  dx: 256,
  dy: 65500,
  pointer: 0x55c2,
  extraPointer: 0x7cc6,
  routeFlags: 5,
  flags: 1,
  countdown: 3,
};
const original = { ...actor };
c.saveActorMotion(actor, state);
c.knockDownActor(actor, () => 0x5630);
assert.equal(state.timer, 180);
for (let tick = 0; tick < 179; tick++)
  assert.equal(
    c.tickActorRecovery(state, () => actor),
    null,
  );
assert.equal(state.timer, 1);
assert.equal(actor.extraPointer, 0);
assert.equal(actor.routeFlags, original.routeFlags | 64);
assert.equal(
  c.tickActorRecovery(state, (sprite) => {
    assert.equal(sprite, 20);
    return actor;
  }),
  actor,
);
for (const field of ["duration", "rate", "dx", "dy", "pointer", "extraPointer"])
  assert.equal(actor[field], original[field], field);
assert.equal(
  actor.countdown,
  8,
  "the original does not save/restore the animation countdown",
);
assert.equal(actor.routeFlags, original.routeFlags);
assert.equal(state.sprite, 255);
assert.equal(
  c.tickActorRecovery(state, () => {
    throw Error("zero timer must skip lookup");
  }),
  null,
);
// There is one saved actor globally: a second collision replaces the snapshot.
const other = { ...original, sprite: 21, dx: 77 };
c.saveActorMotion(actor, state);
c.saveActorMotion(other, state);
assert.equal(state.sprite, 21);
assert.equal(state.saved.dx, 77);
// Special sprite6 changes companion5 without replacing that global snapshot.
const companion = { pointer: 1, dx: 2, dy: 3, duration: 4, flags: 1 };
c.saveActorMotion({ sprite: 6, routeFlags: 4 }, state, companion);
assert.equal(state.sprite, 21);
assert.equal(companion.pointer, 0x50fa);
assert.equal(companion.flags, 25);
assert.equal(companion.dx + companion.dy + companion.duration, 0);
state.timer = 1;
other.routeFlags = 4;
assert.equal(
  c.tickActorRecovery(state, () => other),
  null,
  "cleared stopped flag prevents stale restoration",
);
console.log(
  "PASS original actor motion save,180-tick recovery,global snapshot replacement and sprite6 companion branch",
);
