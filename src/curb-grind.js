/** Native curb grinds on the same continuous contours shown by F8.
 * Distances use the isometric ground plane (screen Y doubled). This adds
 * gameplay over recovered curb geometry; it is not a claimed ROM routine.
 */
(() => {
  const caches = new WeakMap();
  const key = (p) => `${p.x},${p.y}`;
  const vector = (edge) => {
    const x = edge.b.x - edge.a.x,
      y = (edge.b.y - edge.a.y) * 2;
    const length = Math.hypot(x, y);
    return { x: x / length, y: y / length, length };
  };
  function graph(mesh) {
    if (caches.has(mesh)) return caches.get(mesh);
    const links = new Map();
    for (const edge of mesh.segments)
      for (const p of [edge.a, edge.b]) {
        const k = key(p);
        if (!links.has(k)) links.set(k, []);
        links.get(k).push(edge);
      }
    caches.set(mesh, links);
    return links;
  }
  function acquire(mesh, player, radius = 14) {
    if (
      !mesh ||
      player.bail ||
      player.fallen > 0 ||
      player.vehicleTow ||
      (player.air && (player.z > 10 || player.vz > 0))
    )
      return null;
    const speed = Math.hypot(player.vx, player.vy * 2);
    if (speed < 80) return null;
    let best = null,
      cost = Infinity;
    const candidates = new Set();
    for (
      let row = Math.floor((player.y - radius) / 32);
      row <= Math.floor((player.y + radius) / 32);
      row++
    )
      for (const edge of mesh.buckets.get(row) || []) candidates.add(edge);
    for (const edge of candidates) {
      const v = vector(edge);
      if (!v.length) continue;
      const along =
        (player.x - edge.a.x) * v.x + (player.y - edge.a.y) * 2 * v.y;
      // End caps are not magnets: entry must overlap the finite rail.
      if (along < 0 || along > v.length) continue;
      const x = edge.a.x + along * v.x,
        y = edge.a.y + (along * v.y) / 2;
      const distance = Math.hypot(player.x - x, (player.y - y) * 2);
      const alignment = (player.vx * v.x + player.vy * 2 * v.y) / speed;
      if (distance > radius || Math.abs(alignment) < 0.45) continue;
      const score = distance + (1 - Math.abs(alignment)) * 4;
      if (score >= cost) continue;
      const sign = alignment < 0 ? -1 : 1;
      best = {
        mesh,
        edge,
        along,
        sign,
        speed: speed * 0.95,
        x,
        y,
        vx: v.x * sign * speed * 0.95,
        vy: (v.y * sign * speed * 0.95) / 2,
      };
      cost = score;
    }
    return best;
  }
  function step(state, dt) {
    state.speed *= Math.exp(-dt * 0.28);
    let travel = state.speed * dt;
    const links = graph(state.mesh);
    state.finished = state.speed < 55;
    for (let hops = 0; !state.finished && travel > 0 && hops < 32; hops++) {
      const v = vector(state.edge);
      const remaining = state.sign > 0 ? v.length - state.along : state.along;
      const used = Math.min(travel, remaining);
      state.along += used * state.sign;
      travel -= used;
      state.x = state.edge.a.x + state.along * v.x;
      state.y = state.edge.a.y + (state.along * v.y) / 2;
      state.vx = v.x * state.sign * state.speed;
      state.vy = (v.y * state.sign * state.speed) / 2;
      if (travel <= 0) break;
      const end = state.sign > 0 ? state.edge.b : state.edge.a;
      let next = null,
        dot = 0.9;
      for (const edge of links.get(key(end)) || []) {
        if (edge === state.edge) continue;
        const w = vector(edge),
          sign = key(edge.a) === key(end) ? 1 : -1;
        const alignment = (v.x * w.x + v.y * w.y) * state.sign * sign;
        if (alignment > dot) {
          next = { edge, sign, length: w.length };
          dot = alignment;
        }
      }
      // Follow a continuous rail, but leave at its end or a sharp corner.
      if (!next) {
        state.finished = true;
        break;
      }
      state.edge = next.edge;
      state.sign = next.sign;
      state.along = next.sign > 0 ? 0 : next.length;
    }
    return state;
  }
  const api = Object.freeze({ acquire, step });
  if (typeof module !== "undefined") module.exports = api;
  else window.Skate720.CurbGrind = api;
})();
