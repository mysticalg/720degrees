/** Revision4 bail setup A2F0-A42C and recovery1E00050F8-5190.
 * Original words/frames; native collision detection decides when to invoke it.
 * Sound commands and event callbacks remain caller responsibilities.
 */
(() => {
  const word = (x) => x & 65535,
    signed = (x) => (x << 16) >> 16;
  const recoveryFrames = [120, 80, 50, 40];
  const helmetLimits = [895, 1015, 1135, 1255];
  const downhillDirections = [
    10, 14, 2, 6, 12, 0, 4, 8, 14, 2, 6, 10, 0, 4, 8, 12, 14, 14, 14, 6, 6, 6,
    6, 6, 6, 6, 6, 14, 14, 14, 14, 14,
  ];
  function beginBail(
    speed,
    direction,
    facing,
    profile,
    helmet,
    pads,
    airborne,
    vertical,
    kind,
    readWord,
  ) {
    speed = signed(speed);
    direction &= 15;
    facing &= 15;
    if (airborne) {
      speed = 352;
      vertical = Math.min(0, signed(vertical));
    }
    if (speed < 0) {
      speed = signed(-speed);
      direction ^= 8;
    }
    const limit = helmetLimits[helmet & 3];
    const animated = speed >= limit && !(profile & 7);
    let pointer, rate;
    if (animated) {
      speed = limit;
      pointer = readWord(0x4488 + direction * 2);
      rate = 6;
    } else {
      pointer = 0x4428 + facing * 2;
      rate = 0;
      if (
        kind === 3 &&
        (profile & 7) >= 5 &&
        speed < signed(-signed(vertical) * 2)
      )
        speed = signed(-signed(vertical) * 2);
      else speed = Math.max(384, Math.min(640, speed));
    }
    return {
      speed,
      direction,
      pointer,
      rate,
      countdown: rate,
      phase: 0,
      timer: recoveryFrames[pads & 3],
      vertical: signed(vertical),
      airborne,
      finished: false,
    };
  }
  function tickBail(state, profile, kickTarget, blocked) {
    if (state.timer !== 0) state.timer = word(state.timer - 1);
    if (signed(kickTarget) >= 896 && state.timer !== 0)
      state.timer = word(state.timer - 1);
    state.finished = state.timer === 0;
    if (!(profile & 7)) {
      if (!blocked) state.speed = Math.max(0, signed(state.speed - 20));
    } else state.direction = downhillDirections[(profile & 255) >> 3] & 255;
    return state;
  }
  const api = Object.freeze({
    beginBail,
    tickBail,
    recoveryFrames,
    helmetLimits,
  });
  if (typeof module !== "undefined") module.exports = api;
  else window.Skate720.OriginalBail = api;
})();
