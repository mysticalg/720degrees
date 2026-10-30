const assert = require("node:assert/strict");
const C = require("../src/original-contact.js");
const pointer = 0x5000,
  words = new Map([
    [pointer, 0],
    [pointer + 2, 0],
    [pointer + 4, 0x400],
    [pointer + 6, 0x200],
    [pointer - 2, 0xf000],
    [pointer - 4, 0xf000],
  ]),
  read = (a) => words.get(a) || 0;
for (const [direction, dx, dy] of [
  [2, 120, 60],
  [6, -120, 60],
  [10, -120, -60],
  [14, 120, -60],
]) {
  const a = {
    kind: 12,
    extraPointer: pointer,
    actorX: 100,
    actorY: 100,
    direction,
    dx,
    dy,
  };
  const r = C.vehicleRear(a, read);
  assert(r);
  assert.equal(r.direction, direction);
  // Rear must lie outside the occupied mask in the opposite travel half-plane.
  const center = { x: 108, y: 96 };
  assert((r.x - center.x) * r.ux + (r.y - center.y) * 2 * r.uy < 0);
  for (let d = 0; d < 16; d++) {
    const delta = Math.min(
      (d - direction + 16) & 15,
      (direction - d + 16) & 15,
    );
    assert.equal(C.towHeadingAllowed(d, direction), delta <= 2);
  }
  assert.equal(C.vehicleRear({ ...a, kind: 58 }, read), null);
  assert.equal(C.vehicleRear({ ...a, dx: 0, dy: 0 }, read), null);
}
console.log(
  "PASS car rear follows four diagonal headings,original two-heading tolerance excludes nose/opposite approach,stationary/non-car actors rejected",
);
