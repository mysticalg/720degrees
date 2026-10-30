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
    return { profile: q < 400 ? 24 : q < 450 ? 17 : 7 };
  },
};
const point = { x: 550, y: 725 - 0.001 },
  projectedWall = pipe.wallAt(artwork, point.x, point.y);
assert(projectedWall && projectedWall.rawProfile === 17);
const top = pipe.projectSlopePoint(artwork, point);
assert(Math.abs(top.y - top.x * 0.5 - 382) < 0.02);
assert.equal(pipe.riseForWall(artwork, projectedWall, 0), 0);
const frozen = pipe.groundRise(artwork, {
  x: 0,
  y: 0,
  halfpipeFlight: { wall: projectedWall },
});
assert.equal(frozen, pipe.riseForWall(artwork, projectedWall, 1));
assert.equal(
  pipe.riseForWall({ name: "ramp-1" }, { ...projectedWall, rawProfile: 1 }, 1),
  0,
);
console.log(
  "PASS original-art south coping projection, frozen aerial plane and unchanged north wall",
);
