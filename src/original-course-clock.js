/** Revision-4 bank16000 course phases, clocks and alpha time/score bar.
 * World-space contact is supplied by the caller; no CPU interpreter is used.
 */
(() => {
  const signed = (n) => (n << 16) >> 16;
  function begin(kind, index, data, advanced = false, seen = false) {
    if (!Number.isInteger(index) || index < 1 || index > 10)
      throw new RangeError("Course class must be1..10");
    const race = kind === "slalom" || kind === "downhill";
    return {
      phase: 2,
      started: false,
      delay: !advanced && !seen ? 600 : 360,
      seconds: race ? 0 : data.duration[kind][index],
      subsecond: 0,
      penalties: 0,
      expired: false,
    };
  }
  /** 66BA-66EE: type9 terrain has set0F27. Only phase2 can start.
   * 0F1E is loaded for timed parks; race time uses the global16-frame gate.
   * FE6B selects the park's music command at this transition.
   */
  function start(state) {
    if (state.phase !== 2) return false;
    state.phase = 3;
    state.started = true;
    state.subsecond = 60;
    return true;
  }
  /** 85C0 decrements0F22.66F0-6746 applies65D6(-5), which shifts the
   * delta twice for race counters. A depleted clock goes straight to phase5.
   * 7A3A-7A9C decrements seconds every60 ticks or the race every16 frames.
   */
  function tick(state, kind, counter, frame, airborne) {
    let penalty = false;
    const race = kind === "slalom" || kind === "downhill";
    if (state.delay > 0) state.delay--;
    if (state.phase === 2 && state.delay === 0) {
      penalty = true;
      state.penalties++;
      if (race) counter = (counter - 20) & 65535;
      else state.seconds = (state.seconds - 5) & 65535;
      if (signed(race ? counter : state.seconds) <= 0) {
        state.seconds = 0;
        counter = 0;
        state.phase = 5;
        state.expired = true;
      } else state.delay = 300;
    }
    if (state.phase === 3) {
      if (race) {
        if (signed(counter) > 0 && (frame & 15) === 0 && !airborne)
          counter = (counter - 1) & 65535;
      } else if (state.subsecond > 0 && --state.subsecond === 0) {
        state.seconds = (state.seconds - 1) & 65535;
        if (state.seconds) state.subsecond = 60;
      }
      if (signed(race ? counter : state.seconds) <= 0) state.expired = true;
    }
    return { counter, penalty };
  }
  /** 78BE-7980: original two-row alpha bar, not a percentage/progress bar.
   * Race parks show remaining0F20; ramp/jump show deferred0F34 shifted6/5.
   * R3=value>>3, R4=value&7; 20 columns, filled from the right.
   */
  function bar(kind, counter, points, cityValue) {
    const city = kind === null;
    let value = city
      ? cityValue
      : kind === "slalom" || kind === "downhill"
        ? counter
        : signed(points) >> (kind === "ramp" ? 6 : 5);
    value = signed(value);
    const whole = value >> 3,
      fraction = value & 7,
      cells = [];
    for (let column = city ? 15 : 19; column >= 0; column -= 1) {
      // R0 runs 30..0 or38..0 in steps of2: sixteen or twenty cells.
      const r0 = column * 2;
      const tile =
        r0 < whole * 2 ? 0x96 : r0 > whole * 2 ? 0x9e : 0x9e - fraction;
      cells.push({ tile });
    }
    return {
      x: city ? 192 : 176,
      y: 32,
      tiles: cells.reverse().map((c) => c.tile),
      value,
    };
  }
  const api = { begin, start, tick, bar };
  if (typeof module !== "undefined") module.exports = api;
  else window.Skate720.OriginalCourseClock = api;
})();
