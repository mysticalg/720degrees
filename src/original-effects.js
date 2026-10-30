/** Original effect identities: actor type4 is the pursuing bee swarm.
 * Actor53 uses576A for landing bursts and5772 for point graphics; those
 * adjacent directory entries are not a bee animation.
 */
(() => {
  const beeSequences = [20746];
  const beeRate = 4,
    beeColumns = 4,
    beePalette = 1;
  function beeEntry(frames) {
    return (
      beeSequences[0] +
      (Math.floor(Math.max(0, frames) / (beeRate + 1)) % 2) * 2
    );
  }
  /** F064-F0FA setup, original actor53. index0..9 means100..1000.
   * Native coordinates are pixels; the controller comparisons below convert
   * their deltas back to original64-unit words before applying ROM limits.
   */
  function beginLandingEffect(index, x, y, profile) {
    if (!Number.isInteger(index) || index < 0 || index > 9)
      throw new RangeError("Original landing effect index must be0..9");
    return {
      originalLanding: true,
      index,
      x: x + 16,
      y: y - 12 - ((profile & 7) >= 5 ? 32 : 0),
      phase: 0,
      rate: 3,
      countdown: 3,
      hold: 30,
      entry: 0x576a,
      life: 1,
    };
  }
  /** Bank12000 CPU7AA2-7B2C, then B378's separate animation clock.
   * The original burst reaches phase3 before selecting the point glyph.
   * The hold decrements only after the actor has moved away from the popup.
   */
  function tickLandingEffect(effect, playerX, playerY) {
    if (effect.phase === 3) {
      effect.entry = 0x5772 + effect.index * 2;
      effect.rate = 0;
      effect.phase = 4;
    } else if (effect.phase === 4) {
      const dx = Math.abs(Math.round((effect.x - playerX) * 64));
      const dy =
        (Math.abs(Math.round((effect.y - playerY) * 64)) - 512) & 65535;
      if (dx > 2048 || dy > 2560) {
        effect.hold = (effect.hold - 1) & 65535;
        if (effect.hold === 0) {
          effect.entry = 0x5786;
          effect.phase = 5;
          effect.hold = 3;
        }
      }
    } else if (effect.phase > 4) {
      effect.hold = (effect.hold - 1) & 65535;
      if (effect.hold === 0) effect.life = 0;
    }
    if (effect.rate > 0) {
      if (effect.countdown !== 0)
        effect.countdown = (effect.countdown - 1) & 255;
      else {
        effect.countdown = effect.rate;
        effect.phase = (effect.phase + 1) & 255;
        effect.entry += 2;
      }
    }
    return effect;
  }
  const api = Object.freeze({
    beginLandingEffect,
    tickLandingEffect,
    beeSequences,
    beeRate,
    beeColumns,
    beePalette,
    beeEntry,
  });
  if (typeof module !== "undefined") module.exports = api;
  else window.Skate720.OriginalEffects = api;
})();
