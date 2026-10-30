/** Halfpipe map adapter. ROM artwork marks whole curved walls1/17; these
 * scans locate each lane's floor and coping instead of a guessed pipe box.
 * The original slope/pose tables then supply its seven inclination bands.
 */
(() => {
  function wallAt(level, x, y) {
    const raw = level.sample(x, y).profile;
    // Southern foreground rail tiles can occlude short pieces of the curve.
    // Only bridge a bounded rail run between curve/floor samples. A rail at
    // the coping or outside either end remains a real boundary.
    const profile = raw === 15 ? 17 : raw;
    if (profile !== 1 && profile !== 17) return null;
    const sign = profile === 1 ? 1 : -1,
      dx = sign,
      dy = -sign * 0.5;
    const at = (d) => level.sample(x + dx * d, y + dy * d).profile;
    const same = (d) => {
      if (at(d) === profile) return true;
      if (profile !== 17 || at(d) !== 15) return false;
      const ends = [-1, 1].map((sign) => {
        for (let step = 4; step <= 16; step += 4) {
          const candidate = at(d + sign * step);
          if (candidate !== 15) return candidate;
        }
        return null;
      });
      return ends.includes(17) && ends.every((p) => p === 17 || p === 24);
    };
    if (!same(0)) return null;
    function boundary(sign) {
      let distance = 4;
      while (distance < 512 && same(distance * sign)) distance += 4;
      if (distance >= 512) return null;
      let lo = distance - 4,
        hi = distance;
      for (let i = 0; i < 8; i++) {
        const mid = (lo + hi) / 2;
        if (same(mid * sign)) lo = mid;
        else hi = mid;
      }
      return { inside: lo * sign, outside: hi * sign };
    }
    const ahead = boundary(1),
      behind = boundary(-1);
    if (!ahead || !behind) return null;
    const floor = level.sample(
        x + dx * behind.outside,
        y + dy * behind.outside,
      ),
      lip = level.sample(x + dx * ahead.outside, y + dy * ahead.outside);
    if (
      floor.profile !== 24 ||
      !(lip.profile === 120 || (lip.profile & 7) === 7)
    )
      return null;
    const progress = Math.max(
      0,
      Math.min(1, -behind.inside / (ahead.inside - behind.inside)),
    );
    return {
      rawProfile: profile,
      profile: (profile & 56) + Math.min(6, 1 + Math.floor(progress * 6)),
      progress,
      upDirection: profile === 1 ? 2 : 10,
      returnDirection: profile === 1 ? 10 : 2,
      copingProfile: (profile & 56) | 7,
      distance: ahead.inside,
      floor: { x: x + dx * behind.inside, y: y + dy * behind.inside },
      lip: { x: x + dx * ahead.inside, y: y + dy * ahead.inside },
    };
  }
  function heading(angle, tables) {
    let best = Infinity,
      result = 0;
    for (let d = 0; d < 16; d++) {
      const a = Math.atan2(-tables.y[d], tables.x[d]),
        difference = Math.abs(
          Math.atan2(Math.sin(angle - a), Math.cos(angle - a)),
        );
      if (difference < best) {
        best = difference;
        result = d;
      }
    }
    return result;
  }
  /** The south wall is behind the foreground rail in ramp-1.png. Its raw
   * terrain plane runs into the wooden face. Project its height so the lip
   * meets the original white coping pixels at y=x/2+382 (not that face).
   * This artwork-space adapter leaves the ROM motion/animation state intact.
   */
  function riseForWall(level, wall, progress = wall?.progress) {
    if (level?.name !== "ramp-1" || wall?.rawProfile !== 17) return 0;
    const height = Math.max(0, wall.lip.y - wall.lip.x * 0.5 - 382);
    return height * Math.max(0, Math.min(1, progress));
  }
  function groundRise(level, player) {
    if (level?.name !== "ramp-1") return 0;
    if (player.copingReturn)
      return player.copingReturn.rise * (1 - player.copingReturn.t);
    const flight = player.halfpipeFlight;
    return flight
      ? (flight.projectedRise ?? riseForWall(level, flight.wall, 1))
      : riseForWall(level, wallAt(level, player.x, player.y));
  }
  function projectSlopePoint(level, point) {
    if (level?.name !== "ramp-1") return point;
    let wall = wallAt(level, point.x, point.y);
    // Contour vertices lie on tile boundaries; consult the inside sample
    // rather than dropping the projection at those exact boundary pixels.
    if (!wall)
      for (const [dx, dy] of [
        [0.05, 0],
        [-0.05, 0],
        [0, 0.05],
        [0, -0.05],
        [2, -1],
        [-2, 1],
        [4, 0],
        [-4, 0],
        [0, 4],
        [0, -4],
        [8, 4],
        [-8, -4],
        [16, 8],
        [-16, -8],
      ]) {
        const candidate = wallAt(level, point.x + dx, point.y + dy);
        if (candidate?.rawProfile === 17) {
          wall = candidate;
          break;
        }
      }
    if (wall?.rawProfile !== 17) return point;
    const q = point.y - point.x * 0.5,
      floorQ = wall.floor.y - wall.floor.x * 0.5,
      lipQ = wall.lip.y - wall.lip.x * 0.5;
    const progress = (q - floorQ) / (lipQ - floorQ);
    return { ...point, y: point.y - riseForWall(level, wall, progress) };
  }
  /** Recover the whole available lip from the decoded wall, including its
   * staircase corners. Tangential travel is bounded by the real ramp ends.
   */
  function copingAt(level, x, y, profile) {
    const sign = profile === 1 ? -1 : 1;
    for (let inset = 0; inset <= 16; inset += 2) {
      const wall = wallAt(level, x + sign * inset, y - sign * inset * 0.5);
      if (wall?.rawProfile === profile && wall.progress > 0.5) return wall;
    }
    return null;
  }
  function copingSpan(level, wall) {
    const { x, y } = wall.lip;
    // Full original-art white cap extents. Floor-ray admission is narrower
    // near the foreground/brick ends and must not truncate a grind's rail.
    if (level.name === "ramp-1")
      return {
        minX: wall.rawProfile === 1 ? 712 : 424,
        maxX: wall.rawProfile === 1 ? 928 : 640,
        q: y - x * 0.5,
      };
    const end = (sign) => {
      let lo = 0,
        hi = 4;
      while (
        hi < 1024 &&
        copingAt(level, x + sign * hi, y + sign * hi * 0.5, wall.rawProfile)
      ) {
        lo = hi;
        hi += 4;
      }
      for (let i = 0; i < 8; i++) {
        const mid = (lo + hi) * 0.5;
        if (
          copingAt(level, x + sign * mid, y + sign * mid * 0.5, wall.rawProfile)
        )
          lo = mid;
        else hi = mid;
      }
      return x + sign * lo;
    };
    return { minX: end(-1), maxX: end(1), q: y - x * 0.5 };
  }
  function returnPath(level, point, wall, rise) {
    let floor = null,
      distance = Infinity;
    const sign = wall.rawProfile === 1 ? -1 : 1;
    for (let dy = -256; dy <= 256; dy += 8)
      for (let dx = -256; dx <= 256; dx += 8) {
        if (sign * (dx - dy * 0.5) <= 0) continue;
        const d = dx * dx + dy * dy;
        if (d >= distance) continue;
        const x = Math.floor((point.x + dx) / 8) * 8 + 4,
          y = Math.floor((point.y + dy) / 8) * 8 + 4;
        if (
          [
            [0, 0],
            [-4, 0],
            [4, 0],
            [0, -4],
            [0, 4],
          ].every(([a, b]) => {
            const s = level.sample(x + a, y + b);
            return (
              s.profile === 24 && !level.contactSample(x + a, y + b).blocked
            );
          })
        ) {
          floor = { x, y };
          distance = d;
        }
      }
    if (!floor) return null;
    return {
      from: { ...point },
      floor,
      control: { x: point.x, y: floor.y },
      rise,
      t: 0,
      length: Math.max(1, Math.hypot(floor.x - point.x, floor.y - point.y)),
      rawProfile: wall.rawProfile,
    };
  }
  function returnPoint(path, t) {
    return {
      x:
        (1 - t) ** 2 * path.from.x +
        2 * (1 - t) * t * path.control.x +
        t * t * path.floor.x,
      y:
        (1 - t) ** 2 * path.from.y +
        2 * (1 - t) * t * path.control.y +
        t * t * path.floor.y,
    };
  }
  const api = Object.freeze({
    wallAt,
    heading,
    groundRise,
    riseForWall,
    projectSlopePoint,
    copingAt,
    copingSpan,
    returnPath,
    returnPoint,
  });
  if (typeof module !== "undefined") module.exports = api;
  else window.Skate720.Halfpipe = api;
})();
