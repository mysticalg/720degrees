const assert = require("node:assert/strict"),
  c = require("../src/original-contact.js");
for (const [height, want] of [
  [-32768, true],
  [-1, true],
  [0, true],
  [895, true],
  [896, false],
  [32767, false],
  [65535, true],
]) {
  assert.equal(c.pedestrianKnockdown(height, 9), want);
  assert.equal(c.pedestrianKnockdown(height, 9, 9), false);
}
const actor = {
  kind: 50,
  duration: 200,
  extraPointer: 0x7114,
  dx: 100,
  dy: -70,
  routeFlags: 9,
  flags: 1,
  phase: 7,
};
const reads = [];
c.knockDownActor(actor, (a) => {
  reads.push(a);
  return 0x6200;
});
assert.deepEqual(reads, [0x6046 + 100]);
for (const k of ["duration", "extraPointer", "dx", "dy", "phase"])
  assert.equal(actor[k], 0);
assert.equal(actor.pointer, 0x6200);
assert.equal(actor.routeFlags, 73);
assert.equal(actor.flags, 25);
assert.equal(actor.rate, 8);
assert.equal(actor.countdown, 8);
console.log(
  "PASS A60C signed14px boundary/attached exclusion;4F24/D498 actor hit-directory and state",
);

assert.deepEqual(
  Array.from({ length: 10 }, (_, i) => c.riderCash(56 + i)),
  [1, 1, 10, 20, 5, 5, 10, 20, 10, 10],
);
assert.equal(c.riderCash(50), 0);
const reward = { kind: 255, index: 5 };
assert.deepEqual(
  [50, 50, 51, 51].map((k) => c.airbornePedestrianReward(reward, k).points),
  [500, 500, 400, 400],
);
assert.equal(reward.index, 3);
reward.index = 0;
assert.deepEqual(c.airbornePedestrianReward(reward, 50), {
  points: 0,
  index: -1,
});
console.log(
  "PASS A70C rider cash table and A64C original repeated-kind airborne reward state",
);
