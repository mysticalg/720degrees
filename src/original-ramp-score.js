/** Bank16000 CPU7E98-7F50 /7F80: halfpipe trick scoring.
 *031F action,01F1 animation variant,01F2 completed segments,0324 flags,
 *01C4-0FAC elapsed ticks and02F4 rotation are provided by native callers.
 * Uses inert bank2000 tables; no instructions are interpreted at runtime.
 */
(() => {
  function begin() {
    return { used: Array(36).fill(0) }; //7F80 clears0FB4..0FD7.
  }
  function award(input, state, data) {
    if ((input.action & 255) === 1)
      return { index: -1, points: 0, deferred: true, skipped: true };
    const variant = input.variant & 255;
    if (variant >= 36) throw new RangeError("Unrecovered ramp scoring variant");
    let subtotal = 0;
    if (!(state.used[variant] & 255)) {
      subtotal = data.rampFirstUse[variant];
      state.used[variant] = 1;
    }
    subtotal += input.completed & 255;
    let airBonus = 0;
    if (input.flags & 64) {
      const time = Math.min(7, input.frames >> 4);
      const spin = Math.min(7, Math.trunc(Math.abs(input.rotation) / 144));
      airBonus = data.rampTimeSpin[(spin << 3) + time];
      subtotal += airBonus;
    }
    //7F24-7F2E: (subtotal+1)>>1 passes toF064, which caps the index9.
    const index = Math.min(9, (subtotal + 1) >> 1);
    return {
      index,
      points: (index + 1) * 100,
      deferred: true,
      variant,
      subtotal,
      airBonus,
    };
  }
  const api = Object.freeze({ begin, award });
  if (typeof module !== "undefined") module.exports = api;
  else window.Skate720.OriginalRampScore = api;
})();
