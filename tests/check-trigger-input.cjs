const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm");
const pad = {
    id: "standard",
    connected: true,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })),
  },
  S = {};
const context = {
  window: { Skate720: S, addEventListener() {} },
  document: { querySelector: () => null, querySelectorAll: () => [] },
  navigator: { getGamepads: () => [pad] },
  localStorage: { getItem: () => null },
};
vm.runInNewContext(
  fs.readFileSync(require.resolve("../src/input.js"), "utf8"),
  context,
);
const input = new S.Input({ addEventListener() {} });
for (const [index, name] of [
  [6, "pivotLeft"],
  [7, "pivotRight"],
]) {
  input.clear();
  pad.buttons[index].value = 0.56;
  input.poll();
  assert(input.pressed(name));
  assert(!input.held("kick"));
  assert.equal(input.throttle, 0);
  assert.equal(input.brake, 0);
  for (const value of [1, 0.4, 0.26]) {
    pad.buttons[index].value = value;
    input.poll();
    assert(input.held(name));
    assert(!input.pressed(name));
  }
  pad.buttons[index].value = 0.24;
  input.poll();
  assert(!input.held(name));
  pad.buttons[index].value = 0.56;
  input.poll();
  assert(input.pressed(name));
  pad.buttons[index].value = 0;
  input.poll();
}
pad.buttons[0].pressed = true;
pad.buttons[1].pressed = true;
input.poll();
assert(input.held("kick") && input.held("jump"));
assert.equal(input.throttle, 1);
pad.buttons[0].pressed = false;
pad.buttons[1].pressed = false;
pad.buttons[4].pressed = true;
input.poll();
assert.equal(input.padSpin, -1);
pad.buttons[4].pressed = false;
pad.buttons[5].pressed = true;
input.poll();
assert.equal(input.padSpin, 1);
console.log(
  "PASS trigger binding: LT/RT distinct press edges and hysteresis, no throttle/brake, A/B and shoulder air spins preserved",
);
