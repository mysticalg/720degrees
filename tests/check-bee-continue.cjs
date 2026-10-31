const assert = require("node:assert/strict"),
  E = require("../src/original-effects.js");
for (const [settings, limit] of [
  [0, 2],
  [16, 0],
  [32, 1],
  [48, 3],
]) {
  assert.equal(E.beeContinueLimit(settings), limit);
  for (let count = 1; count <= 5; count++)
    assert.equal(
      E.beginBeeContinue(count, settings).phase,
      count > limit ? 5 : 9,
    );
}
let s = E.beginBeeContinue(1, 0);
assert.equal(E.acceptBeeContinue(s, true, true), false);
for (let i = 0; i < 59; i++) assert.equal(E.tickBeeContinue(s), false);
assert.equal(s.seconds, 10);
assert.equal(s.ticks, 1);
assert.equal(E.tickBeeContinue(s), true);
assert.equal(s.seconds, 9);
assert.equal(E.acceptBeeContinue(s, false, true), false);
assert.equal(E.acceptBeeContinue(s, true, false), false);
assert.equal(E.acceptBeeContinue(s, true, true), true);
assert.equal(s.plays, 2);
assert.equal(s.phase, 0);
assert.equal(E.acceptBeeContinue(s, true, true), false);
s = E.beginBeeContinue(1, 0);
let changes = 0;
for (let i = 0; i < 600; i++) if (E.tickBeeContinue(s)) changes++;
assert.equal(changes, 10);
assert.equal(s.phase, 5);
assert.equal(s.seconds, 0);
assert.equal(s.ticks, 0);
assert.equal(E.tickBeeContinue(s), false);
console.log(
  "PASS original FE9E continue limits, first-second input guard, credit/button admission and600tick expiry",
);
