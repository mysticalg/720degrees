const assert = require("node:assert/strict");
const A = require("../src/original-actors.js");
const ram = new Uint8Array(65536);
const write = (a, n) => {
  ram[a] = n;
  ram[a + 1] = n >> 8;
};
const sender = { slot: 1, packed: 0x529, bitmapIndex: 20, routeFlags: 0 };
const low = { slot: 0, sprite: 7, pointer: 0x5000, flags: 1, rate: 128 };
const high = { slot: 3, sprite: 8, pointer: 0x6000, flags: 2, rate: 128 };
const actors = new Map([
  [0, low],
  [3, high],
]);
write(0x09ae, 3);
for (const slot of [0, 1, 3]) write(0x0af8 + slot * 2, sender.packed);
ram[0x0e6a] = 0xff;
let trait = 16,
  link = 0x8120;
const m = {
  readRamByte: (a) => ram[a],
  readTraitByte: () => trait,
  readTypeWord: () => link,
};
const signal = () => A.signalRoutePartner(sender, m, (s) => actors.get(s));
assert.equal(signal(), high); // Highest matching record wins, not map order.
assert.equal(high.pointer, 0x120);
assert.equal(high.flags, 26);
assert.equal(high.rate, 5);
assert.equal(high.countdown, 5);
assert.equal(low.pointer, 0x5000);
sender.routeFlags = 1;
assert.equal(signal(), null);
sender.routeFlags = 0;
trait = 0;
assert.equal(signal(), null);
trait = 16;
write(0x0af8 + 6, 0x123);
link = 0x2345;
assert.equal(signal(), low);
assert.equal(low.pointer, 0x5002);
ram[0x0e6a] = 7;
assert.equal(signal(), null); // C9C8 player exclusion.
write(0x09ae, 0xffff);
assert.equal(signal(), null);
console.log(
  "PASS category3 partner search order, pose links, clock, turn/trait/player guards",
);
