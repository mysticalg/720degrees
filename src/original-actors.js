/** Original actor motion setup, fixed ROM C27A-C350.
 * This module translates the numeric controller fragment. Object spawning,
 * route changes, collision callbacks and original pose selection are separate.
 * Fixed city descriptor clocks are live; route movement remains separate.
 */
(() => {
  const word = (x) => x & 65535;
  const signed = (x) => (x << 16) >> 16;
  const signedByte = (x) => (x << 24) >> 24;
  /** Readers explicitly select bank0000/0400 type tables or bank2400
   * motion tables. Fixed-ROM bytes (FD8A) use readFixedByte.
   * actor fields: kind0370, flags0490, rate0770, duration0430,
   * dx04F0,dy0570,direction07D0. direction/route come from record bytes2/3.
   */
  function configureMotion(actor, direction, route, memory) {
    direction &= 255;
    route &= 255;
    let stationary = memory.readTypeByte(0x649d + actor.kind) & 1;
    if (stationary && direction & 1) {
      stationary = 0;
      actor.flags = actor.flags & ~1 & 255;
    }
    const variant = signedByte(memory.readTypeByte(0x65cc + actor.kind));
    // C296-C2A2 saves rate&007F, clears the rate byte, then restores
    // those low bits. The source (sp)+ pops before destination addressing.
    actor.rate &= 127;
    if (!stationary) {
      const index = word(direction * 8 + variant);
      actor.dx = signed(memory.readMotionWord(word(0x4138 + index * 2)));
      actor.dy = signed(memory.readMotionWord(word(0x4238 + index * 2)));
      actor.duration =
        route === 24
          ? memory.readFixedByte(word(0xfd8a + variant)) & 255
          : memory.readMotionByte(word(0x3ff8 + route * 8 + variant)) & 255;
    } else {
      actor.duration = word(
        actor.duration + memory.readMotionWord(word(0x40f8 + route * 2)),
      );
      actor.dx = 0;
      actor.dy = 0;
      actor.flags = (actor.flags | 1) & 255;
    }
    actor.direction = direction;
    return actor;
  }
  /** C114-C246: select the route's pose, including intermediate turn
   * sequences. Return true when C352 must reproject the actor's placement;
   * a false return allows C27A to configure its motion normally.
   * Actor pointer03B0 is a directory address, not a graphics tile number.
   * routeFlags04B0 controls pending turns; flags0490 controls sprite motion.
   */
  function selectRouteAnimation(actor, direction, memory) {
    direction &= 255;
    const previous = signedByte(actor.direction);
    if (direction === previous) return false;
    const kind = actor.kind & 255;
    const base = memory.readTypeWord(word(0x5f7c + kind * 2));
    const offset = (d) => memory.readFixedByte(word(0xfdba + d)) & 255;
    let selected = memory.readTypeWord(word(base + offset(direction)));
    let step = direction < previous ? -2 : 2;
    if (Math.abs(direction - previous) > 8) step = -step;
    let candidate =
      actor.routeFlags & 1
        ? actor.pointer
        : memory.readTypeWord(word(base + offset(previous)));
    candidate = word(candidate + step);
    const link = memory.readTypeWord(candidate);
    if (link & 32768) candidate = link & 32767;
    if ((direction | previous) & 1) candidate = selected;
    const pending = candidate !== selected;
    if (!pending) actor.routeFlags = (actor.routeFlags || 0) & ~1 & 255;
    else selected = candidate;
    if (memory.readTypeByte(0x6502 + kind) & 255) {
      if (!pending) selected = memory.readTypeWord(selected);
      else if (actor.routeFlags & 1) {
        selected = word(selected + step);
        const loop = memory.readTypeWord(selected);
        if (loop & 32768) selected = loop & 32767;
      }
    }
    if (selected !== actor.pointer) {
      actor.pointer = word(selected);
      actor.dirty = ((actor.dirty || 0) | 24) & 255;
      const extraBase = memory.readTypeWord(word(0x6110 + kind * 2));
      if (extraBase)
        actor.extraPointer = memory.readTypeWord(
          word(extraBase + offset(direction)),
        );
    }
    return pending;
  }
  /** Composition preserves C274's branch: turning actors reproject their
   * object position, while actors already at their target pose get motion.
   * Caller supplies the original BF5E projection for the pending case.
   */
  function updateRouteActor(actor, direction, route, memory, reproject) {
    if (selectRouteAnimation(actor, direction, memory)) {
      // C3D4 marks the intermediate route turn independently of0490.
      actor.routeFlags = ((actor.routeFlags || 0) | 1) & 255;
      if (reproject) reproject(actor);
      return { actor, placementPending: true };
    }
    configureMotion(actor, direction, route, memory);
    return { actor, placementPending: false };
  }
  /** B39A-B3DA/B450-B45C: clock a descriptor-only actor sequence.
   * Actors with embedded movement records use a separate B3DC branch.
   * A negative next word links to another directory entry; it is not art.
   */
  function tickDescriptor(actor, readWord) {
    if (!(actor.rate & 127) || actor.rate & 128) return false;
    if (actor.countdown) {
      actor.countdown = (actor.countdown - 1) & 255;
      return false;
    }
    actor.countdown = actor.rate & 255;
    let pointer = word(actor.pointer + 2);
    actor.phase = ((actor.phase || 0) + 1) & 255;
    const next = readWord(pointer);
    if (next & 32768) {
      pointer = next & 32767;
      actor.phase = 0;
      // B3D0 tests the current route flag, not an immutable type property.
      // Controllers can change this bit while an animation is running.
      if (actor.routeFlags & 32) actor.rate = 0;
    }
    actor.pointer = pointer;
    actor.dirty = ((actor.dirty || 0) | 24) & 255;
    return true;
  }
  /** B378-B474: numeric step for a non-player motion actor. Ordinary
   * velocity is retained between poses. Flag01 turns read a three-byte
   * motion prefix before the new descriptor and override this frame's
   * displacement only; those bytes do not replace stored dx/dy.
   */
  function stepMotionActor(actor, memory) {
    let dx = signed(word(actor.dx || 0)),
      dy = signed(word(actor.dy || 0));
    const changed = tickDescriptor(actor, memory.readTypeWord);
    if (changed && actor.flags & 1) {
      const prefix = word(memory.readTypeWord(actor.pointer) + 0x3ffd);
      dx = signed(word(signedByte(memory.readSpriteByte(prefix)) * 16));
      dy = signed(
        word(signedByte(memory.readSpriteByte(word(prefix + 1))) * 16),
      );
      const duration = memory.readSpriteByte(word(prefix + 2)) & 255;
      if (duration)
        actor.duration = word((actor.duration || 0) - duration + actor.rate);
    }
    return { dx, dy, dz: signed(word(actor.vertical || 0)), changed };
  }
  /** C352-C3DE: intermediate turn pose moves toward the current cell's
   * original BF5E coordinate plus type offsets. Word subtraction wraps
   * before arithmetic shift, preserving turns across coordinate seams.
   */
  function reprojectTurn(actor, position, memory) {
    const x = word(position.x + memory.readTypeWord(0x62a4 + actor.kind * 2));
    const y = word(position.y + memory.readTypeWord(0x636e + actor.kind * 2));
    actor.dx = signed(word(x - actor.x)) >> 4;
    actor.dy = signed(word(y - actor.y)) >> 4;
    actor.duration = 6;
    actor.rate = ((actor.rate || 0) | 128) & 255;
    actor.routeFlags = ((actor.routeFlags || 0) | 1) & 255;
    return actor;
  }
  /** CB64-CB9E category1's route deadline gate. Zero is inactive;
   * positive duration only waits while route flags0C permit it.
   */
  function trafficRouteDue(actor) {
    if (!(actor.duration & 65535)) return false;
    actor.duration = word(actor.duration - 1);
    if (signed(actor.duration) > 0 && actor.routeFlags & 12) return false;
    actor.routeFlags = ((actor.routeFlags || 0) | 8) & 255;
    return true;
  }
  /** CBD4, CC0A-CC56 and CD82-CDBE share CB64's deadline gate.
   * Category0 scenery stops its controller, category5 refreshes viewport
   * admission every16 ticks, category6 retires at its collection deadline.
   * Category9 effects wait15 ticks while either flag06 bit is still set;
   * only the cleared flags admit retirement. Callers own registry/budgets.
   */
  function passiveActorStep(actor, category) {
    if (![0, 5, 6, 9].includes(category) || !trafficRouteDue(actor))
      return null;
    if (category === 0) {
      actor.duration = 0;
      return null;
    }
    if (category === 5) {
      actor.duration = 16;
      return "viewport";
    }
    if (category === 9 && actor.flags & 6) {
      actor.duration = 15;
      return null;
    }
    return "retire";
  }
  /** CC5A-CC8A follows CB64's shared deadline gate. An entered park's
   * gate clears its contact mask and advances CA4C; otherwise it stops.
   */
  function gateRouteDue(actor, memory) {
    if (!trafficRouteDue(actor)) return false;
    const group = memory.readTraitByte(0x4000 + actor.bitmapIndex) & 15;
    if (group && memory.readRamByte(0x0ea4) & (1 << (group - 1))) {
      actor.extraPointer = 0;
      return true;
    }
    actor.dx = actor.dy = actor.duration = 0;
    return false;
  }
  /** CA0C-CA48 / CDD0-CDF8: a category3 route marker signals the
   * other static record at the same packed position. Search backwards,
   * excluding the sender, as the cabinet does (duplicates are meaningful).
   * C98E advances the recipient's directory once and starts rate5.
   * The caller then continues ordinary CA4C routing for the sender.
   */
  function findStaticPartner(actor, packed, memory) {
    const readWord = (a) =>
      memory.readRamByte(a) | (memory.readRamByte(a + 1) << 8);
    for (let slot = signed(readWord(0x09ae)); slot >= 0; slot--) {
      if (slot !== actor.slot && readWord(0x0af8 + slot * 2) === word(packed))
        return slot;
    }
    return -1;
  }
  function advancePartnerPose(recipient, rate, memory) {
    // Only live browser actors have a descriptor adapter. Do not attach a
    // pose to an unrelated sprite when the registry record is offscreen.
    if (!recipient || recipient.sprite === memory.readRamByte(0x0e6a))
      return false;
    let pointer = word(recipient.pointer + 2);
    const next = memory.readTypeWord(pointer);
    if (next & 32768) pointer = next & 32767;
    recipient.pointer = pointer;
    recipient.flags = ((recipient.flags || 0) | 24) & 255;
    recipient.countdown = recipient.rate = rate;
    return true;
  }
  function signalRoutePartner(actor, memory, activeActor) {
    if (actor.routeFlags & 1) return null;
    if (!(memory.readTraitByte(0x4000 + actor.bitmapIndex) & 16)) return null;
    const slot = findStaticPartner(actor, actor.packed, memory);
    const recipient = slot < 0 ? null : activeActor(slot);
    if (advancePartnerPose(recipient, 5, memory)) return recipient;
    return null;
  }
  /** CC8C-CD80, FDDE's three category8 branches (paired actors43/44).
   * The route marker's low nibble chooses ordinary movement, a pose reset,
   * or a throw/handoff. CCEC searches +0400 first, then +0600 only when no
   * record exists. A paused partner resumes at rate4 for0700 ticks. After
   * CA4C, the sender pauses unless it is still in an intermediate turn.
   * route() must update actor.routeFlags before this final test.
   */
  function updatePairedRoute(actor, memory, activeActor, route) {
    const branch = memory.readTraitByte(0x4000 + actor.bitmapIndex) & 15;
    let recipient = null;
    if (branch === 1) {
      actor.pointer = memory.readTypeWord(word(0x5408 + (actor.kind - 43) * 2));
    } else if (branch === 2 && !(actor.routeFlags & 1)) {
      let slot = findStaticPartner(actor, actor.packed + 0x400, memory);
      if (slot < 0)
        slot = findStaticPartner(actor, actor.packed + 0x600, memory);
      const candidate = slot < 0 ? null : activeActor(slot);
      if (candidate && candidate.rate & 128) {
        advancePartnerPose(candidate, 4, memory);
        candidate.duration = 0x700;
        recipient = candidate;
      }
    }
    route();
    if (branch === 2 && !(actor.routeFlags & 1)) {
      actor.rate = ((actor.rate || 0) | 128) & 255;
      actor.duration = 0x7fff;
    }
    return recipient;
  }
  const api = Object.freeze({
    stepMotionActor,
    reprojectTurn,
    trafficRouteDue,
    passiveActorStep,
    gateRouteDue,
    signalRoutePartner,
    updatePairedRoute,
    tickDescriptor,
    configureMotion,
    selectRouteAnimation,
    updateRouteActor,
  });
  if (typeof module !== "undefined") module.exports = api;
  else window.Skate720.OriginalActors = api;
})();
