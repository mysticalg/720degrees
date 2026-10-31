/** Shared constants. All distances are screen-space world pixels; time is seconds. */
window.Skate720 = {};
(() => {
  const S = window.Skate720;
  S.CONFIG = Object.freeze({
    version: "0.86",
    width: 512,
    height: 384,
    step: 1 / 60,
    // Native wall-plant combo: six-frame input window and one boost per plant.
    fencePlantWindow: 6,
    fencePlantImpulse: 0.8,
    fencePlantExtraImpulse: 0.6,
    fencePlantSpeedBoost: 1.12,
    // Original fixed-point travel scale; arbitrary pace boost disabled for exact-physics work.
    skatingPace: 1,
    // User-requested native fakie assists, separate from original ROM tables.
    fakieJumpBoost: 1.03,
    fakieTopSpeed: 1.05,
    // Small native downhill push per fresh press, above the flat kick envelope.
    downhillKickImpulse: 48,
    downhillKickLimit: 2400,
    cityTime: 45,
    beeGrace: 18,
    rounds: 4,
  });
  S.PARKS = ["ramp", "downhill", "jump", "slalom"];
  S.COLORS = {
    ramp: "#fda729",
    downhill: "#f87142",
    jump: "#31d5cf",
    slalom: "#bcdf36",
  };
  S.clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  S.distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  S.angleDelta = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  S.format = (value) => Math.floor(value).toLocaleString("en-US");
})();
