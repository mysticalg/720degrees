const assert = require("node:assert/strict"),
  E = require("../src/original-effects.js");
for (let phase = 0; phase <= 9; phase++) {
  const s = E.beginBeeCapture(phase);
  if (phase !== 1) {
    assert.equal(s, null);
    continue;
  }
  assert.equal(s.phase, 8);
  assert.equal(s.timer, 60);
  for (let tick = 1; tick < 60; tick++) {
    assert.equal(E.tickBeeCapture(s), false);
    assert.equal(s.timer, 60 - tick);
  }
  assert.equal(E.tickBeeCapture(s), true);
  assert.equal(s.timer, 0);
  assert.equal(s.finished, true);
  for (let i = 0; i < 5; i++) assert.equal(E.tickBeeCapture(s), false);
}
console.log(
  "PASS original city-only bee capture,60tick terminal delay and single expiry",
);
