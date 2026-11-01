const assert = require("node:assert/strict"),
  W = require("../src/halfpipe-width.js"),
  P = require("../src/halfpipe.js");
assert.equal(W.extra, 216);
for (let x = 0; x < 1496; x += 13)
  for (let y = 0; y < 1260; y += 17) {
    const p = W.sourcePoint(x, y);
    assert.equal(p.y - p.x * 0.5, y - x * 0.5);
    const u = x * 0.5 + y;
    if (u < W.cut) assert.deepEqual(p, { x, y });
    else if (u >= W.cut + W.extra)
      assert.deepEqual(p, { x: x - 216, y: y - 108 });
    else assert(p.x * 0.5 + p.y >= W.cut && p.x * 0.5 + p.y < W.cut + W.strip);
  }
const old = { name: "ramp-1" },
  wide = { name: "ramp-1", halfpipeExtraWidth: 216 };
for (const rawProfile of [1, 17]) {
  const wall = { rawProfile, lip: { x: 800, y: 496 } };
  assert.equal(
    P.copingSpan(old, wall).maxX - P.copingSpan(old, wall).minX,
    216,
  );
  assert.equal(
    P.copingSpan(wide, wall).maxX - P.copingSpan(wide, wall).minX,
    432,
  );
}
for (const u of [930, 1000, 1100, 1200, 1280])
  for (const q of [100, 200, 260, 404, 432, 444]) {
    const w = P.wallAt(wide, u - q, (u - q) * 0.5 + q);
    assert(w);
    assert(Number.isFinite(w.progress));
    assert.equal(w.lip.y - w.lip.x * 0.5, q < 300 ? 96 : 448);
  }
console.log(
  "PASS doubled coping spans, extra lanes on both faces, unchanged across-ramp coordinates and exact artwork/collision strip mapping",
);
