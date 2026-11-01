/** Original A2BE admission, A45A setup,4CD8/4D80 exit and E51A clocks.
 * Dial delta is supplied in the original144-count revolution by the input
 * adapter. Speed/friction is handled by OriginalGround action10, not an XY blend.
 */
(() => {
  //CPU7988 mask bytes (physical15988),4EAC/4EBC board directories
  //(physical28EAC/28EBC); extract_slide_tables.py reproduces these arrays.
  const data = {
    angleMasks: [
      56, 56, 240, 240, 224, 224, 193, 193, 131, 131, 7, 7, 14, 14, 30, 30, 56,
      56, 240, 240, 224, 224, 193, 193, 131, 131, 7, 7, 14, 14, 30, 30,
    ],
    boardPositive: [20028, 20042, 20056, 20070, 20084, 20098, 20112, 20126],
    boardNegative: [20084, 20098, 20112, 20126, 20028, 20042, 20056, 20070],
  };
  const signed = (n) => (n << 16) >> 16;
  function permitted(facing, travel) {
    const i = ((facing & 15) << 4) + (travel & 15);
    return !!(data.angleMasks[i >> 3] & (1 << (i & 7)));
  }
  function begin(facing, travel, turn, speed) {
    if (
      Math.abs(turn) < 8 ||
      Math.abs(signed(speed)) < 128 ||
      !permitted(facing, travel)
    )
      return null;
    const negative = turn < 0,
      offset = ((facing & 15) >> 1) * 2;
    return {
      original: true,
      facing: facing & 15,
      travel: travel & 15,
      side: negative ? -1 : 1,
      action: 10,
      phase: 0,
      countdown: 3,
      boardBase: (negative ? data.boardNegative : data.boardPositive)[
        offset >> 1
      ],
      body: (negative ? 0x42b0 : 0x42c0) + offset,
    };
  }
  function steer(state, facing, speed) {
    state.facing = facing & 15;
    speed = signed(speed);
    let difference = (state.facing - state.travel + 16) & 15;
    if (difference > 8) difference -= 16;
    if (Math.abs(difference) > 4) {
      speed = signed(-speed);
      state.travel ^= 8;
    }
    const done = Math.abs(speed) < 128 || state.facing === state.travel;
    if (Math.abs(speed) < 128) state.travel = state.facing;
    return { speed, done };
  }
  function tick(state) {
    if (state.action === 10 && state.phase === 6) {
      state.action = 11;
      state.countdown = 0;
    } else if (state.action === 10) {
      if (state.countdown > 0) state.countdown--;
      else {
        state.countdown = 3;
        state.phase++;
      }
    }
    return { body: state.body, board: state.boardBase + state.phase * 2 };
  }
  const api = Object.freeze({ data, permitted, begin, steer, tick });
  if (typeof module !== "undefined") module.exports = api;
  else window.Skate720.OriginalSlide = api;
})();
