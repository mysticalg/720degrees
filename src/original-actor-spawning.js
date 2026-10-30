/** Original sprite-pool selection B5B8-B600 and spawn admission C508-C5D6.
 * Placement, route initialization and descriptor setup remain separate stages.
 * These routines manipulate original fields directly; no CPU is interpreted.
 */
(() => {
  const signedByte = (n) => (n << 24) >> 24;
  /** B5B8: slots8..31 are general actors. During0196's special phase,
   * skip the remembered0FFC slot. Only flag bits86 make a slot unavailable.
   */
  function allocateSprite(memory) {
    let slot = 8;
    const special = memory.readRamByte(0x0196) !== 0;
    while (slot < 256) {
      if (!special) memory.writeRamByte(0x0ffc, slot);
      const skip = special && signedByte(memory.readRamByte(0x0ffc)) === slot;
      if (!skip && !(memory.readRamByte(0x0490 + slot) & 0x86)) break;
      slot++;
    }
    if (slot >= 32) return -1;
    memory.writeRamByte(0x0490 + slot, 0);
    memory.writeRamByte(0x04b0 + slot, 4);
    return slot;
  }
  /** C508-C5D6: reserve category budget, then select the sprite slot.
   * Failure does not refund budget here: retain the original operation order.
   * Returned ready means the caller must finish C5DC-C82C initialization.
   */
  function admit(slot, memory, services) {
    const kind = signedByte(memory.readRamByte(0x09b8 + slot));
    const flags = memory.readTypeByte(0x649d + kind);
    if (slot >= 64) {
      if (flags & 16) {
        const available = signedByte(memory.readRamByte(0x0e96));
        if (!available) return { status: "deferred", kind };
        memory.writeRamByte(0x0e96, available - 1);
      }
    } else if (flags & 64) {
      const available = signedByte(memory.readRamByte(0x0e97));
      if (!available) {
        const group = kind < 47 ? kind + 1 : kind - 29;
        services.request(group);
        services.remove(slot);
        return { status: "removed", kind, group };
      }
      memory.writeRamByte(0x0e97, available - 1);
      services.prepareTraffic(kind);
    }
    let sprite;
    if (kind === 1) {
      if (memory.readRamByte(0x0375)) return { status: "deferred", kind };
      sprite = 5;
    } else if (kind === 4) sprite = 7;
    else sprite = allocateSprite(memory);
    if (sprite < 0) return { status: "deferred", kind };
    memory.writeRamByte(0x0370 + sprite, kind);
    memory.writeRamByte(0x0390 + sprite, slot);
    return { status: "ready", kind, sprite };
  }
  /** C8AA-C98C: advance pending static traffic on its byte-clock deadline.
   * A zero clock skips the whole scan. Route callbacks retain C850/C868's
   * different success values, including accepted-but-pending placements.
   */
  function tickPendingRoutes(memory, services) {
    const clock = (memory.readRamByte(0x0e9a) + 1) & 255;
    memory.writeRamByte(0x0e9a, clock);
    if (!clock) return [];
    const highest =
      ((memory.readRamByte(0x09ae) | (memory.readRamByte(0x09af) << 8)) <<
        16) >>
      16;
    memory.writeRamByte(0x09aa, highest);
    memory.writeRamByte(0x09ab, highest >> 8);
    if (highest < 0) return [];
    const visited = [];
    for (let slot = highest; slot >= 0; slot--) {
      memory.writeRamByte(0x09aa, slot);
      memory.writeRamByte(0x09ab, slot >> 8);
      if (memory.readRamByte(0x0ab8 + slot) !== clock) continue;
      const packed =
        memory.readRamByte(0x0af8 + slot * 2) |
        (memory.readRamByte(0x0af9 + slot * 2) << 8);
      const placement = services.resolve(packed, slot, memory.readObjectWord);
      const bitmap = placement.bitmapIndex;
      const address = 0x0daa + (bitmap >> 3),
        mask = 1 << (bitmap & 7);
      let status;
      if (!(memory.readRamByte(address) & mask)) {
        status = services.primary(slot, placement);
        if (memory.readTraitByte(0x4560 + bitmap) & 64) {
          memory.writeRamByte(address, memory.readRamByte(address) | mask);
          if (status < 0) status = services.alternate(slot, placement);
        }
      } else {
        memory.writeRamByte(address, memory.readRamByte(address) & ~mask);
        status = services.alternate(slot, placement);
        if (status < 0) status = services.primary(slot, placement);
      }
      if (status < 0) memory.writeRamByte(0x0ab8 + slot, clock + 8);
      // A successful route can write a new deadline. Zero is reserved for
      // inactive records, so turn it into1 just as C97E does.
      if (!memory.readRamByte(0x0ab8 + slot))
        memory.writeRamByte(0x0ab8 + slot, 1);
      visited.push({ slot, status });
    }
    // C984 also decrements the visible original scan cursor toFFFF.
    memory.writeRamByte(0x09aa, 255);
    memory.writeRamByte(0x09ab, 255);
    return visited;
  }
  /** C618-C7AE for ordinary actors (type1 has its separate DF40 setup).
   * Position is BF5E's wrapping coordinate pair; direction is route byte2.
   * Bee caller supplies E0C2's position and direction6 instead.
   */
  function initializeActor(actor, position, direction, memory) {
    const word = (n) => n & 65535;
    const kind = actor.kind & 255,
      slot = actor.slot;
    if (kind === 1) throw new RangeError("Type1 requires original DF40 setup");
    const typeFlags = memory.readTypeByte(0x6438 + kind) & 255;
    actor.paletteFlags = (typeFlags & ~48) | 64;
    if (memory.readTraitByte(0x4560 + actor.bitmapIndex) & 32)
      actor.paletteFlags |= 128;
    actor.x = word(position.x + memory.readTypeWord(0x62a4 + kind * 2));
    actor.y = word(position.y + memory.readTypeWord(0x636e + kind * 2));
    actor.rate = memory.readTypeByte(0x6502 + kind) & 255;
    actor.countdown = actor.rate;
    actor.direction = direction & 255;
    const base = memory.readTypeWord(0x5f7c + kind * 2);
    const extra = memory.readTypeWord(0x6110 + kind * 2);
    if (typeFlags & 128) {
      actor.pointer = base;
      actor.extraPointer = extra;
      if (typeFlags & 4) actor.routeFlags = (actor.routeFlags || 0) | 32;
      if (kind === 87 && memory.readRamByte(0x01e7)) {
        actor.rate = 5;
        actor.countdown = 5;
      }
    } else {
      const offset = memory.readFixedByte(0xfdba + actor.direction) & 255;
      let pointer = memory.readTypeWord(word(base + offset));
      if (actor.rate) {
        pointer = memory.readTypeWord(pointer);
        actor.countdown |= 128;
      }
      actor.pointer = word(pointer);
      actor.extraPointer = memory.readTypeWord(word(extra + offset));
    }
    actor.flags =
      ((actor.flags || 0) | (memory.readTypeByte(0x649d + kind) & 1)) & 255;
    const category = memory.readTypeByte(0x623f + kind) & 255;
    if (category && category !== 6) {
      if (slot < 64) {
        const clock = memory.readRamByte(0x0e9a);
        // C79C clears the high byte; BISB retains the wrapped byte difference.
        const remaining = (memory.readRamByte(0x0ab8 + slot) - clock) & 255;
        actor.duration = word(remaining * 4);
        memory.writeRamByte(0x0ab8 + slot, 0);
      } else actor.duration = 16;
    }
    return actor;
  }
  const readFieldWord = (m, a) =>
    m.readRamByte(a) | (m.readRamByte(a + 1) << 8);
  const writeFieldWord = (m, a, n) => {
    m.writeRamByte(a, n);
    m.writeRamByte(a + 1, n >> 8);
  };
  /** B4B6-B56C: register a sprite, set its original column count and
   * initialize screen coordinates. Argument bit80 suppresses its columns.
   */
  function registerSprite(argument, memory) {
    const sprite = argument & ~128;
    let highest = signedByte(memory.readRamByte(0x0994));
    if (sprite >= highest) memory.writeRamByte(0x0994, sprite);
    else if (highest >= 0) {
      while (highest >= 0) {
        if (
          memory.readRamByte(0x0370 + highest) ||
          memory.readRamByte(0x0490 + highest) & 134
        ) {
          memory.writeRamByte(0x0994, highest);
          break;
        }
        highest--;
      }
    }
    const kind = memory.readRamByte(0x0370 + sprite);
    memory.writeRamByte(
      0x04d0 + sprite,
      argument === sprite ? memory.readTypeByte(0x5c96 + kind) : 0,
    );
    const offset = sprite * 2;
    writeFieldWord(
      memory,
      0x0630 + offset,
      readFieldWord(memory, 0x06f0 + offset) - readFieldWord(memory, 0x01a8),
    );
    writeFieldWord(
      memory,
      0x0670 + offset,
      readFieldWord(memory, 0x0730 + offset) + readFieldWord(memory, 0x01aa),
    );
    writeFieldWord(memory, 0x05f0 + offset, 0);
    memory.writeRamByte(
      0x0490 + sprite,
      memory.readRamByte(0x0490 + sprite) | 128,
    );
    // SXT byte is irrelevant to this bit test: slots0..31 reset the hint.
    if (!(sprite & 224)) memory.writeRamByte(0x0ffc, 255);
    return sprite;
  }
  /** C7B2-C82C: activate an initialized registry record and mark its map
   * boundary flags. The caller has completed pose and coordinate setup.
   */
  function activateActor(slot, sprite, kind, memory) {
    const flags = memory.readTypeByte(0x6438 + kind);
    if (flags & 8)
      memory.writeRamByte(
        0x04b0 + sprite,
        memory.readRamByte(0x04b0 + sprite) | 16,
      );
    registerSprite(sprite | (flags & 64 ? 128 : 0), memory);
    const address = 0x0af8 + slot * 2;
    const packed = readFieldWord(memory, address) | 32768;
    writeFieldWord(memory, address, packed);
    let entry = sprite;
    const column = packed & 496;
    const boundary = (readFieldWord(memory, 0x0228) + 32) & 65535;
    if ((column << 16) >> 16 >= (boundary << 16) >> 16) entry |= 128;
    const row = packed & 15;
    if (row < ((readFieldWord(memory, 0x0224) + 2) & 65535)) entry |= 64;
    memory.writeRamByte(0x09b8 + slot, entry);
    return { sprite, packed, entry };
  }
  /** BD78-BE0E: pending-placement viewport test. Deliberately uses the
   * static7A00 directory even for dynamic actors, matching the ROM's test.
   * Bounds are original row/column fields, not browser pixel rectangles.
   */
  function placementVisible(packed, memory) {
    const signedWord = (n) => (n << 16) >> 16;
    const location = packed & 511,
      row = location & 15,
      column = location & 496;
    const top = readFieldWord(memory, 0x0224),
      bottom = readFieldWord(memory, 0x0226);
    const left = readFieldWord(memory, 0x0228),
      right = readFieldWord(memory, 0x022a);
    if (
      row < signedWord(top) ||
      row > signedWord(bottom) ||
      column < signedWord(left) ||
      column > signedWord(right)
    )
      return false;
    const cell =
      (memory.readObjectWord(0x7a00 + location * 2) + ((packed & 32767) >> 9)) &
      65535;
    const cutY = readFieldWord(memory, 0x09a6);
    if (
      row <= signedWord(top) &&
      memory.readCoordinateWord(0x5580 + cell * 2) >= cutY
    )
      return false;
    if (
      row >= signedWord(bottom) &&
      memory.readCoordinateWord(0x5580 + cell * 2) < cutY
    )
      return false;
    const cutX = readFieldWord(memory, 0x09a4);
    if (
      column >= signedWord(right) &&
      memory.readCoordinateWord(0x4ac0 + cell * 2) >= cutX
    )
      return false;
    if (
      column <= signedWord(left) &&
      memory.readCoordinateWord(0x4ac0 + cell * 2) < cutX
    )
      return false;
    return true;
  }
  /** B56E-B5B6: clear a motion-object slot without touching its registry. */
  function retireSprite(sprite, memory) {
    memory.writeRamByte(0x0370 + sprite, 0);
    memory.writeRamByte(
      0x0490 + sprite,
      memory.readRamByte(0x0490 + sprite) & ~152,
    );
    memory.writeRamByte(
      0x04b0 + sprite,
      memory.readRamByte(0x04b0 + sprite) & ~64,
    );
    for (const address of [
      0x0430, 0x0670, 0x06b0, 0x0570, 0x04f0, 0x05b0, 0x03f0,
    ])
      writeFieldWord(memory, address + sprite * 2, 0);
    writeFieldWord(memory, 0x0630 + sprite * 2, 0x9000);
    writeFieldWord(memory, 0x05f0 + sprite * 2, 0x8200);
    memory.writeRamByte(0x0770 + sprite, 0);
  }
  /** C3E6-C4E2: return an active object to its pending registry record,
   * or remove it when route flag10 requests permanent retirement.
   */
  function retireActor(slot, memory, services) {
    const sprite = memory.readRamByte(0x09b8 + slot) & 63;
    const kind = memory.readRamByte(0x0370 + sprite);
    if (kind === 4) return { status: "retained", sprite, kind };
    const flags = memory.readTypeByte(0x649d + kind);
    if (flags & 64) memory.writeRamByte(0x0e97, memory.readRamByte(0x0e97) + 1);
    if (flags & 16) memory.writeRamByte(0x0e96, memory.readRamByte(0x0e96) + 1);
    if (memory.readRamByte(0x04b0 + sprite) & 16) {
      services.remove(slot);
      return { status: "removed", sprite, kind };
    }
    memory.writeRamByte(0x09b8 + slot, kind);
    const duration = (readFieldWord(memory, 0x0430 + sprite * 2) << 16) >> 16;
    retireSprite(sprite, memory);
    if (sprite === 5) retireSprite(6, memory);
    writeFieldWord(
      memory,
      0x0af8 + slot * 2,
      readFieldWord(memory, 0x0af8 + slot * 2) & 32767,
    );
    if (slot < 64) {
      if (!(flags & 128))
        memory.writeRamByte(
          0x0ab8 + slot,
          (duration >> 2) + memory.readRamByte(0x0e9a),
        );
      services.releaseTraffic(kind);
    }
    return { status: "pending", sprite, kind };
  }
  /** BCB8-BD76: refresh active wrap-side flags, retire off-screen actors,
   * or test pending objects in the regular and wrapped viewport windows.
   */
  function processRecord(slot, memory, services) {
    const address = 0x09b8 + slot;
    const packed = readFieldWord(memory, 0x0af8 + slot * 2);
    if (packed & 32768) {
      let entry = memory.readRamByte(address);
      const sprite = entry & 63;
      const x = readFieldWord(memory, 0x0630 + sprite * 2);
      const sx = (x << 16) >> 16;
      if (sx >= 0) {
        entry = x >= 0x4000 ? entry | 128 : entry & ~128;
        memory.writeRamByte(address, entry);
      } else if (
        (x >= 0xc000 && entry & 128) ||
        (x < 0xc000 && signedByte(entry) > 0)
      ) {
        return services.retire(slot);
      }
      const y = readFieldWord(memory, 0x0670 + sprite * 2);
      const sy = (y << 16) >> 16;
      if (sy > 0) {
        entry = y >= 0x4000 ? entry | 64 : entry & ~64;
        memory.writeRamByte(address, entry);
      } else if ((y >= 0xc000 && entry & 64) || (y < 0xc000 && !(entry & 64)))
        return services.retire(slot);
      return { status: "active", sprite };
    }
    let spawned = false;
    if (placementVisible(packed, memory)) {
      services.spawn(slot);
      spawned = true;
    }
    if ((readFieldWord(memory, 0x099a) & 32768) !== 0) {
      for (const a of [0x0224, 0x0226])
        writeFieldWord(memory, a, readFieldWord(memory, a) + 12);
      for (const a of [0x0228, 0x022a])
        writeFieldWord(memory, a, readFieldWord(memory, a) - 80);
      if (placementVisible(packed, memory)) {
        services.spawn(slot);
        spawned = true;
      }
      copyViewportBounds(memory);
    }
    return { status: spawned ? "spawn-attempted" : "outside" };
  }
  function copyViewportBounds(memory) {
    for (const [source, target] of [
      [0x099a, 0x0224],
      [0x099c, 0x0226],
      [0x0996, 0x0228],
      [0x0998, 0x022a],
    ])
      writeFieldWord(memory, target, readFieldWord(memory, source));
  }
  /** BBEC-BCB6: eight dynamic candidates and four static candidates per
   * call, sharing scan cursor09AC exactly as the original outer scheduler.
   */
  function scanRecords(dynamic, memory, services) {
    copyViewportBounds(memory);
    const visited = [];
    for (let i = 0; i < (dynamic ? 8 : 4); i++) {
      let cursor = readFieldWord(memory, 0x09ac);
      if (dynamic) {
        cursor = (cursor + 1) & 65535;
        if ((cursor << 16) >> 16 > (readFieldWord(memory, 0x09b0) << 16) >> 16)
          cursor = memory.readRamByte(0x0e98);
      }
      const slot = cursor;
      writeFieldWord(memory, 0x09aa, slot);
      writeFieldWord(memory, 0x09ac, dynamic ? cursor : cursor + 1);
      if (
        !dynamic &&
        (slot === readFieldWord(memory, 0x09a8) ||
          (slot << 16) >> 16 > (readFieldWord(memory, 0x09ae) << 16) >> 16)
      )
        continue;
      if (memory.readRamByte(0x09b8 + slot)) {
        services.process(slot);
        visited.push(slot);
      }
    }
    if (!dynamic)
      writeFieldWord(memory, 0x09ac, readFieldWord(memory, 0x09ac) & 63);
    return visited;
  }
  /** Compose the translated ordinary C4E4 spawn stages. Special type1
   * DF40 and bee E0C2 setup are supplied by their dedicated controllers.
   */
  function spawnActor(slot, memory, services) {
    writeFieldWord(memory, 0x09aa, slot);
    const admission = admit(slot, memory, services);
    if (admission.status !== "ready") return admission;
    const { kind, sprite } = admission;
    const packed = readFieldWord(memory, 0x0af8 + slot * 2);
    const placement = services.resolve(packed, slot, memory.readObjectWord);
    writeFieldWord(memory, 0x09b6, placement.bitmapIndex);
    if (placement.recordPointer !== null)
      writeFieldWord(memory, 0x09b2, placement.recordPointer);
    const actor = {
      kind,
      sprite,
      slot,
      bitmapIndex: placement.bitmapIndex,
      flags: memory.readRamByte(0x0490 + sprite),
      routeFlags: memory.readRamByte(0x04b0 + sprite),
    };
    if (kind === 1) services.initializeSpecial(actor, memory);
    else {
      let position, direction;
      if (kind === 4) {
        position = services.beePosition(sprite, memory);
        direction = 6;
      } else {
        position = services.coordinates(
          packed,
          placement.bitmapIndex,
          memory.readRamByte(0x0e9b),
          readFieldWord(memory, 0x099c),
          memory.readCoordinateOrFixedWord,
        );
        const pointer = readFieldWord(memory, 0x09b2);
        direction =
          pointer < 0x4000
            ? memory.readRamByte(pointer + 2)
            : memory.readObjectByte(pointer + 2);
      }
      initializeActor(actor, position, direction, memory);
    }
    for (const [field, base] of [
      ["x", 0x06f0],
      ["y", 0x0730],
      ["pointer", 0x03b0],
      ["extraPointer", 0x03f0],
      ["duration", 0x0430],
    ]) {
      if (actor[field] !== undefined)
        writeFieldWord(memory, base + sprite * 2, actor[field]);
    }
    for (const [field, base] of [
      ["flags", 0x0490],
      ["routeFlags", 0x04b0],
      ["paletteFlags", 0x0470],
      ["rate", 0x0770],
      ["countdown", 0x0790],
      ["direction", 0x07d0],
    ]) {
      if (actor[field] !== undefined)
        memory.writeRamByte(base + sprite, actor[field]);
    }
    const active = activateActor(slot, sprite, kind, memory);
    return { status: "active", actor, ...active };
  }
  const api = Object.freeze({
    allocateSprite,
    admit,
    tickPendingRoutes,
    initializeActor,
    registerSprite,
    activateActor,
    placementVisible,
    retireSprite,
    retireActor,
    processRecord,
    scanRecords,
    spawnActor,
  });
  if (typeof module !== "undefined") module.exports = api;
  else window.Skate720.OriginalActorSpawning = api;
})();
