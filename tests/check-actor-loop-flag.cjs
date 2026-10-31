const assert = require("node:assert/strict"),
  A = require("../src/original-actors.js");
const make = () => ({
  pointer: 0x4000,
  rate: 4,
  countdown: 0,
  phase: 3,
  routeFlags: 0,
  dirty: 0,
});
let a = make();
a.routeFlags = 32;
assert(A.tickDescriptor(a, () => 0x8200));
assert.equal(a.pointer, 0x200);
assert.equal(a.phase, 0);
assert.equal(a.rate, 0);
assert.equal(a.countdown, 4);
assert.equal(a.dirty, 24);
assert.equal(
  A.tickDescriptor(a, () => {
    throw Error("Stopped descriptor read");
  }),
  false,
);
// A type-level snapshot cannot force a loop to stop after its route clears20.
a = make();
a.stopOnLoop = true;
assert(A.tickDescriptor(a, () => 0x8200));
assert.equal(a.rate, 4);
a.countdown = 0;
a.routeFlags = 32;
assert(A.tickDescriptor(a, () => 0x1234));
assert.equal(a.rate, 4);
assert.equal(a.phase, 1);
// Set the flag after a sequence started: stop only at the actual loop link.
a.countdown = 0;
assert(A.tickDescriptor(a, () => 0x8200));
assert.equal(a.rate, 0);
for (const rate of [0, 128, 132, 255]) {
  a = make();
  a.rate = rate;
  a.routeFlags = 32;
  assert.equal(
    A.tickDescriptor(a, () => {
      throw Error("Paused descriptor read");
    }),
    false,
  );
  assert.equal(a.pointer, 0x4000);
}
console.log(
  "PASS live04B0 stop flag, linked/ordinary poses, stopped and paused descriptor clocks",
);
