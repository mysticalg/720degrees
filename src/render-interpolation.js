/** Presentation between fixed60Hz simulation ticks. No physics state is changed.
 * Only positions interpolate; original sprite frames, contact masks and timers
 * stay discrete. Resets, park changes and large recovery teleports snap.
 */
(() => {
  const point = (object, fields) => ({
    source: object,
    values: Object.fromEntries(
      fields.map((field) => [field, object[field] || 0]),
    ),
  });
  const playerFields = ["x", "y", "z"];
  const actorFields = ["actorX", "actorY", "height"];
  const cameraFields = ["x", "y"];
  function capture(game) {
    return {
      mode: game.mode,
      event: game.event,
      player: point(game.player, playerFields),
      camera: point(game.camera, cameraFields),
      actors: new Map(
        [...game.cityActors, ...game.trafficActors].map((actor) => [
          actor,
          point(actor, actorFields),
        ]),
      ),
      bees: game.bees ? point(game.bees, cameraFields) : null,
    };
  }
  function blend(object, previous, fields, alpha) {
    if (!previous || object !== previous.source) return object;
    // Recovery/teleport is a state change, not a path through the scenery.
    if (
      fields.some(
        (field) => Math.abs((object[field] || 0) - previous.values[field]) > 64,
      )
    )
      return object;
    const result = { ...object };
    for (const field of fields)
      result[field] =
        previous.values[field] +
        ((object[field] || 0) - previous.values[field]) * alpha;
    return result;
  }
  function view(game, previous, fraction = 1) {
    const alpha = Math.max(0, Math.min(1, fraction));
    if (
      !previous ||
      alpha === 1 ||
      game.paused ||
      previous.mode !== game.mode ||
      previous.event !== game.event
    )
      return game;
    // Inherit the current score/rules while replacing positions in this
    // disposable render view. Never write interpolated values into game.
    const result = Object.create(game);
    result.player = blend(game.player, previous.player, playerFields, alpha);
    result.camera = blend(game.camera, previous.camera, cameraFields, alpha);
    const actors = (list) =>
      list.map((actor) =>
        blend(actor, previous.actors.get(actor), actorFields, alpha),
      );
    result.cityActors = actors(game.cityActors);
    result.trafficActors = actors(game.trafficActors);
    result.bees = game.bees
      ? blend(game.bees, previous.bees, cameraFields, alpha)
      : null;
    return result;
  }
  const api = Object.freeze({ capture, view });
  if (typeof module !== "undefined") module.exports = api;
  else window.Skate720.RenderInterpolation = api;
})();
