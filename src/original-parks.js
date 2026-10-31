/** Original park masks: entry539E-53DA (bank3800), DA02, E6FE and
 * bank16000 CPU7140-7162/6DCA. Index order: slalom/downhill/ramp/jump.
 * Browser map coordinates and course scene creation remain caller adapters.
 */
(() => {
  const kinds = ["slalom", "downhill", "ramp", "jump"];
  function begin(experienced = false) {
    return {
      requestedClass: experienced ? -1 : 1, // CPU6372/637A:0F2D
      advancedSkill: !!experienced, //018E becomes1 after the first four courses.
      cityClass: 1, //0F2E is separate from the per-park90BA selector.
      stage: 0, //0F31, incremented by CPU6846/6898.
      previousMedal: 0,
      results: [], //0262 result history, indexed by0F31.
      entered: 0,
      played: 0,
      disabled: 0,
      completed: 0,
      twoPlayer: false,
      rotation: 4,
      opponentPark: 0,
      roundAdvanced: false,
    };
  }
  /** E6FE: played parks are closed. In alternating-player mode1 only the
   * opponent's current park is available, even when its played bit is clear.
   */
  function closedMask(state) {
    let mask = state.played & 15;
    if (state.rotation === 1) mask |= 15 & ~(1 << state.opponentPark);
    return mask;
  }
  /** 539E-53DA checks entered, disabled/played, then the two-player guard.
   * Ticket admission is a separate5390 branch and is not a closure bit.
   */
  function available(state, index) {
    if (!Number.isInteger(index) || index < 0 || index > 3) return false;
    if ((state.entered | state.disabled | state.played) & (1 << index))
      return false;
    return (
      !state.twoPlayer || state.rotation !== 1 || state.opponentPark === index
    );
  }
  function enter(state, index) {
    if (!available(state, index)) return false;
    state.entered = (state.entered | (1 << index)) & 255; // DA56
    return true;
  }
  function startCourse(state, index) {
    // CPU6618-666A: solo and rotation4 always record the bit; rotation1
    // does too after its separate handoff. Other two-player rotations do not.
    if (!state.twoPlayer || state.rotation === 4 || state.rotation === 1)
      state.played = (state.played | (1 << index)) & 255;
  }
  function finishCourse(state) {
    state.completed = (state.completed + 1) & 255;
    state.roundAdvanced = state.completed === 4;
    if (state.roundAdvanced) {
      state.completed = state.played = 0;
      state.advancedSkill = true; //CPU715C
    }
    return state.roundAdvanced;
  }
  /** Fixed90BA-910A: positive0F2D pins the class. A negative value
   * rotates classes by park using FCAC[0,2,3,1], capped at9 before stage12.
   */
  function courseClass(state, index) {
    const requested = (state.requestedClass << 24) >> 24;
    if (requested > 0) return requested;
    const offset = [0, 2, 3, 1][index];
    if (offset === undefined) throw new RangeError("Park index must be0..3");
    return Math.min(
      ((offset - requested - 1) & 3) - requested,
      (state.stage & 255) < 12 ? 9 : 10,
    );
  }
  /** CPU6830/6882 stores medal|park<<4|class at0262[stage], then
   * advances0F31. CPU7162 reads0261[new stage], the just-finished result.
   * Keep the full packed byte so a future two-player caller can supply its
   * corresponding opponent byte, as the original7168 branch does.
   */
  function recordResult(state, index, packedMedal) {
    const packed =
      (packedMedal & 192) | (index << 4) | courseClass(state, index);
    state.results[state.stage & 255] = packed & 255;
    if (!state.twoPlayer || state.rotation > 2)
      state.stage = (state.stage + 1) & 255;
    state.previousMedal = state.results[(state.stage - 1) & 255] || 0;
    return packed & 255;
  }
  /** CPU7162-71D8 follows the four-course mask reset. Medal success while
   * rotating, or class1, pins the current class until the set ends. At a set
   * boundary its next class is negated to resume rotation, capped at10.
   */
  function advanceClass(state, index, opponentMedal = 0) {
    let requested = (state.requestedClass << 24) >> 24;
    const current = courseClass(state, index);
    const medal =
      (state.previousMedal | (state.twoPlayer ? opponentMedal : 0)) & 192;
    if ((medal && requested < 0) || current === 1) {
      requested = state.completed === 0 ? -Math.min(current + 1, 10) : current;
    } else if (requested > 0 && state.completed === 0) {
      requested = -Math.min(current + 1, 10);
    }
    state.requestedClass = (requested << 24) >> 24;
    state.cityClass = Math.abs(state.requestedClass);
    return state.cityClass;
  }
  /** CPU697C-69C6: solo/ordinary rotation finishes after stage15; the
   * two-player rotation2 comparison uses14. Stage is an unsigned byte.
   */
  function runFinished(state) {
    return (
      (state.stage & 255) > (state.twoPlayer && state.rotation === 2 ? 14 : 15)
    );
  }
  function returnToCity(state) {
    state.entered = state.disabled = 0; // CPU6DCA/6E24
  }
  const api = Object.freeze({
    kinds,
    begin,
    courseClass,
    recordResult,
    runFinished,
    advanceClass,
    closedMask,
    available,
    enter,
    startCourse,
    finishCourse,
    returnToCity,
  });
  if (typeof module !== "undefined") module.exports = api;
  else window.Skate720.OriginalParks = api;
})();
