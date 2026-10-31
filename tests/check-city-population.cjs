const assert = require("assert/strict"),
  fx = require("../src/original-effects.js"),
  contact = require("../src/original-contact.js");
for (let kind = 72; kind <= 82; kind++)
  assert.equal(
    contact.pickupPoints(kind),
    [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000][kind - 72],
  );
assert.equal(contact.pickupPoints(71), 0);
assert.equal(contact.riderCash(57), 1);
for (let mode = 0; mode < 7; mode++)
  for (let direction = 0; direction < 16; direction += 2) {
    const frames = new Set();
    for (let t = 0; t < 100; t++)
      frames.add(fx.chasingBeeEntry(t, direction, true, mode));
    assert.deepEqual([...frames], fx.beeAnimations[mode][direction / 2]);
    assert([...frames].every((a) => a >= 0x5104 && a <= 0x5234));
  }
assert.equal(fx.beeStage(249, 1), 1);
assert.equal(fx.beeStage(250, 1), 2);
assert.equal(fx.beeStage(749, 1), 3);
assert.equal(fx.beeStage(750, 1), 4);
assert.equal(fx.beeStage(50000, 1), 7);
console.log(
  "PASS original point/cash pickup awards, all seven directional swarm sequences and speed-stage boundaries",
);
