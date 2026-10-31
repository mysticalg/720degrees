const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm");
const original = require("../src/original-actors.js");
const S = {},
  context = { window: { Skate720: S } };
vm.createContext(context);
vm.runInContext(
  fs.readFileSync(
    require("node:path").join(__dirname, "../src/traffic-runtime.js"),
    "utf8",
  ),
  context,
);
function scenario(reverse, senderSprite, boost = 1) {
  const ram = new Uint8Array(65536),
    write = (a, n) => {
      ram[a] = n;
      ram[a + 1] = n >> 8;
    };
  write(0x09ae, 1);
  write(0xaf8, 0x305);
  write(0xafa, 0x305);
  ram[0xe6a] = 255;
  const sender = {
    slot: 0,
    sprite: senderSprite,
    kind: 41,
    packed: 0x305,
    bitmapIndex: 2,
    routeFlags: 4,
    duration: 1,
    rate: 128,
    pointer: 0x4000,
    countdown: 0,
    dx: 10,
    dy: 20,
    x: 0,
    y: 0,
    towBoost: boost,
  };
  const partner = {
    slot: 1,
    sprite: senderSprite === 9 ? 5 : 9,
    kind: 38,
    packed: 0x305,
    bitmapIndex: 3,
    routeFlags: 4,
    duration: 1,
    rate: 128,
    pointer: 0x5000,
    countdown: 0,
    dx: 1,
    dy: 2,
    x: 0,
    y: 0,
  };
  const events = [];
  const runtime = Object.create(S.TrafficRuntime.prototype);
  runtime.actors = new Map(
    (reverse ? [partner, sender] : [sender, partner]).map((a) => [a.slot, a]),
  );
  runtime.S = {
    OriginalActors: {
      ...original,
      trafficRouteDue(a) {
        events.push(`control${a.sprite}`);
        return original.trafficRouteDue(a);
      },
      stepMotionActor(a, m) {
        events.push(`motion${a.sprite}`);
        return original.stepMotionActor(a, m);
      },
    },
  };
  runtime.memory = {
    readRamByte: (a) => ram[a],
    readTypeByte: (a) => (a === 0x623f + 41 ? 3 : a === 0x623f + 72 ? 6 : 1),
    readTraitByte: () => 16,
    readTypeWord: () => 0x1234,
  };
  runtime.route = (a) => {
    a.duration = 100;
    a.routeFlags = 12;
  };
  runtime.sync = () => {};
  runtime.remove = (slot) => {
    events.push(`remove${slot}`);
    runtime.actors.delete(slot);
  };
  runtime.advanceActors();
  return { events, sender, partner, runtime };
}
for (const senderSprite of [5, 9]) {
  const a = scenario(false, senderSprite),
    b = scenario(true, senderSprite);
  assert.deepEqual(a.events, ["control9", "control5", "motion9", "motion5"]);
  assert.deepEqual(a.events, b.events);
  assert.deepEqual(a.partner, b.partner);
  assert.equal(a.partner.pointer, 0x5002);
  assert.equal(a.partner.countdown, 4); // Signal5, then exactly one motion tick.
  assert.equal(a.sender.x, 10);
  assert.equal(a.partner.x, 1);
}
const boosted = scenario(false, 9, 2);
assert.deepEqual(boosted.events, [
  "control9",
  "control5",
  "motion9",
  "motion5",
  "control9",
  "motion9",
]);
assert.equal(boosted.sender.x, 20);
assert.equal(boosted.partner.x, 1);
Object.assign(boosted.partner, { kind: 72, duration: 1, routeFlags: 8 });
boosted.events.length = 0;
boosted.runtime.advanceActors();
assert.equal(boosted.runtime.actors.has(1), false);
assert(boosted.events.includes("remove1"));
assert(!boosted.events.includes("motion5"));
console.log(
  "PASS descending controller/motion passes, activation-order independence, same-tick partner signal, towing and expired pickup",
);
