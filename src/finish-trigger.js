/** Course finish strip just beyond the original type10 finish tiles.
 * A swept ground-plane crossing catches airborne and fast skaters without
 * expanding the trigger onto the approach side of the painted line.
 */
(() => {
  function create(cells, columns, flags, hull) {
    const tiles = [];
    for (let i = 0; i < cells.length; i++) {
      if (flags[cells[i] & 8191] === 10)
        tiles.push({ x: (i % columns) * 8, y: Math.floor(i / columns) * 8 });
    }
    if (!tiles.length) return null;
    // The course artwork has either isometric diagonal finish orientation.
    // Recover it from the tile run, using the ground plane (x, 2*y). Courses
    // progress towards +y, so choose the downstream normal consistently.
    const meanX = tiles.reduce((sum, p) => sum + p.x, 0) / tiles.length;
    const meanY = tiles.reduce((sum, p) => sum + p.y, 0) / tiles.length;
    const covariance = tiles.reduce(
      (sum, p) => sum + (p.x - meanX) * (p.y - meanY),
      0,
    );
    const sign = covariance > 0 ? -1 : 1;
    let far = -Infinity,
      left = Infinity,
      right = -Infinity;
    for (const tile of tiles)
      for (const dx of [0, 8])
        for (const dy of [0, 8]) {
          const x = tile.x + dx,
            y = tile.y + dy;
          far = Math.max(far, sign * x + 2 * y);
          const along = x - sign * 2 * y;
          left = Math.min(left, along);
          right = Math.max(right, along);
        }
    // Four coordinate units put the leading edge just past the final paint
    // tile. Side padding and downstream depth cannot trigger an early finish.
    const points = [];
    for (const along of [left - 48, right + 48])
      for (const normal of [far + 4, far + 52])
        points.push({
          x: (along + sign * normal) / 2,
          y: (normal - sign * along) / 4,
        });
    return hull(points);
  }
  /** Clip the whole movement segment against a convex polygon. This catches
   * fast crossings even when neither frame ends inside the finish strip.
   */
  function crosses(polygon, from, to) {
    if (!polygon?.length) return false;
    let enter = 0,
      exit = 1;
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i],
        b = polygon[(i + 1) % polygon.length],
        dx = b.x - a.x,
        dy = b.y - a.y;
      const start = dx * (from.y - a.y) - dy * (from.x - a.x),
        end = dx * (to.y - a.y) - dy * (to.x - a.x);
      if (start < 0 && end < 0) return false;
      if (start < 0) enter = Math.max(enter, start / (start - end));
      if (end < 0) exit = Math.min(exit, start / (start - end));
      if (enter > exit) return false;
    }
    return true;
  }
  const api = Object.freeze({ create, crosses });
  if (typeof module !== "undefined") module.exports = api;
  else window.Skate720.FinishTrigger = api;
})();
