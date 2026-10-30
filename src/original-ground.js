/** Flat-ground subset of revision-4 player movement, translated from ROM.
 * 9BDE/91A6 supply coefficients and velocity; bank 1A000:4EAC-5026
 * updates signed speed. This module handles surface flag 0 only.
 * Turning, kick input timing, slopes, airborne state and collision state are
 * still supplied by the browser adapter and are NOT a complete original port.
 */
(() => {
  const tables = {
    dialDirections: [
      0, 0, 0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4, 5, 5, 5, 5, 5,
      6, 6, 6, 6, 7, 7, 7, 7, 7, 8, 8, 8, 8, 8, 9, 9, 9, 9, 9, 10, 10, 10, 10,
      11, 11, 11, 11, 11, 12, 12, 12, 13, 13, 13, 13, 13, 14, 14, 14, 14, 15,
      15, 15, 15, 15, 0, 0,
    ],
    x: [
      20724, 18752, 14654, 7088, 0, -7292, -14654, -18752, -20724, -18752,
      -14654, -7292, 0, 7292, 14654, 18752,
    ],
    y: [
      0, 4412, 7327, 9737, 10362, 9700, 7327, 4412, 0, -4412, -7327, -9700,
      -10362, -9700, -7327, -4412,
    ],
    limit: [
      940, 959, 1019, 1058, 981, 1001, 1063, 1103, 1057, 1079, 1145, 1189, 1118,
      1141, 1211, 1258, 1198, 1223, 1299, 1348, 1290, 1317, 1398, 1452, 1335,
      1362, 1447, 1502, 1376, 1404, 1491, 1548,
    ],
    reduction: [-18, 0, 35, 63, 100, 142, 162, 181],
    rampReduction: [0, 0, 9, 17, 26, 38, 43, 48],
    rampLimit: [1920, 2048, 2432, 2688],
    kickImpulse: [400, 450, 500, 550],
    kickSpeedImpulse: [
      120, 112, 104, 96, 88, 88, 48, 24, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
    kickCeiling: [900, 960, 1030, 1100],
    friction: [10, 8, 7, 5],
  };
  const s16 = (x) => (x << 16) >> 16;
  const s8 = (x) => (x << 24) >> 24;

  /** 80FA-8132 computes a signed product into 0204/0206.
   * 91BE/91C4 retain bits 8..15 as the fraction and bits 16..31 as
   * the word displacement. Preserve the processor's arithmetic right shift.
   */
  function velocity(speed, direction) {
    const index = direction & 15;
    const productX = Math.imul(s16(speed), tables.x[index]);
    const productY = Math.imul(s16(speed), tables.y[index]);
    return {
      dx: s16(productX >> 16),
      dy: s16(productY >> 16),
      fractionX: (productX >>> 8) & 255,
      fractionY: (productY >>> 8) & 255,
    };
  }

  /** Bank 1A000:4F34-5026, restricted to flat ground and action 0/3.
   * speed=01B4, slopeDelta=02EE, frame=01C4, equipment=025C,
   * kickLimit=02FC. Original words wrap and comparisons are signed.
   * Zero slope is required here; other surfaces need the rest of the caller.
   */
  function flatSpeed(speed, action, equipment, frame, kickLimit) {
    speed = s16(speed);
    equipment = equipment & 3;
    let delta =
      action === 3 ? Math.max(0, Math.min(80, s16(kickLimit - speed))) : 0;
    if (speed !== 0) {
      let friction = 0;
      if (speed > tables.limit[equipment]) {
        // Here 02EE is zero. 4FAE/4FB2 use the flat terrain reduction,
        // which is -18: subtracting it produces an 18-unit deceleration.
        if ((frame & 15) === 0) friction = Math.max(0, -tables.reduction[0]);
      } else if ((frame & 15) === 0) friction = tables.friction[equipment];
      delta += speed > 0 ? -friction : friction;
    }
    const before = speed;
    speed = s16(speed + delta);
    // Surface 0 enforces the original +/-128 minimum rolling speed.
    if (before >= 0 ? speed < 128 : speed > -128) speed = 0;
    return speed;
  }
  /** 92EA-9344: the once-per-16-frames kick envelope update.
   * Kick edge impulses (9266) accumulate in impulse/02FE; the caller supplies
   * the original button-held bit separately from those edges.
   */
  function kickEnvelope(state, speed, equipment, frame, held) {
    if ((frame & 15) !== 0) return state;
    const cap = tables.kickCeiling[equipment & 3];
    const over = s16(state.target) > cap;
    state.impulse = Math.max(384, s16(state.impulse) >> 1);
    let goal = Math.min(s16(speed), cap);
    goal = Math.max(goal, state.impulse);
    goal = Math.min(goal, cap + 128);
    if (s16(state.target) < goal)
      state.target = s16(state.target + ((goal - s16(state.target)) >> 1));
    else state.target = s16(state.target + (held && !over ? 6 : -24));
    return state;
  }
  /** 1A000:4A36-4A3C: convert the original 144-count dial to a direction.
   * The original caller keeps 01C6 in range; reject invalid adapter input.
   */
  function dialDirection(counter) {
    if (!Number.isInteger(counter) || counter < 0 || counter >= 144)
      throw new RangeError("Dial counter must be in 0..143");
    return tables.dialDirections[counter >> 1];
  }
  /** 9242-9276: BOTH changes of input bit 80 add kick impulse.
   * previousMask is original0333, impulse is original02FE. The hardware
   * input is active-low; no animation-state gate appears in this routine.
   */
  function kickInputTransition(state, mask, equipment, speed) {
    mask &= 128;
    if (mask === (state.previousMask & 128)) return state;
    state.previousMask = mask;
    const band = Math.min(15, ((Math.abs(s16(speed)) * 2) & 65535) >> 8);
    state.impulse = s16(
      state.impulse +
        tables.kickImpulse[equipment & 3] +
        tables.kickSpeedImpulse[band],
    );
    return state;
  }
  /** Bank1A0004BEC-4C00: positive kick-state speed catches half the gap
   * to target02FC. Caller must establish the original action-state branch.
   */
  function kickTargetCatchup(speed, target) {
    speed = s16(speed);
    target = s16(target);
    return speed >= 0 && speed < target
      ? s16(speed + (s16(target - speed) >> 1))
      : speed;
  }
  /** 9B82-9C50: select terrain-dependent motion coefficients.
   * profile0327 and direction031D are MOVB sign-extended before indexing.
   * Readers address bank2C00 CPU6000-7FFF. Grounded slopeDelta02EE and
   * airborne landing fields02EA/02EC are different outputs, not substitutes.
   */
  function surfaceCoefficients(
    direction,
    profile,
    movementState,
    kind,
    speed,
    equipment,
    readByte,
    readWord,
  ) {
    const word = (x) => x & 65535;
    const terrain = s8(profile);
    let index = s8(direction);
    if (terrain & 7) {
      if ((terrain & 7) === 7) index = word(index + (terrain & 56) * 2 + 0x220);
      else
        index = word(
          index +
            (terrain & 7) * 16 +
            readWord(word(0x79e8 + (terrain >> 3) * 2)),
        );
    }
    const result = {
      index,
      x: s16(readWord(word(0x6048 + index * 2))),
      y: s16(readWord(word(0x6588 + index * 2))),
      vertical: s16(readWord(word(0x6ac8 + index * 2))),
    };
    if ((movementState & 255) !== 0) {
      let delta = s8(readByte(word(0x7668 + index)));
      if (
        (kind & 255) === 3 &&
        delta < 0 &&
        s16(speed) > 0 &&
        s16(speed) < s16(readWord(0x7c68 + s8(equipment) * 2))
      )
        delta >>= 1;
      result.slopeDelta = delta;
    } else if ((terrain & 7) !== 7) {
      const radius = readByte(word(0x7008 + index)) & 255;
      result.landingRadius = radius ? radius + 1 : 0;
      result.landingGradient = s16(readWord(word(0x7228 + index * 2)));
    } else {
      result.landingRadius = 0;
      result.landingGradient = 0;
    }
    return result;
  }
  /** 50B8-50D0 ->80FA: signed speed times terrain vertical coefficient.
   * 0205 supplies a fractional byte;0206 supplies the signed whole word.
   */
  function surfaceVerticalMotion(speed, coefficient) {
    const product = Math.imul(s16(speed), s16(coefficient));
    return { velocity: s16(product >> 16), fraction: (product >>> 8) & 255 };
  }
  /** A bounded reader for extracted numeric tables, never executable ROM. */
  function terrainTableReader(data) {
    const readWord = (address) => {
      for (const [baseText, values] of Object.entries(data.words)) {
        const offset = address - Number(baseText);
        if (offset >= 0 && !(offset & 1) && offset / 2 < values.length)
          return values[offset / 2];
      }
      throw new RangeError(`Missing terrain word ${address.toString(16)}`);
    };
    const readByte = (address) => {
      for (const [baseText, values] of Object.entries(data.bytes)) {
        const offset = address - Number(baseText);
        if (offset >= 0 && offset < values.length) return values[offset];
      }
      throw new RangeError(`Missing terrain byte ${address.toString(16)}`);
    };
    return { readByte, readWord };
  }
  /** 4EAC-5026 grounded speed for native actions0/3. Other original
   * actions (reverse kick, slide and collision) have separate entry branches.
   */
  function terrainSpeed(
    speed,
    action,
    equipment,
    frame,
    target,
    profile,
    slope,
    kind,
  ) {
    equipment &= 3;
    const terrain = profile & 7;
    speed = s16(speed + s16(slope));
    let delta =
      action === 3 ? Math.max(0, Math.min(80, s16(target - speed))) : 0;
    if (speed !== 0) {
      let friction;
      if (
        Math.abs(speed) > tables.limit[terrain * 4 + equipment] &&
        s16(speed ^ s16(slope)) >= 0
      ) {
        let reduction = 0;
        if (kind === 3) {
          if (speed < tables.rampLimit[equipment])
            reduction = tables.rampReduction[terrain];
        } else if ((frame & 15) === 0) reduction = tables.reduction[terrain];
        friction = Math.max(0, Math.abs(s16(slope)) - reduction);
      } else friction = (frame & 15) === 0 ? tables.friction[equipment] : 0;
      delta += speed > 0 ? -friction : friction;
    }
    const before = speed;
    speed = s16(speed + delta);
    const minimum = terrain === 0 ? 128 : 0;
    if (before >= 0 ? speed < minimum : speed > -minimum) speed = 0;
    return speed;
  }
  /** 9FE8-A068: numeric airborne transition after the event callback.
   * 91A6 computes XY BEFORE 01B4 is rescaled by02EA/256. Then the
   * rescaled speed and02EC produce the moving-ground vertical reference.
   * The caller owns event notification, camera state and sound command4A.
   */
  function airborneTransition(
    speed,
    direction,
    profile,
    kind,
    equipment,
    reader,
  ) {
    speed = s16(speed);
    direction &= 255;
    if (speed < 0) {
      speed = s16(-speed);
      direction ^= 8;
    }
    const savedSpeed = speed;
    const c = surfaceCoefficients(
      direction,
      profile,
      0,
      kind,
      speed,
      equipment,
      reader.readByte,
      reader.readWord,
    );
    const productX = Math.imul(speed, c.x),
      productY = Math.imul(speed, c.y);
    const mainSpeed = s16(Math.imul(speed, c.landingRadius) >> 8);
    return {
      savedSpeed,
      mainSpeed,
      direction,
      dx: s16(productX >> 16),
      dy: s16(productY >> 16),
      fractionX: (productX >>> 8) & 255,
      fractionY: (productY >>> 8) & 255,
      groundVertical: surfaceVerticalMotion(mainSpeed, c.landingGradient),
      gravity: 12,
      movementState: 0,
    };
  }
  const api = Object.freeze({
    airborneTransition,
    terrainTableReader,
    terrainSpeed,
    surfaceCoefficients,
    surfaceVerticalMotion,
    kickInputTransition,
    kickTargetCatchup,
    velocity,
    flatSpeed,
    kickEnvelope,
    dialDirection,
    tables,
  });
  if (typeof module !== "undefined") module.exports = api;
  else window.Skate720.OriginalGround = api;
})();
