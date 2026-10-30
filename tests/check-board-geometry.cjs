const assert = require("node:assert/strict");
const G = require("../src/board-geometry.js");
const diamond = G.hull([
  { x: 0, y: -8 },
  { x: 16, y: 0 },
  { x: 0, y: 8 },
  { x: -16, y: 0 },
  { x: 0, y: 0 },
  { x: 0, y: -8 },
]);
assert.equal(diamond.length, 4);
assert(G.overlapsRect(diamond, { x: 14, y: -1, width: 2, height: 2 }));
assert(!G.overlapsRect(diamond, { x: 14, y: 6, width: 2, height: 2 }));
assert(!G.overlapsRect(diamond, { x: 16, y: 0, width: 4, height: 4 }));
assert(!G.overlapsRect([], { x: 0, y: 0, width: 4, height: 4 }));
const shape = { x: 0, y: 0, width: 32 * 64, height: 16 * 64 },
  actor = { actorX: 100, actorY: 100, height: 0 };
const footprint = { polygon: diamond };
assert(
  G.touchesActor(footprint, { x: 100, y: 100 }, actor, shape, [{ x: 0, y: 0 }]),
);
assert(
  !G.touchesActor(footprint, { x: 100, y: 100 }, actor, shape, [
    { x: 24, y: 0 },
  ]),
);
assert(!G.touchesActor(footprint, { x: 100, y: 100 }, actor, shape, []));
assert(
  !G.touchesActor(footprint, { x: 100, y: 60 }, actor, shape, [{ x: 0, y: 0 }]),
);
console.log(
  "PASS board convex outline: diagonal corners, strict touching, original occupied actor cells, transparent holes and airborne clearance",
);
