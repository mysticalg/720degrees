/** Improved playability geometry over the recovered8px terrain grid.
 * Marching-square contours cut diagonal corners into triangles rather than
 * treating every flagged tile as a full square. Sprite masks stay original.
 */
(() => {
  const TILE = 8;
  // Bit40/low7 profiles identify vertical scenery faces such as fences.
  // The halfpipe also has untagged brick/wood faces; curved walls1/17 and
  // flat coping/grass remain rideable. Voids are support edges, not fences.
  const barrier = (level, sample, x, y) =>
    (sample.profile & 7) === 7 &&
    (!!(sample.profile & 64) || level.kind === "ramp") &&
    !(
      sample.profile === 15 &&
      Number.isFinite(x) &&
      level.halfpipeWallAt?.(x, y)
    );
  const solid = (level, sample) => sample.blocked || barrier(level, sample);
  // Low-three-bit incline2 is the city's shallow curb, in all eight
  // orientations. It remains rideable: this is a surface boundary, not a wall.
  const curb = (level, sample) =>
    level.name === "city" && sample.type === 0 && (sample.profile & 7) === 2;
  // The recovered incline field is1..6;0 is flat and7 is a vertical face.
  // Keep this diagnostic category separate from support/barrier collision.
  const slope = (sample, level, x, y) => {
    // City curbs have their own continuous region; avoid duplicate pebble
    // contours from the generic incline diagnostic.
    if (curb(level, sample)) return false;
    const profile = level?.surfaceProfile?.(sample) ?? sample.profile;
    return (
      !sample.blocked &&
      !(
        sample.profile === 17 &&
        level?.halfpipeWallAt &&
        !level.halfpipeWallAt(x, y)
      ) &&
      (((profile & 7) >= 1 && (profile & 7) <= 6) ||
        (sample.profile === 15 &&
          Number.isFinite(x) &&
          level?.halfpipeWallAt?.(x, y)))
    );
  };
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  function cells(level, x, y, barriersOnly = false, maskReader = null) {
    const col = Math.floor(x / TILE - 0.5),
      row = Math.floor(y / TILE - 0.5);
    const left = (col + 0.5) * TILE,
      top = (row + 0.5) * TILE;
    const points = [
      { x: left, y: top },
      { x: left + TILE, y: top },
      { x: left + TILE, y: top + TILE },
      { x: left, y: top + TILE },
    ];
    const samples = points.map((p) => level.sample(p.x, p.y));
    const values = samples.map((sample, i) =>
      maskReader
        ? maskReader(points[i].x, points[i].y)
        : (
              barriersOnly === "slopes"
                ? slope(sample, level, points[i].x, points[i].y)
                : barriersOnly === "curbs"
                  ? curb(level, sample)
                  : barriersOnly
                    ? barrier(level, sample, points[i].x, points[i].y)
                    : solid(level, sample)
            )
          ? 1
          : 0,
    );
    const edges = [];
    for (let i = 0; i < 4; i++)
      if (values[i] !== values[(i + 1) % 4]) edges.push(i);
    const middle = (i) => ({
      x: (points[i].x + points[(i + 1) % 4].x) / 2,
      y: (points[i].y + points[(i + 1) % 4].y) / 2,
    });
    let pairs = [];
    if (edges.length === 2) pairs = [[edges[0], edges[1]]];
    // In the ambiguous saddle case, retain each solid corner as its own
    // triangle. Do not join two diagonal solids into an invisible wall.
    else if (edges.length === 4) {
      // Diagonal curb tiles meet corner-to-corner along a single painted
      // strip. Join matching curb profiles through the saddle, rather than
      // producing a separate hexagon per stone. Solid walls retain the
      // conservative corner rule, and different curb orientations stay apart.
      const occupied = samples.filter((_, i) => values[i]);
      const join =
        barriersOnly === "curbs" &&
        occupied.length === 2 &&
        occupied[0].profile === occupied[1].profile;
      for (let i = 0; i < 4; i++)
        if (join ? !values[i] : values[i]) pairs.push([(i + 3) % 4, i]);
    }
    const segments = pairs.map(([a, b]) => {
      const p = middle(a),
        q = middle(b),
        fx = ((p.x + q.x) / 2 - left) / TILE,
        fy = ((p.y + q.y) / 2 - top) / TILE;
      const gx =
        (values[1] - values[0]) * (1 - fy) + (values[2] - values[3]) * fy;
      const gy =
        (values[3] - values[0]) * (1 - fx) + (values[2] - values[1]) * fx;
      const length = Math.hypot(gx, gy);
      return { a: p, b: q, normal: { x: -gx / length, y: -gy / length } };
    });
    return { points, samples, values, segments };
  }
  const cache = new WeakMap();
  /** Join contour pieces, then simplify within4px. This replaces an8px
   * staircase with a stable diagonal, while retaining real corners/gaps.
   * Geometry is cached per decoded map and invalidated for a changed reader.
   */
  function geometry(level, barriersOnly) {
    if (!level.columns || !level.rows) return null;
    if (
      level.originalMap &&
      level.sample !== Object.getPrototypeOf(level).sample
    )
      return null;

    let entry = cache.get(level);
    if (!entry || entry.sample !== level.sample) {
      entry = { sample: level.sample };
      cache.set(level, entry);
    }
    const curbsOnly = barriersOnly === "curbs";
    const slopesOnly = barriersOnly === "slopes";
    const key = slopesOnly
      ? "slopes"
      : curbsOnly
        ? "curbs"
        : barriersOnly
          ? "barriers"
          : "support";
    if (entry[key]) return entry[key];
    if (!entry.barrierRaster) {
      const width = level.columns + 4,
        height = level.rows + 4,
        raw = new Uint8Array(width * height),
        expanded = new Uint8Array(raw.length),
        closed = new Uint8Array(raw.length);
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++)
          raw[y * width + x] = barrier(
            level,
            level.sample((x - 1.5) * TILE, (y - 1.5) * TILE),
            (x - 1.5) * TILE,
            (y - 1.5) * TILE,
          )
            ? 1
            : 0;
      // Close one-tile gaps between fence posts/corner joins. This keeps a
      // continuous barrier instead of alternating between its two sides.
      for (let y = 1; y < height - 1; y++)
        for (let x = 1; x < width - 1; x++) {
          let any = 0;
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++)
              any |= raw[(y + dy) * width + x + dx];
          expanded[y * width + x] = any;
        }
      for (let y = 2; y < height - 2; y++)
        for (let x = 2; x < width - 2; x++) {
          let every = 1;
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++)
              every &= expanded[(y + dy) * width + x + dx];
          closed[y * width + x] = every;
        }
      entry.barrierRaster = { width, height, closed };
    }
    const raster = entry.barrierRaster;
    const maskReader = (x, y) => {
      if (slopesOnly) return slope(level.sample(x, y), level, x, y) ? 1 : 0;
      if (curbsOnly) return curb(level, level.sample(x, y)) ? 1 : 0;
      const col = Math.floor(x / TILE) + 2,
        row = Math.floor(y / TILE) + 2;
      const fence =
        col >= 0 && row >= 0 && col < raster.width && row < raster.height
          ? raster.closed[row * raster.width + col]
          : 0;
      // Closing post gaps must not grow a foreground railing into a recovered
      // halfpipe curve. Keep the effective riding surface open in both meshes.
      return (fence && !level.halfpipeWallAt?.(x, y)) ||
        (!barriersOnly && level.sample(x, y).blocked)
        ? 1
        : 0;
    };
    const edges = [];
    for (let row = -1; row < level.rows; row++)
      for (let col = -1; col < level.columns; col++)
        edges.push(
          ...cells(
            level,
            (col + 1) * TILE,
            (row + 1) * TILE,
            barriersOnly,
            maskReader,
          ).segments,
        );
    const links = new Map(),
      pointKey = (p) => p.x + "," + p.y;
    edges.forEach((edge, i) => {
      for (const p of [edge.a, edge.b]) {
        const k = pointKey(p);
        if (!links.has(k)) links.set(k, []);
        links.get(k).push(i);
      }
    });
    const visited = new Set(),
      segments = [],
      paths = [];
    function simplify(points) {
      const keep = new Set([0, points.length - 1]),
        pending = [[0, points.length - 1]];
      while (pending.length) {
        const [a, b] = pending.pop(),
          p = points[a],
          q = points[b],
          dx = q.x - p.x,
          dy = q.y - p.y,
          len = dx * dx + dy * dy;
        let maximum = 16,
          index = -1;
        for (let i = a + 1; i < b; i++) {
          const v = points[i],
            t = len
              ? Math.max(
                  0,
                  Math.min(1, ((v.x - p.x) * dx + (v.y - p.y) * dy) / len),
                )
              : 0,
            d = (v.x - p.x - dx * t) ** 2 + (v.y - p.y - dy * t) ** 2;
          if (d > maximum) {
            maximum = d;
            index = i;
          }
        }
        if (index >= 0) {
          keep.add(index);
          pending.push([a, index], [index, b]);
        }
      }
      return [...keep].sort((a, b) => a - b);
    }
    for (let first = 0; first < edges.length; first++) {
      if (visited.has(first)) continue;
      const points = [edges[first].a],
        normals = [];
      let edgeIndex = first,
        current = edges[first].a;
      while (edgeIndex !== undefined && !visited.has(edgeIndex)) {
        const edge = edges[edgeIndex];
        visited.add(edgeIndex);
        current = pointKey(current) === pointKey(edge.a) ? edge.b : edge.a;
        points.push(current);
        normals.push(edge.normal);
        edgeIndex = (links.get(pointKey(current)) || []).find(
          (i) => !visited.has(i),
        );
      }
      let indices = simplify(points);
      const area = (points) =>
        Math.abs(
          points.reduce((sum, p, i) => {
            const q = points[(i + 1) % points.length];
            return sum + p.x * q.y - p.y * q.x;
          }, 0),
        );
      if (
        pointKey(points[0]) === pointKey(points.at(-1)) &&
        area(indices.map((i) => points[i])) < area(points) * 0.6
      )
        indices = points.map((_, i) => i); // retain narrow posts/obstacles

      paths.push(indices.map((i) => points[i]));
      for (let i = 1; i < indices.length; i++) {
        const a = indices[i - 1],
          b = indices[i],
          p = points[a],
          q = points[b],
          dx = q.x - p.x,
          dy = q.y - p.y,
          length = Math.hypot(dx, dy);
        if (!length) continue;
        let nx = dy / length,
          ny = -dx / length,
          sx = 0,
          sy = 0;
        for (let j = a; j < b; j++) {
          sx += normals[j].x;
          sy += normals[j].y;
        }
        if (nx * sx + ny * sy < 0) {
          nx = -nx;
          ny = -ny;
        }
        segments.push({ a: p, b: q, normal: { x: nx, y: ny } });
      }
    }
    const buckets = new Map();
    for (const segment of segments)
      for (
        let row = Math.floor(Math.min(segment.a.y, segment.b.y) / 32);
        row <= Math.floor(Math.max(segment.a.y, segment.b.y) / 32);
        row++
      ) {
        if (!buckets.has(row)) buckets.set(row, []);
        buckets.get(row).push(segment);
      }
    const outside =
      curbsOnly || slopesOnly
        ? false
        : barriersOnly
          ? barrier(level, level.sample(-8, -8))
          : solid(level, level.sample(-8, -8));
    return (entry[key] = { segments, buckets, outside, paths });
  }
  function blocked(level, x, y, barriersOnly = false) {
    const mesh = geometry(level, barriersOnly);
    if (mesh) {
      let crossings = 0;
      for (const s of mesh.buckets.get(Math.floor(y / 32)) || [])
        if (
          s.a.y > y !== s.b.y > y &&
          x < ((s.b.x - s.a.x) * (y - s.a.y)) / (s.b.y - s.a.y) + s.a.x
        )
          crossings++;
      return mesh.outside !== !!(crossings & 1);
    }
    const c = cells(level, x, y, barriersOnly),
      n = c.values.reduce((a, b) => a + b, 0);
    if (!n) return false;
    if (n === 4) return true;
    const point = { x, y };
    // Each contour bounds its solid half-plane. Opposite-corner saddles
    // are a union of triangles; all other cells have one dividing segment.
    return c.segments.some(
      (s) => dot({ x: point.x - s.a.x, y: point.y - s.a.y }, s.normal) < -1e-8,
    );
  }
  /** Use the same diagonal curb region for physics and the developer overlay.
   * Only cut/extend the edge tiles; retain the original orientation coefficients
   * and neighbouring road/raised-platform profiles. Curbs are never solidified.
   */
  function curbSurface(level, x, y, original = level.sample(x, y)) {
    if (level.name !== "city") return original;
    // Purchase/map/park entry cells keep their recovered trigger semantics.
    if (original.type !== 0 && !original.blocked) return original;
    const inside = blocked(level, x, y, "curbs");
    if (inside === curb(level, original)) return original;
    let nearest = null,
      distance = Infinity;
    // Sample tile centres, not offsets from the player: the boundary must
    // remain stationary as the skater moves across it.
    const left = Math.floor(x / TILE) * TILE + TILE / 2,
      top = Math.floor(y / TILE) * TILE + TILE / 2;
    for (let dy = -64; dy <= 64; dy += TILE)
      for (let dx = -64; dx <= 64; dx += TILE) {
        const sample = level.sample(left + dx, top + dy),
          d = (left + dx - x) ** 2 + (top + dy - y) ** 2;
        if (
          curb(level, sample) === inside &&
          !solid(level, sample) &&
          sample.type === 0 &&
          d < distance
        ) {
          nearest = sample;
          distance = d;
        }
      }
    return nearest
      ? {
          ...original,
          profile: nearest.profile,
          type: nearest.type,
          rawProfile: original.profile,
          rawType: original.type,
          contactGeometry: "diagonal-curb",
        }
      : original;
  }
  function surface(level, x, y) {
    const original = curbSurface(level, x, y),
      occupied = blocked(level, x, y);
    if (occupied === original.blocked) return original;
    if (occupied)
      return {
        ...original,
        blocked: true,
        barrier: blocked(level, x, y, true),
        contactGeometry: "diagonal",
      };
    // A cut-away square corner inherits the nearest supporting terrain,
    // so a water tile's profile cannot zero speed while its triangle is open.
    const c = cells(level, x, y);
    let nearest = null,
      distance = Infinity;
    c.samples.forEach((sample, i) => {
      const p = c.points[i],
        d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (!solid(level, sample) && d < distance) {
        nearest = sample;
        distance = d;
      }
    });
    if (!nearest) {
      for (let dy = -16; dy <= 16; dy += 8)
        for (let dx = -16; dx <= 16; dx += 8) {
          const candidate = level.sample(x + dx, y + dy),
            d = dx * dx + dy * dy;
          if (!solid(level, candidate) && d < distance) {
            nearest = candidate;
            distance = d;
          }
        }
    }
    nearest ||= original;
    return curbSurface(level, x, y, {
      ...original,
      profile: nearest.profile,
      type: nearest.type,
      blocked: false,
      rawProfile: original.profile,
      rawType: original.type,
      contactGeometry: "diagonal",
    });
  }
  function sweep(level, from, to, velocity, options = {}) {
    const barriersOnly = !!options.barriersOnly;
    let start = { x: from.x, y: from.y },
      end = { x: to.x, y: to.y },
      v = { ...velocity },
      hits = 0;
    if (blocked(level, start.x, start.y, barriersOnly))
      return { x: end.x, y: end.y, vx: v.x, vy: v.y, hits };
    for (let pass = 0; pass < 3; pass++) {
      const movement = { x: end.x - start.x, y: end.y - start.y };
      let first = null;
      const minX = Math.floor(Math.min(start.x, end.x) / TILE - 0.5) - 1,
        maxX = Math.floor(Math.max(start.x, end.x) / TILE - 0.5) + 1;
      const minY = Math.floor(Math.min(start.y, end.y) / TILE - 0.5) - 1,
        maxY = Math.floor(Math.max(start.y, end.y) / TILE - 0.5) + 1;
      const mesh = geometry(level, barriersOnly);
      const candidates = mesh
        ? mesh.segments.filter(
            (s) =>
              Math.max(s.a.x, s.b.x) >= Math.min(start.x, end.x) - 1 &&
              Math.min(s.a.x, s.b.x) <= Math.max(start.x, end.x) + 1 &&
              Math.max(s.a.y, s.b.y) >= Math.min(start.y, end.y) - 1 &&
              Math.min(s.a.y, s.b.y) <= Math.max(start.y, end.y) + 1,
          )
        : [];
      if (!mesh)
        for (let row = minY; row <= maxY; row++)
          for (let col = minX; col <= maxX; col++)
            candidates.push(
              ...cells(level, (col + 1) * TILE, (row + 1) * TILE, barriersOnly)
                .segments,
            );
      for (const s of candidates) {
        const d0 = dot({ x: start.x - s.a.x, y: start.y - s.a.y }, s.normal),
          d1 = dot({ x: end.x - s.a.x, y: end.y - s.a.y }, s.normal);
        if (d0 < -0.001 || d1 >= 0 || d0 - d1 < 1e-9) continue;
        const t = d0 / (d0 - d1),
          hit = {
            x: start.x + movement.x * t,
            y: start.y + movement.y * t,
          },
          line = { x: s.b.x - s.a.x, y: s.b.y - s.a.y };
        const u =
          dot({ x: hit.x - s.a.x, y: hit.y - s.a.y }, line) / dot(line, line);
        if (u < -0.0001 || u > 1.0001) continue;
        if (!first || t < first.t) first = { ...s, t, hit };
      }
      if (!first) break;
      hits++;
      const n = first.normal,
        remaining = {
          x: movement.x * (1 - first.t),
          y: movement.y * (1 - first.t),
        },
        into = dot(remaining, n),
        speedInto = dot(v, n);
      start = { x: first.hit.x + n.x * 0.01, y: first.hit.y + n.y * 0.01 };
      end = {
        x: start.x + remaining.x - n.x * Math.min(0, into),
        y: start.y + remaining.y - n.y * Math.min(0, into),
      };
      if (speedInto < 0) {
        v.x -= n.x * speedInto;
        v.y -= n.y * speedInto;
      }
    }
    return { x: end.x, y: end.y, vx: v.x, vy: v.y, hits };
  }
  /** Separate the recovered inclined faces inside a slope region. These
   * marching-cell boundaries are diagnostic only and never create walls.
   */
  function slopeDivisions(level) {
    if (!geometry(level, "slopes")) return [];
    const entry = cache.get(level);
    if (entry.divisions) return entry.divisions;
    const result = [],
      seen = new Set();
    const profile = (x, y) => {
      const sample = level.sample(x, y);
      return sample.blocked
        ? -1
        : (level.halfpipeWallAt?.(x, y)?.profile ??
            level.surfaceProfile?.(sample) ??
            sample.profile);
    };
    for (let row = 0; row < level.rows - 1; row++)
      for (let col = 0; col < level.columns - 1; col++) {
        const x = (col + 1) * TILE,
          y = (row + 1) * TILE;
        const values = [
          profile(x - 4, y - 4),
          profile(x + 4, y - 4),
          profile(x + 4, y + 4),
          profile(x - 4, y + 4),
        ];
        const faces = new Set(values);
        if (
          faces.size < 2 ||
          values.some((p) => p < 0 || (p & 7) < 1 || (p & 7) > 6)
        )
          continue;
        for (const face of faces)
          for (const edge of cells(level, x, y, false, (px, py) =>
            profile(px, py) === face ? 1 : 0,
          ).segments) {
            const key = [edge.a.x + "," + edge.a.y, edge.b.x + "," + edge.b.y]
              .sort()
              .join("/");
            if (!seen.has(key)) {
              seen.add(key);
              result.push(edge);
            }
          }
      }
    return (entry.divisions = result);
  }
  const api = Object.freeze({
    blocked,
    surface,
    sweep,
    slopeDivisions,
    invalidate: (level) => cache.delete(level),
    debugMesh: (level, barriersOnly = false) => geometry(level, barriersOnly),
    contours: (level, barriersOnly = false) =>
      geometry(level, barriersOnly)?.segments || [],
  });
  if (typeof module !== "undefined") module.exports = api;
  else window.Skate720.TerrainCollision = api;
})();
