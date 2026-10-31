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
assert.throws(() => original.thresholds("slalom", 1, data), RangeError);
assert.throws(() => original.thresholds("ramp", 11, data), RangeError);
console.log(
  "PASS original park results:22 class/park threshold sets, inclusive boundaries, signed words, packed medals and class-scaled cash",
);
