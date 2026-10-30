/** Larger course finish columns. Geometry follows original type10 tiles;
 * height is deliberately excluded so an ollie cannot clear the trigger.
 */
(() => {
  function create(cells, columns, flags, hull) {
    const points = [];
    for (let i = 0; i < cells.length; i++) {
      if (flags[cells[i] & 8191] !== 10) continue;
      const x = (i % columns) * 8,
        y = Math.floor(i / columns) * 8;
      // Expand every original tile, then retain one diagonal convex boundary.
      for (const dx of [-48, 56])
        for (const dy of [-32, 40]) points.push({ x: x + dx, y: y + dy });
    }
    return points.length ? hull(points) : null;
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
