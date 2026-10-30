/** Original ramp animation setup, bank1A0005264-5376.
 * Data arrays preserve ROM table order from bank2C00 CPU7D12-7DF1.
 * Includes animation setup, action dispatch, segment markers and interruption
 * poses. Native terrain/actor integration is still pending; this module is
 * intentionally not loaded by the browser game yet.
 */
(() => {
  const tables = {
    speedNumerators: [896, 2016, 2688],
    directionOffsets: [0, 0, 1, 2, 2, 2, 255, 2],
    actions: [
      79, 77, 79, 69, 70, 69, 75, 69, 75, 84, 81, 84, 73, 73, 73, 75, 87, 75,
    ],
    interrupts: [6, 6, 6, 6, 7, 6, 7, 7, 7, 7, 6, 7, 7, 7, 7, 7, 7, 7],
    sequences: [
      32313, 32248, 32303, 0, 32242, 0, 32279, 0, 32291, 32284, 32323, 32296,
      32271, 32254, 32262, 32271, 32327, 32262,
    ],
    boardSequences: [
      20652, 20396, 20692, 0, 20356, 0, 20520, 0, 20540, 20560, 20616, 20588,
      20452, 20420, 20484, 20452, 20712, 20484, 20672, 20408, 20632, 0, 20376,
      0, 20530, 0, 20550, 20574, 20624, 20602, 20502, 20436, 20468, 20502,
      20712, 20468,
    ],
    bodySequences: [
      17872, 17616, 17912, 0, 17576, 0, 17740, 0, 17760, 17780, 17836, 17808,
      17672, 17640, 17704, 17672, 17932, 17704, 17892, 17628, 17852, 0, 17596,
      0, 17750, 0, 17770, 17794, 17844, 17822, 17722, 17656, 17688, 17722,
      17932, 17688,
    ],
  };
  const word = (x) => x & 65535,
    signed = (x) => (x << 16) >> 16;
  function setupRampAnimation(
    vertical,
    groundVertical,
    direction,
    flags,
    profile,
  ) {
    vertical = signed(word(vertical));
    const speedClass = vertical < 288 ? 0 : vertical < 384 ? 1 : 2;
    const quotient =
      vertical === 0
        ? 0
        : Math.trunc(tables.speedNumerators[speedClass] / vertical);
    const countdown = Math.max(5, Math.min(9, quotient));
    const offset = (tables.directionOffsets[direction & 7] << 24) >> 24;
    let index = speedClass * 3 + offset;
    if (flags & 128 && signed(word(groundVertical)) < 416) index += 9;
    if (index < 0 || index >= 18)
      throw new RangeError(
        "Ramp setup inputs select an unsupported original state",
      );
    const action = tables.actions[index];
    const sequenceIndex = index + (profile & 56 ? 18 : 0);
    return {
      speedClass,
      tableIndex: index,
      action,
      nextAction: (action + 1) & 255,
      interrupt: tables.interrupts[index],
      sequence: tables.sequences[index],
      targetHeight: profile & 56 ? 0x1800 : 0x1900,
      variant: sequenceIndex,
      bodyPointer: tables.bodySequences[sequenceIndex],
      boardPointer: tables.boardSequences[sequenceIndex],
      phase: 0,
      rate: countdown | 128,
      bodyRate: countdown | 128,
      countdown,
      animationMode: 64,
      flags: action === 69 ? flags | 64 : flags,
      reshapeVelocity: speedClass === 2,
    };
  }
  /** 5516-5644: primary ramp actions40..45 (hex).
   * Original word inputs: height06B2,targetHeight0300,vertical05B2,
   * savedVertical01DE,actorX06F2,actorY0732,hold0432; byte fields:
   * flags0324,profile0327,currentPhase07B2,nextAction01EF,interrupt01F0.
   * finishSegment must implement5462 with original sequence data. A changed
   * action46..57 is handled by the following secondary dispatch, not here.
   */
  function tickRampPrimary(state, finishSegment) {
    const finish = () => finishSegment(state);
    const finishAtLowHeight = () => {
      state.flags &= ~8;
      finish();
      state.variant = 18;
    };
    switch (state.action & 255) {
      case 0x40:
        if (signed(word(state.height)) < signed(word(state.targetHeight))) {
          finishAtLowHeight();
          break;
        }
        finish();
        if (state.interrupt & 255) {
          state.action = 0x45;
          break;
        }
        if (state.flags & 1) {
          state.savedVertical = word(state.vertical);
          state.vertical = 0;
          const position = word(
            (signed(word(state.actorX)) >> 1) + state.actorY,
          );
          state.height = word(
            (state.profile === 7 ? 0x2600 : 0xe000) -
              position +
              state.targetHeight -
              256,
          );
          state.height2 = state.height;
          state.height3 = state.height;
          state.gravity = 0;
        }
        break;
      case 0x41:
        state.flags |= 64;
        if (signed(word(state.height)) > signed(word(state.targetHeight)))
          break;
        state.action = 0x45;
        finish();
        break;
      case 0x42:
        if (signed(word(state.vertical)) <= 0) finish();
        break;
      case 0x43: {
        const expected = state.nextAction & 255;
        if ((state.currentPhase & 255) !== expected) break;
        if (expected !== 4) {
          state.vertical = word(-state.savedVertical);
          state.vertical2 = state.vertical;
        }
        state.gravity = 12;
        state.action = 0x45;
        if (expected === 5) state.soundCommand = 0x59;
        break;
      }
      case 0x44:
        state.hold = word(state.hold - 1);
        if (state.hold === 0 || state.interrupt & 255) {
          finish();
          state.nextAction = 4;
          state.action = 0x43;
        }
        break;
      case 0x45:
        if (
          state.flags & 8 &&
          signed(word(state.vertical)) >= 320 &&
          signed(word(state.height)) >= 0x2400
        )
          finishAtLowHeight();
        break;
    }
    return state;
  }
  /** 5654-57E4: secondary ramp actions46..57(hex), dispatched once after
   * the primary pass. Byte writes intentionally wrap; scaled rates can clear
   * the pause bit. A new primary action is processed on the following tick.
   */
  function tickRampSecondary(state, shoes) {
    const setRate = (value) => {
      value &= 255;
      state.rate = value;
      state.bodyRate = value;
      state.countdown = value;
      state.bodyCountdown = value;
    };
    switch (state.action & 255) {
      case 0x46:
        state.flags |= 5;
        state.action = 0x40;
        break;
      case 0x47:
        if ((state.currentPhase & 255) === 5) {
          setRate((state.rate & 255) * 4);
          state.action = 0x48;
        }
        break;
      case 0x48:
        if ((state.currentPhase & 255) !== 5) {
          setRate((state.rate & 255) >> 2);
          state.nextAction = 9;
          state.action = 0x43;
        }
        break;
      case 0x49:
        state.flags |= 1;
        state.action = 0x40;
        break;
      case 0x4a:
        if (!(state.currentPhase & 255)) break;
        if (!Number.isInteger(shoes) || shoes < 0 || shoes > 3)
          throw new RangeError("Invalid original shoe index");
        state.vertical = word(
          [100, 140, 160, 200][shoes] + state.savedVertical,
        );
        if (signed(state.vertical) > [645, 660, 670, 700][shoes])
          state.vertical = [645, 660, 670, 700][shoes];
        state.gravity = 12;
        state.action = 0x41;
        break;
      case 0x4b:
        state.action = 0x42;
        break;
      case 0x4c:
        state.action = 0x41;
        break;
      case 0x4d:
        state.flags |= 1;
        state.targetHeight = word(state.targetHeight + 256);
        state.action = 0x40;
        break;
      case 0x4e:
        state.savedVertical = 0;
        state.nextAction = 5;
        state.action = 0x43;
        break;
      case 0x4f:
        state.flags |= 5;
        state.targetHeight = word(state.targetHeight + 512);
        state.action = 0x40;
        break;
      case 0x50: {
        state.flags &= ~4;
        if (Math.abs((state.direction & 7) - 6) <= 2) {
          state.currentBoard = word(state.currentBoard + 10);
          state.currentBody = word(state.currentBody + 10);
          state.boardPointer = word(state.boardPointer + 10);
          state.bodyPointer = word(state.bodyPointer + 10);
          state.sequence = word(state.sequence + 5);
        }
        state.hold = 40;
        state.action = 0x44;
        state.velocityX = word(
          state.velocityX + (signed(word(state.velocityX)) >> 1),
        );
        state.velocityY = word(
          state.velocityY + (signed(word(state.velocityY)) >> 1),
        );
        break;
      }
      case 0x51:
        state.action = 0x40;
        break;
      case 0x52:
        state.action = 0x41;
        state.interrupt = 4;
        state.nextAction = 0x53;
        break;
      case 0x53:
        state.action = 0x45;
        break;
      case 0x54:
        state.action = 0x42;
        state.gravity = 9;
        break;
      case 0x55:
        state.nextAction = 0x56;
        state.action = 0x41;
        break;
      case 0x56:
        state.vertical = word(state.vertical + 96);
        state.action = 0x45;
        break;
      case 0x57:
        if (state.profile === 7 && (state.direction & 255) === 2)
          state.flags |= 12;
        state.nextAction = 0;
        state.action = 0x45;
        break;
    }
    return state;
  }
  /** 53A8-543C, with the original ramp field names retained. */
  function requestRampInterruption(state, candidate) {
    let mismatch = false;
    if (!(state.interrupt & 255) && !(state.flags & 4)) {
      let heading = candidate & 15;
      if (state.profile & 16) heading ^= 8;
      let distance = Math.abs(heading - (state.direction & 255));
      if (distance > 8) distance = 16 - distance;
      mismatch = distance > 2;
    }
    if (!mismatch && (state.profile & 7) === 7) return state;
    state.interrupt = (state.profile & 7) === 0 ? 4 : 7;
    state.bodyRate = (state.bodyRate | 128) & 255;
    state.rate = state.bodyRate;
    if (word(state.gravity) === 0) {
      state.gravity = 12;
      state.vertical = word(state.savedVertical);
    }
    return state;
  }

  /** 543E-54CC: finish a segment using original marker bytes. */
  function finishRampSegment(state, readByte) {
    state.frameEvent = 0;
    state.currentBoard = word(state.boardPointer);
    state.currentBody = word(state.bodyPointer);
    state.currentPhase = state.phase & 255;
    const candidate = readByte(word(state.sequence + state.currentPhase)) & 255;
    if (!(candidate & 128)) {
      state.bodyRate &= 127;
      state.rate = state.bodyRate;
    }
    let pointer = word(state.sequence + state.currentPhase);
    let marker;
    do {
      state.boardPointer = word(state.boardPointer + 2);
      state.bodyPointer = word(state.bodyPointer + 2);
      state.phase = (state.phase + 1) & 255;
      marker = readByte(pointer) & 128;
      pointer = word(pointer + 1);
    } while (!marker);
    if (state.interrupt & 255) {
      state.interrupt = 0;
      requestRampInterruption(state, candidate);
    }
    if (!(state.interrupt & 255)) state.completed = (state.completed + 1) & 255;
    if (state.nextAction & 255) {
      state.action = state.nextAction & 255;
      state.nextAction = 0;
    }
    return state;
  }

  /** Primary pass -> secondary pass -> shared interruption-pose selector,
   * preserving 54CE-5812 order. This does not tick the separate B378 clocks.
   */
  function tickRampController(state, shoes, readByte, poseMemory) {
    // 54DE-5514 reads the current sequence candidate before either dispatch.
    if (word(state.sequence) !== 0) {
      const candidate =
        readByte(word(state.sequence + (state.currentPhase & 255))) & 255;
      if (state.frameEvent & 255) {
        state.frameEvent = 0;
        if (candidate & 128) {
          state.bodyRate = (state.bodyRate | 128) & 255;
          state.rate = state.bodyRate;
        }
      }
      requestRampInterruption(state, candidate);
    }
    tickRampPrimary(state, (s) => finishRampSegment(s, readByte));
    tickRampSecondary(state, shoes);
    const interrupt = state.interrupt & 255;
    state.poseOverride = interrupt
      ? interrupt | ((state.heightGauge & 65535) < 0x5c00 ? 16 : 0)
      : null;
    if (state.poseOverride !== null && poseMemory) {
      const pose = resolveInterruptionPose(
        state.poseOverride,
        state.direction,
        state.profile,
        state.speed,
        poseMemory.readByte,
        poseMemory.readWord,
      );
      state.currentBoard = pose.board;
      state.currentBody = pose.body;
    }
    return state;
  }
  /** E5D2/E648: resolve interruption pose-directory addresses.
   * readByte/readWord address the original bank pair 0000/0400 plus fixed ROM.
   * Return directory addresses, not descriptor values: the motion reader does
   * the final indirection. F162 preserves the caller's pose parameter.
   */
  function resolveInterruptionPose(
    parameter,
    direction,
    profile,
    speed,
    readByte,
    readWord,
  ) {
    parameter = word(parameter);
    direction = (direction << 24) >> 24; // MOVB sign extension
    const pose = parameter & 7;
    const groupOffset = (signed(parameter) >> 3) * 2;
    const board =
      pose === 0
        ? word(0x4f64 + direction * 2)
        : word(
            readWord(word(0x4c4c + groupOffset)) +
              (readByte(0xfe2d + pose) & 255) +
              (direction & 7) * 2,
          );
    let body;
    if (pose === 0) body = word(0x4000 + direction * 2);
    else if ((profile === 2 || profile === 10) && signed(word(speed)) >= 0x500)
      body = word((profile === 2 ? 0x43e8 : 0x4408) + direction * 2);
    else
      body = word(
        readWord(word(0x4020 + groupOffset)) +
          (readByte(0xfe35 + pose) & 255) +
          direction * 2,
      );
    return { board, body };
  }
  /** B378 processes body actor2 before board actor1. The board phase
   * (07B1) is consumed as an event by54CE; the body phase (07B2) indexes
   * sequence candidates. Neither is the future segment cursor01EE.
   * tickMotionAnimation is the shared translated B39A-B45C routine.
   */
  function tickRampClocks(state, readWord, tickMotionAnimation) {
    const body = {
      rate: state.bodyRate,
      countdown: state.bodyCountdown,
      phase: state.currentPhase,
      pointer: state.currentBody,
      stopOnLoop: !!state.bodyStopOnLoop,
    };
    tickMotionAnimation(body, readWord);
    state.bodyRate = body.rate;
    state.bodyCountdown = body.countdown;
    state.currentPhase = body.phase;
    state.currentBody = body.pointer;
    const board = {
      rate: state.rate,
      countdown: state.countdown,
      phase: state.frameEvent,
      pointer: state.currentBoard,
      stopOnLoop: !!state.boardStopOnLoop,
    };
    tickMotionAnimation(board, readWord);
    state.rate = board.rate;
    state.countdown = board.countdown;
    state.frameEvent = board.phase;
    state.currentBoard = board.pointer;
    return state;
  }
  /** Fixed98F0-991A: grounded curved-wall to coping transition gate.
   * previousProfile0327 and candidateProfile/R3 must share height bits3..5.
   * probeProfile0304 must contain all three low bits. A failed probe returns
   * directly at991A; a failed wall/band test takes the9EEE contact handler.
   * This routine consumes original terrain-probe outputs, not screen radii.
   */
  function copingTransition(
    movementState,
    previousProfile,
    candidateProfile,
    probeProfile,
  ) {
    if ((movementState & 255) === 0) return "airborne-probe";
    if (
      (previousProfile & 7) < 5 ||
      (previousProfile & 56) !== (candidateProfile & 56)
    )
      return "ordinary-contact";
    return (probeProfile & 7) === 7 ? "begin-ramp" : "wait-probe";
  }
  const api = Object.freeze({
    copingTransition,
    tables,
    tickRampClocks,
    resolveInterruptionPose,
    setupRampAnimation,
    tickRampPrimary,
    tickRampSecondary,
    requestRampInterruption,
    finishRampSegment,
    tickRampController,
  });
  if (typeof module !== "undefined") module.exports = api;
  else window.Skate720.OriginalRampAnimation = api;
})();
