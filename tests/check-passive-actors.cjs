const assert = require("node:assert/strict"),
  A = require("../src/original-actors.js");
for (let flags = 0; flags < 256; flags++) {
  const a = { duration: 1, routeFlags: 4, flags };
  const result = A.passiveActorStep(a, 9);
  assert.equal(result, flags & 6 ? null : "retire");
  assert.equal(a.duration, flags & 6 ? 15 : 0);
  if (flags & 6) {
    for (let i = 0; i < 14; i++) assert.equal(A.passiveActorStep(a, 9), null);
    a.flags &= ~6;
    assert.equal(A.passiveActorStep(a, 9), "retire");
  }
}
let a = { duration: 1, routeFlags: 4 };
assert.equal(A.passiveActorStep(a, 5), "viewport");
assert.equal(a.duration, 16);
for (let i = 0; i < 15; i++) assert.equal(A.passiveActorStep(a, 5), null);
assert.equal(A.passiveActorStep(a, 5), "viewport");
assert.equal(a.duration, 16);
a = { duration: 1, routeFlags: 4 };
assert.equal(A.passiveActorStep(a, 0), null);
assert.equal(a.duration, 0);
for (const category of [0, 5, 6, 9]) {
  a = { duration: 0, routeFlags: 4 };
  assert.equal(A.passiveActorStep(a, category), null);
  assert.equal(a.duration, 0);
}
for (const category of [1, 2, 3, 4, 7, 8]) {
  a = { duration: 1, routeFlags: 4 };
  assert.equal(A.passiveActorStep(a, category), null);
  assert.equal(a.duration, 1);
}
console.log(
  "PASS passive controller dispatch, cash16tick refresh, all256 effect flags and15tick retirement recheck",
);
