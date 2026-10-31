/** Original ticket state: bank3800:41DE-41EE, bank16000 CPU72CA-7398,
 * fixedEF54-EFE6.025B is the ticket count; equipment starts at025C.
 * These are numeric translations and inert ROM tables, not CPU execution.
 */
(() => {
  const increments = [
    [5000, 10000, 10000, 15000, 15000],
    [3000, 4000, 8000, 10000, 10000],
    [8000, 12000, 15000, 17500, 17500],
    [12000, 13000, 15000, 20000, 20000],
  ]; // bank3800:5212..5239
  const initial = [1, 0, 2, 3]; //523A,01F4&3
  const signedByte = (n) => (n << 24) >> 24;
  function begin(settings = 0, ticketSettings = 0) {
    const row = settings & 3;
    return {
      tickets: initial[ticketSettings & 3],
      row,
      stage: 0,
      threshold: increments[row][0],
    };
  }
  /** 7382-7398 stores a byte, then applies a signed upper cap of4.
   * Admission must reject zero tickets before requesting a negative change.
   */
  function change(state, delta) {
    let count = (signedByte(state.tickets) + ((delta << 16) >> 16)) & 255;
    if (signedByte(count) > 4) count = 4;
    state.tickets = count;
    return count;
  }
  /** EF54 loops after every crossing, including when the ticket count is
   * already capped. Stage025A saturates at4; its last interval repeats.
   * Comparison is the original signed32-bit remaining-threshold test.
   */
  function award(state, score, terminal = false) {
    let count = 0;
    while (((state.threshold - (score >>> 0)) | 0) <= 0) {
      state.stage = Math.min(4, state.stage + 1);
      state.threshold =
        (state.threshold + increments[state.row][state.stage]) >>> 0;
      if (!terminal) change(state, 1); // EFCC phase5 suppresses ticket delivery.
      count++;
    }
    return count;
  }
  /** 5DF6-5E00 supplies one ticket on continuation only when025B is0. */
  function continueTicket(state) {
    if ((state.tickets & 255) !== 0) return false;
    change(state, 1);
    return true;
  }
  const api = Object.freeze({
    increments,
    initial,
    begin,
    change,
    award,
    continueTicket,
  });
  if (typeof module !== "undefined") module.exports = api;
  else window.Skate720.OriginalTickets = api;
})();
