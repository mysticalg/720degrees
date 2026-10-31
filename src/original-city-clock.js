/** F028-F062 and bank16000 CPU7F52-7F7E: original city countdown.
 * The44 bytes at bank3800:51E6 are four settings rows, eleven classes each.
 * Value0254 counts units;0FA6/0FA7 count simulation ticks per unit.
 */
(() => {
  const periods = [
    13, 13, 13, 13, 12, 12, 11, 11, 10, 10, 9, 15, 16, 16, 15, 14, 13, 12, 12,
    11, 11, 10, 12, 12, 12, 12, 11, 11, 10, 10, 9, 9, 8, 11, 11, 11, 10, 10, 9,
    9, 8, 8, 7, 7,
  ];
  const word = (n) => n & 65535,
    signed = (n) => (n << 16) >> 16;
  function reset(difficulty = 1, settings = 0) {
    if (!Number.isInteger(difficulty) || difficulty < 0 || difficulty > 10)
      throw new RangeError("Unrecovered city clock class");
    const period = periods[((settings >> 2) & 3) * 11 + difficulty];
    return { value: 127, period, countdown: period, statusFlags: 4 };
  }
  function adjust(state, amount) {
    const value = word(state.value + amount);
    state.value = signed(value) < 0 ? 0 : value;
    state.statusFlags = (state.statusFlags | 4) & 255;
  }
  function tick(state, phase = 0, submode = 0, attached = 0) {
    if (phase !== 0 || (submode | attached) & 255) return false;
    state.countdown = (state.countdown - 1) & 255;
    if (state.countdown) return false;
    state.countdown = state.period;
    adjust(state, -1);
    return true;
  }
  function seconds(state) {
    return state.value > 0
      ? ((state.value - 1) * state.period + state.countdown) / 60
      : 0;
  }
  const api = Object.freeze({ periods, reset, adjust, tick, seconds });
  if (typeof module !== "undefined") module.exports = api;
  else window.Skate720.OriginalCityClock = api;
})();
