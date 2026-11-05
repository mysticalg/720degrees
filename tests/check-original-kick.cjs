const assert = require("node:assert/strict");
const K = require("../src/original-kick.js");
const G = require("../src/original-ground.js");
const R = require("../src/original-routines.js");
const trace = require("./fixtures/original-kick-trace.json");
const rows = trace.rows.map((row) =>
  Object.fromEntries(trace.columns.map((k, i) => [k, row[i]])),
);
const first = rows[0],
  state = K.begin();
let speed = first.speed;
const envelope = {
  target: first.target,
  impulse: first.impulse,
  previousMask: first.input & 128,
};
for (let i = 1; i < rows.length; i++) {
  const row = rows[i];
  assert.equal(
    row.frame,
    rows[i - 1].frame + 1,
    "reference must contain consecutive frames",
  );
  const held = !!(row.input & 128);
  G.kickInputTransition(envelope, row.input & 128, 0, speed);
  K.control(state, {
    held,
    speed,
    target: envelope.target,
    cap: 900,
    kind: 0,
    rampState: 0,
    profile: 32,
    bail: false,
    locked: false,
    turning: false,
    rate: R.kickAnimationRate(speed),
  });
  G.kickEnvelope(envelope, speed, 0, row.frame, held);
  speed = K.motion(state, speed);
  speed = G.terrainSpeed(
    speed,
    state.action === 3 ? 3 : 0,
    0,
    row.frame,
    envelope.target,
    32,
    0,
    0,
  );
  R.tickAnimationPhase(state);
  for (const [key, actual] of Object.entries({
    speed,
    target: envelope.target,
    impulse: envelope.impulse,
    inhibit: state.inhibit,
    mode: state.mode,
    action: state.action,
    bodyPhase: state.phase,
    rate: state.rate,
    countdown: state.countdown,
  }))
    assert.equal(actual, row[key], `original frame${row.frame} ${key}`);
}
// Admission's exact64-unit margin and suppression are independent of button edges.
const context = {
  held: true,
  speed: 400,
  target: 464,
  cap: 900,
  kind: 0,
  rampState: 0,
  profile: 32,
  bail: false,
  locked: false,
  turning: false,
  rate: 11,
};
assert(!K.control(K.begin(), context));
assert(K.control(K.begin(), { ...context, target: 465 }));
for (const patch of [
  { bail: true },
  { locked: true },
  { turning: true },
  ...Array.from({ length: 4 }, (_, i) => ({ profile: 4 + i })),
])
  assert(!K.control(K.begin(), { ...context, target: 800, ...patch }));
assert(
  !K.control(K.begin(), { ...context, speed: -385, kind: 3, rampState: 2 }),
);
assert(
  K.control(K.begin(), { ...context, speed: -384, kind: 3, rampState: 2 }),
);
// 4F26 forces384 only on consuming state2, never on starting a press.
for (const speed of [-600, 0, 127, 600]) {
  const state = K.begin();
  state.action = 2;
  assert.equal(K.motion(state, speed), speed <= 0 ? 384 : speed);
  assert.equal(state.action, 3);
}
console.log(
  `PASS ${rows.length - 1} consecutive original-ROM frames: kick admission, phases, target/impulse, speed and recovery; terrain/lock/ramp guards`,
);
