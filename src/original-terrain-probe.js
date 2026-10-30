/** Fixed ROM9C5E-9DDE terrain probe. Original word coordinates, not PNG
 * pixels. Readers supply the decoded playfield RAM and original ROM tables.
 * No instruction execution or CPU state is used.
 */
(() => {
  const word = (x) => x & 65535,
    signed = (x) => (x << 16) >> 16,
    byteSigned = (x) => (x << 24) >> 24;
  function probeTerrain(state, memory) {
    let x = word(state.x),
      bank = word(state.bank),
      height = word(state.groundHeight);
    const limit = word(state.limit),
      step = word(state.step),
      heightStep = word(-signed(step) * 2);
    const attempts = (state.kind & 255) === 0 ? 10 : 30;
    let profile = 0;
    const finish = () => ({
      profile: word(profile),
      height: word(height),
      x,
      bank,
    });
    for (let attempt = 0; attempt < attempts; attempt++) {
      if (signed(height) >= signed(limit)) {
        profile = 0x8000;
        return finish();
      }
      x = word(x + step);
      height = word(height + heightStep);
      if (x & 0x2000) {
        x &= 0x1f00;
        bank = word(bank + 0x2000);
      }
      const mapOffset = ((x & 0x1f00) + ((state.y >>> 8) & 255)) & 0x1ffe;
      const tile = memory.readMapWord(bank & 0x2000 ? 1 : 0, mapOffset) & 65535;
      profile = tile;
      const alias = word(
        (tile & 1023) + (tile & 0x400 ? state.aliasHigh : state.aliasLow),
      );
      const fromProfile = () => byteSigned(memory.readProfileByte(alias));
      const setHeight = () => {
        if (!(profile & 7) && signed(profile) >> 3 !== 15)
          height = word(
            memory.readHeightWord(word(0xfcb0 + (signed(profile) >> 3) * 2)),
          );
        else height = word(height + (state.groundHeight & 511));
      };
      if (limit === 0x7ffe) {
        if (!(tile & 0x4000)) continue;
        profile = fromProfile();
        if (!(profile & 7) && signed(profile) >> 3 !== 15)
          height = word(
            memory.readHeightWord(word(0xfcb0 + (signed(profile) >> 3) * 2)),
          );
        else {
          profile &= 63;
          height = word(height + (state.groundHeight & 511));
        }
        height &= 0xfffe;
        return finish();
      }
      profile = alias;
      const flags =
        limit === 0x7fff || byteSigned(state.mode) > 1
          ? byteSigned(memory.readFlagByte(alias))
          : 0;
      if (limit === 0x7fff) {
        if (flags >= 0) continue;
        profile = flags & 127;
        return finish();
      }
      profile =
        byteSigned(state.mode) > 1 && flags < 0 ? flags & 127 : fromProfile();
      if (profile & 7) profile &= 63;
      if ((profile & 7) === 7 && profile !== 63) continue;
      setHeight();
      height &= 0xfffe;
      return finish();
    }
    height = 0x7fff;
    return finish();
  }
  /** 9364-944A: three original contact points from actor0 and the
   * high bytes of its terrain coefficients. Returned slots0/1/2 correspond
   * to0302/0304/0306; x/y/bank map to0308/030E/0314 arrays.
   * The banked playfield reader is the same interface used by9C5E.
   */
  function contactPoints(
    actorX,
    actorY,
    groundHeight,
    coefficientX,
    coefficientY,
    coefficientZ,
    memory,
  ) {
    let y = word(actorX + 0x0a00);
    let x = word(actorY + groundHeight + 0x0300);
    const strideY = word(byteSigned(word(coefficientX) >>> 8) * 8);
    const strideX = word(
      (byteSigned(word(coefficientY) >>> 8) +
        byteSigned(word(coefficientZ) >>> 8)) *
        8,
    );
    y = word(y + strideY);
    x = word(x + strideX);
    const points = new Array(3);
    let flags = 0,
      lastSolid = null;
    for (let slot = 2; slot >= 0; slot--) {
      const alignedY = y & 0xfe00;
      const bank = word(0x3f00 - ((signed(x) >> 1) & 0x3f00));
      const packedX = bank & 0x1f00;
      const offset = word(packedX + (alignedY >>> 8));
      const tile = memory.readMapWord(bank & 0x2000 ? 1 : 0, offset) & 65535;
      if (tile & 0x4000) lastSolid = { x, y: alignedY, bank };
      flags |= (tile >>> 8) & 255;
      points[slot] = { x: packedX, y: alignedY, bank, tile };
      y = word(y - strideY);
      x = word(x - strideX);
    }
    return {
      points,
      flags: flags & 0xc0,
      lastSolid,
      center: { ...points[1] },
      strideX,
      strideY,
    };
  }
  /** Composition9834-98B8: select a saved contact slot before probing.
   * The caller still chooses limit, step and ground height for its action.
   */
  function probeContact(contacts, slot, state, memory) {
    if (slot < 0 || slot > 2 || !Number.isInteger(slot))
      throw new RangeError("Original contact slot must be0..2");
    return probeTerrain({ ...state, ...contacts.points[slot] }, memory);
  }
  /** 944C-94DA: resolve raw contact tiles through the two graphics-bank
   * aliases, then replace their words with signed terrain profiles. Mode2
   * substitutes negative flag bytes (masked to7 bits). Raw tile and alias
   * values are retained separately so callers cannot confuse the stages.
   */
  function decodeContactProfiles(contacts, aliasLow, aliasHigh, mode, memory) {
    const points = contacts.points.map((point) => {
      const tile = point.tile & 65535;
      const alias = word((tile & 1023) + (tile & 1024 ? aliasHigh : aliasLow));
      const flags = memory.readFlagByte(alias) & 255;
      const profile =
        (mode & 255) === 2 && flags & 128
          ? flags & 127
          : word(byteSigned(memory.readProfileByte(alias)));
      return { ...point, alias, profile, flags };
    });
    return {
      ...contacts,
      points,
      center: { ...points[1] },
      field032a: points[1].flags,
      field032b: points[1].flags,
    };
  }
  const api = Object.freeze({
    probeTerrain,
    contactPoints,
    probeContact,
    decodeContactProfiles,
  });
  if (typeof module !== "undefined") module.exports = api;
  else window.Skate720.OriginalTerrainProbe = api;
})();
