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
  // E196-E1CE: modes0..4 use eight directional directories;5/6 are
  // direction-independent. Entries and animation lengths are original ROM.
  const beeAnimations = [
    [
      [20740, 20742],
      [20746, 20748],
      [20752, 20754],
      [20758, 20760],
      [20764, 20766],
      [20770, 20772],
      [20776, 20778],
      [20782, 20784],
    ],
    [
      [20788, 20790],
      [20794, 20796],
      [20800, 20802],
      [20806, 20808],
      [20812, 20814],
      [20818, 20820],
      [20824, 20826],
      [20830, 20832],
    ],
    [
      [20836, 20838],
      [20842, 20844],
      [20848, 20850],
      [20854, 20856],
      [20860, 20862],
      [20866, 20868],
      [20872, 20874],
      [20878, 20880],
    ],
    [
      [20884, 20886, 20888, 20890, 20892, 20894],
      [20898, 20900, 20902, 20904, 20906, 20908],
      [20912, 20914, 20916, 20918, 20920, 20922],
      [20926, 20928, 20930, 20932, 20934, 20936],
      [20940, 20942, 20944, 20946, 20948, 20950],
      [20954, 20956, 20958, 20960, 20962, 20964],
      [20968, 20970, 20972, 20974, 20976, 20978],
      [20982, 20984, 20986, 20988, 20990, 20992],
    ],
    [
      [20996, 20998, 21000, 21002, 21004, 21006, 21008, 21010],
      [20996, 20998, 21000, 21002, 21004, 21006, 21008, 21010],
      [21014, 21016, 21018, 21020, 21022, 21024, 21026, 21028],
      [21014, 21016, 21018, 21020, 21022, 21024, 21026, 21028],
      [21014, 21016, 21018, 21020, 21022, 21024, 21026, 21028],
      [21014, 21016, 21018, 21020, 21022, 21024, 21026, 21028],
      [20996, 20998, 21000, 21002, 21004, 21006, 21008, 21010],
      [20996, 20998, 21000, 21002, 21004, 21006, 21008, 21010],
    ],
    [
      [21032, 21034],
      [21032, 21034],
      [21032, 21034],
      [21032, 21034],
      [21032, 21034],
      [21032, 21034],
      [21032, 21034],
      [21032, 21034],
    ],
    [
      [21038, 21040, 21042, 21044],
      [21038, 21040, 21042, 21044],
      [21038, 21040, 21042, 21044],
      [21038, 21040, 21042, 21044],
      [21038, 21040, 21042, 21044],
      [21038, 21040, 21042, 21044],
      [21038, 21040, 21042, 21044],
      [21038, 21040, 21042, 21044],
    ],
  ];
  function chasingBeeEntry(frames, direction, enraged = false, appearance = 4) {
    const sequence =
      beeAnimations[enraged ? appearance : 0][(direction & 15) >> 1];
    return sequence[Math.floor(Math.max(0, frames) / 5) % sequence.length];
  }
  /** E07C/E086 and5018: initial250-tick speed step, then FE0D[class].
   * Pursuit positioning remains the native browser adapter.
   */
  function beeStage(frames, difficulty = 1) {
    const delay =
      [250, 250, 245, 240, 235, 230, 225, 200, 175, 150, 150][difficulty] ||
      250;
    return Math.min(
      7,
      1 + (frames < 250 ? 0 : 1 + Math.floor((frames - 250) / delay)),
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
    beeAnimations,
    chasingBeeEntry,
    beeStage,
  });
  if (typeof module !== "undefined") module.exports = api;
  else window.Skate720.OriginalEffects = api;
})();
