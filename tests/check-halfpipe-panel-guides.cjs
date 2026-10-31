const assert = require("node:assert/strict"),
  pipe = require("../src/halfpipe.js");
const level = {
  name: "ramp-1",
  sample(x, y) {
    return { profile: y - x * 0.5 < 312 ? 1 : 24 };
  },
};
for (let lane = 0; lane <= 6; lane++) {
  const floor = { x: 624 + lane * 32, y: 624 + lane * 16 };
  let last;
  for (let n = 0; n <= 100; n++) {
    const t = n / 100,
      point = { x: floor.x + 216 * t, y: floor.y - 108 * t };
    const projected = pipe.projectSlopePoint(level, point);
    assert(
      Math.abs(
        projected.x +
          2 * (projected.y + 128 * pipe.heightProgress(t)) -
          (point.x + 2 * point.y),
      ) < 1e-7,
    );
    if (t > pipe.VERT_START && last)
      assert(
        Math.abs(projected.x - last.x) < 1e-7,
        "upper vert follows the same panel seam",
      );
    last = projected;
  }
  assert(Math.abs(last.x - (712 + lane * 32)) < 1e-7);
  assert(
    Math.abs(last.y - (452 + lane * 16)) < 1e-7,
    "original white coping endpoint",
  );
  const lip = { x: floor.x + 216, y: floor.y - 108 };
  assert.equal(
    pipe.groundShift(level, {
      ...lip,
      halfpipeFlight: { wall: { rawProfile: 1 } },
    }),
    -128,
    "no horizontal snap on takeoff",
  );
}
console.log(
  "PASS seven original north panel guides, curve/vert continuity, white coping and frozen aerial X",
);
