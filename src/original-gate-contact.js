/** Gate contacts A734-A782,9E52-9F88 and steering-release4A42/4AD4/4DEC.
 * Fields retain their original signed words/bytes. Native XY integration is
 * separate from this translated controller; no CPU instructions run here.
 */
(() => {
  const s16 = (n) => (n << 16) >> 16,
    s8 = (n) => (n << 24) >> 24;
  function contact(state, kind, readByte) {
    state.currentProfile = kind === 20 ? 7 : 15;
    if (state.contactProfile === state.currentProfile) return false;
    state.contactProfile = state.currentProfile;
    let speed = s16(state.speed);
    state.speed = speed;
    state.needsBail = false;
    if (state.movementState === 0) {
      state.heading = (state.heading ^ 8) & 15;
      state.speed = 352;
      state.vertical = Math.min(0, s16(state.vertical));
      state.mode = 2;
      state.clock = 6;
      return true;
    }
    const index =
      (state.currentProfile & 56) * 2 + (state.heading ^ (speed < 0 ? 8 : 0));
    const target = s8(readByte(0x7908 + index));
    if (target === 63) {
      state.target = state.heading;
      state.speed = speed >= 0 ? -352 : 352;
    } else {
      state.target = target;
      if (speed < 0) {
        state.target = s8(target ^ 8);
        if (speed > -352) state.speed = -352;
      } else if (speed < 352) state.speed = 352;
    }
    // 01EA2 requests A2F0's separate bail controller before the final tests.
    if (state.movementState === 2) {
      if (s16(state.speed) < 0) state.target = s8(state.target ^ 8);
      state.needsBail = true;
      state.action = 1;
      state.movementState = 1;
    }
    if (state.action === 1 && s16(state.speed) < 0) {
      state.target = s8(state.target ^ 8);
      state.speed = s16(-state.speed);
    }
    state.mode = 1;
    state.clock = 8;
    return true;
  }
  function steer(state, inputHeading) {
    let target = s8(state.target ?? -1);
    if (target >= 0) {
      if (target < 63 && state.movementState !== 1) target = state.target = 63;
      let desired = target < 63 ? target : inputHeading;
      if (target >= 63 && desired === state.heading) state.target = -1;
      let delta = desired - state.heading,
        step = delta === 0 ? 0 : delta > 0 ? 1 : -1;
      if (Math.abs(delta) > 8) step = -step;
      state.heading = (state.heading + step + 16) & 15;
    }
    const away = state.currentProfile !== state.contactProfile;
    if (state.mode === 2 && away && --state.clock === 0) {
      state.mode = 0;
      state.contactProfile = 254;
    }
    if (state.mode === 1) {
      if (state.heading === state.target && away && --state.clock === 0) {
        state.target = 63;
        state.mode = 0;
        state.contactProfile = 254;
      }
      if (s8(state.target) < 0) {
        state.mode = 0;
        state.contactProfile = 254;
      }
    }
    return state;
  }
  const api = Object.freeze({ contact, steer });
  if (typeof module !== "undefined") module.exports = api;
  else window.Skate720.OriginalGateContact = api;
})();
