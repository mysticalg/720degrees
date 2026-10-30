/** Halfpipe map adapter. ROM artwork marks whole curved walls1/17; these
 * scans locate each lane's floor and coping instead of a guessed pipe box.
 * The original slope/pose tables then supply its seven inclination bands.
 */
(() => {
  function wallAt(level, x, y) {
    const profile = level.sample(x, y).profile;
    if (profile !== 1 && profile !== 17) return null;
    const sign = profile === 1 ? 1 : -1,
      dx = sign,
      dy = -sign * 0.5;
    const same = (d) =>
      level.sample(x + dx * d, y + dy * d).profile === profile;
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
  const api = Object.freeze({ wallAt, heading });
  if (typeof module !== "undefined") module.exports = api;
  else window.Skate720.Halfpipe = api;
})();
