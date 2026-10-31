const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm"),
  score = require("../src/original-landing-score.js");
const c = { window: { Skate720: {} } };
vm.runInNewContext(
  fs.readFileSync(require.resolve("../src/landing-score-data.js"), "utf8"),
  c,
);
const d = c.window.Skate720.LANDING_SCORE_DATA;
const base = {
  kind: 2,
  frames: 48,
  rotation: 0,
  drop: 0,
  gapCount: 10,
  gap: true,
  backwards: false,
  takeoffBackwards: false,
  takeoffDirection: 4,
  direction: 4,
  profile: 10,
  target: false,
  classIndex: 1,
};
assert.deepEqual(
  [0, 288, 576].map(
    (rotation) =>
      score.award({ ...base, rotation }, score.createState(), d).points,
  ),
  [200, 300, 400],
);
assert.equal(
  score.award({ ...base, rotation: -288 }, score.createState(), d).points,
  300,
);
const jump = { ...base, kind: 4, frames: 60, rotation: 288, drop: 0 };
assert.equal(
  score.award({ ...jump, target: false }, score.createState(), d).points,
  800,
);
assert.equal(
  score.award({ ...jump, target: true }, score.createState(), d).points,
  900,
);
const repeated = score.createState(),
  awards = Array.from(
    { length: 4 },
    () => score.award({ ...base, gapCount: 0 }, repeated, d).points,
  );
assert.equal(awards[3], 0);
const long = score.award({ ...base, frames: 60 }, repeated, d);
assert(long.points > 0);
assert.equal(repeated.repeats[4], 3);
for (const kind of [2, 4])
  for (const frames of [0, 29, 30, 40, 41, 56, 57, 100])
    for (const rotation of [0, 144, 288, 576, -576]) {
      const v = score.award(
        { ...base, kind, frames, rotation },
        score.createState(),
        d,
      );
      assert(Number.isInteger(v.points) && v.points >= 0 && v.points <= 1000);
    }
console.log(
  "PASS original landing score: spin signs, target modifier, repeated-trick exhaustion/refill and80 frame/rotation boundaries",
);

assert.deepEqual(Array.from(d.resetQuota), [2, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
for (const kind of [0, 1]) {
  const plain = score.award({ ...base, kind }, score.createState(), d);
  const spin = score.award(
    { ...base, kind, rotation: 288 },
    score.createState(),
    d,
  );
  assert(
    spin.points > plain.points,
    "City/slalom spin must affect original score",
  );
}
//Two distinct, positive first-use signatures at class1 replenish all entries.
const variety = score.createState(1, d);
variety.repeats[7] = 0;
score.award({ ...base, kind: 0, frames: 32, gapCount: 0 }, variety, d);
assert.equal(variety.resetQuota, 1);
assert.equal(variety.repeats[7], 0);
score.award(
  { ...base, kind: 0, frames: 32, gapCount: 0, rotation: 144 },
  variety,
  d,
);
assert.equal(variety.resetQuota, 2);
assert.equal(variety.repeats[7], 3);
assert.equal(variety.repeats[2], 2); //Decrement occurs AFTER the reset.
const q = variety.resetQuota;
variety.repeats[7] = 0;
score.resetRepeats(variety, 2, 1, d);
assert.equal(variety.repeats[7], 2);
assert.equal(variety.resetQuota, q);
variety.fatigue = 128;
for (let frame = 1; frame < 32; frame++) score.tickFatigue(variety, frame);
assert.equal(variety.fatigue, 128);
score.tickFatigue(variety, 32);
assert.equal(variety.fatigue, 64);
score.tickFatigue(variety, 64);
assert.equal(variety.fatigue, 32);
const rollover = score.createState(1, d);
rollover.landings = 255;
score.award({ ...base }, rollover, d);
assert.equal(rollover.landings, 0);
console.log(
  "PASS city/slalom spin-sensitive scores, original4649 quotas/reset ordering, long-air partial recovery and32-frame fatigue decay",
);
