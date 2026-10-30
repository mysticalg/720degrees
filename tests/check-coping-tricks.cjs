const assert = require("node:assert/strict");
const ramp = require("../src/original-ramp-animation.js"),
  pipe = require("../src/halfpipe.js");
// 5264 speed band0 + 7D12 direction offsets select distinct original paths.
for (const side of [7, 23]) {
  for (const direction of [0, 4, 8, 12])
    assert.equal(
      ramp.setupRampAnimation(225, 225, direction, 0, side).action,
      0x4f,
    );
  for (const direction of [2, 10])
    assert.equal(
      ramp.setupRampAnimation(225, 225, direction, 0, side).action,
      0x4d,
    );
}
const slide = {
  action: 0x50,
  flags: 4,
  direction: 0,
  velocityX: 142,
  velocityY: 0xffb8,
};
ramp.tickRampSecondary(slide, 0);
assert.equal(slide.action, 0x44);
assert.equal(slide.hold, 40);
assert.equal(slide.velocityX, 213);
assert.equal(slide.velocityY, 0xff94);
for (const rawProfile of [1, 17]) {
  const span = pipe.copingSpan(
    { name: "ramp-1" },
    { rawProfile, lip: { x: 800, y: 500 } },
  );
  assert.equal(span.maxX - span.minX, 216, "full recovered artwork cap width");
}
const path = {
  from: { x: 712, y: 451 },
  control: { x: 712, y: 600 },
  floor: { x: 644, y: 600 },
};
assert.deepEqual(pipe.returnPoint(path, 0), path.from);
assert.deepEqual(pipe.returnPoint(path, 1), path.floor);
const half = pipe.returnPoint(path, 0.5);
assert(half.x < path.from.x && half.y > path.from.y);
console.log(
  "PASS original angled grind/straight stall selection,40-tick/1.5x slide and full coping/curved return geometry",
);
