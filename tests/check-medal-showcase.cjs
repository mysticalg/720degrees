const assert = require("node:assert/strict"),
  scene = require("../src/original-medal-showcase.js");
const input = [0xc1, 0x92, 0x63, 0x34, 0xc5];
const s = scene.begin(input, 4);
input[0] = 0;
const reveals = [];
for (let i = 0; !s.done && i < 1000; i++) {
  const r = scene.tick(s);
  if (r) reveals.push({ ...r, frame: s.frame });
}
assert.deepEqual(
  reveals.map((r) => r.frame),
  [1, 11, 21, 31, 41],
);
assert.deepEqual(
  reveals.map((r) => r.slot),
  [0, 1, 2, 3, 4],
);
assert.deepEqual(
  reveals.map((r) => r.command),
  [0x66, 0x65, 0x64, 0x63, 0x66],
);
assert.equal(s.weighted, 3 + 4 + 3 + 0 + 15);
assert.equal(s.frame, 251); // final current-row wait40 + tail120+5*10.
assert.equal(scene.tick(s), null);
assert.equal(s.frame, 251);
const empty = scene.begin([], 0);
for (let i = 0; i < 121; i++) scene.tick(empty);
assert(empty.done);
const full = scene.begin(Array(20).fill(255), 0);
assert.equal(full.records.length, 16);
console.log(
  "PASS original medal packing,10/40-frame row waits, weighted score, tail and bounded records",
);
