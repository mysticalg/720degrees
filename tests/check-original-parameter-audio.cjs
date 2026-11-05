const assert = require("node:assert/strict"),
  vm = require("node:vm"),
  fs = require("node:fs");
class MockAudio {
  constructor(src) {
    this.src = src;
    this.currentTime = 0;
    this.paused = true;
    this.plays = 0;
  }
  play() {
    this.paused = false;
    this.plays++;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
}
class MockFoley {
  constructor() {
    this.enabled = false;
    this.volume = 0.45;
  }
  effect() {
    return false;
  }
  stop() {}
}
const sandbox = {
  window: { Skate720: { SkateFoley: MockFoley } },
  Audio: MockAudio,
  localStorage: { getItem: () => null, setItem: () => {} },
};
vm.runInNewContext(
  fs.readFileSync(__dirname + "/../src/audio.js", "utf8"),
  sandbox,
);
const a = new sandbox.window.Skate720.AudioSystem(),
  g = { mode: "city", paused: false, player: { bail: {}, skid: null } };
assert(a.effect("crash", { originalCommand: 0x54 }));
let low = a.clips["rom-84"];
assert(!low.paused);
assert(!low.loop);
low.currentTime = 0.4;
g.paused = true;
a.syncOriginalMotion(g);
assert(low.paused);
assert.equal(low.currentTime, 0.4);
g.paused = false;
a.syncOriginalMotion(g);
assert(!low.paused);
assert.equal(low.plays, 2);
g.player.bail = null;
a.syncOriginalMotion(g);
assert(low.paused);
assert.equal(low.currentTime, 0);
assert(!a.motionClips.impact);
g.player.skid = { original: true };
a.effect("skid", { originalCommand: 0x57 });
let slide = a.clips["rom-87"];
assert(slide.loop);
assert(!slide.paused);
g.player.bail = {};
a.effect("crash", { originalCommand: 0x56 });
assert(slide.paused);
assert(!a.motionClips.slide);
let impact = a.clips["rom-86"];
impact.onended();
assert(!a.motionClips.impact);
a.muted = true;
assert.equal(a.effect("crash", { originalCommand: 0x54 }), false);
assert(!a.motionClips.impact);
a.muted = false;
a.effect("skid", { originalCommand: 0x57 });
g.mode = "result";
a.syncOriginalMotion(g);
assert(slide.paused);
assert(!a.motionClips.slide);
g.mode = "city";
a.effect("skid", { originalCommand: 0x57 });
a.stop();
assert.equal(Object.keys(a.motionClips).length, 0);
assert(slide.paused);
console.log(
  "PASS initialized ROM54/56/57 dispatch, recovery/cancel, pause/resume, scene reset and mute; independent of enhanced skate pack",
);
