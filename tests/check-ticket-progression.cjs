const assert = require("node:assert/strict"),
  T = require("../src/original-tickets.js");
for (let i = 0; i < 4; i++)
  assert.equal(T.begin(0, i).tickets, [1, 0, 2, 3][i]);
for (const [row, boundaries] of [
  [0, [5000, 15000, 25000, 40000, 55000, 70000]],
  [1, [3000, 7000, 15000, 25000, 35000, 45000]],
  [2, [8000, 20000, 35000, 52500, 70000, 87500]],
  [3, [12000, 25000, 40000, 60000, 80000, 100000]],
]) {
  const s = T.begin(row);
  let previous = 0;
  for (const boundary of boundaries) {
    assert.equal(s.threshold, boundary);
    assert.equal(T.award(s, boundary - 1), 0);
    assert.equal(T.award(s, boundary), 1);
    assert.equal(s.tickets, Math.min(4, 2 + previous));
    previous++;
  }
  assert.equal(s.stage, 4);
}
let s = T.begin();
assert.equal(T.award(s, 45000), 4);
assert.equal(s.tickets, 4);
assert.equal(s.threshold, 55000);
assert.equal(s.stage, 4);
s = T.begin();
assert.equal(T.award(s, 15000, true), 2);
assert.equal(s.tickets, 1);
assert.equal(s.threshold, 25000);
for (let count = 0; count <= 4; count++) {
  s = T.begin();
  s.tickets = count;
  assert.equal(T.continueTicket(s), count === 0);
  assert.equal(s.tickets, count || 1);
}
s = T.begin();
assert.equal(T.change(s, -1), 0);
assert.equal(T.change(s, 1), 1);
assert.equal(T.change(s, 10), 4);
s.tickets = 0;
assert.equal(T.change(s, -1), 255); // Caller admission prevents this source byte underflow.
console.log(
  "PASS all4 ROM threshold schedules, exact crossings, multi-awards/cap4, phase5 suppression and continue-only refill",
);
