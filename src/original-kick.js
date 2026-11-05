/** Revision4 kick admission92A0-92E4 and animationE2A2/E49C/E4A6.
 * This is the original action controller, not a button-held speed multiplier.
 * Call control BEFORE the envelope's 16-frame update, then motion before
 * 4F34 terrain arithmetic, then the ordinary actor clock after physics.
 */
(() => {
  const signed = (n) => (n << 16) >> 16;
  function begin() {
    return {
      originalKick: true,
      action: 0,
      mode: 0,
      inhibit: 1,
      phase: 0,
      rate: 0,
      countdown: 0,
    };
  }
  function control(state, c) {
    const speed = signed(c.speed),
      target = signed(c.target);
    // 92A0's input is the complemented game byte0193: held is nonzero.
    // Target/cap comparison uses the previous envelope, before92EA updates it.
    if (
      c.held &&
      target > signed(speed + (target > signed(c.cap) ? 0 : 64)) &&
      !(c.kind === 3 && c.rampState <= 2 && speed < -384)
    )
      state.inhibit = 0;
    if (c.bail || c.locked || c.turning || (c.profile & 7) >= 4)
      state.inhibit = 1;
    let started = false;
    if (!state.inhibit && state.mode !== 1) {
      state.inhibit = 1;
      state.mode = state.action = 1;
      state.phase = 0;
      state.rate = state.countdown = c.rate & 255;
      started = true;
    }
    // E49C advances action1 at body phase2, without incrementing that phase.
    if (state.action === 1 && state.phase === 2) state.action = 2;
    else if (state.action === 3 && state.phase === 3) {
      // E514->E238 clears mode/rate/action and rearms the admission guard.
      state.action = state.mode = state.rate = 0;
      state.inhibit = 1;
    }
    return started;
  }
  /** 4EFA-4F32 consumes action2 once; action3 alone accelerates toward02FC. */
  function motion(state, speed) {
    speed = signed(speed);
    if (state.action === 2) {
      state.action = 3;
      if (speed <= 0) speed = 384;
    }
    return speed;
  }
  const api = Object.freeze({ begin, control, motion });
  if (typeof module !== "undefined") module.exports = api;
  else window.Skate720.OriginalKick = api;
})();
