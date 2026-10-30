/** Direct translations from the 720 revision-4 fixed T-11 ROM.
 * Addresses below refer to CPU addresses in the original program.
 * These are ordinary functions, not an instruction interpreter. Arithmetic
 * explicitly wraps at 16 bits where the original processor wraps.
 * Caller-provided directory tables contain original ROM words, not guesses.
 * These verified fragments do not constitute the complete game simulation.
 */
(() => {
  const word = (value) => value & 0xffff;
  const signed = (value) => (value << 16) >> 16;

  /** B46C-B4A6: integrate an actor and update its projected coordinates.
   * The surrounding loop skips integration for r5 < 4; preserve that branch.
   * ROM fields: x=06F0, y=0730, z=06B0, dz=05B0,
   * screenX=0630, screenY=0670, alignedDeltaY=05F0 (each indexed by r4).
   * dx/r3 and dy/r2 are already computed by the preceding animation logic.
   * These are original fixed-point units, not browser pixels or seconds.
   */
  function updateActor(actor, camera, dx, dy, loopIndex) {
    if (signed(loopIndex) >= 4) {
      actor.x = word(actor.x + dx);
      actor.y = word(actor.y + dy);
      actor.z = word(actor.z + actor.dz);
    }
    actor.screenX = word(actor.x - camera.x);
    const projectedY = word(actor.y + camera.y + actor.z);
    actor.alignedDeltaY = word(
      (projectedY & 0xfff8) - (actor.screenY & 0xfff8),
    );
    actor.screenY = projectedY;
    return actor;
  }

  /** E668-E6D8: select the address of a skater animation-directory entry.
   * Original global 01F8 supplies the direction byte; 0327 the action byte;
   * 01B4 the signed speed word. descriptor is the original r4 argument.
   * The returned address is an entry pointer, not a graphics tile number.
   * tables.readWord reads the recovered directory at bank 0000/0400.
   */
  function animationEntry(direction, descriptor, action, speed, tables) {
    const directionWord = signed((direction & 0xff) << 8) >> 8;
    descriptor = word(descriptor);
    if ((descriptor & 7) === 0) return word(0x4000 + directionWord * 2);
    if ((action === 2 || action === 10) && signed(speed) >= 0x500) {
      return word((action === 2 ? 0x43e8 : 0x4408) + directionWord * 2);
    }
    const directoryIndex = word((signed(descriptor) >> 3) * 2);
    const directory = tables.readWord(word(0x4020 + directoryIndex));
    const variantOffset = tables.variantOffsets[descriptor & 7]; // FE35 table
    return word(directory + variantOffset + directionWord * 2);
  }

  /** E6F0-E6FC: horizontal projection for the separate actor slot at 06F2. */
  function projectHorizontal(x, cameraX) {
    return word(x - cameraX);
  }

  /** E702-E72E: collect the original four eligibility bits.
   * FC74 supplies one byte mask per candidate. 0F29 contains selected bits;
   * 0F2B and 02B8 describe the special single-candidate restriction.
   */
  function eligibilityMask(selected, restriction, candidate, masks) {
    let result = 0;
    for (let index = 3; index >= 0; index--) {
      // E70E branches directly to inclusion when the selected bit is set.
      if (selected & masks[index]) result |= masks[index];
      else if (restriction === 1 && index !== (candidate & 0xff))
        result |= masks[index];
    }
    return word(result);
  }
  /** EF30-EF44 -> 80C8: add one unsigned award word to the two-word score.
   * This translates accumulation only; callers still determine award amounts.
   */
  function addScoreWord(score, award) {
    const low = (score & 65535) + (award & 65535);
    const high = ((score >>> 16) + (low >>> 16)) & 65535;
    return high * 65536 + (low & 65535);
  }
  /** Bank 16000 offset 1E44 (CPU 7E44): airtime award; F064 caps index.
   * 01C4 - 0FB0 is a wrapping 60 Hz frame count. Jump park (kind 4)
   * skips this award; ramp kind 3 accumulates it for the later tally.
   * Only award selection is translated here; browser landing is the caller.
   */
  function airtimeAward(elapsedFrames, kind) {
    if (kind === 4) return { points: 0, deferred: false, index: -1 };
    const index = signed(word(elapsedFrames - 30)) >> 3;
    if (index < 0) return { points: 0, deferred: false, index };
    const capped = Math.min(9, index);
    return {
      points: [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000][capped],
      deferred: kind >= 3,
      index: capped,
    };
  }
  /** Bank 1A000, 50E0-50F6: airborne vertical velocity update.
   * 05B2 -= 02EE, signed 16-bit; cap at FE00 (-512), except ramp kind 3.
   * 02EE is set to 12 at A068/56F0 for ordinary jumps, or 9 at 57A6
   * for another ramp state. Preserve it as an explicit input, not a magic
   * universal gravity constant. This does not implement launch or landing.
   */
  function airborneVelocity(velocity, gravity, kind) {
    let next = signed(word(velocity - gravity));
    if (next < -512 && kind !== 3) next = -512;
    return next;
  }
  /** Bank 1A000 4E86-4E90: ordinary jump transition 01EB=5 -> 6.
   * 025F indexes the unsigned 7C70 launch byte in bank 2C00 (ROM 15C70).
   * CLRB 05B3 explicitly zero-extends the byte into vertical word 05B2.
   * Caller must establish this transition; other jump states use other tables.
   */
  function ordinaryJumpLaunch(shoes) {
    const table = [170, 208, 220, 242];
    if (!Number.isInteger(shoes) || shoes < 0 || shoes >= table.length)
      throw new RangeError("Invalid original shoe equipment index");
    return table[shoes];
  }
  /** Bank 1A000 53BC-53F2: compare a landing direction with 01F8.
   * Directions are sixteen discrete slots. The argument is masked to its
   * low nibble, then the smaller distance around the ring is compared to 2.
   * This is the numeric test only: 01F0, 0324 and terrain-state guards in
   * 53A8-53BA remain the caller's responsibility.
   */
  function landingDirectionMismatch(direction, reference) {
    let distance = Math.abs((direction & 15) - (reference & 255));
    if (distance > 8) distance = 16 - distance;
    return distance > 2;
  }
  /** Bank 1A000 53A8-543C: complete animation interruption predicate.
   * Address-named fields preserve meaning without inventing state semantics:
   * interrupt=01F0, flags=0324, terrain=0327, direction=01F8,
   * animationRate=0772, pairedRate=0771, gravity=02EE,
   * savedVertical=01DE, vertical=05B2.
   * This routine requests an animation interruption; it does NOT directly
   * say "crash". Its caller 5462/54CE decides the next state.
   */
  function requestAnimationInterruption(state, candidate) {
    let mismatch = false;
    if (!(state.interrupt & 255) && !(state.flags & 4)) {
      let direction = candidate & 15;
      if (state.terrain & 16) direction ^= 8;
      mismatch = landingDirectionMismatch(direction, state.direction);
    }
    if (!mismatch && (state.terrain & 7) === 7) return state;
    state.interrupt = (state.terrain & 7) === 0 ? 4 : 7;
    state.animationRate = (state.animationRate | 128) & 255;
    state.pairedRate = state.animationRate;
    if (word(state.gravity) === 0) {
      state.gravity = 12;
      state.vertical = word(state.savedVertical);
    }
    return state;
  }
  /** 1A000:543E-5460: advance two sprite sequence pointers until the
   * next signed-byte marker in the original direction sequence.
   * readByte must address the original 2C00 bank at CPU 6000-7FFF.
   * A bounds-checked reader catches corrupt pointers instead of scanning RAM.
   */
  function advanceAnimationMarker(state, readByte) {
    let pointer = word(state.sequence + (state.phase & 255));
    let marker;
    do {
      state.spritePointer = word(state.spritePointer + 2);
      state.boardPointer = word(state.boardPointer + 2);
      state.phase = (state.phase + 1) & 255;
      marker = readByte(pointer) & 128;
      pointer = word(pointer + 1);
    } while (!marker);
    return state;
  }

  /** 1A000:5462-54CC: update animation sequence at a state boundary.
   * Separate original sequence/current sprite pointers are preserved.
   * Completion increments 01F2 only if interruption handling leaves 01F0 clear.
   */
  function finishAnimationSegment(state, readByte) {
    state.frameEvent = 0; // 07B1
    state.currentSprite = word(state.spritePointer); // 03B2
    state.currentBoard = word(state.boardPointer); // 03B4
    state.currentPhase = state.phase & 255; // 07B2
    const candidate = readByte(word(state.sequence + state.currentPhase));
    if ((candidate & 128) === 0) {
      state.animationRate &= 127;
      state.pairedRate = state.animationRate;
    }
    advanceAnimationMarker(state, readByte);
    if (state.interrupt & 255) {
      state.interrupt = 0;
      requestAnimationInterruption(state, candidate);
    }
    if (!(state.interrupt & 255)) state.completed = (state.completed + 1) & 255;
    if (state.nextAction & 255) {
      state.action = state.nextAction & 255;
      state.nextAction = 0;
    }
    return state;
  }
  /** B39A-B3DC/B45C: original motion-object animation clock.
   * rate=0770, countdown=0790, phase=07B0, pointer=03B0;
   * stopOnLoop is 04B0 bit 0x20. readWord addresses the currently selected
   * original animation-directory bank. This function advances only the clock;
   * descriptor-driven displacement and rendering are separate operations.
   */
  function tickMotionAnimation(actor, readWord) {
    const rate = (actor.rate << 24) >> 24;
    actor.frameAdvanced = false;
    if (rate <= 0) return actor;
    if ((actor.countdown & 255) !== 0) {
      actor.countdown = (actor.countdown - 1) & 255;
      return actor;
    }
    actor.countdown = actor.rate & 255;
    actor.pointer = word(actor.pointer + 2);
    actor.phase = (actor.phase + 1) & 255;
    const entry = readWord(actor.pointer);
    if (entry & 32768) {
      actor.pointer = entry & 32767;
      actor.phase = 0;
      if (actor.stopOnLoop) actor.rate = 0;
    }
    actor.frameAdvanced = true;
    return actor;
  }
  /** B266-B328: read a motion-object descriptor into column records.
   * The first signed byte offsets X in pixels. Header bit 7 selects one
   * shared Y offset; otherwise every column has its own signed Y byte.
   * Header bits 0..2 select the upper tile bank. A negative tile word ends
   * the descriptor, while subsequent columns use the hardware neighbour bit.
   * Coordinates remain original 16-bit fixed-point words (64 units/pixel).
   * Link/palette/priority allocation belongs to the surrounding sprite list.
   */
  function spriteDescriptor(readByte, address, columns, screenX, screenY) {
    const byte = () => readByte(address++) & 255;
    const displacement = () => ((byte() << 24) >> 24) * 64;
    const x = word(screenX + displacement());
    const header = byte();
    const baseY = (screenY & 0xfff8) | (header & 7);
    let y = baseY;
    if (header & 128) y = word(baseY + displacement());
    const records = [];
    for (let column = 0; column < columns; column++) {
      if (!(header & 128)) y = word(baseY + displacement());
      const raw = byte() | (byte() << 8);
      records.push({
        y,
        code: (raw & 0x7fff) | (column ? 0x8000 : 0),
        x: column ? 0 : x,
      });
      if (raw & 0x8000) break;
    }
    return { records, nextAddress: address, xOffset: word(x - screenX) };
  }
  /** E458-E47C: select original flat-ground sharp-turn body/board entry pointers.
   * 01F8 is reduced to an even direction (eight kick headings); 0321's
   * signed flag chooses the original pair of pose tables.
   * The caller must establish E448-E456's terrain/action/timer guards.
   */
  function sharpTurnAnimationEntries(direction, signedFlag) {
    const offset = ((direction & 255) >> 1) * 2;
    const alternate = (signedFlag << 24) >> 24 < 0;
    return {
      body: (alternate ? 0x42b0 : 0x42c0) + offset,
      board: (alternate ? 0x4e1c : 0x4e2c) + offset,
    };
  }
  /** Bank1A000 4A0A-4A28: shortest direction difference on a 16-slot ring.
   * r2 enters as target-current. r1 returns -1/0/+1, r2 the distance.
   * An exactly opposite target retains the input difference's sign.
   */
  function steeringDifference(difference) {
    difference = signed(word(difference));
    let step = difference === 0 ? 0 : difference < 0 ? -1 : 1;
    let distance = difference < 0 ? word(-difference) : difference;
    if (signed(distance) > 8) {
      distance = word(16 - distance);
      step = -step;
    }
    return { step, distance: signed(distance) };
  }
  /** Bank16000 CPU692E-6968 (listing492E): tally pending 0F34 points.
   * Original scores enter this path in awards of at least 100. Preserve the
   * exact signed-word subtraction and small-remainder branch, not a formula
   * invented from medal rank. Each call is one original tally iteration.
   */
  function tallyPendingScore(pending) {
    pending = signed(word(pending));
    if (pending <= 0)
      return { pending: word(pending), awards: [], done: true, wait: 64 };
    pending = signed(word(pending - 32));
    const awards = [32];
    if (pending < 64) {
      awards.push(word(pending));
      pending = 0;
    }
    return { pending: word(pending), awards, done: false, wait: 0 };
  }
  /** Bank16000 CPU7A74-7A9C: decrement the original race counter.
   * 0F20 changes once per sixteen global frames, only in event phase 3,
   * and pauses when player-state 031F equals 5. It is not a seconds timer.
   * Earlier caller branches establish whether this counter path applies.
   */
  function tickRaceCounter(counter, frame, eventPhase, playerState) {
    counter = word(counter);
    if (
      signed(counter) > 0 &&
      (frame & 15) === 0 &&
      (eventPhase & 255) === 3 &&
      (playerState & 255) !== 5
    )
      counter = word(counter - 1);
    return counter;
  }

  /** Bank16000 CPU6902-6926: original race-counter score tally.
   * 0E95 selects 50 rather than 100 points per remaining counter unit.
   * The outer state machine waits for 0F22 before calling and requests
   * sound/display updates after each award; those are caller operations.
   */
  function tallyRaceCounter(counter, reducedAward) {
    counter = word(counter);
    if (signed(counter) <= 0)
      return { counter, award: 0, done: true, wait: 96 };
    return {
      counter: word(counter - 1),
      award: reducedAward ? 50 : 100,
      done: false,
      wait: 0,
    };
  }
  /** 90BA-910A: deterministic original setup-table index.
   * requested=0F2D (signed byte), selector=027A, stage=0F31.
   * Despite earlier scratch notes, this routine is not a random-number call.
   */
  function setupTableIndex(requested, selector, stage) {
    requested = (requested << 24) >> 24;
    if (requested > 0) return requested;
    if (!Number.isInteger(selector) || selector < 0 || selector > 3)
      throw new RangeError("Original setup selector must be 0..3");
    const offsets = [0, 2, 3, 1];
    let value = word(offsets[selector] - requested - 1) & 3;
    value = word(value - requested);
    const maximum = (stage & 255) < 12 ? 9 : 10;
    return Math.min(signed(value), maximum);
  }

  /** Bank16000 CPU6BC4-6BE4, with bank1=2000: race counter setup.
   * Tables at CPU5EAB/5EB5 are in physical ROM2DEAB/2DEB5, not the
   * bank containing these instructions. Selectors 2/3 use another path.
   */
  function initialRaceCounter(selector, index) {
    const tables = [
      [11, 32, 28, 28, 24, 24, 20, 20, 16, 16, 16],
      [16, 112, 120, 112, 128, 120, 124, 116, 140, 132, 132],
    ];
    if (selector !== 0 && selector !== 1)
      throw new RangeError("This selector uses another setup path");
    if (!Number.isInteger(index) || index < 0 || index > 10)
      throw new RangeError("Setup index outside recovered table");
    return tables[selector][index];
  }
  /** Bank1E000 5360-538C: city interaction selector stored at 027A.
   * The original 539E/5582 callers select from fields 0996 and 099A.
   * Preserve original units and signed comparisons; browser pixel coordinates
   * cannot be substituted for these fields without the map-coordinate reader.
   */
  function cityInteractionSelector(field0996, field099a) {
    if (signed(word(field099a)) > 4)
      return signed(word(field0996)) > 176 ? 0 : 3;
    return signed(word(field0996)) > 176 ? 2 : 1;
  }
  /** Bank1A000 400C/4012 and 412E-4168: initial packed map/view bounds.
   * row and column are original 4000-call parameters, not world pixels.
   * The row parameter is reduced by four before the bounds calculation.
   * These are fields0996(left),0998(right),099A(top),099C(bottom).
   */
  function initialMapBounds(column, row) {
    const adjustedRow = word(row - 4);
    const top = word(signed(adjustedRow) >> 1);
    const left = word((signed(word(column - 1)) >> 1) * 16);
    return { left, right: word(left + 64), top, bottom: word(top + 3) };
  }
  /** Bank16000 CPU6A1C-6A54: recover city-return setup parameters.
   * The caller supplies the original entry index. Data CPU5666/566A/566E
   * belongs to bank3800 (physical1F666...), before switching to bank1800
   * for map setup and back to3800 for the actor-position entry.
   * Do not reinterpret this entry index as a browser park-name index.
   */
  function cityReturnParameters(index) {
    if (!Number.isInteger(index) || index < 0 || index > 3)
      throw new RangeError("Invalid original city return entry");
    const column = [20, 13, 8, 13][index];
    const row = [21, 32, 20, 11][index];
    return {
      kind: 0,
      column,
      row,
      actorEntry: [8, 16, 24, 32][index],
      bounds: initialMapBounds(column, row),
    };
  }
  /** Bank16000 6AC0-6AC6: city selector -> original course kind.
   * This explicit increment proves selector 0/1/2/3 selects course 1/2/3/4.
   */
  function courseKindFromSelector(selector) {
    if (!Number.isInteger(selector) || selector < 0 || selector > 3)
      throw new RangeError("Invalid city selector");
    return selector + 1;
  }
  /** BE10-BE7A: resolve an original packed object placement through its map.
   * 0AF8[slot] is not a direct X/Y coordinate. Its low nine bits index the
   * object-cell directory at CPU7A00 (slots<64) or 7D00 (slots>=64).
   * The remaining six payload bits offset that cell. The 8000 flag is ignored.
   * readWord addresses the caller-selected bank2; returning pointers rather
   * than fabricating world coordinates preserves the original data contract.
   */
  function resolveObjectPlacement(packed, slot, readWord) {
    const value = packed & 0x7fff;
    const dynamic = signed(word(slot)) >= 64;
    const address = 0x7a00 + (dynamic ? 0x300 : 0) + (value & 511) * 2;
    const cell = word(readWord(address) + (value >> 9));
    return dynamic
      ? { cell, bitmapIndex: word(cell + 0x338), recordPointer: null }
      : { cell, bitmapIndex: cell, recordPointer: word(0x6040 + cell * 8) };
  }
  /** BF5E-BFBA: original object cell -> fixed-point actor coordinates.
   * packed=0AF8[slot], bitmapIndex=09B6 resolved by BE10;
   * rowPhase=0E9B (signed byte), lastRow=099C. readWord accesses the
   * caller's bank1 coordinate tables at CPU4AC0/5580, plus fixed ROM.
   * Returned coordinates are wrapping original words, not unwrapped map PNG
   * coordinates. C62A/C63A add actor-type offsets separately.
   */
  function objectCoordinates(packed, bitmapIndex, rowPhase, lastRow, readWord) {
    const location = packed & 511;
    let phase = (rowPhase << 24) >> 24;
    if ((location & 15) > (lastRow & 65535)) phase++;
    const xPhase = ((location >> 4) + phase) & 3;
    const x = word(
      readWord(0xfdb2 + xPhase * 2) + readWord(word(0x4ac0 + bitmapIndex * 2)),
    );
    const y = word(
      readWord(0xfdaa + (location & 3) * 2) +
        readWord(word(0x5580 + bitmapIndex * 2)),
    );
    return { x, y, xPhase };
  }
  /** E322-E32E/91FA-9216: kick animation countdown selected by speed. */
  function kickAnimationRate(speed) {
    const magnitude = Math.abs(signed(word(speed)));
    let band = ((magnitude * 2) & 65535) >> 8;
    if (band > 15) band = 15;
    return [12, 12, 11, 11, 10, 10, 9, 9, 8, 8, 7, 7, 7, 7, 7, 7][band];
  }
  /** E3B0-E3DE: ordinary jump rate from pre-launch speed. */
  function jumpAnimationRate(speed) {
    const value = signed(word(speed));
    const magnitude = value < 0 ? signed(word(-value)) : value;
    return magnitude < 448 ? 8 : 2;
  }
  /** B3A8-B3BE/B45C: byte countdown/phase update without pointer plumbing. */
  function tickAnimationPhase(clock) {
    if ((clock.rate << 24) >> 24 <= 0) return clock;
    if (clock.countdown > 0) clock.countdown = (clock.countdown - 1) & 255;
    else {
      clock.countdown = clock.rate & 255;
      clock.phase = (clock.phase + 1) & 255;
    }
    return clock;
  }
  /** E4CE-E518: original ordinary-jump action states5..9.
   * action=01EB, phase=07B1, rate=0771, countdown=0791;
   * vertical=05B2, groundVertical=05B0, height=06B2, groundHeight=06B0,
   * movementState=01EA (1 means grounded here).
   * E4FE increments phase on state changes independently of the animation
   * clock. Thus evenly dividing flight duration cannot reproduce these poses.
   * Caller supplies original actor words; no browser state inference here.
   */
  function jumpActionTransition(state) {
    let advance = false;
    switch (state.action & 255) {
      case 4:
        // E4AE waits for 07B1, then E238 clears rates before E4B8/BE.
        if ((state.phase & 255) !== 0) {
          state.action = 5;
          state.animationMode = 4;
          state.inputInhibit = 1;
          state.rate = 0;
          state.bodyRate = 0;
          state.countdown = 0;
        }
        return state;
      case 5:
      case 6:
        advance = signed(word(state.vertical - state.groundVertical)) < 0;
        break;
      case 7:
        advance = signed(word(state.height - state.groundHeight)) <= 0x600;
        break;
      case 8:
        if ((state.movementState & 255) === 1) {
          state.rate = 20;
          state.countdown = 20;
          advance = true;
        }
        break;
      case 9:
        if ((state.countdown & 255) === 2) {
          // E514 -> E238 resets jump/kick animation state and rates.
          state.action = 0;
          state.animationMode = 0;
          state.inputInhibit = 1;
          state.rate = 0;
          state.countdown = 0;
          state.bodyRate = 0;
        }
        return state;
      default:
        return state;
    }
    if (advance) {
      state.action = (state.action + 1) & 255;
      state.phase = (state.phase + 1) & 255;
    }
    return state;
  }
  /** E3A6-E3DE: original ordinary-jump anticipation setup.
   * The main speed is saved to02E8 and zeroed. Rate8/2 is assigned to
   * both jump actors; phase07B1 starts at0. E4AE waits for its first event
   * before launching, then stops those clocks for velocity-driven phases.
   * This is not a uniform timer stretched over the whole jump.
   */
  function beginOrdinaryJumpAnimation(speed) {
    const rate = jumpAnimationRate(speed);
    return {
      action: 4,
      animationMode: 4,
      inputInhibit: 1,
      savedSpeed: word(speed),
      mainSpeed: 0,
      phase: 0,
      rate,
      bodyRate: rate,
      countdown: rate,
    };
  }
  /** Bank1A0004E34-4E90: physics consumes animation state5 once,
   * restores saved speed, advances action to6, then applies shoe launch byte.
   * Direction-to-velocity conversion5B46 and9FB4 remain caller operations.
   */
  function ordinaryJumpTakeoff(state, shoes) {
    if ((state.action & 255) !== 5) return state;
    const saved = signed(word(state.savedSpeed));
    state.mainSpeed = word(
      saved >= 0 && saved <= 128
        ? saved + 256
        : saved < 0 && saved >= -128
          ? saved - 256
          : saved,
    );
    state.action = 6;
    state.vertical = ordinaryJumpLaunch(shoes);
    return state;
  }
  /** E366-E3DE: rising surfaces (>48 signed vertical units/frame)
   * enter action6 immediately with phase1 and add the shoe impulse.
   * Slower surfaces use the speed-dependent action4 anticipation instead.
   */
  function beginSurfaceJumpAnimation(speed, vertical, shoes) {
    if (signed(word(vertical)) <= 48) {
      const state = beginOrdinaryJumpAnimation(speed);
      state.risingSurface = false;
      return state;
    }
    return {
      action: 6,
      animationMode: 4,
      inputInhibit: 1,
      phase: 1,
      rate: 0,
      bodyRate: 0,
      countdown: 0,
      savedSpeed: word(speed),
      mainSpeed: word(speed),
      vertical: word(vertical + ordinaryJumpLaunch(shoes)),
      risingSurface: true,
    };
  }
  /** E334-E358: jump request gate. jumpInput0332=2 is a new press;
   * movementState01EA=1 is grounded; profile0327 low bits>=3 reject;
   * specialState0F59=3 also rejects. Geometry ahead is not tested here.
   */
  function jumpRequestAllowed(jumpInput, movementState, profile, specialState) {
    return (
      (jumpInput & 255) === 2 &&
      (movementState & 255) === 1 &&
      (profile & 7) < 3 &&
      (specialState & 255) !== 3
    );
  }
  /** E5D2/E648: paired ground pose entries from terrain and signed speed.
   * Profiles2/10 use the alternate squat-body tables at speed>=0500.
   * FE2D/FE35 offsets are original ROM bytes, not animation estimates.
   */
  function groundPoseEntries(direction, profile, speed, readWord) {
    const body = animationEntry(direction, profile, profile, speed, {
      readWord,
      variantOffsets: [0, 0, 0, 0, 32, 32, 64, 96],
    });
    const board =
      (profile & 7) === 0
        ? word(0x4f64 + direction * 2)
        : word(
            readWord(word(0x4c4c + (signed(word(profile)) >> 3) * 2)) +
              [136, 0, 16, 16, 32, 32, 48, 64][profile & 7] +
              (direction & 7) * 2,
          );
    return { body, board, shadow: (profile & 7) === 7 ? 0x50fa : board };
  }
  /** 9F98-9FAE: enter the airborne landing/fall pose without a jump
   * impulse. The caller supplies velocity and performs9FB4's transition.
   */
  function beginDropAnimation(speed) {
    return {
      action: 8,
      phase: 3,
      rate: 0,
      bodyRate: 0,
      countdown: 0,
      animationMode: 4,
      inputInhibit: 1,
      savedSpeed: word(speed),
      mainSpeed: word(speed),
      movementState: 0,
    };
  }
  /** Bank16000 CPU7224-7252: map display seconds from difficulty0F2E.
   * A marker in a different region from the current visit mask halves the
   * duration, with a two-second floor. The normal timer ticks at 60 frames.
   */
  function mapDisplaySeconds(difficulty, sameRegionMask) {
    let seconds = word(12 - (difficulty & 255));
    if (!sameRegionMask) seconds = Math.max(2, signed(seconds) >> 1);
    return seconds;
  }
  const routines = Object.freeze({
    beginDropAnimation,
    groundPoseEntries,
    beginSurfaceJumpAnimation,
    jumpRequestAllowed,
    ordinaryJumpTakeoff,
    beginOrdinaryJumpAnimation,
    jumpActionTransition,
    kickAnimationRate,
    jumpAnimationRate,
    tickAnimationPhase,
    mapDisplaySeconds,
    objectCoordinates,
    resolveObjectPlacement,
    courseKindFromSelector,
    cityReturnParameters,
    initialMapBounds,
    cityInteractionSelector,
    setupTableIndex,
    initialRaceCounter,
    tickRaceCounter,
    tallyRaceCounter,
    tallyPendingScore,
    steeringDifference,
    sharpTurnAnimationEntries,
    spriteDescriptor,
    tickMotionAnimation,
    advanceAnimationMarker,
    finishAnimationSegment,
    requestAnimationInterruption,
    landingDirectionMismatch,
    ordinaryJumpLaunch,
    airborneVelocity,
    airtimeAward,
    addScoreWord,
    updateActor,
    animationEntry,
    projectHorizontal,
    eligibilityMask,
  });
  if (typeof module !== "undefined") module.exports = routines;
  else window.Skate720.OriginalRoutines = routines;
})();
