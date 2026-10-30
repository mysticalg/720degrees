/** CPU-visible playfield window over the recovered full map. The caller
 * supplies the map phase established by scrolling/setup routines. */
(() => {
  function expand(pairs, size) {
    const a = new Uint16Array(size);
    let cursor = 0;
    for (let i = 0; i < pairs.length; i += 2) {
      const end = cursor + pairs[i];
      if (end > size) throw Error("Invalid original playfield run");
      a.fill(pairs[i + 1], cursor, end);
      cursor = end;
    }
    if (cursor !== size) throw Error("Incomplete original playfield");
    return a;
  }
  const wrap = (n, size) =>
    ((((n + size / 2) % size) + size) % size) - size / 2;
  function createMapWindow(
    data,
    originRow,
    originColumn,
    physicalOriginRow = 0,
    physicalOriginColumn = 0,
  ) {
    if (!Number.isInteger(originRow) || !Number.isInteger(originColumn))
      throw Error("Map phase must use tile coordinates");
    const size = data.columns * data.rows,
      raw = expand(data.raw, size),
      aliases = expand(data.aliasHigh, size);
    const center = originRow * data.columns + originColumn;
    if (center < 0 || center >= size)
      throw new RangeError("Playfield origin outside map");
    const aliasHigh = aliases[center];
    function readMapWord(bank, offset) {
      if (
        (bank !== 0 && bank !== 1) ||
        !Number.isInteger(offset) ||
        offset < 0 ||
        offset >= 8192 ||
        offset & 1
      )
        throw new RangeError("Invalid playfield address");
      const physicalRow = bank * 32 + (offset >> 8),
        physicalColumn = (offset & 255) >> 1;
      const row = originRow + wrap(physicalRow - physicalOriginRow, 64),
        column =
          originColumn + wrap(physicalColumn - physicalOriginColumn, 128);
      if (row < 0 || column < 0 || row >= data.rows || column >= data.columns)
        throw new RangeError("Probe requires a map boundary handler");
      const index = row * data.columns + column,
        value = raw[index];
      if (value & 1024 && aliases[index] !== aliasHigh)
        throw new RangeError("Probe requires an alias-bank transition");
      return value;
    }
    return { readMapWord, aliasLow: data.aliasLow, aliasHigh };
  }
  const api = Object.freeze({ createMapWindow });
  if (typeof module !== "undefined") module.exports = api;
  else window.Skate720.OriginalPlayfield = api;
})();
