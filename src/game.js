/** Native game simulation. No ROM instructions are executed by this file.
 * Rendering is deliberately separate so fixed-step tests can inspect the rules.
 */
(() => {
  const S = window.Skate720;
  class Game {
    constructor(input, audio) {
      this.input = input;
      this.audio = audio;
      this.motionDirectory = Uint8Array.from(atob(S.MOTION_BANKS[0]), (c) =>
        c.charCodeAt(0),
      );
      const sprites = S.MOTION_BANKS.slice(1).map((bank) =>
        Uint8Array.from(atob(bank), (byte) => byte.charCodeAt(0)),
      );
      this.actorMemory = {
        readTypeWord: (address) => {
          const index = address - 0x4000;
          if (index < 0 || index + 1 >= this.motionDirectory.length)
            throw Error("City actor directory outside decoded data");
          return (
            this.motionDirectory[index] | (this.motionDirectory[index + 1] << 8)
          );
        },
        readSpriteByte: (address) => {
          if (address < 0x4000 || address >= 0x8000)
            throw Error("Actor motion prefix outside decoded sprite banks");
          return sprites[address < 0x6000 ? 0 : 1][address & 8191];
        },
      };
      this.city = S.makeCity();
      this.cracks = [];
      this.cityActors = [];
      this.trafficActors = [];
      this.mode = "title";
      this.practice = false;
      this.camera = { x: 3072, y: 1660 };
      this.elapsed = 0;
      this.floats = [];
      this.message = "WELCOME TO SKATE CITY";
      this.messageTime = 0;
      this.resetPlayer(3072, 1704);
      this.mapFrames = 0;
      this.mapVisitMask = 0;
      this.mapDifficulty = 1;
      this.score = 0;
      this.cash = 100;
      this.tickets = 1;
      this.lives = 3;
      this.gear = { helmet: 0, shoes: 0, board: 0, pads: 0 };
      this.shopState = {
        stockMask: 0,
        attemptMask: 0,
        visitMask: 0,
        stage: 0,
        cash: 0,
      };
      this.clears = { ramp: 0, downhill: 0, jump: 0, slalom: 0 };
      this.medals = [];
      this.highScore = 0;
      try {
        this.highScore =
          Number(localStorage.getItem("720-native-highscore")) || 0;
      } catch {}
    }
    resetPlayer(x, y) {
      this.player = {
        x,
        y,
        vx: 0,
        vy: 0,
        angle: Math.PI / 2,
        z: 0,
        vz: 0,
        air: false,
        spin: 0,
        airTime: 0,
        takeoffAngle: 0,
        cooldown: 0,
        fallen: 0,
        invulnerable: 1.5,
        kickClock: 0,
        fromRamp: false,
        lastSafe: { x, y },
      };
    }
    start(practice = false) {
      this.practice = practice;
      this.cityActors = S.CITY_ACTOR_DATA.objects.map((object) => ({
        ...object,
        pointer: object.entry,
        countdown: object.rate,
        phase: 0,
      }));
      this.cracks = S.CITY_CRACK_DATA.objects.map((object) => ({
        ...object,
        phase: 0,
        rate: 0,
        countdown: 0,
      }));
      // CFD6/D01A queue fixed objects in ROM order. Initialization below uses
      // C618-C7AE; visibility/pool scheduling is not yet applied to rendering.
      this.objectRegistry = S.OriginalObjectRegistry.createMemory(
        S.OBJECT_REGISTRY_DATA,
        (data) => Uint8Array.from(atob(data), (byte) => byte.charCodeAt(0)),
      );
      this.objectRegistry = S.OriginalActorMemory.createMemory(
        this.objectRegistry,
        S.ACTOR_TABLE_DATA,
        (data) => Uint8Array.from(atob(data), (byte) => byte.charCodeAt(0)),
      );
      // Motion, route and spawn routines now share the same ROM table readers.
      this.actorMemory = { ...this.actorMemory, ...this.objectRegistry };
      const registryServices = {
        inspect: S.OriginalActorRoutes.inspect,
        resolve: S.OriginalRoutines.resolveObjectPlacement,
      };
      for (const actor of [...this.cityActors, ...this.cracks]) {
        const placement = S.OriginalObjectRegistry.enqueue(
          actor.packed,
          actor.kind ?? 85,
          true,
          this.objectRegistry,
          registryServices,
        );
        if (placement.status !== 0)
          throw new Error("Original fixed actor placement is unavailable");
        actor.registrySlot = placement.slot;
        if (actor.kind !== undefined) {
          const initialized = {
            kind: actor.kind,
            slot: placement.slot,
            bitmapIndex: placement.bitmapIndex,
            flags: 0,
            routeFlags: 4,
          };
          const position = S.OriginalRoutines.objectCoordinates(
            actor.packed,
            placement.bitmapIndex,
            0,
            15,
            this.objectRegistry.readCoordinateOrFixedWord,
          );
          S.OriginalActorSpawning.initializeActor(
            initialized,
            position,
            0,
            this.objectRegistry,
          );
          Object.assign(actor, initialized);
          // The browser renders an unwrapped city PNG. Select the original
          // wrapping coordinate's image nearest its packed map-cell origin.
          const column = (actor.packed & 511) >> 4;
          const row = actor.packed & 15;
          const signedWord = (n) => (n << 16) >> 16;
          actor.actorX =
            column * 256 + signedWord(initialized.x - column * 256 * 64) / 64;
          actor.actorY =
            (row + 1) * 256 +
            signedWord(0xa000 - initialized.y - (row + 1) * 256 * 64) / 64;
          actor.phase = 0;
        }
      }
      // D2AE queues the original difficulty1 category1 placements. These
      // pending records now advance through C8AA/C850/C868/C0D8 off-screen.
      // Visibility-to-sprite activation remains a separate integration stage.
      this.pendingTrafficSlots = [];
      for (const object of S.ACTOR_TABLE_DATA.trafficInitial["1"]) {
        const placement = S.OriginalObjectRegistry.enqueue(
          object.packed,
          object.kind,
          false,
          this.objectRegistry,
          registryServices,
        );
        if (placement.status !== 0)
          throw new Error("Original initial traffic placement is unavailable");
        this.pendingTrafficSlots.push(placement.slot);
      }
      this.pendingTrafficMoves = 0;
      this.mode = "city";
      this.event = null;
      this.paused = false;
      this.mapFrames = 0;
      this.mapVisitMask = 0;
      this.mapDifficulty = 1;
      this.score = 0;
      this.cash = practice ? 900 : 100;
      this.tickets = practice ? 99 : 1;
      this.lives = 3;
      this.nextTicket = 3000;
      this.gear = { helmet: 0, shoes: 0, board: 0, pads: 0 };
      this.shopState = {
        stockMask: 0,
        attemptMask: 0,
        visitMask: 0,
        stage: 0,
        cash: 0,
      };
      this.clears = { ramp: 0, downhill: 0, jump: 0, slalom: 0 };
      this.medals = [];
      this.floats = [];
      this.resetPlayer(this.city.spawn.x, this.city.spawn.y);
      this.resetCityClock();
      this.camera = { x: 3072, y: 1660 };
      this.trafficActors = [];
      this.trafficRuntime = new S.TrafficRuntime(
        S,
        this.objectRegistry,
        this.actorMemory.readSpriteByte,
      );
      this.tell("SKATE CITY · JUMP + C TO SPIN · E AT A PARK", 7);
      this.audio.unlock();
      this.audio.playStartCue();
      this.changed?.();
    }
    resetCityClock() {
      this.cityTimer = S.CONFIG.cityTime;
      this.bees = null;
      this.warned = false;
    }
    tell(text, seconds = 3) {
      this.message = text;
      this.messageTime = seconds;
    }
    popup(text, x = this.player.x, y = this.player.y - 55, color = "#fff46b") {
      this.floats.push({ text, x, y, life: 1.6, color });
    }
    addScore(points, label, trackEvent = true) {
      this.score = S.OriginalRoutines.addScoreWord(this.score, points);
      if (trackEvent && this.event && this.mode === "event")
        this.event.points += points;
      if (label) this.popup(label);
      if (!this.practice && this.score >= this.nextTicket) {
        this.tickets = Math.min(4, this.tickets + 1);
        this.nextTicket += 10000;
        this.tell("PARK TICKET EARNED!", 3);
        this.audio.effect("coin");
      }
      if (this.score > this.highScore) {
        this.highScore = this.score;
        try {
          localStorage.setItem("720-native-highscore", this.highScore);
        } catch {}
      }
    }
    available(kind) {
      return (
        this.practice ||
        this.clears[kind] === Math.min(...Object.values(this.clears))
      );
    }
    /** Contact flags5..8 select a shop region. The original5326 consumes
     * scrolling map fields; nearest wrapped region adapts the full city PNG.
     */
    shopAt(x, y) {
      const distance = (shop) => {
        const dx = Math.abs(x - shop.x),
          dy = Math.abs(y - shop.y);
        return (
          Math.min(dx, this.city.width - dx) ** 2 +
          Math.min(dy, this.city.height - dy) ** 2
        );
      };
      return this.city.shops.reduce((best, shop) =>
        distance(shop) < distance(best) ? shop : best,
      );
    }
    nearestInteraction() {
      if (this.mode !== "city") return null;
      const candidates = [
        ...this.city.gates.map((g) => ({ ...g, type: "park" })),
      ];
      return (
        candidates
          .filter((object) => S.distance(this.player, object) < 115)
          .sort(
            (a, b) => S.distance(this.player, a) - S.distance(this.player, b),
          )[0] || null
      );
    }
    interact(target = this.nearestInteraction()) {
      if (this.mode !== "city") return;
      if (!target) {
        this.tell("FOLLOW A PARK ARROW · E TO ENTER", 2);
        return;
      }
      if (target.type === "shop") {
        // Purchase only on a coded shop pad, including optional legacy E use.
        const surface = this.city.level.contactSample(
          this.player.x,
          this.player.y,
        );
        if (surface.type < 5 || surface.type > 8) return;
        const shop = this.shopAt(this.player.x, this.player.y);
        const index = S.OriginalEquipment.kinds.indexOf(shop.kind);
        if (this.shopState.cash !== this.cash) this.shopState.attemptMask = 0;
        // User-requested visit policy: each item can be bought once, rather
        // than5602 closing every previously owned item after a purchase.
        this.shopState.stockMask =
          S.OriginalEquipment.stockMask(this.gear, 3) |
          (this.shopState.visitMask || 0);
        this.shopState.cash = this.cash;
        this.shopState.stage = Math.min(15, this.medals.length);
        const result = S.OriginalEquipment.purchase(
          this.shopState,
          index,
          this.gear,
          S.EQUIPMENT_DATA,
        );
        this.cash = this.shopState.cash;
        if (result.status === "purchased") {
          this.shopState.visitMask =
            (this.shopState.visitMask || 0) | (1 << index);
          this.audio.effect("coin");
          this.tell(`${shop.label} LEVEL ${result.level} · $${result.cost}`, 3);
        } else if (result.status === "funds")
          this.tell(`NEED $${result.cost} · WIN MEDALS TO EARN CASH`, 3);
        return;
      }
      if (!this.available(target.kind)) {
        this.tell("COMPLETE THE OTHER PARKS IN THIS ROUND FIRST", 3);
        return;
      }
      if (this.tickets < 1) {
        this.tell("NEED A TICKET · JUMP AND SPIN TO EARN POINTS", 3);
        return;
      }
      if (!this.practice) this.tickets--;
      this.event = S.makeEvent(
        target.kind,
        this.clears[target.kind] + 1,
        this.experienced,
      );
      this.mode = "event";
      const spawn = this.event.level.start;
      this.resetPlayer(spawn.x, spawn.y);
      this.player.angle =
        target.kind === "ramp"
          ? -0.55
          : Math.atan2(100, this.event.level.centerAt(spawn.y + 100) - spawn.x);
      this.camera = { x: this.player.x, y: this.player.y };
      this.audio.effect("coin");
      const help = {
        ramp: "HALF PIPE · KICK TOWARD EITHER LIP · JUMP + SPIN",
        downhill: "RACE DOWNHILL · STAY ON THE ROAD",
        jump: "JUMP AT THE RAMP · LAND INSIDE THE TARGET",
        slalom: "PASS BETWEEN THE FLAGS · KICK FOR SPEED",
      };
      this.tell(help[target.kind], 6);
      this.changed?.();
    }
    /** Jump velocity sets height; horizontal momentum is retained in the air. */
    jump() {
      const p = this.player;
      if (
        p.air ||
        p.fallen > 0 ||
        p.cooldown > 0 ||
        p.jumpRecovery ||
        p.jumpSequence
      )
        return;
      const level = this.event?.level || this.city.level;
      const wall =
        this.event?.kind === "ramp" ? S.Halfpipe.wallAt(level, p.x, p.y) : null;
      if (wall && wall.progress > 0.55 && !p.halfpipeReturning) {
        p.halfpipeJumpQueued = 20;
        return;
      }
      const here = level.contactSample(p.x, p.y);
      // E344 admits profiles0..2. Their vertical coefficient determines
      // whether E366 selects immediate rising-surface takeoff or anticipation.
      if (
        (here.type === 0 ||
          (!this.event && [5, 6, 7, 8, 17].includes(here.type)) ||
          (["downhill", "jump"].includes(this.event?.kind) &&
            here.type === 16) ||
          (!this.event && here.type >= 128 && here.profile === 32) ||
          (this.event?.kind === "ramp" &&
            ([9, 13].includes(here.type) ||
              (here.type >= 128 && [16, 120].includes(here.profile))))) &&
        S.OriginalRoutines.jumpRequestAllowed(2, 1, here.profile, 0)
      ) {
        const rom = S.OriginalGround,
          reader = rom.terrainTableReader(S.TERRAIN_TABLES);
        const coefficient = rom.surfaceCoefficients(
          p.romDirection ?? 4,
          here.profile,
          1,
          { slalom: 1, downhill: 2, ramp: 3, jump: 4 }[this.event?.kind] || 0,
          p.romSpeed || 0,
          Math.min(3, this.gear.board),
          reader.readByte,
          reader.readWord,
        );
        const vertical = rom.surfaceVerticalMotion(
          p.romSpeed || 0,
          coefficient.vertical,
        );
        p.jumpSequence = S.OriginalRoutines.beginSurfaceJumpAnimation(
          p.romSpeed || 0,
          vertical.velocity,
          Math.min(3, this.gear.shoes),
        );
        p.kickAnimation = null;
        p.kickClock = 0;
        if (p.jumpSequence.risingSurface) this.launchJump();
        else {
          p.romSpeed = 0;
          p.vx = 0;
          p.vy = 0;
        }
      } else this.launchJump();
    }
    /** A864-A8B8 supplies the activation threshold and pad impulse;
     * 9F8A/9FB4 supply the pose and airborne momentum conversion.
     * Native contact rectangles initiate this translated controller.
     */
    launchFromCrack(crack) {
      const p = this.player,
        data = S.CITY_CRACK_DATA;
      const activated = S.OriginalCracks.activate(
        p.romSpeed || 0,
        Math.round(p.z * 64),
        0,
        p.romGroundVertical?.velocity || 0,
        this.gear.pads,
        data.padImpulses,
      );
      if (!activated) return false;
      Object.assign(crack, activated);
      // B378 also sees the newly started clock on the activation frame.
      S.OriginalCracks.tick(crack);
      const rom = S.OriginalGround,
        surface = this.city.level.contactSample(p.x, p.y);
      const motion = rom.airborneTransition(
        p.romSpeed,
        p.romDirection ?? 4,
        surface.profile,
        0,
        Math.min(3, this.gear.board),
        rom.terrainTableReader(S.TERRAIN_TABLES),
      );
      p.romSpeed = motion.mainSpeed;
      p.romMovementDirection = motion.direction;
      p.vx = ((motion.dx + motion.fractionX / 256) * 60) / 64;
      p.vy = (-(motion.dy + motion.fractionY / 256) * 60) / 64;
      p.airborneTerrainReference = motion.groundVertical;
      p.jumpGroundVertical = { velocity: 0, fraction: 0 };
      // A8A6 calls9F8A: action8/phase3, rather than the shoe-jump pose.
      p.jumpSequence = S.OriginalRoutines.beginDropAnimation(p.romSpeed);
      p.jumpSequence.savedSpeed = motion.savedSpeed & 65535;
      p.jumpAnimation = p.jumpSequence;
      p.jumpRecovery = null;
      p.cooldown = 0;
      p.kickAnimation = null;
      p.air = true;
      p.edgeContact = false;
      p.spin = 0;
      p.airTime = 0;
      p.takeoffAngle = p.angle;
      p.z = 1;
      p.romVerticalVelocity = activated.vertical;
      p.jumpLaunchVelocity = activated.vertical;
      p.vz = (activated.vertical * 60) / 64;
      p.romGravity = 12;
      p.launchSource =
        "ROM A864 crack springboard; pad impulse table7CA4; native contact";
      return true;
    }
    /** Native ledge-contact adapter: no button press and no shoe impulse.
     * Original9F98 pose state and50E0 gravity are shared with normal flight.
     * Rendering uses clearance relative to the upper takeoff plane until the
     * projected feet meet supported lower scenery. Full9C5E contact is pending.
     */
    dropFromLedge() {
      const p = this.player;
      p.dropFall = { frames: 0 };
      p.air = true;
      p.edgeContact = false;
      p.spin = 0;
      p.airTime = 0;
      p.takeoffAngle = p.angle;
      p.z = 0;
      p.romVerticalVelocity = p.romGroundVertical?.velocity || 0;
      p.jumpLaunchVelocity = p.romVerticalVelocity;
      p.romGravity = 12;
      p.jumpGroundVertical = { velocity: 0, fraction: 0 };
      p.jumpSequence = S.OriginalRoutines.beginDropAnimation(p.romSpeed || 0);
      p.jumpAnimation = p.jumpSequence;
      p.kickAnimation = null;
      p.launchSource =
        "ROM9F98 falling pose and50E0 gravity; native ledge contact";
    }
    updateDropContact() {
      const p = this.player,
        level = this.event.level;
      p.dropFall.frames++;
      const feetY = p.y - p.z,
        surface = level.contactSample(p.x, feetY);
      if (
        p.romVerticalVelocity < 0 &&
        p.z <= -4 &&
        !surface.blocked &&
        [0, 9, 10, 15, 16].includes(surface.type) &&
        (surface.profile & 7) < 3
      ) {
        p.y = feetY;
        p.dropFall = null;
        this.land();
      } else if (feetY > level.height - 20 || p.z < -320) {
        // A missed flight used to teleport to lastSafe on the launch ramp.
        // Recover beside the actual projected impact, so the camera does not
        // yank the skater back up the course. This is a native contact adapter;
        // original terrain-height/collision composition is still incomplete.
        let recovery = null;
        const impact = { x: p.x, y: feetY };
        let nearest = Infinity;
        for (let dy = -768; dy <= 768; dy += 8)
          for (let dx = -768; dx <= 768; dx += 8) {
            const distance = dx * dx + dy * dy;
            if (distance >= nearest) continue;
            const x = impact.x + dx,
              y = impact.y + dy;
            const supported = [
              [0, 0],
              [8, 0],
              [-8, 0],
              [0, 8],
              [0, -8],
            ].every(([sx, sy]) => {
              const cell = level.contactSample(x + sx, y + sy);
              return !cell.blocked && (cell.profile & 7) < 3;
            });
            if (supported) {
              recovery = { x, y };
              nearest = distance;
            }
          }
        recovery ||= p.lastSafe;
        p.dropFall = null;
        p.air = false;
        p.z = 0;
        p.x = recovery.x;
        p.y = recovery.y;
        p.lastSafe = { ...recovery };
        // Also clear the old airborne controller when invulnerability prevents
        // crash() from starting a bail. A stale action8 could block the next jump.
        p.jumpSequence = p.jumpAnimation = p.jumpRecovery = null;
        p.romVerticalVelocity = 0;
        p.jumpGroundVertical = { velocity: 0, fraction: 0 };
        p.spin = 0;
        this.crash("MISSED THE LANDING");
        if (p.bail) p.bail.speed = 0;
        p.vx = p.vy = p.romSpeed = 0;
      }
    }
    /** Coping entry: use the original vertical-face coefficient and4A
     * shoe boost, followed by5264's original animation selection. The map
     * scan supplies a local coping plane until full terrain probing is ported.
     */
    launchHalfpipe(wall) {
      const p = this.player,
        rom = S.OriginalGround,
        reader = rom.terrainTableReader(S.TERRAIN_TABLES);
      const speed = Math.abs(p.romSpeed || 0);
      const coefficients = rom.surfaceCoefficients(
        wall.upDirection,
        wall.copingProfile,
        1,
        3,
        speed,
        this.gear.board,
        reader.readByte,
        reader.readWord,
      );
      const ground = rom.surfaceVerticalMotion(
        speed,
        coefficients.vertical,
      ).velocity;
      let vertical = ground;
      const jumping = this.input.held("jump") || p.halfpipeJumpQueued > 0;
      if (jumping) {
        const boost = {
          action: 0x4a,
          currentPhase: 1,
          savedVertical: vertical,
        };
        S.OriginalRampAnimation.tickRampSecondary(boost, this.gear.shoes);
        vertical = (boost.vertical << 16) >> 16;
      }
      if (vertical <= 0) return false;
      const setup = S.OriginalRampAnimation.setupRampAnimation(
        vertical,
        ground,
        wall.upDirection,
        jumping ? 128 : 0,
        wall.copingProfile,
      );
      p.halfpipeFlight = {
        speed,
        wall,
        baseHeight: setup.targetHeight,
        jumping,
      };
      p.x = wall.lip.x;
      p.y = wall.lip.y;
      p.z = 1;
      p.air = true;
      p.fromRamp = true;
      p.airTime = 0;
      p.spin = 0;
      p.romDirection = wall.upDirection;
      p.angle = p.takeoffAngle = Math.atan2(
        -rom.tables.y[wall.upDirection],
        rom.tables.x[wall.upDirection],
      );
      p.vx = p.vy = 0;
      p.romVerticalVelocity = vertical;
      p.jumpLaunchVelocity = vertical;
      p.romGravity = 12;
      p.launchSource =
        "original coping slope/4A boost/5264 animation; decoded-wall adapter";
      p.jumpSequence = p.jumpRecovery = p.kickAnimation = null;
      p.halfpipeReturning = false;
      p.halfpipeJumpQueued = 0;
      const rate = S.OriginalRoutines.jumpAnimationRate(speed);
      p.jumpAnimation = { rate, countdown: rate, phase: 0 };
      p.rampAnimation =
        setup.sequence && setup.bodyPointer
          ? {
              ...setup,
              profile: wall.copingProfile,
              direction: wall.upDirection,
              speed,
              vertical,
              gravity: 12,
              savedVertical: vertical,
              currentBody: setup.bodyPointer,
              currentBoard: setup.boardPointer,
              bodyCountdown: setup.countdown,
              currentPhase: 0,
              frameEvent: 0,
              completed: 0,
              heightGauge: 0x6000,
              actorX: 0,
              actorY: 0,
              velocityX: 0,
              velocityY: 0,
            }
          : null;
      return true;
    }
    tickHalfpipeAnimation() {
      const p = this.player,
        state = p.rampAnimation,
        flight = p.halfpipeFlight;
      if (!state || !flight) return;
      this.rampMarkerBytes ||= Uint8Array.from(
        atob(S.RAMP_DATA.sequence),
        (c) => c.charCodeAt(0),
      );
      const readByte = (a) => {
        const index = a - S.RAMP_DATA.sequenceBase;
        if (index < 0 || index >= this.rampMarkerBytes.length)
          throw Error("Missing original ramp marker");
        return this.rampMarkerBytes[index];
      };
      state.height = (flight.baseHeight + Math.round(p.z * 64)) & 65535;
      state.actorX = 0;
      state.actorY =
        ((state.profile === 7 ? 0x2600 : 0xe000) - 256 - Math.round(p.z * 64)) &
        65535;
      state.vertical = p.romVerticalVelocity & 65535;
      state.direction = S.Halfpipe.heading(p.angle, S.OriginalGround.tables);
      S.OriginalRampAnimation.tickRampController(
        state,
        this.gear.shoes,
        readByte,
        {
          readWord: this.objectRegistry.readTypeWord,
          readByte: (a) =>
            a >= S.RAMP_DATA.poseBase
              ? S.RAMP_DATA.pose[a - S.RAMP_DATA.poseBase]
              : this.objectRegistry.readTypeByte(a),
        },
      );
      p.z = (((state.height - flight.baseHeight) << 16) >> 16) / 64;
      p.romVerticalVelocity = (state.vertical << 16) >> 16;
      p.romGravity = state.gravity;
      S.OriginalRampAnimation.tickRampClocks(
        state,
        this.objectRegistry.readTypeWord,
        S.OriginalRoutines.tickMotionAnimation,
      );
    }
    landHalfpipe() {
      const p = this.player,
        flight = p.halfpipeFlight;
      this.land();
      p.halfpipeFlight = p.rampAnimation = null;
      if (p.bail) return;
      // A128-A14A's FCD0 heading aligns the steep wall before descending.
      p.x = flight.wall.lip.x;
      p.y = flight.wall.lip.y;
      p.romSpeed = flight.speed;
      p.romDirection = p.romMovementDirection = flight.wall.returnDirection;
      p.angle = Math.atan2(
        -S.OriginalGround.tables.y[p.romDirection],
        S.OriginalGround.tables.x[p.romDirection],
      );
      p.romDialAngle = p.angle;
      p.jumpSequence = p.jumpRecovery = p.jumpAnimation = null;
      p.halfpipeReturning = true;
      p.halfpipePoseProfile = flight.wall.profile;
    }
    launchJump() {
      const p = this.player;
      if (
        p.air ||
        p.fallen > 0 ||
        p.cooldown > 0 ||
        p.jumpRecovery?.action === 9
      )
        return;
      let boost = 1;
      const level = this.event?.level || this.city.level,
        surface = level.contactSample(p.x, p.y);
      const ahead = level.contactSample(
        p.x + Math.cos(p.angle) * 24,
        p.y + Math.sin(p.angle) * 24,
      );
      p.fromRamp =
        !p.jumpSequence &&
        !surface.blocked &&
        (surface.type === 16 ||
          ![24, 32, 120].includes(surface.profile) ||
          ahead.blocked);
      if (!p.jumpSequence && this.event?.kind === "ramp") p.fromRamp = true;
      if (p.fromRamp) boost = 1.45;
      p.kickAnimation = null;
      p.kickClock = 0;
      if (p.jumpSequence) {
        S.OriginalRoutines.ordinaryJumpTakeoff(
          p.jumpSequence,
          Math.min(3, this.gear.shoes),
        );
        const speed = (p.jumpSequence.mainSpeed << 16) >> 16;
        const rom = S.OriginalGround;
        const motion = rom.airborneTransition(
          speed,
          p.romDirection ?? 4,
          surface.profile,
          { slalom: 1, downhill: 2, ramp: 3, jump: 4 }[this.event?.kind] || 0,
          Math.min(3, this.gear.board),
          rom.terrainTableReader(S.TERRAIN_TABLES),
        );
        p.romSpeed = motion.mainSpeed;
        p.romMovementDirection = motion.direction;
        p.airborneTerrainReference = motion.groundVertical;
        p.jumpGroundVertical = { velocity: 0, fraction: 0 };
        p.jumpSequence.savedSpeed = motion.savedSpeed & 65535;
        p.vx = ((motion.dx + motion.fractionX / 256) * 60) / 64;
        p.vy = (-(motion.dy + motion.fractionY / 256) * 60) / 64;
        p.jumpAnimation = p.jumpSequence;
      } else {
        const rate = S.OriginalRoutines.jumpAnimationRate(p.romSpeed || 0);
        p.jumpAnimation = { rate, countdown: rate, phase: 0 };
      }
      p.air = true;
      p.edgeContact = false;
      p.spin = 0;
      p.airTime = 0;
      p.takeoffAngle = p.angle;
      p.z = 1;
      p.lastStickAngle = this.input.stick.active
        ? Math.atan2(this.input.stick.y, this.input.stick.x)
        : null;
      // Launch magnitude is still provisional; retain it separately from the
      // translated airborne update so it cannot be mistaken for a ROM value.
      const ordinaryFlatJump =
        !!p.jumpSequence || (surface.type === 0 && !p.fromRamp);
      if (ordinaryFlatJump) {
        p.romVerticalVelocity = p.jumpSequence?.risingSurface
          ? (p.jumpSequence.vertical << 16) >> 16
          : S.OriginalRoutines.ordinaryJumpLaunch(Math.min(3, this.gear.shoes));
        p.vz = (p.romVerticalVelocity * 60) / 64;
        p.launchSource = "ROM 1A000:4E34-4E90 ordinary takeoff";
      } else {
        p.vz = (230 + this.gear.shoes * 25) * boost;
        p.romVerticalVelocity = Math.round((p.vz * 64) / 60);
        p.launchSource = "provisional terrain/ramp launch";
      }
      p.jumpLaunchVelocity = p.romVerticalVelocity;
      p.romGravity = 12; // A068 ordinary jump state; ramp variants remain TODO.
      this.audio.effect("jump");
      if (this.event?.kind === "jump" && p.fromRamp) {
        const launch = this.event.ramps.find(
          (r) => Math.abs(r.y - p.y) < 100 && Math.abs(r.x - p.x) < 170,
        );
        if (launch)
          p.jumpTarget = this.event.targets.findIndex(
            (target) => target.y > launch.y + 35,
          );
      }
    }
    land() {
      const p = this.player;
      p.z = 0;
      p.air = false;
      p.cooldown = 0;
      // E4EA-E506 enters action9 with countdown20. E50C clears at2.
      if (p.jumpSequence) {
        p.jumpSequence.movementState = 1;
        S.OriginalRoutines.jumpActionTransition(p.jumpSequence);
        if (p.jumpSequence.action === 9) p.jumpRecovery = p.jumpSequence;
      } else {
        p.jumpRecovery = {
          action: 8,
          phase: 3,
          rate: 0,
          countdown: 0,
          movementState: 1,
        };
        S.OriginalRoutines.jumpActionTransition(p.jumpRecovery);
      }
      const degrees = (Math.abs(p.spin) * 180) / Math.PI;
      // Provisional policy retained until the original animation interruption
      // callers (5462/54CE) and terrain landing states are translated. Routine
      // 53A8 requests interruption; using it directly as a crash test was wrong.
      const offAxis = Math.abs(((degrees + 90) % 180) - 90);
      if (degrees > 100 && offAxis > 70 + this.gear.pads * 5) {
        this.crash("CROOKED LANDING");
        return;
      }
      const kind =
        { slalom: 1, downhill: 2, ramp: 3, jump: 4 }[this.event?.kind] || 0;
      const award = S.OriginalRoutines.airtimeAward(
        Math.round(p.airTime * 60),
        kind,
      );
      if (award.deferred) {
        this.event.originalPendingPoints =
          (this.event.originalPendingPoints || 0) + award.points;
        this.event.points += award.points;
      } else if (award.points) this.addScore(award.points);
      if (award.points) {
        const profile = (this.event?.level || this.city.level).contactSample(
          p.x,
          p.y,
        ).profile;
        const effect = S.OriginalEffects.beginLandingEffect(
          award.index,
          p.x,
          p.y,
          profile,
        );
        // F064 setup occurs before the original frame's B378 clock pass.
        S.OriginalEffects.tickLandingEffect(effect, p.x, p.y);
        this.floats = this.floats.filter((f) => !f.originalLanding);
        this.floats.push(effect);
      }
      this.audio.effect("land");
      // Restore the travel heading after the trick, instead of reversing velocity.
      p.angle = p.takeoffAngle;
      p.spin = 0;
      if (this.event?.kind === "ramp" && p.fromRamp) this.event.rampHits++;
      if (this.event?.kind === "jump" && p.jumpTarget !== undefined) {
        const target = this.event.targets[p.jumpTarget];
        if (
          target &&
          !this.event.passed.has(p.jumpTarget) &&
          !this.event.level.contactSample(p.x, p.y).blocked &&
          S.distance(p, target) < 175
        ) {
          this.event.passed.add(p.jumpTarget);
          this.event.jumpsLanded++;
          this.popup("TARGET LANDED"); // Original jump scoring chain not yet translated.
        } else this.popup("MISSED TARGET", p.x, p.y - 65, "#ffab87");
        p.jumpTarget = undefined;
      }
    }
    crash(reason) {
      const p = this.player;
      if (p.invulnerable > 0 || p.fallen > 0) return;
      const level = this.event?.level || this.city.level;
      const surface = level.contactSample(p.x, p.y);
      const bytes = this.motionDirectory;
      const readWord = (a) => bytes[a - 0x4000] | (bytes[a - 0x4000 + 1] << 8);
      p.bail = S.OriginalBail.beginBail(
        p.romSpeed || 0,
        p.romMovementDirection ?? p.romDirection ?? 4,
        p.romDirection ?? 4,
        surface.profile,
        Math.min(3, this.gear.helmet),
        Math.min(3, this.gear.pads),
        p.air,
        p.romVerticalVelocity || 0,
        { slalom: 1, downhill: 2, ramp: 3, jump: 4 }[this.event?.kind] || 0,
        readWord,
      );
      p.air = false;
      p.rampAnimation = p.halfpipeFlight = null;
      p.halfpipeReturning = false;
      p.dropFall = null;
      p.romVerticalVelocity = p.bail.vertical;
      p.spin = 0;
      p.jumpRecovery = null;
      p.jumpSequence = null;
      p.jumpAnimation = null;
      p.kickAnimation = null;
      p.romKickEnvelope = { target: 0, impulse: 0, previousMask: 128 };
      p.fallen = p.bail.timer / 60;
      p.invulnerable = 2;
      this.audio.effect("crash");
      this.popup(reason, p.x, p.y - 45, "#ff967b");
      if (this.event) {
        this.event.crashes++;
        this.event.timer = Math.max(0, this.event.timer - 1.5);
      } else if (!this.practice)
        this.cityTimer = Math.max(0, this.cityTimer - 2);
    }
    /** Original bail state1 with native map/collision adapters. */
    updateBail(dt) {
      const p = this.player,
        b = p.bail,
        rom = S.OriginalGround;
      const level = this.event?.level || this.city.level;
      const surface = level.contactSample(p.x, p.y);
      p.romFrame = (p.romFrame || 0) + 1;
      const kick = this.input.held("kick");
      rom.kickInputTransition(
        p.romKickEnvelope,
        kick ? 0 : 128,
        Math.min(3, this.gear.shoes),
        b.speed,
      );
      rom.kickEnvelope(
        p.romKickEnvelope,
        b.speed,
        Math.min(3, this.gear.shoes),
        p.romFrame,
        kick,
      );
      S.OriginalBail.tickBail(
        b,
        surface.profile,
        p.romKickEnvelope.target,
        false,
      );
      const bytes = this.motionDirectory;
      S.OriginalRoutines.tickMotionAnimation(
        b,
        (a) => bytes[a - 0x4000] | (bytes[a - 0x4000 + 1] << 8),
      );
      const m = rom.velocity(b.speed, b.direction);
      p.vx = ((m.dx + m.fractionX / 256) * 60) / 64;
      p.vy = (-(m.dy + m.fractionY / 256) * 60) / 64;
      p.romSpeed = b.speed;
      p.x = S.clamp(
        p.x + p.vx * dt,
        35,
        (this.event?.width || this.city.width) - 35,
      );
      p.y = S.clamp(
        p.y + p.vy * dt,
        75,
        (this.event?.height || this.city.height) - 45,
      );
      if (b.airborne) {
        b.vertical = S.OriginalRoutines.airborneVelocity(
          b.vertical,
          12,
          this.event?.kind === "ramp" ? 3 : 0,
        );
        p.z = Math.max(0, p.z + b.vertical / 64);
        if (p.z === 0) b.airborne = false;
      } else p.z = 0;
      // Recovery motion must obey the same support boundary as skating.
      // Otherwise its ROM scalar carries the actor off the platform even
      // after the native collision adapter has rolled the position back.
      this.collideWithRecoveredTerrain();
      p.fallen = b.timer / 60;
      if (b.finished) {
        p.bail = null;
        p.fallen = 0;
      }
      if (this.mode === "city") this.updateCity(dt);
      else if (this.mode === "event") this.updateEvent(dt);
      this.camera.x += (p.x - this.camera.x) * Math.min(1, dt * 7);
      this.camera.y +=
        (p.y - 35 - (p.halfpipeFlight ? p.z * 0.6 : 0) - this.camera.y) *
        Math.min(1, dt * 7);
    }
    caughtByBees() {
      if (this.practice) return;
      this.lives--;
      this.audio.effect("crash");
      if (this.lives <= 0) {
        this.mode = "gameover";
        this.audio.pauseMusic();
        this.changed?.();
        return;
      }
      this.resetPlayer(this.city.spawn.x, this.city.spawn.y);
      this.resetCityClock();
      this.tell(`THE BEES GOT YOU · ${this.lives} BOARDS LEFT`, 4);
    }
    finishEvent() {
      if (this.mode !== "event") return;
      const e = this.event;
      e.finished = true;
      this.mapDifficulty = e.difficulty;
      let performance = 0;
      if (e.kind === "ramp") performance = e.points / 3500;
      if (e.kind === "slalom") performance = e.gatesHit / 10;
      if (e.kind === "jump") performance = e.jumpsLanded / 3;
      if (e.kind === "downhill")
        performance =
          (this.player.y >= e.level.finish.y - 30 ? 1 : 0) *
          Math.max(
            0.25,
            1 - e.elapsed / (e.level.height / 30) - e.crashes * 0.05,
          );
      const medal =
        performance >= 0.8
          ? "GOLD"
          : performance >= 0.5
            ? "SILVER"
            : performance >= 0.2
              ? "BRONZE"
              : "PARTICIPATION";
      const cash = { GOLD: 300, SILVER: 200, BRONZE: 100, PARTICIPATION: 50 }[
        medal
      ];
      // Translate the original deferred-points tally; medal labels no longer
      // invent a fixed score bonus. Race tally state 0F20 remains untranslated.
      let pending = e.originalPendingPoints || 0,
        bonus = 0;
      while (pending > 0) {
        const tally = S.OriginalRoutines.tallyPendingScore(pending);
        for (const award of tally.awards) {
          this.addScore(award, undefined, false);
          bonus += award;
        }
        pending = tally.pending;
      }
      e.originalPendingPoints = 0;
      this.cash += cash; // Medal/cash selection remains provisional.
      this.medals.push({
        park: e.kind,
        round: e.round,
        medal,
        points: e.points,
      });
      this.clears[e.kind] = Math.min(4, this.clears[e.kind] + 1);
      this.result = { medal, cash, bonus, kind: e.kind, points: e.points };
      this.mode = "result";
      this.audio.effect("medal");
      this.changed?.();
    }
    continueAfterEvent() {
      if (Object.values(this.clears).every((count) => count >= 4)) {
        this.addScore(this.cash * 10);
        this.mode = "victory";
        this.audio.pauseMusic();
        this.changed?.();
        return;
      }
      const gate = this.city.gates.find((g) => g.kind === this.event.kind);
      this.event = null;
      this.mode = "city";
      this.resetPlayer(
        gate.x + (gate.x < 3072 ? 80 : -80),
        gate.y + (gate.y < 1536 ? 60 : -60),
      );
      // Every visit awards enough points toward the next ticket; a consolation
      // ticket prevents a low-scoring first park from trapping a beginner.
      this.tickets = Math.max(1, this.tickets);
      this.shopState.visitMask = 0;
      this.shopState.stockMask = S.OriginalEquipment.stockMask(this.gear, 3);
      this.shopState.attemptMask = 0;
      this.resetCityClock();
      this.tell("MEDAL CASH BUYS GEAR · FIND THE NEXT PARK", 5);
      this.changed?.();
    }
    /** Original pending route clock followed by active traffic scheduling. */
    updatePendingTraffic() {
      const memory = this.objectRegistry;
      const resolve = S.OriginalRoutines.resolveObjectPlacement;
      const advance = (slot, placement, alternate) => {
        const result = S.OriginalActorRoutes.advancePending(
          slot,
          placement.recordPointer,
          alternate,
          memory,
          resolve,
        );
        if (result.advanced) this.pendingTrafficMoves++;
        return result.status;
      };
      S.OriginalActorSpawning.tickPendingRoutes(memory, {
        resolve,
        primary: (slot, placement) => advance(slot, placement, false),
        alternate: (slot, placement) => advance(slot, placement, true),
      });
      this.trafficActors = this.trafficRuntime.frame(
        this.camera,
        this.city.width,
        this.city.height,
      );
    }
    update(dt) {
      if (this.paused || !["city", "event"].includes(this.mode)) return;
      if (!(this.event?.level || this.city.level).ready) return;
      const p = this.player,
        e = this.event;
      this.elapsed += dt;
      for (const crack of this.cracks) S.OriginalCracks.tick(crack);
      if (this.mode === "city")
        for (const actor of this.cityActors) {
          const motion = S.OriginalActors.stepMotionActor(
            actor,
            this.actorMemory,
          );
          actor.actorX += motion.dx / 64;
          actor.actorY -= motion.dy / 64;
          actor.height = ((actor.height || 0) + motion.dz) & 65535;
        }
      if (this.mode === "city") this.updatePendingTraffic();
      this.messageTime = Math.max(0, this.messageTime - dt);
      for (const popup of this.floats) {
        if (popup.originalLanding)
          S.OriginalEffects.tickLandingEffect(popup, p.x, p.y - p.z);
        else {
          popup.life -= dt;
          popup.y -= 12 * dt;
        }
      }
      this.floats = this.floats.filter((f) => f.life > 0);
      p.cooldown = Math.max(0, p.cooldown - dt);
      if (p.jumpRecovery) {
        S.OriginalRoutines.tickAnimationPhase(p.jumpRecovery);
        S.OriginalRoutines.jumpActionTransition(p.jumpRecovery);
        if (p.jumpRecovery.action === 0) {
          p.jumpRecovery = null;
          p.jumpSequence = null;
          p.jumpAnimation = null;
        }
      }
      p.invulnerable = Math.max(0, p.invulnerable - dt);
      if (p.kickAnimation) {
        // E254 sees the previous motion-object phase before B378 ticks it.
        if (p.kickAnimation.phase >= 3) p.kickAnimation = null;
        else S.OriginalRoutines.tickAnimationPhase(p.kickAnimation);
      }
      p.kickClock = p.kickAnimation
        ? ((3 - p.kickAnimation.phase) * (p.kickAnimation.rate + 1)) / 60
        : 0;
      if (p.bail) {
        this.updateBail(dt);
        return;
      }
      if (p.fallen > 0) {
        p.fallen = Math.max(0, p.fallen - dt);
        return;
      }
      // Course ramp fronts have profile low bits7: their coefficients describe
      // a vertical face, not a surface to skate along. Sampling that artwork
      // as ground reverses screen-Y velocity and traps the rider at the lip.
      // Leave the upper platform with its existing momentum instead.
      const courseSurface = e?.level.contactSample(p.x, p.y);
      if (
        ["downhill", "jump"].includes(e?.kind) &&
        courseSurface &&
        (courseSurface.profile & 7) === 7 &&
        !courseSurface.barrier &&
        !p.air &&
        Math.hypot(p.vx, p.vy) > 0.01
      )
        this.dropFromLedge();
      if (p.halfpipeJumpQueued > 0) p.halfpipeJumpQueued--;
      const direction = this.input.direction(),
        kick = this.input.held("kick");
      const kickAnimationSpeed = p.romSpeed || 0; // Previous frame's0331 speed band.
      const kickPressed = kick && !p.kickWasHeld;
      p.kickWasHeld = kick;
      const stick = this.input.stick,
        rotating = this.input.controlMode === "rotate";
      if (p.jumpSequence?.action === 4) {
        S.OriginalRoutines.jumpActionTransition(p.jumpSequence);
        if (p.jumpSequence.action === 5) this.launchJump();
        else S.OriginalRoutines.tickAnimationPhase(p.jumpSequence);
      } else if (!p.air) {
        const dialFromAngle = (angle) =>
          ((Math.round((-angle / (Math.PI * 2)) * 144) % 144) + 144) % 144;
        const isoAngle = (index) =>
          Math.atan2(
            -S.OriginalGround.tables.y[index],
            S.OriginalGround.tables.x[index],
          );
        if (rotating && !p.halfpipeReturning) {
          // Continuous analog dial adapter, followed by the original lookup.
          p.romDialAngle =
            (p.romDialAngle ?? p.angle) +
            (stick.active
              ? stick.x
              : Number(this.input.held("right")) -
                Number(this.input.held("left"))) *
              3.8 *
              dt;
          p.romDialCounter = dialFromAngle(p.romDialAngle);
          p.romDirection = S.OriginalGround.dialDirection(p.romDialCounter);
          p.angle = isoAngle(p.romDirection);
        }
        if (direction.active && !rotating && !p.halfpipeReturning) {
          const dial = dialFromAngle(Math.atan2(direction.y * 2, direction.x));
          const target = S.OriginalGround.dialDirection(dial);
          let current = p.romDirection;
          if (current === undefined)
            current = S.OriginalGround.dialDirection(dialFromAngle(p.angle));
          const turn = S.OriginalRoutines.steeringDifference(target - current);
          p.romDirection = (current + turn.step + 16) & 15;
          p.romDialCounter = dial;
          p.romDialAngle = Math.atan2(direction.y, direction.x);
          p.angle = isoAngle(p.romDirection);
        }
        const keyboardKick = ["KeyX", "ShiftLeft", "ShiftRight"].some(
          (code) => this.input.keys.has(code) || this.input.touchKeys.has(code),
        );
        const throttle = keyboardKick
          ? 1
          : Math.max(this.input.throttle, kick ? 0.2 : 0);
        const drive = direction.active
          ? direction.magnitude
          : rotating
            ? Math.max(0, -stick.y)
            : 0;
        let surface = (e?.level || this.city.level).contactSample(p.x, p.y);
        p.halfpipeWall =
          e?.kind === "ramp" ? S.Halfpipe.wallAt(e.level, p.x, p.y) : null;
        p.halfpipePoseProfile = p.halfpipeWall?.profile;
        if (
          p.halfpipeReturning &&
          (!p.halfpipeWall || p.halfpipeWall.progress < 0.3)
        )
          p.halfpipeReturning = false;
        if (p.halfpipeWall)
          surface = { ...surface, profile: p.halfpipeWall.profile };
        // Recovered surface coefficients and grounded arithmetic apply to flag0.
        // The input adapter still supplies turning and kick state timing.
        if (
          (surface.type === 0 ||
            (!e && [5, 6, 7, 8, 17].includes(surface.type)) ||
            (["downhill", "jump"].includes(e?.kind) && surface.type === 16) ||
            (!e && surface.type >= 128 && surface.profile === 32) ||
            (e?.kind === "ramp" &&
              ([9, 13].includes(surface.type) ||
                (surface.type >= 128 &&
                  [16, 120].includes(surface.profile))))) &&
          !this.input.brake
        ) {
          const rom = S.OriginalGround;
          p.romFrame = (p.romFrame || 0) + 1;
          let scalar = p.romSpeed || 0;
          if (kickPressed && scalar <= 0) scalar = 0x180; // 4F26-4F2C
          const gear = Math.min(3, this.gear.board);
          p.romKickEnvelope ||= { target: 0, impulse: 0, previousMask: 128 };
          // Original physical press/release transitions, with no synthetic
          // hold-to-repeat impulses. Rapid taps can build the target-speed envelope.
          const shoes = Math.min(3, this.gear.shoes);
          rom.kickInputTransition(
            p.romKickEnvelope,
            kick ? 0 : 128,
            shoes,
            scalar,
          );
          rom.kickEnvelope(
            p.romKickEnvelope,
            scalar,
            Math.min(3, this.gear.shoes),
            p.romFrame,
            kick,
          );
          const reader = rom.terrainTableReader(S.TERRAIN_TABLES);
          const kind =
            { slalom: 1, downhill: 2, ramp: 3, jump: 4 }[e?.kind] || 0;
          const coefficients = rom.surfaceCoefficients(
            p.romDirection ?? 4,
            surface.profile,
            1,
            kind,
            scalar,
            gear,
            reader.readByte,
            reader.readWord,
          );
          scalar = rom.terrainSpeed(
            scalar,
            kick ? 3 : 0,
            gear,
            p.romFrame,
            p.romKickEnvelope.target,
            surface.profile,
            coefficients.slopeDelta,
            kind,
          );
          // Browser heading -> nearest original isometric direction. The ROM
          // coefficient vectors, rather than trigonometric replacements, move us.
          let best = Infinity,
            direction = 0;
          for (let i = 0; i < 16; i++) {
            const error = Math.abs(
              S.angleDelta(
                Math.atan2(-rom.tables.y[i], rom.tables.x[i]),
                p.angle,
              ),
            );
            if (error < best) {
              best = error;
              direction = i;
            }
          }
          const coefficient = rom.surfaceCoefficients(
            direction,
            surface.profile,
            1,
            kind,
            scalar,
            gear,
            reader.readByte,
            reader.readWord,
          );
          const productX = Math.imul(scalar, coefficient.x);
          const productY = Math.imul(scalar, coefficient.y);
          const motion = {
            dx: productX >> 16,
            dy: productY >> 16,
            fractionX: (productX >>> 8) & 255,
            fractionY: (productY >>> 8) & 255,
          };
          p.romGroundVertical = rom.surfaceVerticalMotion(
            scalar,
            coefficient.vertical,
          );
          p.romSurfaceProfile = surface.profile;
          // ROM screen Y is projected with a minus sign in motion objects.
          // Convert both the velocity and the input dial orientation together.
          // Coordinates use 64 fixed-point units per pixel.
          p.vx = ((motion.dx + motion.fractionX / 256) * 60) / 64;
          // B486-B48E projects actor Y plus its terrain height. Omitting
          // the height delta makes opposite faces of a ramp trap the skater.
          const groundY =
            p.romGroundVertical.velocity + p.romGroundVertical.fraction / 256;
          p.vy = -((motion.dy + motion.fractionY / 256 + groundY) * 60) / 64;
          if (p.halfpipeWall) {
            // PNG wall coordinates already contain the curved rise. Project
            // original height travel along that wall's isometric axis rather
            // than adding it to screenY a second time (which changes lanes).
            const dx = motion.dx + motion.fractionX / 256,
              dy = motion.dy + motion.fractionY / 256;
            const along = (dx - 2 * dy) / 2,
              across =
                (dx + 2 * dy) / 2 +
                (p.halfpipeWall.rawProfile === 1 ? 1 : -1) * 2 * groundY;
            p.vx = ((along + across) * 60) / 64;
            p.vy = ((along - across) * 30) / 64;
          }
          p.romSpeed = scalar;
          p.romKicking = kick;
          p.romGroundActive = true;
        } else {
          p.romGroundActive = false;
          p.romSpeed = 0;
          p.romKicking = false;
          const acceleration =
            (kick ? (245 + this.gear.board * 32) * throttle : 115 * drive) *
            (1 - this.input.brake);
          p.vx += Math.cos(p.angle) * acceleration * dt;
          p.vy += Math.sin(p.angle) * acceleration * dt;
          const drag = Math.exp(
            -((kick ? 0.65 : 1.55) + this.input.brake * 6) * dt,
          );
          p.vx *= drag;
          p.vy *= drag;
        }
        if (kickPressed && !p.kickAnimation) {
          const rate = S.OriginalRoutines.kickAnimationRate(kickAnimationSpeed);
          p.kickAnimation = { rate, countdown: rate, phase: 0 };
          // B786 calls E254 before B7AE calls B378: tick on the setup frame.
          S.OriginalRoutines.tickAnimationPhase(p.kickAnimation);
          p.kickClock = (3 * (rate + 1)) / 60;
          this.audio.effect("kick");
        }
      } else {
        p.romGroundActive = false;
        let spinDirection = this.input.held("left")
          ? -1
          : this.input.held("right")
            ? 1
            : this.input.held("spin")
              ? 1
              : 0;
        if (this.input.padSpin) spinDirection = this.input.padSpin;
        else if (rotating && stick.active) spinDirection = stick.x;
        const spinRate = ((610 + this.gear.helmet * 100) * Math.PI) / 180;
        if (
          this.input.controlMode === "point" &&
          direction.active &&
          !this.input.held("spin") &&
          !this.input.padSpin
        ) {
          // Point has the same meaning in the air as on the ground. Change
          // facing toward the chosen direction; retain takeoff momentum.
          const target = Math.atan2(direction.y, direction.x);
          p.spin += S.angleDelta(target, p.angle);
        } else p.spin += spinDirection * spinRate * dt;
        p.angle = p.takeoffAngle + p.spin;
        p.airTime += dt;
        this.tickHalfpipeAnimation();
        if (p.jumpSequence) {
          const state = p.jumpSequence;
          state.vertical = p.romVerticalVelocity;
          state.groundVertical = p.jumpGroundVertical?.velocity || 0;
          state.height = Math.round(p.z * 64);
          state.groundHeight = 0;
          state.movementState = 0;
          S.OriginalRoutines.jumpActionTransition(state);
        } else if (p.jumpAnimation)
          S.OriginalRoutines.tickAnimationPhase(p.jumpAnimation);
        const romKind =
          { slalom: 1, downhill: 2, ramp: 3, jump: 4 }[e?.kind] || 0;
        p.romVerticalVelocity = S.OriginalRoutines.airborneVelocity(
          p.romVerticalVelocity ?? Math.round((p.vz * 64) / 60),
          p.romGravity ?? 12,
          romKind,
        );
        p.vz = (p.romVerticalVelocity * 60) / 64;
        // Airborne XY uses the plane displacement and Z uses the absolute
        // original vertical velocity. Carrying a frozen takeoff-slope velocity
        // in both fields can make clearance grow forever after gravity caps.
        // The resulting rendered Y still follows B486: planeY minus height.
        p.z += ((p.romVerticalVelocity * 60) / 64) * dt;
        if (!p.dropFall && p.z <= 0) {
          const support = (e?.level || this.city.level).contactSample(p.x, p.y);
          if (["downhill", "jump"].includes(e?.kind) && support.blocked) {
            // Crossing the takeoff plane over empty scenery is still flight.
            // Keep the current impulse/momentum until lower support is found.
            p.dropFall = { frames: 0 };
          } else if (p.halfpipeFlight) this.landHalfpipe();
          else this.land();
        }
      }
      const maxSpeed = kick
        ? 220 + this.gear.board * 24
        : 180 + this.gear.board * 20;
      const speed = Math.hypot(p.vx, p.vy);
      if (!p.romGroundActive && !p.jumpSequence && speed > maxSpeed) {
        p.vx *= maxSpeed / speed;
        p.vy *= maxSpeed / speed;
      }
      p.terrainStepOrigin = { x: p.x, y: p.y };
      p.x += p.vx * dt * S.CONFIG.skatingPace;
      p.y += p.vy * dt * S.CONFIG.skatingPace;
      const width = e ? e.width : this.city.width,
        height = e ? e.height : this.city.height;
      // City contact tiles include shops within the outermost map rows.
      // Let ROM terrain checks handle those cells rather than cutting off
      // 45/75 pixels of valid scenery with the course camera margin.
      p.x = S.clamp(p.x, e ? 35 : 4, width - (e ? 35 : 4));
      p.y = S.clamp(p.y, e ? 75 : 4, height - (e ? 45 : 4));
      if (p.dropFall) this.updateDropContact();
      this.collideWithRecoveredTerrain();
      if (this.mode === "city") this.updateCity(dt);
      else this.updateEvent(dt);
      this.camera.x += (p.x - this.camera.x) * Math.min(1, dt * 7);
      this.camera.y +=
        (p.y - 35 - (p.halfpipeFlight ? p.z * 0.6 : 0) - this.camera.y) *
        Math.min(1, dt * 7);
    }
    /** Recovered normal-stance footprint and original scanline contact masks.
     * Pose-specific footprint selection and remaining response controllers are pending.
     */
    actorMaskContact(actor, pointer = actor.extraPointer) {
      if (!pointer) return false;
      const read = this.objectRegistry.readContactWord;
      return (
        S.OriginalContact.maskContact(
          S.OriginalContact.actorContact(actor, pointer, read),
          S.OriginalContact.playerContact(this.player, read),
          read,
        ) === true
      );
    }
    mapSkatingInput() {
      return {
        kick: this.input.held("kick"),
        jump: this.input.held("jump"),
        directions: ["up", "right", "down", "left"].reduce(
          (bits, key, i) => bits | (this.input.held(key) ? 1 << i : 0),
          0,
        ),
        x: this.input.stick.active ? this.input.stick.x : 0,
        y: this.input.stick.active ? this.input.stick.y : 0,
      };
    }
    showMap(frames = 180) {
      this.mapFrames = Math.min(180, Math.max(1, frames));
      this.mapInputSnapshot = this.mapSkatingInput();
    }
    updateCity(dt) {
      const p = this.player;
      this.mapFrames = Math.max(0, this.mapFrames - 1);
      if (this.mapFrames > 0) {
        const current = this.mapSkatingInput(),
          previous = this.mapInputSnapshot || current;
        const resumed =
          (current.kick && !previous.kick) ||
          (current.jump && !previous.jump) ||
          !!(current.directions & ~previous.directions) ||
          (Math.hypot(current.x - previous.x, current.y - previous.y) > 0.18 &&
            Math.hypot(current.x, current.y) > 0);
        if (resumed) this.mapFrames = 0;
        this.mapInputSnapshot = current;
      }
      const surface = this.city.level.contactSample(p.x, p.y);
      if (!p.air && !p.bail && p.fallen <= 0) {
        for (const crack of this.cracks) {
          if (
            this.actorMaskContact(crack, 0x7a30) &&
            this.launchFromCrack(crack)
          )
            break;
        }
      }
      // Bank1E000 5390/5460/5522 dispatches these original contact flags.
      // Browser foot contact is still an adapter to the recovered tile map.
      const canContact = !p.air && !p.bail && p.fallen <= 0;
      if (canContact && surface.type === 17) {
        // The six connected type17 marker regions in the original city map.
        const markers = [
          [4808, 2380],
          [4032, 780],
          [2616, 1652],
          [3528, 1652],
          [1456, 2332],
          [1856, 908],
        ];
        let region = 0,
          nearest = Infinity;
        markers.forEach(([x, y], i) => {
          const distance = Math.hypot(p.x - x, p.y - y);
          if (distance < nearest) {
            nearest = distance;
            region = i;
          }
        });
        const bit = 1 << region;
        if (!(this.mapVisitMask & bit)) {
          this.mapVisitMask |= bit;
          this.showMap(
            S.OriginalRoutines.mapDisplaySeconds(
              this.mapDifficulty,
              this.mapVisitMask === bit,
            ) * 60,
          );
        }
      }
      if (canContact && surface.type >= 5 && surface.type <= 8) {
        const shop = this.shopAt(p.x, p.y);
        p.shopPad = shop.kind;
        this.interact({ ...shop, type: "shop" });
      } else p.shopPad = null;

      // Type1 marks the original green park entry pads. Trigger on walking
      // onto a pad, and latch rejected requests until the player leaves it.
      const onPad =
        !p.air &&
        p.fallen <= 0 &&
        this.city.level.contactSample(p.x, p.y).type === 1;
      const gate = onPad
        ? this.city.gates.find((g) => S.distance(p, g) < 100)
        : null;
      if (!gate) p.parkPad = null;
      else if (p.parkPad !== gate.kind) {
        p.parkPad = gate.kind;
        this.interact({ ...gate, type: "park" });
        if (this.mode !== "city") return;
      }
      if (!this.practice) this.cityTimer -= dt;
      if (this.cityTimer <= 0 && !this.warned) {
        this.warned = true;
        this.bees = { x: p.x - 230, y: p.y - 120, born: this.elapsed };
        this.tell("SKATE OR DIE! · GET TO A PARK!", 6);
        this.audio.clip("bees");
      }
      if (this.bees) {
        const dx = p.x - this.bees.x,
          dy = p.y - this.bees.y,
          length = Math.hypot(dx, dy) || 1;
        const speed = 130 + Math.min(80, -this.cityTimer * 5);
        this.bees.x += (dx / length) * speed * dt;
        this.bees.y += (dy / length) * speed * dt;
        if (length < 22 || this.cityTimer < -S.CONFIG.beeGrace)
          this.caughtByBees();
      }
      if (!p.bail) {
        const read = this.objectRegistry.readContactWord;
        const contact = [...(this.trafficActors || [])]
          .sort((a, b) => b.sprite - a.sprite)
          .find((actor) => this.actorMaskContact(actor));
        if (!contact) p.lastOriginalContact = 0;
        else {
          const code = S.OriginalContact.responseCode(
            contact.kind,
            !p.air,
            Math.round(p.z * 64),
            this.objectRegistry.readTypeByte,
          );
          // A5B8 handles response2/7 with the original1300-unit impact speed.
          // Cyclist attachment(5) and pedestrian(6) controllers are separate.
          if (
            (code === 2 || code === 7) &&
            p.lastOriginalContact !== contact.sprite &&
            p.invulnerable <= 0
          ) {
            const player = S.OriginalContact.playerContact(p, read);
            const actor = S.OriginalContact.actorContact(
              contact,
              contact.extraPointer,
              read,
            );
            actor.sprite = contact.sprite;
            const side = S.OriginalContact.impactSide(
              player,
              actor,
              this.objectRegistry.readTypeWord,
            );
            const direction = side ? 4 : 12;
            p.romDirection = p.romMovementDirection = direction;
            p.angle = Math.atan2(
              -S.OriginalGround.tables.y[direction],
              S.OriginalGround.tables.x[direction],
            );
            p.romSpeed = 0x0514;
            this.crash("TRAFFIC COLLISION");
          }
          if (code !== null) p.lastOriginalContact = contact.sprite;
        }
      }
      // Speaker87 maps to61DA response0: its original contact causes no bail.
      // Scenery/terrain contact remains responsible for its solid platform.
    }
    collideWithRecoveredTerrain() {
      const p = this.player,
        level = this.event?.level || this.city.level;
      if (p.dropFall) return;
      const wall = p.halfpipeWall;
      if (
        this.event?.kind === "ramp" &&
        !p.air &&
        !p.bail &&
        wall &&
        wall.progress > 0.7 &&
        level.sample(p.x, p.y).profile !== wall.rawProfile &&
        (p.romGroundVertical?.velocity || 0) > 0
      ) {
        if (this.launchHalfpipe(wall)) return;
      }
      if (!p.air && !p.bail && p.fallen <= 0 && p.terrainStepOrigin) {
        const slide = S.TerrainCollision.sweep(
          level,
          p.terrainStepOrigin,
          p,
          {
            x: p.vx,
            y: p.vy,
          },
          { barriersOnly: ["downhill", "jump"].includes(this.event?.kind) },
        );
        if (slide.hits) {
          p.x = slide.x;
          p.y = slide.y;
          p.vx = slide.vx;
          p.vy = slide.vy;
          p.diagonalContacts = slide.hits;
          // Retain native drive speed: repeatedly projecting that scalar too
          // would compound friction on each tick and recreate edge sticking.
          p.edgeContact = false;
        } else p.diagonalContacts = 0;
      }
      p.terrainStepOrigin = null;
      const surface = level.contactSample(p.x, p.y);
      if (
        surface.blocked &&
        !surface.barrier &&
        !p.air &&
        !p.bail &&
        p.fallen <= 0 &&
        Math.hypot(p.vx, p.vy) > 0.01 &&
        ["downhill", "jump"].includes(this.event?.kind)
      ) {
        this.dropFromLedge();
        return;
      }
      // Unsupported scenery is open air during a jump, including its first
      // rising frames. Test support again after the jump lands.
      if (surface.blocked && p.air) return;
      if (surface.blocked && p.z < 18) {
        // One sustained edge contact is one collision, not a new bail on
        // every attempt to steer. Release the latch after reaching the road
        // interior; a fresh jump also starts a distinct contact episode.
        if (!p.edgeContact) {
          p.edgeContactOrigin = { ...p.lastSafe };
          this.crash(
            surface.type === 18 ? "CLEAR THE GAP!" : "WATCH THE EDGE!",
          );
        }
        p.edgeContact = true;
        p.x = p.lastSafe.x;
        p.y = p.lastSafe.y;
        p.vx = p.vy = p.romSpeed = 0;
        if (p.bail) p.bail.speed = 0;
        if (p.romKickEnvelope) {
          p.romKickEnvelope.target = 0;
          p.romKickEnvelope.impulse = 0;
        }
      } else if (!surface.blocked && !p.air) {
        // Keep the rollback anchor inside the platform, rather than saving
        // a point right on its border that immediately collides again.
        const interior = [
          [8, 0],
          [-8, 0],
          [0, 8],
          [0, -8],
        ].every(([dx, dy]) => !level.contactSample(p.x + dx, p.y + dy).blocked);
        const movedAway =
          !p.edgeContact ||
          !p.edgeContactOrigin ||
          S.distance(p, p.edgeContactOrigin) >= 16;
        if (interior && movedAway) {
          p.lastSafe = { x: p.x, y: p.y };
          p.edgeContact = false;
        }
      }
    }
    updateEvent(dt) {
      const e = this.event,
        p = this.player;
      e.elapsed += dt;
      e.timer -= dt;
      if (e.kind === "ramp") {
        // The decoded surface profiles supply wall travel. Do not clamp the
        // pipe to a guessed rotated rectangle or reflect against an invisible
        // lip: those limits cut through valid ramp lanes and its grass apron.
      } else {
        if (e.kind === "slalom") {
          for (const gate of e.gates) {
            if (!gate.hit && !gate.missed && p.y >= gate.y) {
              if (Math.abs(p.x - gate.x) < 76) {
                gate.hit = true;
                e.gatesHit++;
                this.addScore(300, "GATE +300");
                this.audio.effect("coin");
              } else {
                gate.missed = true;
                this.popup("MISSED GATE", p.x, p.y - 60, "#ff9f88");
              }
            }
          }
        }
        if (e.kind === "jump") {
          for (const ramp of e.ramps) {
            if (
              Math.abs(p.y - ramp.y) < 80 &&
              Math.abs(p.x - ramp.x) < 125 &&
              !p.air
            )
              this.tell("JUMP AT THE LIP · LAND ON THE NEXT PLATFORM", 2);
          }
        }
        if (e.level.contactSample(p.x, p.y).type === 10 && !p.air) {
          this.finishEvent();
          return;
        }
      }
      if (e.timer <= 0) this.finishEvent();
    }
    /** Observable state for automation; coordinates use top-left origin, +Y down. */
    toJSON() {
      const p = this.player;
      return {
        mode: this.mode,
        paused: !!this.paused,
        coordinates:
          "world pixels, origin top-left; +x right, +y down; z is height",
        player: {
          x: +p.x.toFixed(1),
          y: +p.y.toFixed(1),
          height: +p.z.toFixed(1),
          airborne: p.air,
          speed: +(Math.hypot(p.vx, p.vy) * S.CONFIG.skatingPace).toFixed(1),
          angleDegrees: +((p.angle * 180) / Math.PI).toFixed(1),
          spinDegrees: Math.round((p.spin * 180) / Math.PI),
          fallen: p.fallen > 0,
        },
        physics: {
          active: p.romGroundActive
            ? "translated flat-ground subset"
            : "provisional recreation",
          originalSpeed: p.romSpeed || 0,
          originalFrame: p.romFrame || 0,
          originalAirVelocity: p.romVerticalVelocity ?? null,
          originalGravity: p.romGravity ?? null,
          launchSource: p.launchSource || null,
          airborneUpdate:
            "translated gravity/cap; provisional launch and landing",
          originalKickTarget: p.romKickEnvelope?.target || 0,
          completeOriginalSimulation: false,
          scoring:
            "original accumulator and airtime award; other awards provisional",
        },
        score: this.score,
        cash: this.cash,
        tickets: this.tickets,
        lives: this.lives,
        gear: this.gear,
        clears: this.clears,
        controls: {
          mode: this.input.controlMode,
          pad: this.input.padName,
          stick: this.input.stick,
          throttle: this.input.throttle,
          brake: this.input.brake,
        },
        mapDisplay: {
          active: this.mapFrames > 0,
          frames: this.mapFrames,
          visitedMask: this.mapVisitMask,
        },
        cityTimer: this.practice ? null : +this.cityTimer?.toFixed(1),
        bees: this.bees,
        cityActors:
          this.mode === "city"
            ? this.cityActors
                .filter(
                  (actor) =>
                    Math.hypot(p.x - actor.actorX, p.y - actor.actorY) < 320,
                )
                .map((actor) => ({
                  kind: actor.kind,
                  x: actor.actorX,
                  y: actor.actorY,
                  phase: actor.phase,
                }))
            : [],
        traffic: {
          active: this.trafficActors?.length || 0,
          pendingRequests: this.trafficRuntime?.population.total || 0,
          nearby: (this.trafficActors || [])
            .filter((a) => Math.hypot(p.x - a.actorX, p.y - a.actorY) < 500)
            .map((a) => ({
              kind: a.kind,
              slot: a.slot,
              sprite: a.sprite,
              x: +a.actorX.toFixed(1),
              y: +a.actorY.toFixed(1),
              direction: a.direction,
              pointer: a.pointer,
            })),
        },
        cracks:
          this.mode === "city"
            ? this.cracks
                .filter(
                  (crack) =>
                    Math.hypot(p.x - crack.actorX, p.y - crack.actorY) < 320,
                )
                .map((crack) => ({
                  x: crack.actorX,
                  y: crack.actorY,
                  phase: crack.phase,
                  active: !!crack.rate,
                }))
            : [],
        nearby: this.nearestInteraction(),
        parks: this.city.gates.map((g) => ({
          ...g,
          available: this.available(g.kind),
        })),
        event: this.event
          ? {
              kind: this.event.kind,
              round: this.event.round,
              time: +this.event.timer.toFixed(1),
              points: this.event.points,
              gatesHit: this.event.gatesHit,
              jumpsLanded: this.event.jumpsLanded,
            }
          : null,
        level: {
          name: (this.event?.level || this.city.level).name,
          source: "decoded original ROM layout",
          surface: (this.event?.level || this.city.level).contactSample(
            p.x,
            p.y,
          ),
        },
        message: this.messageTime > 0 ? this.message : null,
      };
    }
  }
  S.Game = Game;
})();
