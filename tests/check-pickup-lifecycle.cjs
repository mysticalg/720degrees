const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm"),
  path = require("node:path");
const actors = require("../src/original-actors.js"),
  contact = require("../src/original-contact.js");
const S = {},
  context = { window: { Skate720: S } };
vm.createContext(context);
vm.runInContext(
  fs.readFileSync(path.join(__dirname, "../src/traffic-runtime.js"), "utf8"),
  context,
);
for (let kind = 72; kind <= 82; kind++) {
  const a = {
    kind,
    slot: 100,
    sprite: 8,
    extraPointer: 0x7000,
    flags: 1,
    routeFlags: 0,
    rate: 0,
    countdown: 0,
    pointer: 0x5000,
    duration: 0,
    x: 0,
    y: 0,
  };
  const r = Object.create(S.TrafficRuntime.prototype);
  r.S = { OriginalActors: actors };
  r.actors = new Map([[a.slot, a]]);
  r.memory = {
    readTypeByte: () => 6,
    readTypeWord: () => 0x8500,
    readSpriteByte: () => 0,
  };
  r.sync = () => {};
  let removed = 0;
  r.remove = (slot) => {
    removed++;
    r.actors.delete(slot);
  };
  for (let i = 0; i < 160; i++) r.advanceActors();
  assert.equal(removed, 0); // Uncollected has no expiry.
  contact.collectPointPickup(a);
  assert.equal(a.extraPointer, 0);
  assert.equal(a.routeFlags, 8);
  assert.equal(a.flags, 97);
  assert.equal(a.countdown, 7);
  for (let tick = 1; tick < 128; tick++) {
    r.advanceActors();
    assert.equal(a.duration, 128 - tick);
    assert.equal(removed, 0);
  }
  r.advanceActors();
  assert.equal(removed, 1);
  assert.equal(r.actors.size, 0);
  r.advanceActors();
  assert.equal(removed, 1);
}
console.log(
  "PASS all11 point pickups: uncollected persistence, original collection clocks and exact128tick single retirement",
);
