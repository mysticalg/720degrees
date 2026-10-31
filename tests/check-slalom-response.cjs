const assert = require("node:assert/strict"),
  C = require("../src/original-contact.js");
for (let kind = 26; kind <= 35; kind++)
  for (const side of [0, 1])
    for (const pole of [false, true])
      for (const counter of [0, 124, 128]) {
        const a = { kind, pointer: 0xfffe, flags: 1 },
          b = { kind: 25, pointer: 0x5000, flags: 2 },
          s = { counter, statusFlags: 1 };
        const passed = C.slalomContact(a, b, s, side, pole),
          expected = !pole && ((kind >= 31 && kind <= 33) || !side);
        assert.equal(passed, expected);
        assert.equal(a.pointer, expected ? 2 : 0);
        assert.equal(b.pointer, expected ? 0x5004 : 0x5002);
        assert.equal(b.kind, expected ? 23 : 24);
        assert.equal(a.flags, 25);
        assert.equal(b.flags, 26);
        assert.equal(a.duration, 16);
        assert.equal(b.duration, 15);
        assert.equal(
          s.counter,
          expected ? Math.min(counter + 6, 128) : counter,
        );
        assert.equal(s.statusFlags, expected ? 5 : 1);
      }
console.log(
  "PASS all10 slalom types, geometric-side/pole outcomes, linked frame offsets, race cap and paired effect states",
);
