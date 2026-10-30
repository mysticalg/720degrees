/** Original city population request selection, D2D6-D30C/D348-D47A.
 * Candidate positions, actor kinds and counts are read from original tables.
 * enqueue supplies CE24 allocation/occupancy; this module never invents paths.
 */
(() => {
  const word = (n) => n & 65535,
    signed = (n) => (n << 16) >> 16;
  function resetRequests(state, difficulty, memory) {
    state.counts ||= new Uint8Array(21);
    for (let group = 20; group > 0; group--) state.counts[group] = 0;
    state.total = 0;
    const table = memory.readTypeWord(0x68d0 + (difficulty & 255) * 2);
    for (let group = 9; group > 0; group--) {
      const count = memory.readTypeByte(word(table + group - 1)) & 255;
      state.counts[group] = count;
      state.total = (state.total + count) & 255;
    }
    state.difficulty = difficulty & 255;
    state.previousDifficulty = difficulty & 255;
    return state;
  }
  function request(state, group) {
    group = word(group);
    if (!group) return;
    if (group >= state.counts.length)
      throw new RangeError("Population group outside original request array");
    state.counts[group] = (state.counts[group] + 1) & 255;
    state.total = (state.total + 1) & 255;
  }
  /** 9152-917A consumes the original32-byte entropy buffer. Hardware/input
   * code refreshes that buffer separately; this reader does not choose a seed.
   */
  function nextBufferedRandom(state) {
    state.index = ((state.index || 0) + 1) & 31;
    return state.bytes[state.index] & 255;
  }
  function spawnOne(state, context, memory, nextRandom, enqueue) {
    const attempts = [];
    if (!(state.total & 255)) return { spawned: false, attempts };
    for (let group = 19; group > 0; group--) {
      if (!state.counts[group]) continue;
      state.randomByte = ((state.randomByte || 0) + (nextRandom() & 255)) & 255;
      const index =
        state.randomByte & (memory.readFixedByte(0xfd95 + group) & 255);
      const table = memory.readTypeWord(0x6948 + group * 2);
      const packed = word(memory.readTypeWord(word(table + index * 2)));
      let excluded;
      if (group <= 3) excluded = ((index >> 4) & 3) === word(context.phase - 1);
      else {
        const row = packed & 15,
          column = packed & 0x1f0,
          b = context.bounds;
        excluded =
          row >= signed(word(b.top)) &&
          row <= signed(word(b.bottom)) &&
          column >= signed(word(b.left)) &&
          column < signed(word(b.right));
      }
      if (excluded) {
        attempts.push({ group, index, packed, excluded: true });
        continue;
      }
      const dynamic = group <= 10;
      const kind =
        memory.readTypeByte(
          dynamic
            ? word(
                memory.readTypeWord(0x6862 + (state.difficulty & 255) * 2) +
                  group -
                  1,
              )
            : 0x6935 + group,
        ) & 255;
      const candidate = { group, index, packed, kind, dynamic };
      const status = enqueue(candidate);
      attempts.push({ ...candidate, status });
      if (word(status) === 0) {
        state.counts[group] = (state.counts[group] - 1) & 255;
        state.total = (state.total - 1) & 255;
        return { spawned: true, candidate, attempts };
      }
    }
    return { spawned: false, attempts };
  }
  const api = Object.freeze({
    resetRequests,
    request,
    nextBufferedRandom,
    spawnOne,
  });
  if (typeof module !== "undefined") module.exports = api;
  else window.Skate720.OriginalPopulation = api;
})();
