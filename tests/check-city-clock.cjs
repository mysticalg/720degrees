const assert = require("node:assert/strict"),
  C = require("../src/original-city-clock.js");
assert.equal(C.periods.length, 44);
for (let settings = 0; settings < 4; settings++)
  for (let difficulty = 0; difficulty <= 10; difficulty++) {
    const s = C.reset(difficulty, settings << 2),
      period = C.periods[settings * 11 + difficulty];
    assert.equal(s.period, period);
    assert.equal(s.value, 127);
    assert.equal(C.seconds(s), (127 * period) / 60);
    for (let i = 1; i < 127 * period; i++) C.tick(s);
    assert.equal(s.value, 1);
    assert.equal(s.countdown, 1);
    assert.equal(C.seconds(s), 1 / 60);
    C.tick(s);
    assert.equal(s.value, 0);
    assert.equal(C.seconds(s), 0);
  }
for (const args of [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
  [0, 0, 255],
]) {
  const s = C.reset(),
    before = { ...s };
  for (let i = 0; i < 60; i++) C.tick(s, ...args);
  assert.deepEqual(s, before);
}
let s = C.reset();
C.adjust(s, 5);
assert.equal(s.value, 132);
C.adjust(s, -133);
assert.equal(s.value, 0);
s.value = 32767;
C.adjust(s, 1);
assert.equal(s.value, 0);
s = C.reset();
s.countdown = 0;
C.tick(s);
assert.equal(s.countdown, 255);
assert.equal(s.value, 127);
assert.throws(() => C.reset(11));
assert.throws(() => C.reset(-1));
console.log(
  "PASS all44 original class/settings clock durations, final-tick boundary, scene/attachment freezes and signed adjustments",
);
