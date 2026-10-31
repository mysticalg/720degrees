const assert = require("node:assert/strict"),
  pipe = require("../src/halfpipe.js");
const level = {
  name: "ramp-1",
  sample(x, y) {
    return { profile: y - x * 0.5 < 272 ? 1 : 24 };
  },
};
for (let lane = 0; lane <= 6; lane++) {
  const floor = { x: 636 + lane * 32, y: 590 + lane * 16 };
  let last;
  for (let n = 0; n <= 100; n++) {
    const t = n / 100,
      point = { x: floor.x + 176 * t, y: floor.y - 88 * t };
    const projected = pipe.projectSlopePoint(level, point);
    assert(
      Math.abs(
        projected.x +
          2 * (projected.y + 100 * pipe.heightProgress(t)) -
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
  const lip = { x: floor.x + 176, y: floor.y - 88 };
  assert.equal(
    pipe.groundShift(level, {
      ...lip,
      halfpipeFlight: { wall: { rawProfile: 1 } },
    }),
    -100,
    "no horizontal snap on takeoff",
  );
}
console.log(
  "PASS seven original north panel guides, curve/vert continuity, white coping and frozen aerial X",
);

// Independent artwork fixtures: brown seam pixels (208,144,96) read from
// assets/levels/ramp-1.png on flat planks and just below the white coping.
// These catch a smooth but wrongly phased mapping into the adjacent plank.
for (let lane = 0; lane < 5; lane++) {
  const start = { x: 611 + lane * 32, y: 626 + lane * 16 };
  const laneCoordinate = start.x + 2 * start.y;
  const rawLipX = (laneCoordinate - 192) / 2;
  const lip = { x: rawLipX, y: rawLipX * 0.5 + 96 };
  const top = pipe.projectSlopePoint(level, lip);
  assert(Math.abs(top.x - (735 + lane * 32)) < 1);
  assert(Math.abs(top.y - (464 + lane * 16)) < 1);
}
console.log(
  "PASS five independent original-art flat/coping seam pairs stay in the same plank",
);
