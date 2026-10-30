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
  /** Browser sprite anchors -> original fixed-point contact coordinates.
   * Same -40X/+11Y anchor used by Renderer.descriptorSkater. Normal stance
   * header7114 is recovered; full pose-dependent header selection is pending.
   */
  function playerContact(player, readWord) {
    return {
      x: word(Math.round((player.x - 40) * 64)),
      y: word(Math.round(-(player.y + 11 - (player.z || 0)) * 64)),
      shape: readShape(0x7114, readWord),
    };
  }
  function actorContact(actor, pointer, readWord) {
    return {
      x: word(Math.round(actor.actorX * 64)),
      y: word(Math.round((-actor.actorY + (actor.height || 0) / 64) * 64)),
      shape: readShape(pointer, readWord),
    };
  }
  const api = Object.freeze({
    readShape,
    broadPhase,
    findContact,
    smallMaskContact,
    playerContact,
    actorContact,
  });
  if (typeof module !== "undefined") module.exports = api;
  else window.Skate720.OriginalContact = api;
})();
