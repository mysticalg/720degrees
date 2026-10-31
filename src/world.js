/** Course geometry and collision shapes. The rules are newly written JavaScript;
 * the PNG sprites/scenery are decoded from the original arcade ROM.
 */
(() => {
  const S = window.Skate720;
  S.makeCity = () => ({
    width: 6144,
    height: 3072,
    level: S.Levels.get("city"),
    spawn: { x: 3072, y: 1704 },
    // Centers of the four connected type1 entrance pads in the ROM map.
    gates: [
      { kind: "ramp", x: 4312, y: 534 },
      { kind: "downhill", x: 1576, y: 662 },
      { kind: "jump", x: 1176, y: 2358 },
      { kind: "slalom", x: 5224, y: 2230 },
    ],
    shops: [
      { kind: "helmet", x: 2750, y: 350, label: "HELMETS", price: 100 },
      { kind: "shoes", x: 5560, y: 1500, label: "SHOES", price: 100 },
      { kind: "board", x: 650, y: 1510, label: "BOARDS", price: 100 },
      { kind: "pads", x: 3330, y: 2990, label: "PADS", price: 100 },
    ],
    ramps: [],
    // Solid actor contact uses recovered masks in the game contact stage.
    obstacles: [],
  });
  S.makeEvent = (kind, round, experienced = false, originalClass = null) => {
    const level = S.Levels.course(kind, round, experienced, originalClass);
    const difficulty =
      originalClass ??
      Math.min(10, 1 + (round - 1) * 2 + (experienced ? 3 : 0));
    const course = {
      kind,
      round,
      difficulty,
      level,
      width: level.width,
      height: level.height,
      timer: Math.max(55, level.height / 75),
      elapsed: 0,
      points: 0,
      gatesHit: 0,
      nextGate: 0,
      finished: false,
      passed: new Set(),
      rampHits: 0,
      jumpsLanded: 0,
      crashes: 0,
    };
    if (kind === "slalom" || kind === "downhill") {
      const selector = kind === "slalom" ? 0 : 1;
      course.originalRaceCounter = S.OriginalRoutines.initialRaceCounter(
        selector,
        difficulty,
      );
      course.timer = course.originalRaceCounter;
    }
    if (kind === "ramp") course.timer = 45;
    const start = level.start.y + 170,
      end = level.finish?.y - 100 || start + 1000;
    course.gates = Array.from({ length: 10 }, (_, index) => {
      const y = start + ((end - start) * index) / 9;
      return { x: level.centerAt(y), y, hit: false, missed: false };
    });
    if (kind === "slalom") {
      const variant = Number(level.name.split("-").at(-1)) - 1;
      course.actors = S.SLALOM_DATA[variant].map((actor) => ({
        ...actor,
        // B5EE-B5F2's allocated-sprite route state, before C618 setup.
        routeFlags: 4,
        duration: 0,
      }));
      // The checkpoints now coincide with the original placed flags rather
      // than ten guessed points spread uniformly down the map.
      course.gates = course.actors
        .filter((actor) => actor.kind !== 25)
        .map((actor) => ({
          x: actor.actorX,
          y: actor.actorY,
          actor,
          hit: false,
          missed: false,
        }));
      // Original6110 mask describes passage beside each flag, rather than
      // a radius around its pole. Keep placement order through course bends.
      for (const gate of course.gates)
        gate.companion = course.actors.find(
          (a) => a.kind === 25 && a.packed === gate.actor.packed,
        );
    }
    // Launch and target regions come from the ROM's original gap tiles (type 18).
    course.ramps = level.launches || [];
    course.targets =
      kind === "jump" ? [...(level.targets || []), level.finish] : [];
    return course;
  };
})();
