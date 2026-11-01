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
   * Compatibility estimator; live pursuit now keeps the original delay/stage fields.
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
  const beeIntervals = [250, 250, 245, 240, 235, 230, 225, 200, 175, 150, 150];
  const beeWord = (n) => n & 65535,
    beeSigned = (n) => (n << 16) >> 16;
  /** E0C2-E102: spawn around the wrapping camera, behind player motion. */
  function beginBeePursuit(cameraX, cameraY, playerDX, playerDY, appearance) {
    return {
      x: beeWord(cameraX + (beeSigned(playerDX) < 0 ? 0x8e00 : 0xf200)),
      y: beeWord(-cameraY + (beeSigned(playerDY) < 0 ? 0x6e00 : 0x1200)),
      dx: 0,
      dy: 0,
      delay: 0,
      speedClock: 250,
      stage: 1,
      direction: 255,
      appearance,
      form: 0,
      animationFrames: 0,
      firstTick: true,
    };
  }
  /** Native display adapter: place the16-bit bee coordinate in the same
   *1024px world image as the player. Never accumulate a separate unwrapped
   *position: recovery/camera corrections can otherwise strand it a wrap away.
   */
  function beeWorldPosition(state, player) {
    const x = beeWord(Math.round((player.x - 40) * 64));
    const y = beeWord(Math.round(0xa000 - (player.y + 11) * 64));
    return {
      x: player.x + beeSigned(beeWord(state.x - x)) / 64,
      y: player.y - beeSigned(beeWord(state.y - y)) / 64,
    };
  }
  /** Bank3800:4F98-5016: biased eight-way pursuit, not an atan2 aim.
   * All additions wrap before signed tests;01C4 contributes nine frame bits.
   */
  function beeHeading(state, player, frame) {
    const x = beeSigned(beeWord(player.x - state.x + 0x500 + (frame & 511)));
    const y = beeSigned(beeWord(player.y - state.y + player.height + 0x500));
    if (beeSigned(beeWord(Math.abs(x))) < 512) return y < 0 ? 12 : 4;
    if (beeSigned(beeWord(Math.abs(y))) < 512) return x < 0 ? 8 : 0;
    let direction = x < 0 ? 6 : 2;
    if (y < 0) direction = 16 - direction;
    return direction;
  }
  /** Bank3800:5018-50C6 + E13A-E1E0, then B378 motion. Entropy is
   * supplied in place of9152's cabinet random buffer. The outer clock must
   * tick0F22 once, just as85C4-85CC does, independently of retargeting.
   */
  function tickBeePursuit(
    state,
    player,
    camera,
    frame,
    difficulty,
    readMotionWord,
    randomByte,
  ) {
    // E036 runs after85C4's global clock on the spawn frame, then calls
    //5018 immediately. Its freshly assigned250 must survive that first call.
    if (state.firstTick) state.firstTick = false;
    else if (state.speedClock > 0) state.speedClock--;
    state.delay = beeWord(state.delay - 1);
    const screenX = beeWord(state.x - camera.x);
    const screenY = beeWord(state.y + camera.y);
    const outside =
      (screenX > 0x8200 && screenX < 0xf000) ||
      !(beeSigned(screenY) >= 0x1000 || screenY <= 0x9000);
    let inheritX = 0,
      inheritY = 0;
    if (outside) {
      inheritX = player.dx;
      inheritY = beeWord(player.dy + player.dz);
      state.delay = 65535;
    }
    if (beeSigned(state.delay) <= 0) {
      if (state.speedClock <= 0) {
        if (state.stage <= 6) state.stage++;
        state.speedClock = beeIntervals[difficulty] || 250;
      }
      const direction = beeHeading(state, player, frame);
      const index = (direction * 8 + state.stage) * 2;
      state.dx = beeSigned(
        beeWord(readMotionWord(0x4138 + index) * 2 + inheritX),
      );
      state.dy = beeSigned(
        beeWord(readMotionWord(0x4238 + index) * 2 + inheritY),
      );
      if (state.direction !== direction) {
        state.direction = direction;
        state.form = state.stage >= 4 ? state.appearance : 0;
        state.animationFrames = 0;
      }
      state.delay = beeSigned(state.delay) < 0 ? 5 : (randomByte() & 15) + 16;
    }
    state.x = beeWord(state.x + state.dx);
    state.y = beeWord(state.y + state.dy);
    state.animationFrames++;
    return state;
  }
  /** E222-E236 enters capture only from city phase1. The global0F22
   * clock gives60 ticks before bank3800:5BD4 processes the terminal phase.
   * The caller still owns that later life/progression decision.
   */
  function beginBeeCapture(phase = 1) {
    return phase === 1 ? { phase: 8, timer: 60, finished: false } : null;
  }
  function tickBeeCapture(state) {
    if (state.phase !== 8 || state.finished) return false;
    if (state.timer > 0) state.timer--;
    if (state.timer !== 0) return false;
    state.finished = true;
    return true;
  }
  /** Bank3800:5BDA-5C60, fixedFE9E.027B starts at1 (4240), and
   * increments on accepted continuation (5DC4), not on capture itself.
   */
  function beeContinueLimit(settings) {
    return [2, 0, 1, 3][(settings >> 4) & 3];
  }
  function beginBeeContinue(plays, settings = 0) {
    const phase = (plays & 255) > beeContinueLimit(settings) ? 5 : 9;
    return { phase, plays: plays & 255, seconds: 10, ticks: 60 };
  }
  /** Bank16000 CPU7A4A-7A6C's shared countdown, composed at60Hz. */
  function tickBeeContinue(state) {
    if (state.phase !== 9 || !state.ticks) return false;
    if (--state.ticks) return false;
    state.seconds = beeWord(state.seconds - 1);
    if (state.seconds) state.ticks = 60;
    else state.phase = 5;
    return true;
  }
  /** 5DA6-5DC4 / E78E: input/credit admission is caller supplied. The
   * initial10 countdown digit does not accept input;9..1 do.
   */
  function acceptBeeContinue(state, pressed, creditAccepted) {
    if (state.phase !== 9 || state.seconds > 9 || !pressed || !creditAccepted)
      return false;
    state.plays = (state.plays + 1) & 255;
    state.seconds = state.ticks = 0;
    state.phase = 0;
    return true;
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
    beginBeePursuit,
    beeWorldPosition,
    beeHeading,
    tickBeePursuit,
    beginBeeCapture,
    tickBeeCapture,
    beeContinueLimit,
    beginBeeContinue,
    tickBeeContinue,
    acceptBeeContinue,
  });
  if (typeof module !== "undefined") module.exports = api;
  else window.Skate720.OriginalEffects = api;
})();
