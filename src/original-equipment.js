/** Native shop state from1E0005248-52FA/5460-547C/55DE-561C.
 * World-position to shop-index selection remains a browser map adapter.
 */
(() => {
  const kinds = ["board", "helmet", "pads", "shoes"];
  function price(stage, data) {
    return data.prices[data.priceStages[Math.max(0, Math.min(15, stage))]];
  }
  function stockMask(gear, limit) {
    return kinds.reduce(
      (mask, kind, index) => mask | (gear[kind] >= limit ? 1 << index : 0),
      0,
    );
  }
  function purchase(state, index, gear, data) {
    const bit = 1 << index,
      kind = kinds[index];
    if (!kind) throw new RangeError("Invalid original shop index");
    if (gear[kind] >= 3 || (state.stockMask | state.attemptMask) & bit)
      return { status: "unavailable", kind };
    state.attemptMask |= bit; //525A latches even a failed balance check.
    const cost = price(state.stage, data);
    if (state.cash < cost) return { status: "funds", kind, cost };
    gear[kind] = Math.min(3, Math.max(0, gear[kind]) + 1);
    state.cash = Math.max(0, Math.min(9999, state.cash - cost));
    state.attemptMask = 0; //F002 cash mutation releases failed-attempt masks.
    state.stockMask = stockMask(gear, 1); //5602 closes stocked/owned equipment.
    return { status: "purchased", kind, cost, level: gear[kind] };
  }
  /** Original SystemII intensity/colour ladders used by palette RAM. */
  function rgb(value) {
    const intensity = [
        0, 124, 132, 141, 152, 161, 169, 178, 193, 202, 210, 219, 230, 239, 247,
        256,
      ][value & 15],
      colors = [0, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 14, 15, 15];
    return [12, 8, 4].map(
      (shift) => (colors[(value >>> shift) & 15] * intensity) >> 4,
    );
  }
  /** 1C00:5BDC-5C3A palette writes. No substitute equipment artwork. */
  function palettes(gear, clock, data) {
    const body = data.palette.slice(0, 16).map((c) => c.slice()),
      board = data.palette.slice(16, 32).map((c) => c.slice());
    const phase = ((clock - 1) >> 3) & 1,
      padPhase = ((clock - 2) >> 3) & 1,
      boardPhase = (clock >> 4) & 1;
    if (gear.shoes) {
      body[11] = rgb(data.colors.shoes[gear.shoes * 2 + phase]);
      body[14] = rgb(data.colors.shoeTrim[gear.shoes * 2 + phase]);
    }
    if (gear.pads) body[2] = rgb(data.colors.pads[gear.pads * 2 + padPhase]);
    if (gear.board)
      board[12] = rgb(data.colors.board[gear.board * 2 + boardPhase]);
    return { body, board };
  }
  const api = Object.freeze({
    kinds,
    price,
    stockMask,
    purchase,
    rgb,
    palettes,
  });
  if (typeof module !== "undefined") module.exports = api;
  else window.Skate720.OriginalEquipment = api;
})();
