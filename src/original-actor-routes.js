/** Original route-cell occupancy, BE7C-BF5C and BFDC-C0B8.
 * Banked object readers and RAM reservation readers are supplied explicitly.
 * No map positions or traffic paths are fabricated by this module.
 */
(() => {
  const word = (n) => n & 65535,
    signed = (n) => (n << 16) >> 16;
  const bit = (n) => 1 << (n & 7);
  /** BE7C-BF14: test the destination word stored in a route record.
   * Group owners at0E6D store slot+1 (zero means unowned). Cells without
   * a group use individual bits in0CF6. Invalid directory entries return-1.
   */
  function inspect(packed, slot, memory) {
    const directory = 0x7a00 + (signed(word(slot)) >= 64 ? 0x300 : 0);
    const base = word(memory.readObjectWord(directory + (packed & 511) * 2));
    if (signed(base) < 0) return { status: base, bitmapIndex: null };
    const cell = word(base + (signed(word(packed)) >> 9));
    const bitmapIndex = word(cell + (signed(word(slot)) >= 64 ? 0x338 : 0));
    const trait = memory.readTraitByte(0x4560 + bitmapIndex) & 255,
      group = trait & 15;
    let status;
    if (group) {
      const owner = memory.readRamByte(0x0e6d + group) & 255;
      status = owner && owner !== word(slot + 1) ? 1 : 0;
    } else
      status =
        memory.readRamByte(0x0cf6 + (bitmapIndex >> 3)) &
        bit(bitmapIndex) &
        255;
    return { status, bitmapIndex, trait, group };
  }
  /** BF18-BF5C: release both the group owner and individual-cell bit. */
  function release(bitmapIndex, memory) {
    const group = memory.readTraitByte(0x4560 + bitmapIndex) & 15;
    if (group) memory.writeRamByte(0x0e6d + group, 0);
    const address = 0x0cf6 + (bitmapIndex >> 3);
    memory.writeRamByte(
      address,
      memory.readRamByte(address) & ~bit(bitmapIndex) & 255,
    );
  }
  /** BFDC-C0B8 after successful pose/motion setup. Commit ownership and the
   * next packed word. The original active flag8000 survives the transition.
   * paletteFlags is actor0470; its bit80 follows destination shading bit20.
   */
  function commit(
    currentPacked,
    targetPacked,
    slot,
    oldBitmap,
    newBitmap,
    paletteFlags,
    memory,
  ) {
    const oldTrait = memory.readTraitByte(0x4560 + oldBitmap) & 255;
    const nextTrait = memory.readTraitByte(0x4560 + newBitmap) & 255;
    const oldGroup = oldTrait & 15,
      nextGroup = nextTrait & 15;
    if (oldGroup) {
      if (!nextGroup) memory.writeRamByte(0x0e6d + oldGroup, 0);
    } else {
      const address = 0x0cf6 + (oldBitmap >> 3);
      memory.writeRamByte(
        address,
        memory.readRamByte(address) & ~bit(oldBitmap) & 255,
      );
    }
    if (currentPacked & 0x8000)
      paletteFlags = nextTrait & 32 ? paletteFlags | 128 : paletteFlags & 127;
    if (nextGroup) memory.writeRamByte(0x0e6d + nextGroup, (slot + 1) & 255);
    else {
      const address = 0x0cf6 + (newBitmap >> 3);
      memory.writeRamByte(
        address,
        memory.readRamByte(address) | bit(newBitmap),
      );
    }
    return {
      packed: word(targetPacked | (currentPacked & 0x8000)),
      paletteFlags: paletteFlags & 255,
    };
  }
  /** C850-C866: advance only after BE7C reports an available destination.
   * prepare owns C114/C27A's pose/motion update; nonzero defers the commit.
   */
  function tryAdvance(actor, targetPacked, oldBitmap, memory, prepare) {
    const next = inspect(targetPacked, actor.slot, memory);
    if (next.status !== 0) return { advanced: false, status: -1, next };
    if (prepare(next) !== 0)
      return { advanced: false, status: 1, placementPending: true, next };
    Object.assign(
      actor,
      commit(
        actor.packed,
        targetPacked,
        actor.slot,
        oldBitmap,
        next.bitmapIndex,
        actor.paletteFlags,
        memory,
      ),
    );
    return { advanced: true, status: 1, next };
  }
  /** C868-C8A8: secondary record at+4 may restrict the actor kind through
   * the class table at4000/FD91. Accepted secondary paths return0 (the
   * primary wrapper returns1), even when the turn pose defers its commit.
   */
  function tryAlternate(actor, recordAddress, oldBitmap, memory, prepare) {
    const address = word(recordAddress + 4);
    const target = memory.readObjectWord(address);
    const next = inspect(target, actor.slot, memory);
    if (next.status !== 0)
      return { advanced: false, status: -1, next, recordAddress: address };
    const routeClass = memory.readTraitByte(0x4000 + next.bitmapIndex) & 15;
    if (
      routeClass &&
      (memory.readFixedByte(0xfd91 + routeClass) & 255) !== (actor.kind & 255)
    )
      return { advanced: false, status: -1, next, recordAddress: address };
    if (prepare(next, address) !== 0)
      return {
        advanced: false,
        status: 0,
        placementPending: true,
        next,
        recordAddress: address,
      };
    Object.assign(
      actor,
      commit(
        actor.packed,
        target,
        actor.slot,
        oldBitmap,
        next.bitmapIndex,
        actor.paletteFlags,
        memory,
      ),
    );
    return { advanced: true, status: 0, next, recordAddress: address };
  }
  /** CA4C-CB22: choose primary/secondary routes, including per-cell
   * alternation bits0DAA and blocked-actor delay. Callbacks carry the full
   * C850/C868/BFBC outcomes; the turning path resumes without rechoosing.
   */
  function chooseRouteRecord(
    actor,
    bitmapIndex,
    recordAddress,
    memory,
    operations,
  ) {
    if (actor.routeFlags & 1) {
      const address = word(recordAddress + (actor.routeFlags & 2 ? 4 : 0));
      return { ...operations.resume(address), recordAddress: address };
    }
    const address = 0x0daa + (bitmapIndex >> 3),
      mask = bit(bitmapIndex);
    let result;
    if (memory.readRamByte(address) & mask) {
      memory.writeRamByte(address, memory.readRamByte(address) & ~mask & 255);
      result = operations.alternate(recordAddress);
      if (signed(word(result.status)) < 0)
        result = operations.primary(recordAddress);
    } else {
      result = operations.primary(recordAddress);
      if (memory.readTraitByte(0x4560 + bitmapIndex) & 64) {
        memory.writeRamByte(address, memory.readRamByte(address) | mask);
        if (signed(word(result.status)) < 0)
          result = operations.alternate(recordAddress);
      }
    }
    const status = signed(word(result.status));
    if (status < 0) {
      const variant =
        (memory.readTypeByte(0x65cc + (actor.kind & 255)) << 24) >> 24;
      actor.duration = memory.readFixedByte(word(0xfd8a + variant)) & 255;
      actor.dx = 0;
      actor.dy = 0;
      actor.rate = (actor.rate | 128) & 255;
    } else if (status > 0) actor.routeFlags = (actor.routeFlags || 0) & 253;
    else actor.routeFlags = ((actor.routeFlags || 0) | 2) & 255;
    return result;
  }
  /** C0D8-C112: successful off-screen route preparation schedules the
   * next static update from the signed type variant's original FD82 byte.
   */
  function preparePending(slot, kind, memory) {
    const variant = (memory.readTypeByte(0x65cc + kind) << 24) >> 24;
    const delay = memory.readFixedByte(word(0xfd82 + variant)) & 255;
    memory.writeRamByte(0x0ab8 + slot, delay + memory.readRamByte(0x0e9a));
    return 0;
  }
  /** Compose C850/C868/BFBC for a pending static registry record. Active
   * actors require C114's pose/motion stage and must use its separate path.
   */
  function advancePending(slot, recordAddress, alternate, memory, resolve) {
    const address = 0x0af8 + slot * 2;
    const packed =
      memory.readRamByte(address) | (memory.readRamByte(address + 1) << 8);
    if (packed & 32768)
      throw new Error("Pending route callback received active actor");
    const kind = memory.readRamByte(0x09b8 + slot);
    const old = resolve(packed, slot, memory.readObjectWord);
    const actor = { slot, kind, packed, paletteFlags: 0 };
    const selected = word(recordAddress + (alternate ? 4 : 0));
    memory.writeRamByte(0x09b2, selected);
    memory.writeRamByte(0x09b3, selected >> 8);
    const prepare = (next) => {
      memory.writeRamByte(0x09b4, next.bitmapIndex);
      memory.writeRamByte(0x09b5, next.bitmapIndex >> 8);
      return preparePending(slot, kind, memory);
    };
    const result = alternate
      ? tryAlternate(actor, recordAddress, old.bitmapIndex, memory, prepare)
      : tryAdvance(
          actor,
          memory.readObjectWord(selected),
          old.bitmapIndex,
          memory,
          prepare,
        );
    if (result.advanced) {
      memory.writeRamByte(address, actor.packed);
      memory.writeRamByte(address + 1, actor.packed >> 8);
    }
    return result;
  }
  const api = Object.freeze({
    inspect,
    preparePending,
    advancePending,
    release,
    commit,
    tryAdvance,
    tryAlternate,
    chooseRouteRecord,
  });
  if (typeof module !== "undefined") module.exports = api;
  else window.Skate720.OriginalActorRoutes = api;
})();
