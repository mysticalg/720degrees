/** Original map initialization/strip-request state from bank1A000.
 * These functions manage words and bytes only. The E82E block decoder
 * consumes their requests separately; they do not execute ROM instructions.
 */
(() => {
  const word = (x) => x & 65535,
    signed = (x) => (x << 16) >> 16,
    sbyte = (x) => (x << 24) >> 24;
  /** 400C-406A/40EC-4168 after directory/variant selection. */
  function beginMapState(column, row, kind, directory, width) {
    const adjusted = word(row - 4);
    width &= 255;
    const cameraX = word(((column & 7) << 13) + 0x2000);
    const cameraY = word(((adjusted & 7) << 13) + 0x1000);
    const left = word((signed(word(column - 1)) >> 1) * 16),
      top = word(signed(adjusted) >> 1);
    return {
      kind: kind & 255,
      width,
      rowPhase: adjusted & 255,
      cameraX,
      cameraY,
      edgeX: cameraX & 0xe000,
      edgeY: cameraY & 0xf000,
      mapPointer: word(directory + signed(adjusted) * width + word(column * 2)),
      mapY: word(((adjusted & 255) << 12) - 0x800),
      mapX: (column * 32) & 255,
      bounds: { left, right: word(left + 64), top, bottom: word(top + 3) },
      rowLimit: kind === 0 ? 12 : 0x0fff,
    };
  }
  /** 42BC-438A: prepare six blocks in a newly exposed horizontal strip.
   * Positive delta scans toward smaller mapY; zero follows the negative path.
   */
  function verticalStrip(state, delta) {
    if (signed(delta) > 0) {
      state.mapY = word(state.mapY - 0x800);
      let distance;
      if (state.mapY & 0x800) {
        state.mapPointer = word(state.mapPointer - state.width);
        const previousRow = sbyte(state.rowPhase) - 1;
        state.rowPhase = previousRow & 255;
        if (previousRow < 0) {
          state.rowPhase = 23;
          state.mapPointer = word(0x0a6c + state.mapPointer - 0x180);
        }
        distance = state.width * 3;
      } else distance = state.width * 4;
      state.readPointer = word(state.mapPointer - distance);
      state.writePointer = word(state.mapY - 0x3800);
    } else {
      state.mapY = word(state.mapY + 0x800);
      if (!(state.mapY & 0x800)) {
        state.mapPointer = word(state.mapPointer + state.width);
        state.rowPhase = (state.rowPhase + 1) & 255;
        if (sbyte(state.rowPhase) === word(state.rowLimit * 2)) {
          state.rowPhase = 0;
          state.mapPointer = word(state.mapPointer - 0x0a80 + 0x194);
        }
      }
      state.writePointer = state.mapY;
      state.readPointer = state.mapPointer;
    }
    state.writeX = state.mapX & 255;
    state.columnStep = 32;
    state.rowStep = 0;
    state.blockCount = 6;
    return state;
  }
  /** 438C-43F6: prepare eight blocks in a newly exposed vertical strip. */
  function horizontalStrip(state, delta) {
    if (signed(delta) > 0) {
      state.mapX = (state.mapX + 32) & 255;
      state.mapPointer = word(state.mapPointer + 2);
      state.writeX = (state.mapX + 160) & 255;
      state.readPointer = word(state.mapPointer + 10);
    } else {
      state.mapX = (state.mapX - 32) & 255;
      state.mapPointer = word(state.mapPointer - 2);
      state.writeX = state.mapX;
      state.readPointer = state.mapPointer;
    }
    state.writePointer = state.mapY;
    state.blockCount = 8;
    state.columnStep = 0;
    state.rowStep = 0xf800;
    return state;
  }
  /** 41CE-4252: consume a strip in original order. decodeBlock returns the
   * selected 16x8 half-block's words; writeWord receives bank/byte address.
   * Keeping decoding separate preserves the ROM's alias and object variants.
   */
  function consumeStrip(state, decodeBlock, writeWord) {
    let blocks = 0;
    while (state.blockCount) {
      state.blockCount = (state.blockCount - 1) & 255;
      state.writePointer &= 0x3ffe;
      const cells = decodeBlock(
        state.readPointer,
        !!(state.writePointer & 0x800),
      );
      if (cells.length !== 128)
        throw Error("Original half-block must have 128 words");
      const bank = (state.writePointer >> 13) & 1;
      // E908/EA34-EA56: columns wrap in the low byte only; rows advance
      // independently. A half-block never crosses the bank's row boundary.
      for (let y = 0; y < 8; y++)
        for (let x = 0; x < 16; x++) {
          const offset =
            (((state.writePointer & 0x1f00) + y * 256) & 0x1f00) |
            ((state.writeX + x * 2) & 255);
          writeWord(bank, offset, cells[y * 16 + x]);
        }
      state.writePointer = word(state.writePointer + state.rowStep);
      if (state.writePointer & state.rowStep & 0x800) {
        state.readPointer = word(state.readPointer - state.width);
        if (state.objectPointer !== undefined)
          state.objectPointer = word(state.objectPointer - 6);
      }
      state.writeX = (state.writeX + sbyte(state.columnStep)) & 255;
      if (state.columnStep & 255) {
        state.readPointer = word(state.readPointer + 2);
        if (state.objectMask) {
          state.objectMask = (state.objectMask << 1) & 255;
          if (!state.objectMask) {
            state.objectMask = 1;
            state.objectPointer = word(state.objectPointer + 1);
          }
        }
      }
      blocks++;
    }
    state.completedStrips = ((state.completedStrips || 0) + 1) & 255;
    return blocks;
  }
  const api = Object.freeze({
    beginMapState,
    verticalStrip,
    horizontalStrip,
    consumeStrip,
  });
  if (typeof module !== "undefined") module.exports = api;
  else window.Skate720.OriginalMapState = api;
})();
