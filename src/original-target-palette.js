/** DD10-DD5A: cycle the three target pens through four colours every fourth simulation tick.
 * DD58 SOB writes pens 3,2,1 only; backdrop pen zero stays unchanged.
 * 7C5E sets 0EA9=60 on a target landing. Zero restores the static scenery.
 * This is palette animation, not rotation of the target geometry.
 */
(() => {
  const api = {
    trigger(state) {
      state.targetPaletteTicks = 60;
    },
    tick(state) {
      state.targetPaletteClock = ((state.targetPaletteClock || 0) + 1) & 3;
      if (!state.targetPaletteClock && state.targetPaletteTicks > 0) {
        state.targetPaletteTicks--;
        state.targetPalettePhase = state.targetPaletteTicks
          ? state.targetPaletteTicks & 3
          : -1;
      }
    },
    phase(state) {
      return state.targetPalettePhase ?? -1;
    },
  };
  if (typeof module !== "undefined") module.exports = api;
  else window.Skate720.OriginalTargetPalette = api;
})();
