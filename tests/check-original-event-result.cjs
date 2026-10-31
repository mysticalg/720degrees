const assert = require("node:assert/strict");
const fs = require("node:fs"),
  vm = require("node:vm");
const original = require("../src/original-event-result.js");
const context = { window: { Skate720: {} } };
vm.runInNewContext(
  fs.readFileSync(require.resolve("../src/event-result-data.js"), "utf8"),
  context,
);
const data = JSON.parse(
  JSON.stringify(context.window.Skate720.EVENT_RESULT_DATA),
);

assert.deepEqual(original.thresholds("ramp", 1, data), [2304, 3456, 4608]);
assert.deepEqual(original.thresholds("jump", 1, data), [1152, 1728, 2304]);
for (const kind of ["ramp", "jump"])
  for (let index = 0; index <= 10; index++) {
    const limits = original.thresholds(kind, index, data);
    assert.equal(original.medal(0, limits), 0);
    for (let rank = 1; rank <= 3; rank++) {
      assert.equal(original.medal(limits[rank - 1] - 1, limits), rank - 1);
      assert.equal(original.medal(limits[rank - 1], limits), rank);
      assert.equal(original.medal(limits[rank - 1] + 1, limits), rank);
    }
    for (const negative of [-1, 32768, 65535])
      assert.equal(original.medal(negative, limits), 0);
  }
assert.equal(original.result("ramp", 4608, 1, data).packedMedal, 192);
assert.equal(original.result("ramp", 4608, 1, data).cash, 50);
assert.equal(original.result("jump", 4608, 10, data).cash, 350); // class10 silver
assert.equal(original.cash(1, 7, data), 175);
assert.equal(original.cash(0, 7, data), 0);
assert.equal(original.cash(3, 2000, data), 34464); // original low-word product
assert.deepEqual(original.thresholds("slalom", 1, data), [0, 22, 44]);
assert.deepEqual(original.thresholds("downhill", 1, data), [0, 32, 64]);
for (const kind of ["slalom", "downhill"])
  for (let index = 1; index <= 10; index++) {
    const limits = original.thresholds(kind, index, data);
    assert.equal(original.medal(0, limits), 0);
    assert.equal(original.medal(1, limits), 1);
    for (let rank = 2; rank <= 3; rank++) {
      assert.equal(original.medal(limits[rank - 1] - 1, limits), rank - 1);
      assert.equal(original.medal(limits[rank - 1], limits), rank);
    }
    assert.equal(
      original.result(kind, limits[2], index, data).cash,
      50 * index,
    );
  }
assert.throws(() => original.thresholds("slalom", 0, data), RangeError);
assert.throws(() => original.thresholds("ramp", 11, data), RangeError);
console.log(
  "PASS original park results:42 class/park threshold sets, inclusive boundaries, signed words, packed medals and class-scaled cash",
);

//5EF6/5F02: >10 is checked AFTER consuming the first dollar.
for (const [cash, expected, remaining] of [
  [1, [10], 0],
  [10, [10], 9],
  [11, [10], 10],
  [12, [10, 100], 1],
  [100, [10, 100], 89],
]) {
  const s = original.beginCashTally(cash, true);
  for (let i = 0; i < 120; i++) assert.deepEqual(original.tickCashTally(s), []);
  assert.equal(s.phase, "cash");
  assert.deepEqual(original.tickCashTally(s), expected);
  assert.equal(s.cash, remaining);
}
for (const cash of [0, 1, 10, 11, 12, 100, 9999, 32767, 32768, 65535]) {
  const s = original.beginCashTally(cash, true);
  let frames = 0,
    total = 0;
  while (s.phase !== "done" && frames++ < 5000)
    total += original.tickCashTally(s).reduce((a, b) => a + b, 0);
  assert.equal(s.phase, "done");
  assert.equal(total, cash < 32768 ? cash * 10 : 0);
  assert.equal(s.cash, cash < 32768 ? 0 : cash);
  assert.equal(s.total, total);
  const before = JSON.stringify(s);
  assert.deepEqual(original.tickCashTally(s), []);
  assert.equal(JSON.stringify(s), before);
}
for (const advanced of [false, true])
  for (const settings of [0, 16, 32, 48]) {
    const s = original.beginCashTally(0, advanced, settings),
      wait = 120 + (!advanced && settings !== 16 ? 120 : 0);
    for (let i = 1; i < wait; i++) {
      original.tickCashTally(s);
      assert.notEqual(s.phase, "done");
    }
    original.tickCashTally(s);
    assert.equal(s.phase, "done");
  }
console.log(
  "PASS original terminal cash step boundaries, signed admission, complete10-points-per-dollar tally and message waits",
);
