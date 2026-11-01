const assert = require("node:assert/strict"),
  S = require("../src/original-slide.js"),
  G = require("../src/original-ground.js");
for (let facing = 0; facing < 16; facing++)
  for (let travel = 0; travel < 16; travel++) {
    const accepted = [
      [3, 4, 5, 11, 12, 13],
      [4, 5, 6, 7, 12, 13, 14, 15],
      [5, 6, 7, 13, 14, 15],
      [0, 6, 7, 8, 14, 15],
      [0, 1, 7, 8, 9, 15],
      [0, 1, 2, 8, 9, 10],
      [1, 2, 3, 9, 10, 11],
      [1, 2, 3, 4, 9, 10, 11, 12],
    ][facing & 7].includes(travel);
    assert.equal(S.permitted(facing, travel), accepted);
    assert.equal(!!S.begin(facing, travel, 8, 600), accepted);
    assert.equal(S.begin(facing, travel, 7, 600), null);
  }
assert.equal(S.begin(0, 12, 36, 127), null);
const s = S.begin(0, 12, 36, 600);
assert(s);
assert.equal(s.travel, 12);
assert.equal(s.facing, 0);
assert.deepEqual(S.steer(s, 0, 600), { speed: 600, done: false });
let pose;
for (let n = 0; n < 25; n++) pose = S.tick(s);
assert.equal(s.phase, 6);
assert.equal(s.action, 11);
assert.equal(pose.board, s.boardBase + 12);
assert.deepEqual(S.steer(s, 12, 600), { speed: 600, done: true });
const reverse = S.begin(5, 0, 45, 600),
  r = S.steer(reverse, 5, 600);
assert.equal(r.speed, -600);
assert.equal(reverse.travel, 8);
assert.equal(r.done, false);
assert.deepEqual(S.steer(reverse, 5, 100), { speed: 100, done: true });
assert.equal(G.terrainSpeed(600, 10, 0, 1, 0, 0, 0, 2), 584);
assert.equal(G.terrainSpeed(-600, 11, 0, 1, 0, 0, 0, 2), -584);
assert.equal(G.terrainSpeed(600, 0, 0, 1, 0, 0, 0, 2), 600);
console.log(
  "PASS ROM A2BE angle masks,8-count dial gate, moderate-speed entry, travel/facing split, A45A board sequence, E51A clocks and16-unit slide drag",
);
