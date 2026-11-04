const assert = require("node:assert/strict");
global.window = { Skate720: {} };
require("../src/course-clock-data.js");
const D = window.Skate720.COURSE_CLOCK_DATA,
  C = require("../src/original-course-clock.js");
assert.deepEqual(
  D.duration.ramp.slice(1),
  [21, 22, 23, 24, 25, 26, 27, 28, 29, 30],
);
assert.deepEqual(
  D.duration.jump.slice(1),
  [25, 28, 24, 32, 28, 40, 36, 52, 48, 55],
);
for (const kind of ["ramp", "jump", "slalom", "downhill"])
  for (const advanced of [false, true])
    for (const seen of [false, true]) {
      const s = C.begin(kind, 1, D, advanced, seen),
        delay = !advanced && !seen ? 600 : 360;
      let count = 112;
      const initial = s.seconds;
      for (let f = 0; f < delay - 1; f++)
        count = C.tick(s, kind, count, f, false).counter;
      assert.equal(s.seconds, initial);
      assert.equal(count, 112);
      assert.equal(s.penalties, 0);
      const first = C.tick(s, kind, count, delay, false);
      count = first.counter;
      assert(first.penalty);
      assert.equal(s.delay, 300);
      assert.equal(
        s.seconds,
        initial - (kind === "ramp" || kind === "jump" ? 5 : 0),
      );
      assert.equal(count, kind === "ramp" || kind === "jump" ? 112 : 92);
      for (let f = 0; f < 299; f++)
        count = C.tick(s, kind, count, f, false).counter;
      assert.equal(s.penalties, 1);
      C.tick(s, kind, count, 300, false);
      assert.equal(s.penalties, 2);
    }
let s = C.begin("jump", 1, D);
s.delay = 1;
assert(C.start(s));
assert(!C.start(s));
for (let f = 0; f < 59; f++) C.tick(s, "jump", 0, f, false);
assert.equal(s.seconds, 25);
C.tick(s, "jump", 0, 59, true);
assert.equal(s.seconds, 24);
assert.equal(s.penalties, 0, "contact wins over deadline on the same frame");
s = C.begin("slalom", 1, D);
C.start(s);
assert.equal(C.tick(s, "slalom", 32, 16, true).counter, 32);
assert.equal(C.tick(s, "slalom", 32, 16, false).counter, 31);
s = C.begin("slalom", 1, D, true);
s.delay = 1;
assert.equal(C.tick(s, "slalom", 16, 0, false).counter, 0);
assert(s.expired);
assert.equal(s.phase, 5);
// Literal78BE comparison outcome: R0 counts38..0 and R3=(metric>>3)<<1.
for (let value = 0; value < 256; value++) {
  const tiles = C.bar("slalom", value, 0, 0).tiles;
  assert.equal(tiles.length, 20);
  for (let column = 0; column < 20; column++) {
    let tile = 0x9e;
    if (column < value >> 3) tile = 0x96;
    if (column === value >> 3) tile = 0x9e - (value & 7);
    assert.equal(tiles[column], tile);
  }
}
assert.equal(C.bar("ramp", 0, 6400, 0).value, 100);
assert.equal(C.bar("jump", 0, 3200, 0).value, 100);
assert.equal(C.bar(null, 0, 0, 12).tiles.length, 16);
console.log(
  "PASS ROM course setup, 600/360-frame start guard, -5/-20 penalties, 300-frame retries, clock gates and 256 bar states",
);
