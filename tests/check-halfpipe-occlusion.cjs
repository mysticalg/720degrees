const assert = require("node:assert/strict");
const pipe = require("../src/halfpipe.js"),
  terrain = require("../src/terrain-collision.js");
const level = {
  kind: "ramp",
  columns: 48,
  rows: 24,
  sample(x, y) {
    if (y < 0 || y >= 192 || x < 0 || x >= 384)
      return { profile: 120, blocked: true, type: 19 };
    const profile = x >= 200 ? 24 : x < 80 ? 7 : x >= 140 && x < 152 ? 15 : 17;
    return { profile, blocked: false, type: 0 };
  },
};
level.halfpipeWallAt = (x, y) => pipe.wallAt(level, x, y);
const wall = pipe.wallAt(level, 144, 96);
assert(
  wall && wall.rawProfile === 17,
  "short foreground rail must retain underlying southern curve",
);
assert(wall.profile >= 18 && wall.profile <= 21);
assert(Math.abs(wall.lip.x - 80) < 0.02);
assert.equal(terrain.blocked(level, 144, 96), false);
assert.equal(terrain.blocked(level, 144, 96, true), false);
assert.equal(terrain.blocked(level, 144, 96, "slopes"), true);
assert.equal(
  terrain.blocked(level, 64, 96, true),
  true,
  "actual coping face stays solid",
);
assert.equal(
  pipe.wallAt({ sample: () => ({ profile: 15 }) }, 144, 96),
  null,
  "do not erase unrelated fences",
);
const broad = {
  sample(x) {
    return {
      profile: x >= 200 ? 24 : x < 80 ? 7 : x >= 120 && x < 164 ? 15 : 17,
    };
  },
};
assert.equal(
  pipe.wallAt(broad, 144, 96),
  null,
  "do not bridge an unbounded rail",
);
console.log(
  "PASS southern foreground occlusion: bounded curve bridge, shared slope/wall overlay, real coping and wide fences retained",
);
// The recovered artwork's white south coping is y=x/2+382. Raw terrain
// coordinates describe the plane behind the foreground rail, not this line.
const artwork = {
  name: "ramp-1",
  sample(x, y) {
    const q = y - x * 0.5;
    return { profile: q < 400 ? 24 : q < 448 ? 17 : 7 };
  },
};
const point = { x: 550, y: 723 - 0.001 },
  projectedWall = pipe.wallAt(artwork, point.x, point.y);
assert(projectedWall && projectedWall.rawProfile === 17);
const top = pipe.projectSlopePoint(artwork, point);
assert(Math.abs(top.y - top.x * 0.5 - 382) < 0.02);
assert.equal(pipe.riseForWall(artwork, projectedWall, 0), 8);
const frozen = pipe.groundRise(artwork, {
  x: 0,
  y: 0,
  halfpipeFlight: { wall: projectedWall },
});
assert.equal(frozen, pipe.riseForWall(artwork, projectedWall, 1));
assert.equal(
  pipe.riseForWall({ name: "ramp-1" }, { ...projectedWall, rawProfile: 1 }, 1),
  64,
);
console.log(
  "PASS original-art coping projection and frozen aerial plane",
);

const lower = pipe.projectSlopePoint(artwork, { x: 688, y: 744 });
assert(
  Math.abs(lower.x - 704) < 1e-6 && Math.abs(lower.y - 736) < 1e-6,
  "lower curve joins the flat floor without an along-pipe offset",
);
const coping = pipe.projectSlopePoint(artwork, { x: 640, y: 768 });
assert(Math.abs(coping.x - 640) < 1e-6 && Math.abs(coping.y - 702) < 1e-6);
console.log(
  "PASS lane-aligned lower curve and unchanged white coping endpoints share the same projection",
);

// Ground-plane travel must not gain an along-pipe component merely from
// entering a display warp. Height changes screen Y separately on the curve.
for (let q = 320; q < 400; q += 0.25) {
  const player = { x: 1020 - q, y: (1020 - q) * 0.5 + q };
  const dx = pipe.groundShift(artwork, player),
    dy = -pipe.groundRise(artwork, player);
  assert(Math.abs(dx + 2 * dy) < 1e-9, "flat approach preserves its lane");
}
for (let n = 0; n <= 100; n++) {
  const progress = n / 100,
    x = 600 - 48 * progress,
    y = 700 + 24 * progress;
  const player = { x, y },
    projected = {
      x: x + pipe.groundShift(artwork, player),
      y: y - pipe.groundRise(artwork, player),
    };
  const elevation = 66 * pipe.heightProgress(progress);
  assert(
    Math.abs(projected.x + 2 * (projected.y + elevation) - (x + 2 * y)) < 1e-7,
    "curve only raises the rider, never slides the ground lane sideways",
  );
}
const small = 1e-5,
  floor = { x: 600, y: 700 },
  next = { x: 600 - 48 * small, y: 700 + 24 * small };
const a = pipe.projectSlopePoint(artwork, floor),
  b = pipe.projectSlopePoint(artwork, next);
assert(
  Math.abs((b.y - a.y) / (b.x - a.x) + 0.5) < 1e-4,
  "curve foot tangent matches flat isometric travel",
);
console.log(
  "PASS lane-stable flat approach, elevation-only curve projection and continuous floor tangent",
);
