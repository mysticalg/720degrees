/** Native contact geometry from the original board sprite's opaque pixels.
 * The convex outline removes empty AABB corners while retaining every pixel.
 * This changes contact geometry only; no replacement graphics are generated.
 */
(() => {
  function hull(points) {
    const sorted = [
      ...new Map(points.map((p) => [p.x + "," + p.y, p])).values(),
    ].sort((a, b) => a.x - b.x || a.y - b.y);
    if (sorted.length < 3) return sorted;
    const cross = (a, b, c) =>
      (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    const half = (points) => {
      const out = [];
      for (const p of points) {
        while (out.length >= 2 && cross(out.at(-2), out.at(-1), p) <= 0)
          out.pop();
        out.push(p);
      }
      return out;
    };
    const lower = half(sorted),
      upper = half([...sorted].reverse());
    lower.pop();
    upper.pop();
    return lower.concat(upper);
  }
  function overlapsRect(polygon, rect) {
    if (polygon.length < 3 || rect.width <= 0 || rect.height <= 0) return false;
    const corners = [
      { x: rect.x, y: rect.y },
      { x: rect.x + rect.width, y: rect.y },
      { x: rect.x + rect.width, y: rect.y + rect.height },
      { x: rect.x, y: rect.y + rect.height },
    ];
    const axes = [
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i],
        b = polygon[(i + 1) % polygon.length];
      axes.push({ x: a.y - b.y, y: b.x - a.x });
    }
    return axes.every((axis) => {
      const project = (p) => p.x * axis.x + p.y * axis.y;
      const a = polygon.map(project),
        b = corners.map(project);
      return (
        Math.max(...a) > Math.min(...b) + 1e-8 &&
        Math.max(...b) > Math.min(...a) + 1e-8
      );
    });
  }
  function touchesActor(footprint, origin, actor, shape, cells) {
    const polygon = footprint.polygon.map((p) => ({
      x: p.x + origin.x,
      y: p.y + origin.y,
    }));
    const left = actor.actorX + shape.x / 64,
      base =
        actor.actorY - (((actor.height || 0) << 16) >> 16) / 64 - shape.y / 64;
    if (
      !overlapsRect(polygon, {
        x: left,
        y: base - shape.height / 64,
        width: shape.width / 64,
        height: shape.height / 64,
      })
    )
      return false;
    return cells.some((c) =>
      overlapsRect(polygon, {
        x: left + c.x,
        y: base - c.y - 4,
        width: 4,
        height: 4,
      }),
    );
  }
  const api = Object.freeze({ hull, overlapsRect, touchesActor });
  if (typeof module !== "undefined") module.exports = api;
  else window.Skate720.BoardGeometry = api;
})();
