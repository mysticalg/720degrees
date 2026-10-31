/** Halfpipe map adapter. ROM artwork marks whole curved walls1/17; these
 * scans locate each lane's floor and coping instead of a guessed pipe box.
 * The original slope/pose tables then supply its seven inclination bands.
 */
(() => {
  // Native geometry adapter: the original map marks an entire wall with one
  // profile. Separate its curved approach from its short upper vert section.
  // Keep the original six coefficient/pose entries; only their coverage changes.
  const VERT_START = 0.7;
  function inclination(progress) {
    const p = Math.max(0, Math.min(1, progress));
    return p < VERT_START
      ? Math.min(4, 1 + Math.floor((p / VERT_START) * 4))
      : Math.min(6, 5 + Math.floor(((p - VERT_START) / (1 - VERT_START)) * 2));
  }
  // Integrate a rising gradient through the lower curve, then maintain the
  // upper vert gradient. Position and tangent meet continuously at the join.
  // The endpoints stay pinned to the decoded floor and original white coping.
  function heightProgress(progress) {
    const p = Math.max(0, Math.min(1, progress)),
      t = VERT_START,
      lower = t / (2 - t);
    return p < t
      ? lower * (p / t) ** 2
      : lower + ((1 - lower) * (p - t)) / (1 - t);
  }
  function widthProgress(progress) {
    const p = Math.max(0, Math.min(1, progress)) / VERT_START;
    return p < 1 ? 2 * p - p * p : 1;
  }
  /** The foreground wall needs both axes: a curved approach ends tangent
   * to an actual vertical section. Its feet, shadow, camera and F8 mesh all
   * use this one projection, with the original white coping held fixed.
   */
  function southOffsets(wall, progress, height) {
    const p = Math.max(0, Math.min(1, progress)),
      dx = wall.lip.x - wall.floor.x,
      dy = wall.lip.y - wall.floor.y;
    // Keep the artwork's horizontal extent, but project that ground travel
    // on the same isometric axis as the flat floor. Elevation is a separate
    // smooth term. Independent X/Y curves previously invented lateral drift
    // and changed the tangent abruptly at the foot of the wall.
    const acrossX = 16 + (dx - 16) * widthProgress(p);
    return {
      x: acrossX - dx * p,
      y: -acrossX * 0.5 - height * heightProgress(p) - dy * p,
    };
  }
  // The far wall's panel seams turn upward into the vert. Its coarse ROM
  // plane omits that artwork projection:100px of height at the coping.
  // This maps a seam from636,590 to712,452, keeping the white lip q=96.
  function northOffsets(wall, progress) {
    const p = Math.max(0, Math.min(1, progress));
    const dx = wall.lip.x - wall.floor.x,
      dy = wall.lip.y - wall.floor.y;
    const across = (dx - 100) * widthProgress(p);
    return {
      x: across - dx * p,
      y: -across * 0.5 - 100 * heightProgress(p) - dy * p,
    };
  }
  function wallAt(level, x, y) {
    if (level.name === "ramp-1") {
      const q = y - x * 0.5;
      const northLipX = x + q - 96;
      // Full art-aligned far wall: its left panel runs from636,590 on the
      // floor to712,452 at the white coping; other lanes translate32,16.
      if (q >= 96 && q <= 272 && northLipX >= 812 && northLipX <= 1028) {
        const progress = (272 - q) / 176;
        return {
          rawProfile: 1,
          profile: inclination(progress),
          progress,
          stage: progress < VERT_START ? "curve" : "vert",
          upDirection: 2,
          returnDirection: 10,
          copingProfile: 7,
          distance: q - 96,
          floor: { x: northLipX - 176, y: (northLipX - 176) * 0.5 + 272 },
          lip: { x: northLipX, y: northLipX * 0.5 + 96 },
        };
      }
      const lipX = x + q - 448;
      // The original front railing overwrites the last riding tiles. Admit
      // the complete finite art-derived surface, including its right corner.
      if (q >= 400 && q <= 448 && lipX >= 424 && lipX <= 640) {
        const progress = (q - 400) / 48;
        return {
          rawProfile: 17,
          profile: 16 + inclination(progress),
          progress,
          stage: progress < VERT_START ? "curve" : "vert",
          upDirection: 10,
          returnDirection: 2,
          copingProfile: 23,
          distance: 448 - q,
          floor: { x: x + q - 400, y: y - (q - 400) * 0.5 },
          lip: { x: lipX, y: y + (448 - q) * 0.5 },
        };
      }
    }
    const raw = level.sample(x, y).profile;
    if (level.name === "ramp-1" && raw === 1) return null;
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
    let progress = Math.max(
      0,
      Math.min(1, -behind.inside / (ahead.inside - behind.inside)),
    );
    let floorPoint = { x: x + dx * behind.inside, y: y + dy * behind.inside },
      lipPoint = { x: x + dx * ahead.inside, y: y + dy * ahead.inside },
      distance = ahead.inside;
    if (level.name === "ramp-1") {
      // The ROM grid stair-steps each lane by up to8px. Use continuous
      // diagonal planes through those decoded boundaries for the rideable
      // wall, retaining the scans above for finite-wall/fence admission.
      const q = y - x * 0.5,
        floorQ = profile === 1 ? 272 : 400,
        lipQ = profile === 1 ? 96 : 448,
        rate = dy - dx * 0.5,
        toFloor = (floorQ - q) / rate,
        toLip = (lipQ - q) / rate;
      if (
        profile === 17 &&
        (q < 400 || q > 448 || x + dx * toLip < 424 || x + dx * toLip > 640)
      )
        return null;
      progress = Math.max(0, Math.min(1, (q - floorQ) / (lipQ - floorQ)));
      floorPoint = { x: x + dx * toFloor, y: y + dy * toFloor };
      lipPoint = { x: x + dx * toLip, y: y + dy * toLip };
      distance = Math.max(0, toLip);
    }
    return {
      rawProfile: profile,
      profile: (profile & 56) + inclination(progress),
      stage: progress < VERT_START ? "curve" : "vert",
      progress,
      upDirection: profile === 1 ? 2 : 10,
      returnDirection: profile === 1 ? 10 : 2,
      copingProfile: (profile & 56) | 7,
      distance,
      floor: floorPoint,
      lip: lipPoint,
    };
  }
  const transitionCache = new WeakMap();
  function transitionSegments(level) {
    if (level.name !== "ramp-1") return [];
    if (transitionCache.has(level)) return transitionCache.get(level);
    const segments = [];
    for (const raw of [1, 17]) {
      const floorQ = raw === 1 ? 272 : 400,
        lipQ = raw === 1 ? 96 : 448,
        q = floorQ + (lipQ - floorQ) * VERT_START;
      let previous = null;
      for (let x = 0; x <= level.width; x += 2) {
        const y = x * 0.5 + q,
          wall = wallAt(level, x, y);
        if (wall?.rawProfile !== raw) {
          previous = null;
          continue;
        }
        const point = projectSlopePoint(level, { x, y });
        if (previous) segments.push({ a: previous, b: point });
        previous = point;
      }
    }
    transitionCache.set(level, segments);
    return segments;
  }
  function travelScale(level, wall) {
    if (level?.name !== "ramp-1" || wall?.rawProfile !== 17) return 1;
    return 48 / 176;
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
    if (level?.name !== "ramp-1" || !wall) return 0;
    if (wall.rawProfile === 1) return -northOffsets(wall, progress).y;
    if (wall.rawProfile !== 17) return 0;
    const height = Math.max(0, wall.lip.y - wall.lip.x * 0.5 - 382);
    return -southOffsets(wall, progress, height).y;
  }
  function flatSouthOffset(level, point) {
    if (
      level?.name !== "ramp-1" ||
      level.sample(point.x, point.y).profile !== 24
    )
      return { x: 0, y: 0 };
    const smooth = (v) => {
      v = Math.max(0, Math.min(1, v));
      return v * v * (3 - 2 * v);
    };
    const q = point.y - point.x * 0.5,
      lipX = point.x + q - 448;
    const weight =
      smooth((q - 320) / 80) *
      smooth((lipX - 408) / 16) *
      smooth((656 - lipX) / 16);
    // A flat-floor correction may move across the pipe, never along it.
    return { x: 16 * weight, y: -8 * weight };
  }
  function returnProjection(level, path) {
    const floor = flatSouthOffset(level, path.floor),
      p = 1 - path.t,
      fx = path.floor.x + floor.x,
      fy = path.floor.y + floor.y;
    const fromX = path.from.x - (path.rawProfile === 1 ? 100 : 0);
    const dx = (fromX - fx) * widthProgress(p);
    const rise = path.from.y - path.rise - fy + (fromX - fx) * 0.5;
    return {
      x: fx + dx,
      y: fy - dx * 0.5 + rise * heightProgress(p),
    };
  }
  function groundRise(level, player) {
    if (level?.name !== "ramp-1") return 0;
    if (player.copingReturn)
      return player.y - returnProjection(level, player.copingReturn).y;
    const flight = player.halfpipeFlight;
    if (flight)
      return flight.projectedRise ?? riseForWall(level, flight.wall, 1);
    const wall = wallAt(level, player.x, player.y);
    return wall ? riseForWall(level, wall) : -flatSouthOffset(level, player).y;
  }
  function groundShift(level, player) {
    if (level?.name !== "ramp-1") return 0;
    if (player.halfpipeFlight)
      return player.halfpipeFlight.wall.rawProfile === 1 ? -100 : 0;
    if (player.copingReturn)
      return returnProjection(level, player.copingReturn).x - player.x;
    const wall = wallAt(level, player.x, player.y);
    return wall?.rawProfile === 1
      ? northOffsets(wall, wall.progress).x
      : wall?.rawProfile === 17
        ? southOffsets(wall, wall.progress, 0).x
        : flatSouthOffset(level, player).x;
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
        if ([1, 17].includes(candidate?.rawProfile)) {
          wall = candidate;
          break;
        }
      }
    if (wall?.rawProfile === 1) {
      const offset = northOffsets(wall, wall.progress);
      return { ...point, x: point.x + offset.x, y: point.y + offset.y };
    }
    if (wall?.rawProfile !== 17) {
      const offset = flatSouthOffset(level, point);
      return { ...point, x: point.x + offset.x, y: point.y + offset.y };
    }
    // Clip raster contour vertices to the actual finite curve, not stray
    // foreground alias tiles beyond the right/left ramp end.
    const sourceQ = point.y - point.x * 0.5,
      clippedQ = Math.max(400, Math.min(448, sourceQ)),
      lipX = point.x + sourceQ - 448,
      along = Math.max(424, Math.min(640, lipX)) - lipX,
      across = clippedQ - sourceQ;
    point = {
      ...point,
      x: point.x + along - across,
      y: point.y + along * 0.5 + across * 0.5,
    };
    const q = point.y - point.x * 0.5,
      floorQ = wall.floor.y - wall.floor.x * 0.5,
      lipQ = wall.lip.y - wall.lip.x * 0.5;
    const progress = (q - floorQ) / (lipQ - floorQ);
    return {
      ...point,
      x: point.x + southOffsets(wall, progress, 0).x,
      y: point.y - riseForWall(level, wall, progress),
    };
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
              s.profile === 24 &&
              !level.halfpipeWallAt?.(x + a, y + b) &&
              !level.contactSample(x + a, y + b).blocked
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
      length:
        level.name === "ramp-1"
          ? 176 * Math.sqrt(1.25)
          : Math.max(1, Math.hypot(floor.x - point.x, floor.y - point.y)),
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
    inclination,
    heightProgress,
    VERT_START,
    transitionSegments,
    heading,
    travelScale,
    groundRise,
    groundShift,
    widthProgress,
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
