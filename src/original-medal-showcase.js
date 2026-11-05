/** Original6FDA-7110 reveal, weighted medal score and waits.
 * Caller supplies its saved R1 comparison word (stage at the normal return).
 * This is a scene state machine over packed results, not a ROM interpreter.
 */
(() => {
  function begin(records, comparisonWord = records.length) {
    return {
      records: records.slice(0, 16).map((v) => v & 255),
      comparisonWord: comparisonWord & 65535,
      revealed: 0,
      weighted: 0,
      delay: 0,
      frame: 0,
      phase: "reveal",
      done: false,
    };
  }
  function tick(state) {
    if (state.done) return null;
    state.frame++;
    if (state.delay > 0 && --state.delay > 0) return null;
    if (state.phase === "tail") {
      state.done = true;
      return null;
    }
    if (state.revealed === state.records.length) {
      state.phase = "tail";
      state.delay = 120 + state.records.length * 10;
      return null;
    }
    const index = state.revealed++,
      packed = state.records[index],
      rank = packed >>> 6,
      park = (packed >>> 4) & 3,
      cls = packed & 15;
    const slot = (index & ~3) + park;
    state.weighted = (state.weighted + rank * cls) & 65535;
    state.delay = (index & ~3) === state.comparisonWord ? 40 : 10;
    return { index, rank, park, cls, slot, command: 0x63 + rank };
  }
  const api = Object.freeze({ begin, tick });
  if (typeof module !== "undefined") module.exports = api;
  else window.Skate720.OriginalMedalShowcase = api;
})();
