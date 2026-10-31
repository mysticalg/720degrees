/** Numeric translation of bank16000 CPU7ADA..7DB4 landing scoring.
 * Input adapters convert native spin radians to the ROM's288 units/turn.
 * Target geometry and physical landing detection remain separate callers.
 */
(() => {
  const signedByte = (n) => (n << 24) >> 24;
  function createState() {
    return { repeats: Array(32).fill(3), fatigue: 0, landings: 0 };
  }
  function award(input, state, data) {
    const { kind, frames, rotation } = input;
    const spin = Math.min(15, Math.floor((Math.abs(rotation) + 36) / 72));
    const time = Math.min(15, (frames + 4) >> 3);
    let index = 0;
    if (input.backwards && kind === 2) index++;
    if (input.takeoffBackwards) index += data.backwards[kind];
    state.landings++;
    if (kind === 4) {
      const drop = input.drop > 20 ? 16 : input.drop > 12 ? 8 : 0;
      index += data.jumpSpin[drop + (spin >> 1)];
      let duration = data.jumpTime[time + drop * 2];
      if (state.landings === data.specialJump[input.classIndex]) duration *= 2;
      index += duration;
      if (input.gap) index += 2;
      if (index > 14 && state.landings !== data.specialJump[input.classIndex])
        index = 14;
      if (((input.takeoffDirection ^ input.direction) & 7) === 0) index += 2;
      if (input.target) index += 4;
      index = signedByte(data.bytes[0x4584 - 0x451c + index]);
    } else {
      index += kind === 2 ? data.time[time] >> 1 : data.time[time];
      index += data.spin[spin >> 1];
      if (input.groundedState2) index += 2;
      let penalty = data.repeats[Math.min(15, (input.gapCount + 4) >> 3)];
      if (kind !== 2) penalty = data.drop[Math.min(15, Math.abs(input.drop))];
      if (kind !== 2) index += penalty;
      else penalty = 0;
      index += state.fatigue >> 3;
      state.fatigue = Math.min(128, (state.fatigue + index) & 255);
      const signature = frames > 56 ? -1 : spin + (frames > 40 ? 16 : 0);
      let tableOffset = 0;
      if (signature < 0) {
        state.repeats = state.repeats.map((n) => Math.min(3, n + 2));
        if (input.profile === 24) tableOffset = 40;
      } else if (!state.repeats[signature]) return { index: -1, points: 0 };
      else {
        if (input.gapCount < 5) {
          const count = state.repeats[signature];
          tableOffset = count <= 1 ? 80 : count === 3 ? 0 : 40;
          if (input.profile === 24 && tableOffset < 80) tableOffset += 40;
          state.repeats[signature]--;
        }
      }
      index = signedByte(data.bytes[0x45d1 - 0x451c + tableOffset + index]);
    }
    index = Math.min(9, index);
    return { index, points: index < 0 ? 0 : (index + 1) * 100 };
  }
  const api = Object.freeze({ createState, award });
  if (typeof module !== "undefined") module.exports = api;
  else window.Skate720.OriginalLandingScore = api;
})();
