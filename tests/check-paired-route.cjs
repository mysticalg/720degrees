const assert = require("node:assert/strict");
const A = require("../src/original-actors.js");
const ram = new Uint8Array(65536);
const write = (a, n) => {
  ram[a] = n;
  ram[a + 1] = n >> 8;
};
ram[0x0e6a] = 255;
write(0x09ae, 3);
const sender = { slot: 0, kind: 43, packed: 0x305, bitmapIndex: 12 };
const first = { slot: 1, sprite: 8 },
  second = { slot: 2, sprite: 9 };
const active = new Map([
  [1, first],
  [2, second],
]);
write(0x0af8 + 2, 0x705);
write(0x0af8 + 4, 0x905);
let branch = 0,
  reads = [],
  routes = 0;
const m = {
  readRamByte: (a) => ram[a],
  readTraitByte: () => branch,
  readTypeWord: (a) => {
    reads.push(a);
    return a === 0x5408 ? 0x5200 : a === 0x540a ? 0x5300 : 0x8450;
  },
};
const run = (route = () => routes++) =>
  A.updatePairedRoute(sender, m, (s) => active.get(s), route);
const reset = () => {
  Object.assign(sender, {
    routeFlags: 8,
    pointer: 0x4000,
    rate: 7,
    duration: 1,
  });
  Object.assign(first, { rate: 128, pointer: 0x5000, flags: 0, duration: 22 });
  Object.assign(second, { rate: 128, pointer: 0x6000, flags: 0, duration: 33 });
  reads = [];
  routes = 0;
};
reset();
run();
assert.equal(routes, 1);
assert.equal(sender.pointer, 0x4000);
for (const kind of [43, 44]) {
  reset();
  branch = 1;
  sender.kind = kind;
  run();
  assert.equal(sender.pointer, kind === 43 ? 0x5200 : 0x5300);
  assert.equal(routes, 1);
  assert.equal(sender.rate, 7);
}
reset();
branch = 2;
assert.equal(run(), first);
assert.equal(first.pointer, 0x450);
assert.equal(first.rate, 4);
assert.equal(first.countdown, 4);
assert.equal(first.duration, 0x700);
assert.equal(second.duration, 33);
assert.equal(sender.rate, 135);
assert.equal(sender.duration, 0x7fff);
// Do not try the alternate when a first record exists but is not paused/live.
reset();
first.rate = 7;
assert.equal(run(), null);
assert.equal(second.rate, 128);
reset();
active.delete(1);
assert.equal(run(), null);
assert.equal(second.rate, 128);
active.set(1, first);
reset();
write(0x0afa, 0x706);
assert.equal(run(), second);
write(0x0afa, 0x705);
// A turn skips the signal; the route's *resulting* flag decides pausing.
reset();
sender.routeFlags = 9;
assert.equal(run(), null);
assert.equal(first.rate, 128);
assert.equal(sender.rate, 7);
reset();
run(() => {
  routes++;
  sender.routeFlags |= 1;
});
assert.equal(sender.rate, 7);
assert.equal(sender.duration, 1);
reset();
sender.routeFlags = 9;
run(() => (sender.routeFlags &= ~1));
assert.equal(sender.rate, 135);
assert.equal(sender.duration, 0x7fff);
console.log(
  "PASS category8 marker dispatch, both pose resets, partner priority/rate4, pause and post-route turn guards",
);
