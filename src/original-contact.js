/** Original actor-contact broad phase, bank3800:5684-5728.
 * Shapes retain signed fixed-point offsets and unsigned extents from ROM.
 * A candidate must pass572A's separate scanline-mask test before it hits.
 */
(() => {
  const word = (n) => n & 65535,
    signed = (n) => (n << 16) >> 16;
  function readShape(pointer, readWord) {
    return {
      pointer,
      x: signed(readWord(pointer)),
      y: signed(readWord(pointer + 2)),
      width: word(readWord(pointer + 4)),
      height: word(readWord(pointer + 6)),
    };
  }
  /** 56AA-56EE: strict rectangle overlap, preserving wrapping subtract/NEG.
   * dy is the original actor-top minus player-top argument passed to572A.
   */
  function broadPhase(actor, player) {
    const dx = signed(
      word(actor.x + actor.shape.x - player.x - player.shape.x),
    );
    if (
      dx >= 0 ? word(dx) >= player.shape.width : word(-dx) >= actor.shape.width
    )
      return { overlap: false, dx, dy: null };
    const dy = signed(
      word(actor.y + actor.shape.y - player.y - player.shape.y),
    );
    if (
      dy >= 0
        ? word(dy) >= player.shape.height
        : word(-dy) >= actor.shape.height
    )
      return { overlap: false, dx, dy };
    return { overlap: true, dx, dy };
  }
  /** Highest slot down to5, matching original first-hit priority. Screen Y
   * for the player comes from0238, whose caller can subtract ground height.
   * narrowPhase owns572A; this routine never treats a rectangle as a hit.
   */
  function findContact(memory, narrowPhase) {
    const rw = (a) => memory.readRamByte(a) | (memory.readRamByte(a + 1) << 8);
    const playerPointer = rw(0x023a);
    const player = {
      x: rw(0x0630),
      y: rw(0x0238),
      shape: readShape(playerPointer, memory.readContactWord),
    };
    let highest = (memory.readRamByte(0x0994) << 24) >> 24;
    for (let sprite = highest; sprite >= 5; sprite--) {
      const pointer = rw(0x03f0 + sprite * 2);
      if (!pointer) continue;
      const actor = {
        x: rw(0x0630 + sprite * 2),
        y: rw(0x0670 + sprite * 2),
        shape: readShape(pointer, memory.readContactWord),
      };
      const candidate = broadPhase(actor, player);
      if (
        candidate.overlap &&
        narrowPhase({ sprite, dy: candidate.dy, actor, player })
      )
        return sprite;
    }
    return 0;
  }
  /** 572A-58C8 narrow path for two shapes at most16 mask bits wide.
   * Rows and horizontal offsets use original256-unit mask cells (4 pixels).
   * Wider vehicles use the separate58CC-5A44 path, not a rectangle fallback.
   */
  function smallMaskContact(actor, player, readWord) {
    const candidate = broadPhase(actor, player);
    if (!candidate.overlap) return false;
    if (actor.shape.width >>> 8 > 16 || player.shape.width >>> 8 > 16)
      return null;
    const actorTop = word(actor.y + actor.shape.y),
      playerTop = word(player.y + player.shape.y);
    const actorBottom = word(actorTop + actor.shape.height),
      playerBottom = word(playerTop + player.shape.height);
    const bottom =
      signed(playerBottom) >= signed(actorBottom) ? actorBottom : playerBottom;
    const offset = signed(word(playerTop - actorTop));
    let p3, p2, delta, top;
    if (offset >= 0) {
      p3 = word(player.shape.pointer - 2);
      p2 = word(actor.shape.pointer - ((word(offset + 256) >>> 8) & 255) * 2);
      delta = candidate.dx;
      top = playerTop;
    } else {
      p3 = word(actor.shape.pointer - 2);
      p2 = word(player.shape.pointer - ((word(256 - offset) >>> 8) & 255) * 2);
      delta = signed(word(-candidate.dx));
      top = actorTop;
    }
    const rows = (word(bottom - top + 192) >>> 8) & 255;
    const shift = (Math.abs(delta) >>> 8) & 255;
    if (shift >= 16) return false;
    for (let row = 0; row < rows; row++) {
      const mask3 = readWord(p3),
        mask2 = readWord(p2);
      if (
        delta < 0 ? word(mask2 << shift) & mask3 : word(mask3 << shift) & mask2
      )
        return true;
      p3 = word(p3 - 2);
      p2 = word(p2 - 2);
    }
    return false;
  }
  /** Original7DB8 word shifter. Negative counts round right shifts using
   * the discarded carry (ROR/ADC); positive counts shift left. The original
   * jump table accepts-16..15 and returns zero outside that range.
   */
  function shiftMask(value, count) {
    value = word(value);
    if (count < -16 || count > 15) return 0;
    if (count >= 0) return word(value << count);
    const right = -count;
    return word(Math.floor((value + 2 ** (right - 1)) / 2 ** right));
  }
  /** 58CC-5A44: two/three-strip vehicle masks. Strip anchors follow the
   * original width-16/width-32 offsets, not padded16-bit rectangles.
   * The player mask is the original narrow footprint used by this caller.
   */
  function wideMaskContact(actor, player, readWord) {
    const candidate = broadPhase(actor, player);
    if (!candidate.overlap) return false;
    const width = actor.shape.width >>> 8;
    if (width <= 16) return smallMaskContact(actor, player, readWord);
    if (width > 48 || player.shape.width >>> 8 > 16) return null;
    const actorTop = word(actor.y + actor.shape.y),
      playerTop = word(player.y + player.shape.y);
    const actorBottom = word(actorTop + actor.shape.height),
      playerBottom = word(playerTop + player.shape.height);
    const bottom =
      signed(playerBottom) >= signed(actorBottom) ? actorBottom : playerBottom;
    const offset = signed(word(playerTop - actorTop));
    let p3, p2, delta, top, playerAbove;
    if (offset >= 0) {
      p3 = word(player.shape.pointer - 2);
      p2 = word(actor.shape.pointer - ((word(offset + 256) >>> 8) & 255) * 2);
      delta = candidate.dx;
      top = playerTop;
      playerAbove = false;
    } else {
      p3 = word(actor.shape.pointer - 2);
      p2 = word(player.shape.pointer - ((word(256 - offset) >>> 8) & 255) * 2);
      delta = signed(word(-candidate.dx));
      top = actorTop;
      playerAbove = true;
    }
    const rows = signed(word(bottom - top + 192)) >> 8;
    if (rows <= 0) return false;
    const stride = (actor.shape.height >>> 8) * 2;
    // SWAB's N flag is byte-sized; COMB of the upper byte sign-extends it.
    const base = delta >> 8;
    const extra = playerAbove ? base - (width - 16) : base + (width - 16);
    const middle = width > 32 ? extra + (playerAbove ? 16 : -16) : extra;
    const passes = [];
    if (Math.abs(base) < 16) passes.push([width > 32 ? 2 : 1, base]);
    if (Math.abs(middle) < 16) passes.push([width > 32 ? 1 : 0, middle]);
    if (width > 32 && extra > -16) passes.push([0, extra]);
    for (const [column, shift] of passes) {
      let left = p3,
        right = p2;
      for (let row = 0; row < rows; row++) {
        const mask = playerAbove
          ? readWord(word(left - column * stride))
          : readWord(left);
        const other = playerAbove
          ? readWord(right)
          : readWord(word(right - column * stride));
        if (shiftMask(mask, shift) & other) return true;
        left = word(left - 2);
        right = word(right - 2);
      }
    }
    return false;
  }
  function maskContact(actor, player, readWord) {
    return actor.shape.width >>> 8 <= 16
      ? smallMaskContact(actor, player, readWord)
      : wideMaskContact(actor, player, readWord);
  }
  /** A57C-A5AE: grounded contact bypasses the airborne height gate, then
   * original61DA selects the response. Code0 is explicitly no action.
   */
  function responseCode(kind, grounded, relativeHeight, readByte) {
    const limit = (readByte(0x6631 + kind) & 255) << 8;
    if (!grounded && signed(word(relativeHeight)) > signed(word(limit)))
      return null;
    return readByte(0x61da + kind) & 255;
  }
  /** Original pedestrian response gate; low-height contact is wired live.
   * A60C-A64A: response6 excludes the attached actor, then compares
   * the signed relative height against0380 (14 browser pixels). The upper
   * branch has separate reward state and must not be treated as a bail.
   */
  function pedestrianKnockdown(relativeHeight, sprite, attachedSprite = 0) {
    return sprite !== attachedSprite && signed(word(relativeHeight)) < 0x0380;
  }
  /** A70C-A732 / FD10: response8 awards cash, then CF5E removes the
   * contacted rider. No player bail or invented score award is involved.
   */
  function riderCash(kind) {
    return kind >= 56 && kind <= 65
      ? [1, 1, 10, 20, 5, 5, 10, 20, 10, 10][kind - 56]
      : 0;
  }
  /** D1B8-D1C4 and A64C-A67E: diminishing jump-over pedestrian reward.
   * FCFA supplies the score words. Repeat kinds reduce the NEXT award.
   */
  function airbornePedestrianReward(state, kind) {
    const index = state.index & 255;
    if (!index) return { points: 0, index: -1 };
    const points = [50, 100, 200, 300, 400, 500][index];
    if (state.kind === (kind & 255)) state.index = (index - 1) & 255;
    state.kind = kind & 255;
    return { points, index };
  }
  /** 4F24-4F3A followed by D498-D4BE: stop the struck actor and select
   * its original6046 hit directory. Preserve unrelated flag bits.
   */
  function knockDownActor(actor, readWord) {
    actor.duration = actor.extraPointer = actor.dx = actor.dy = 0;
    actor.routeFlags = ((actor.routeFlags || 0) | 0x40) & 255;
    actor.rate = actor.countdown = 8;
    actor.pointer = readWord(0x6046 + actor.kind * 2) & 65535;
    actor.flags = ((actor.flags || 0) | 0x18) & 255;
    actor.phase = 0;
    return actor;
  }
  /** Bank1E000:4ECC-4F40. One global saved actor, not a per-NPC timer.
   * Preserve exactly the six original motion fields before stopping it.
   * Sprite6 instead stops companion sprite5 without replacing the snapshot.
   */
  function saveActorMotion(actor, state, companion) {
    if (actor.sprite === 6) {
      if (companion) {
        companion.pointer = 0x50fa;
        companion.flags = ((companion.flags || 0) | 0x18) & 255;
        companion.dx = companion.dy = companion.duration = 0;
      }
    } else {
      state.sprite = actor.sprite & 255;
      state.timer = 0xb4;
      state.saved = {};
      for (const key of [
        "duration",
        "rate",
        "dx",
        "dy",
        "pointer",
        "extraPointer",
      ])
        state.saved[key] = actor[key] || 0;
    }
    actor.duration = actor.extraPointer = actor.dx = actor.dy = 0;
    actor.routeFlags = ((actor.routeFlags || 0) | 0x40) & 255;
    return state;
  }
  /** CB26-CB4A and bank1E000:4F42-4F96. Restore only the remembered
   * sprite when flag40 still marks it as stopped. Countdown is not saved.
   */
  function tickActorRecovery(state, findActor) {
    if (!(state.timer & 255)) return null;
    state.timer = (state.timer - 1) & 255;
    if (state.timer) return null;
    const actor = findActor(state.sprite);
    if (!actor || !(actor.routeFlags & 0x40)) return null;
    for (const key of [
      "duration",
      "rate",
      "dx",
      "dy",
      "pointer",
      "extraPointer",
    ])
      actor[key] = state.saved[key];
    actor.flags = ((actor.flags || 0) | 0x18) & 255;
    actor.routeFlags &= ~0x40 & 255;
    actor.phase = 0; // Browser directory bookkeeping, not an extra ROM clock.
    state.sprite = 255;
    return actor;
  }
  /** AD94-ADFE for player slot0 versus an ordinary actor. Shape words8,
   * 10 and12 determine the original left/right knockdown-side decision.
   * The attached-actor special case is supplied explicitly by the caller.
   */
  function impactSide(player, actor, readWord, attachedSprite = 0) {
    if (actor.sprite === attachedSprite) return 0;
    const pp = player.shape.pointer,
      ap = actor.shape.pointer;
    if (!pp) return 1;
    if (!ap) return 0;
    const dx = signed(
      word(player.x + readWord(pp + 8) - actor.x - readWord(ap + 8)),
    );
    const dy =
      dx < 0
        ? word(player.y + readWord(pp + 12) - actor.y - readWord(ap + 10))
        : word(player.y + readWord(pp + 10) - actor.y - readWord(ap + 12));
    return signed(dy) >= 0 ? 1 : 0;
  }
  function playerDirection(player, tables) {
    const facing = player.romFacingDirection ?? player.romDirection;
    if (!player.air && facing !== undefined) return facing & 15;
    if (!tables || player.angle === undefined) return (facing ?? 0) & 15;
    let best = Infinity,
      direction = 0;
    for (let d = 0; d < 16; d++) {
      const angle = Math.atan2(-tables.y[d], tables.x[d]);
      const delta = Math.abs(
        Math.atan2(
          Math.sin(player.angle - angle),
          Math.cos(player.angle - angle),
        ),
      );
      if (delta < best) {
        best = delta;
        direction = d;
      }
    }
    return direction;
  }
  /** E3F6-E402:01F8&7 indexes the eight original footprint pointers70F0.
   * Opposite facings share one board axis.7114 is only the horizontal entry.
   */
  function playerShapePointer(direction, readWord) {
    return word(readWord(0x70f0 + (direction & 7) * 2));
  }
  /** Browser sprite anchors -> original fixed-point contact coordinates.
   * Same -40X/+11Y anchor used by Renderer.descriptorSkater. A528's special
   * post-impact7106 override is separate from this ordinary direction path.
   */
  function playerContact(player, readWord, tables) {
    return {
      x: word(Math.round((player.x - 40) * 64)),
      y: word(Math.round(-(player.y + 11 - (player.z || 0)) * 64)),
      shape: readShape(
        playerShapePointer(playerDirection(player, tables), readWord),
        readWord,
      ),
    };
  }
  function actorContact(actor, pointer, readWord) {
    return {
      x: word(Math.round(actor.actorX * 64)),
      y: word(Math.round((-actor.actorY + (actor.height || 0) / 64) * 64)),
      shape: readShape(pointer, readWord),
    };
  }
  /** Diagnostic cells from the same backwards scanline strips used by
   * contact tests. Coordinates are four-pixel cells in original +Y space.
   */
  function maskCells(shape, readWord) {
    const width = shape.width >>> 8,
      rows = shape.height >>> 8;
    if (!width || width > 48 || !rows || rows > 64) return [];
    const anchors =
      width <= 16
        ? [0]
        : width <= 32
          ? [width - 16, 0]
          : [width - 16, width - 32, 0];
    const result = [],
      seen = new Set();
    for (let strip = 0; strip < anchors.length; strip++)
      for (let row = 0; row < rows; row++) {
        const mask = readWord(
          word(shape.pointer - 2 - (strip * rows + row) * 2),
        );
        for (let bit = 0; bit < 16; bit++)
          if (mask & (1 << (15 - bit))) {
            const col = anchors[strip] + bit,
              key = row * 64 + col;
            if (col < width && !seen.has(key)) {
              seen.add(key);
              result.push({ x: col * 4, y: row * 4 });
            }
          }
      }
    return result;
  }
  /** D838-D87E: attached movement must face within two of sixteen headings.
   * Rear bumper geometry below is a native adapter over original occupied
   * mask cells; it is not the unfinished D4E4 moving-platform height map.
   */
  function towHeadingAllowed(facing, direction) {
    const delta = ((facing - direction + 24) & 15) - 8;
    return Math.abs(delta) <= 2;
  }
  function vehicleRear(actor, readWord) {
    if (actor.kind < 10 || actor.kind > 16 || !actor.extraPointer) return null;
    const dx = signed(actor.dx || 0),
      dy = -signed(actor.dy || 0),
      length = Math.hypot(dx, dy * 2);
    if (!length) return null;
    const ux = dx / length,
      uy = (dy * 2) / length,
      shape = readShape(actor.extraPointer, readWord),
      cells = maskCells(shape, readWord);
    if (!cells.length) return null;
    let rear = Infinity;
    const points = cells.map((c) => {
      const x = shape.x / 64 + c.x + 2,
        y = -shape.y / 64 - c.y - 2;
      const along = x * ux + y * 2 * uy;
      rear = Math.min(rear, along);
      return { x, y, along };
    });
    const edge = points.filter((c) => c.along <= rear + 6);
    return {
      x:
        actor.actorX +
        edge.reduce((n, c) => n + c.x, 0) / edge.length -
        ux * 14,
      y:
        actor.actorY + edge.reduce((n, c) => n + c.y, 0) / edge.length - uy * 7,
      ux,
      uy,
      direction: actor.direction & 15,
    };
  }
  const api = Object.freeze({
    towHeadingAllowed,
    vehicleRear,
    maskCells,
    readShape,
    broadPhase,
    findContact,
    smallMaskContact,
    shiftMask,
    wideMaskContact,
    maskContact,
    responseCode,
    pedestrianKnockdown,
    riderCash,
    airbornePedestrianReward,
    knockDownActor,
    saveActorMotion,
    tickActorRecovery,
    impactSide,
    playerContact,
    playerDirection,
    playerShapePointer,
    actorContact,
  });
  if (typeof module !== "undefined") module.exports = api;
  else window.Skate720.OriginalContact = api;
})();
