const assert = require("node:assert/strict"),
  P = require("../src/original-parks.js");
for (let played = 0; played < 16; played++)
  for (let entered = 0; entered < 16; entered++)
    for (let disabled = 0; disabled < 16; disabled++) {
      const s = { ...P.begin(), played, entered, disabled };
      assert.equal(P.closedMask(s), played);
      for (let i = 0; i < 4; i++)
        assert.equal(
          P.available(s, i),
          !((played | entered | disabled) & (1 << i)),
        );
    }
for (let opponentPark = 0; opponentPark < 4; opponentPark++) {
  const s = { ...P.begin(), twoPlayer: true, rotation: 1, opponentPark };
  assert.equal(P.closedMask(s), 15 ^ (1 << opponentPark));
  assert.equal(P.available(s, opponentPark), true);
  s.played |= 1 << opponentPark;
  assert.equal(P.closedMask(s), 15);
}
for (const rotation of [0, 1, 2, 3, 4, 5]) {
  const s = { ...P.begin(), twoPlayer: true, rotation };
  P.startCourse(s, 2);
  assert.equal(s.played, rotation === 1 || rotation === 4 ? 4 : 0);
}
for (const order of [
  [0, 1, 2, 3],
  [3, 2, 0, 1],
  [1, 3, 2, 0],
]) {
  const s = P.begin();
  for (let n = 0; n < 4; n++) {
    const i = order[n];
    assert(P.enter(s, i));
    assert(!P.enter(s, i));
    P.startCourse(s, i);
    assert.equal(P.finishCourse(s), n === 3);
    P.returnToCity(s);
    assert.equal(s.entered, 0);
    assert.equal(s.disabled, 0);
    if (n < 3) assert(!P.available(s, i));
  }
  assert.equal(s.completed, 0);
  assert.equal(s.played, 0);
  for (let i = 0; i < 4; i++) assert(P.available(s, i));
}
assert.equal(P.available(P.begin(), -1), false);
assert.equal(P.available(P.begin(), 4), false);
const soloMode1 = { ...P.begin(), rotation: 1, opponentPark: 2 };
assert.equal(P.closedMask(soloMode1), 11); // E6FE has no01F6 guard.
assert.equal(P.available(soloMode1, 0), true); // Entry53C4 does test01F6.
console.log(
  "PASS4096 original mask combinations, two-player closure guards, entry latches and arbitrary-order four-park reopening",
);

//90BA already has a separately translated setupTableIndex: compare every
// signed class, park and stage boundary used by the progression controller.
const R = require("../src/original-routines.js");
for (let requestedClass = -10; requestedClass <= 10; requestedClass++)
  for (const stage of [0, 1, 11, 12, 15, 255])
    for (let index = 0; index < 4; index++) {
      const state = { ...P.begin(), requestedClass, stage };
      assert.equal(
        P.courseClass(state, index),
        R.setupTableIndex(requestedClass, index, stage),
      );
    }
function run(experienced, order, medals) {
  const s = P.begin(experienced),
    rows = [];
  for (let n = 0; n < order.length; n++) {
    const i = order[n],
      selected = P.courseClass(s, i);
    P.startCourse(s, i);
    const packed = P.recordResult(s, i, medals[n] * 64);
    P.finishCourse(s);
    P.advanceClass(s, i);
    P.returnToCity(s);
    assert.equal(packed, (medals[n] << 6) | (i << 4) | selected);
    assert.equal(s.results[n], packed);
    rows.push([selected, s.requestedClass, s.cityClass]);
  }
  return rows;
}
assert.deepEqual(run(false, [3, 2, 0, 1, 3, 2, 0, 1], Array(8).fill(0)), [
  [1, 1, 1],
  [1, 1, 1],
  [1, 1, 1],
  [1, -2, 2],
  [4, -2, 2],
  [2, -2, 2],
  [3, -2, 2],
  [5, -2, 2],
]);
assert.deepEqual(run(true, [2, 1, 3, 0], [0, 0, 0, 0]), [
  [4, -1, 1],
  [3, -1, 1],
  [2, -1, 1],
  [1, -2, 2],
]);
assert.deepEqual(run(true, [2, 1, 3, 0], [1, 0, 0, 0]), [
  [4, 4, 4],
  [4, 4, 4],
  [4, 4, 4],
  [4, -5, 5],
]);
for (const medal of [64, 128, 192]) {
  const s = {
    ...P.begin(true),
    requestedClass: -9,
    completed: 0,
    previousMedal: medal,
    stage: 12,
  };
  P.advanceClass(s, 2);
  assert.equal(s.requestedClass, -10);
  assert.equal(s.cityClass, 10);
}
const alternating = { ...P.begin(true), twoPlayer: true, rotation: 1 };
P.recordResult(alternating, 2, 192);
assert.equal(alternating.stage, 0);
assert.equal(alternating.previousMedal, 0);
P.advanceClass(alternating, 2, 64);
assert.equal(alternating.requestedClass, -5);
console.log(
  "PASS ROM signed class selection, packed result history, medal pinning, four-course progression and stage12 cap",
);

for (let stage = 0; stage <= 20; stage++)
  for (const twoPlayer of [false, true])
    for (const rotation of [0, 1, 2, 3, 4])
      assert.equal(
        P.runFinished({ ...P.begin(), stage, twoPlayer, rotation }),
        stage > (twoPlayer && rotation === 2 ? 14 : 15),
      );
assert.equal(P.begin().advancedSkill, false);
assert.equal(P.begin(true).advancedSkill, true);
const firstSet = P.begin();
for (let i = 0; i < 4; i++) P.finishCourse(firstSet);
assert.equal(firstSet.advancedSkill, true);
console.log("PASS697C terminal stage guards and715C advanced-skill latch");
