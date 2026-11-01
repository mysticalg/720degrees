/** Wider native halfpipe using repeated original pixels and collision samples.
 * The tangent is(1,.5); translations along it preserve both ramp gradients.
 * A24px central strip is repeated to add216px, doubling each216px coping.
 */
(() => {
  const extra = 216,
    cut = 960,
    strip = 24;
  function sourcePoint(x, y) {
    const along = x * 0.5 + y;
    const shift =
      along < cut
        ? 0
        : along >= cut + extra
          ? extra
          : Math.floor((along - cut) / strip) * strip;
    return { x: x - shift, y: y - shift * 0.5 };
  }
  const api = Object.freeze({ extra, cut, strip, sourcePoint });
  if (typeof module !== "undefined") module.exports = api;
  else window.Skate720.HalfpipeWidth = api;
})();
