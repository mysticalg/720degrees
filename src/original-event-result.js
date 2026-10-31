/** Original bank16000 park-result arithmetic, without a CPU emulator.
 * Browser class selection is supplied by the caller; this module does not
 * invent an alternative class, medal percentage or fixed cash payout.
 */
(() => {
  const word = (value) => value & 65535;
  const signed = (value) => (word(value) << 16) >> 16;
  /** CPU6B84..6BB6: unpack three byte thresholds and apply the original
   * jump-table shifts. Ramp enters6BA4 (six shifts), jump6BAA (five).
   */
  function thresholds(kind, index, data) {
    const shift = data.shifts[kind],
      row = data.thresholdBytes[index];
    if (!Number.isInteger(shift) || !row)
      throw new RangeError("Unrecovered park result kind or class index");
    return row.map((value) => word(value << shift));
  }
  /** CPU6E38..6E90: signed metric0258 must be positive. Search ranks3..1
   * against0FDE/0FDC/0FDA inclusively, then store rank<<6 in0262[stage].
   */
  function medal(metric, limits) {
    const value = signed(metric);
    if (value > 0)
      for (let rank = 3; rank >= 1; rank--)
        if (value >= signed(limits[rank - 1])) return rank;
    return 0;
  }
  /** CPU67D8..680C and fixed80D8: cash = FE8C[rank] * setup index,
   * with a16-bit product. Rank0 takes the no-award branch in the caller.
   */
  function cash(rank, index, data) {
    return rank ? word(Math.imul(data.cashPerClass[rank], index)) : 0;
  }
  function result(kind, metric, index, data) {
    const limits = thresholds(kind, index, data);
    const rank = medal(metric, limits);
    return {
      rank,
      packedMedal: rank << 6,
      thresholds: limits,
      metric: word(metric),
      medal: ["PARTICIPATION", "BRONZE", "SILVER", "GOLD"][rank],
      cash: cash(rank, index, data),
      classIndex: index,
      source: "ROM6B84 threshold scaling /6E38 medal /67D8 cash",
    };
  }
  const api = { thresholds, medal, cash, result };
  if (typeof module !== "undefined") module.exports = api;
  else window.Skate720.OriginalEventResult = api;
})();
