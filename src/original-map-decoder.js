/** Original E908-EA5C scenery half-block decoder, expressed as native data
 * operations. Readers provide ROM bytes; no CPU or instruction loop is used.
 * Object spawning from the optional block trailer remains a separate routine.
 */
(() => {
  const word = (n) => n & 65535;
  /** Decode exactly 16 columns by 8 rows. The header's third byte points
   * from the upper header to the lower header (both streams start at +3).
   * Byte runs preserve the previous high byte, including across run changes.
   */
  function decodeHalfBlock(
    readByte,
    pointer,
    lower = false,
    substitute = (v) => v,
  ) {
    const header = [0, 1, 2].map((i) => readByte(word(pointer + i)) & 255);
    let cursor = word(pointer + (lower ? header[2] : 0) + 3);
    let value = 0,
      mode = 0,
      remaining = 0;
    const cells = new Uint16Array(128);
    const next = () => {
      const n = readByte(cursor) & 255;
      cursor = word(cursor + 1);
      return n;
    };
    for (let index = 0; index < cells.length; index++) {
      if (!remaining) {
        const control = next();
        remaining = control & 63 || 65536;
        mode = control >>> 6;
        value = (value & 0xff00) | next();
        if (mode === 2) value = (value & 255) | (next() << 8);
      } else if (mode === 0) value = (value & 0xff00) | next();
      else if (mode === 2) value = next() | (next() << 8);
      else if (mode === 3) value = word(value + 1);
      // EA30 writes the current raw word when no alias is selected. Alias
      // substitution must not alter the run accumulator used by the next cell.
      cells[index] = word(substitute(value, index));
      remaining--;
    }
    return { cells, header, terrainGroup: header[lower ? 1 : 0] & 127, cursor };
  }
  /** E9E8-EA2E: only codes 0..15 with a nonzero table entry are dynamic.
   * nextNoise supplies the original FEE2 noise-table byte for this write;
   * the caller owns the evolving 0FA0 index, rather than inventing a seed.
   */
  function substituteDynamicWord(value, table, nextNoise) {
    const code = value & 0x7ff;
    if (code > 15 || !table[code]) return word(value);
    return word((value & 0xf800) | word(table[code] + nextNoise()));
  }
  /** E846-E8EE: select directory and compressed-data banks for one request.
   * readBankWord/readBankByte use the original bank-line values, not offsets.
   * alternate is the city's object-bitfield test at E894, supplied by caller.
   */
  function decodeMapBlock(
    kind,
    readPointer,
    lower,
    alternate,
    memory,
    nextNoise,
  ) {
    const directoryBank = memory.readFixedWord(0xfeb2 + kind * 2);
    const pointer = memory.readBankWord(directoryBank, readPointer);
    let dataBank = memory.readFixedWord(0xfea2 + kind * 2);
    if (alternate) dataBank = 0x6000;
    else if (kind > 0 && kind <= 4 && pointer & 1) dataBank = 0xa000;
    const tableAddress = memory.readFixedWord(0xff54 + kind * 2);
    const table = Array.from({ length: 16 }, (_, i) =>
      memory.readFixedWord(tableAddress + i * 2),
    );
    return decodeHalfBlock(
      (address) => memory.readBankByte(dataBank, address),
      pointer,
      lower,
      (value) => substituteDynamicWord(value, table, nextNoise),
    );
  }
  /** Decode an extracted level using its original compressed block streams.
   * The stable decorative noise phase matches the existing PNG extraction;
   * it is explicitly not the original frame-dependent random seed.
   * Raw collision words retain bit4000 independently of displayed tile IDs.
   */
  function decodeLevel(name, data, decodeBase64) {
    const level = data.levels[name];
    if (!level) throw Error(`Missing compressed original layout: ${name}`);
    const columns = level.columns * 16,
      rows = level.rows * 16;
    const raw = new Uint16Array(columns * rows);
    const tiles = new Uint16Array(raw.length);
    const aliases = new Uint16Array(raw.length);
    const cache = new Map();
    for (let block = 0; block < level.blocks.length; block++) {
      const id = level.blocks[block];
      if (!cache.has(id)) {
        const bytes = decodeBase64(data.blocks[id]);
        const read = (address) => {
          if (address >= bytes.length)
            throw Error("Truncated original map stream");
          return bytes[address];
        };
        cache.set(id, [
          decodeHalfBlock(read, 0),
          decodeHalfBlock(read, 0, true),
        ]);
      }
      const halves = cache.get(id);
      for (let half = 0; half < 2; half++) {
        const decoded = halves[half];
        const high =
          level.kind === 0
            ? (decoded.terrainGroup >> 3) * 1024
            : level.aliasHigh;
        for (let n = 0; n < 128; n++) {
          const y =
            Math.floor(block / level.columns) * 16 + half * 8 + (n >> 4);
          const x = (block % level.columns) * 16 + (n & 15);
          const index = y * columns + x;
          const value = substituteDynamicWord(
            decoded.cells[n],
            data.dynamic[level.kind],
            () => (x * 3 + y * 5 + (x ^ y)) & 7,
          );
          raw[index] = value;
          aliases[index] = high;
          tiles[index] =
            (value & 1023) + (value & 1024 ? high : level.aliasLow);
        }
      }
    }
    return { raw, tiles, aliases, aliasLow: level.aliasLow, columns, rows };
  }
  /** EC20/ED70-EDA6: write selected original city overlay templates.
   * Zero words leave the existing cell and column pointer unchanged.
   * Existing palette/solid bits F800 survive, while incoming codes >=0800
   * are redirected through the high scenery alias exactly as ED74-ED8E.
   * Variant selection is separate: callers must supply recovered park/gear
   * state; null skips an overlay rather than fabricating an unlocked state.
   */
  function applyCityOverlays(map, overlays, selectVariant) {
    const changes = [];
    for (const overlay of overlays) {
      const variant = selectVariant(overlay);
      if (variant === null) continue;
      const cells = overlay.variants[variant];
      if (!cells) throw Error("Invalid original overlay variant");
      for (let row = 0; row < overlay.height; row++) {
        let column = overlay.x;
        for (let col = 0; col < overlay.width; col++) {
          let value = cells[row * overlay.width + col] & 65535;
          if (!value) continue;
          const y = overlay.y + row;
          if (column < 0 || column >= map.columns || y < 0 || y >= map.rows)
            throw Error("Original city overlay outside map");
          const index = y * map.columns + column;
          if ((value << 16) >> 16 >= 0x800) value = (value & 0x3ff) + 0x400;
          value |= map.raw[index] & 0xf800;
          map.raw[index] = value;
          map.tiles[index] =
            (value & 1023) + (value & 1024 ? map.aliases[index] : map.aliasLow);
          changes.push({
            index,
            rawWord: value,
            tile: map.tiles[index],
            id: overlay.id,
          });
          column++;
        }
      }
    }
    return changes;
  }
  const api = Object.freeze({
    applyCityOverlays,
    decodeLevel,
    decodeHalfBlock,
    substituteDynamicWord,
    decodeMapBlock,
  });
  if (typeof module !== "undefined") module.exports = api;
  else window.Skate720.OriginalMapDecoder = api;
})();
