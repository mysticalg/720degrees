/** Native game simulation. No ROM instructions are executed by this file.
 * Rendering is deliberately separate so fixed-step tests can inspect the rules.
 */
(() => {
  const S = window.Skate720;
  class Game {
    constructor(input, audio) {
      this.input = input;
      this.audio = audio;
      if (audio.foley) audio.foley.game = this;
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
    /** Keep the board and its lower-surface shadow in the same view. The
     * midpoint also stays continuous when a long fall rebases on landing.
     */
    cameraTargetY(player) {
      let y = player.y - 35 - S.Halfpipe.groundRise(this.event?.level, player);
      if (
        player.air &&
        this.event?.kind === "jump" &&
        player.courseShadowPlaneDrop !== undefined
      )
        y += (player.courseShadowPlaneDrop - player.z) * 0.5;
      else if (
        player.halfpipeFlight ||
        (player.air && ["jump", "downhill"].includes(this.event?.kind))
      )
        y -= player.z * 0.6;
      return y;
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
      this.tell("SKATE CITY \u00b7 JUMP + C TO SPIN \u00b7 E AT A PARK", 7);
      this.audio.unlock();
      this.audio.playStartCue();
      this.changed?.();
    }
    resetCityClock() {
      this.pedestrianReward = { kind: 255, index: 5 };
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
        this.tell("FOLLOW A PARK ARROW \u00b7 E TO ENTER", 2);
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
          this.audio.effect("purchase");
          this.tell(
            `${shop.label} LEVEL ${result.level} \u00b7 $${result.cost}`,
            3,
          );
        } else if (result.status === "funds")
          this.tell(`NEED $${result.cost} \u00b7 WIN MEDALS TO EARN CASH`, 3);
        return;
      }
      if (!this.available(target.kind)) {
        this.tell("COMPLETE THE OTHER PARKS IN THIS ROUND FIRST", 3);
        return;
      }
      if (this.tickets < 1) {
        this.tell("NEED A TICKET \u00b7 JUMP AND SPIN TO EARN POINTS", 3);
        return;
      }
      if (!this.practice) this.tickets--;
      this.cityEntryPosition = { x: this.player.x, y: this.player.y };
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
        ramp: "HALF PIPE \u00b7 ANGLE INTO COPING TO GRIND \u00b7 JUMP + SPIN",
        downhill: "RACE DOWNHILL \u00b7 STAY ON THE ROAD",
        jump: "JUMP AT THE RAMP \u00b7 LAND INSIDE THE TARGET",
        slalom: "PASS BETWEEN THE FLAGS \u00b7 KICK FOR SPEED",
      };
      this.tell(help[target.kind], 6);
      this.changed?.();
    }
    /** Small backward-kick assist requested for fakie jumps. Scale only XY
     * travel and its saved landing speed; vertical impulse/gravity stay intact.
     * The5% headroom caps repeated boosts, without clamping naturally faster
     * downhill or towed momentum back down to an artificial flat-ground limit.
     */
    boostFakieJump(profile) {
      const p = this.player;
      if (!p.fakie) return;
      const tables = S.OriginalGround.tables,
        speed = Math.abs(
          p.halfpipeFlight?.speed ?? p.courseFlightSpeed ?? p.romSpeed ?? 0,
        );
      if (speed <= 0) return;
      const ceiling =
        Math.max(
          tables.kickCeiling[Math.min(3, this.gear.shoes)] + 128,
          tables.limit[(profile & 7) * 4 + Math.min(3, this.gear.board)],
          this.event?.kind === "ramp"
            ? tables.rampLimit[Math.min(3, this.gear.board)]
            : 0,
        ) * S.CONFIG.fakieTopSpeed;
      const scale = Math.max(
        1,
        Math.min(S.CONFIG.fakieJumpBoost, ceiling / speed),
      );
      p.vx *= scale;
      p.vy *= scale;
      p.romSpeed = Math.round((p.romSpeed || 0) * scale);
      if (p.courseFlightSpeed !== undefined)
        p.courseFlightSpeed = Math.round(p.courseFlightSpeed * scale);
      if (p.jumpSequence)
        for (const key of ["savedSpeed", "mainSpeed"])
          p.jumpSequence[key] = Math.round(p.jumpSequence[key] * scale) & 65535;
      if (p.halfpipeFlight) p.halfpipeFlight.speed *= scale;
      p.lastFakieJumpBoost = scale;
    }
    pointHeading(direction) {
      const angle = Math.atan2(direction.y * 2, direction.x);
      const dial =
        ((Math.round((-angle / (Math.PI * 2)) * 144) % 144) + 144) % 144;
      return S.OriginalGround.dialDirection(dial);
    }
    /** An exit kick plants the foot, ending the backward coast. Keep the
     * body facing the same way and let the ordinary4F26 kick-start branch
     * propel it forward; do not turn the sprite or reverse full-speed momentum.
     */
    exitFakieWithKick(direction) {
      const p = this.player,
        tables = S.OriginalGround.tables,
        facing = p.romFacingDirection ?? ((p.romDirection ?? 4) + 8) & 15;
      p.fakie = false;
      p.fakiePointAnchor = null;
      p.romDirection = p.romMovementDirection = facing;
      p.romFacingDirection = undefined;
      p.angle = Math.atan2(-tables.y[facing], tables.x[facing]);
      p.romDialAngle = Math.atan2(-tables.y[facing] * 2, tables.x[facing]);
      p.romSpeed = 0;
      p.vx = p.vy = 0;
      p.romKickEnvelope = { target: 0, impulse: 0, previousMask: 128 };
      p.fakieSteeringTarget = p.fakieTurnLatch = p.fakieAirInput = null;
      p.exitFakieTarget = direction.active
        ? this.pointHeading(direction)
        : null;
      p.copingReturn = null;
      p.halfpipeReturning = false;
    }
    /** Jump velocity sets height; horizontal momentum is retained in the air. */
    jump() {
      const p = this.player;
      p.groundPivot = p.groundPivotPose = null;
      p.fenceJumpWindow = S.CONFIG.fencePlantWindow;
      if (
        p.fencePlantAir &&
        p.fencePlantAge <= S.CONFIG.fencePlantWindow / 60 &&
        !p.fencePlantBoosted
      ) {
        this.boostFencePlant();
        return;
      }
      // A fresh press just after spring contact belongs to the same launch.
      if (p.air && p.crackSpringAge <= 0.1) {
        this.boostCrackJump();
        return;
      }
      if (p.vehicleTow) this.releaseVehicleTow();
      if (p.curbGrind) this.releaseCurbGrind();
      if (
        p.air ||
        p.fallen > 0 ||
        p.cooldown > 0 ||
        p.jumpRecovery ||
        p.jumpSequence
      )
        return;
      p.crackJumpWindow = 6; // 100ms timing allowance, never a held-button boost.
      if (this.mode === "city") {
        for (const crack of this.cracks)
          if (
            this.actorMaskContact(crack, 0x7a30) &&
            this.launchFromCrack(crack)
          )
            return;
      }
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
          (["slalom", "downhill", "jump"].includes(this.event?.kind) &&
            [9, 10, 15, 16].includes(here.type)) ||
          (!this.event &&
            (here.terrainLayer === "raised" ||
              (here.type >= 128 && here.profile === 32))) ||
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
    /** Add one normal shoe-jump impulse to a timed spring launch. */
    boostCrackJump() {
      const p = this.player;
      if (
        !p.air ||
        !Number.isFinite(p.crackSpringAge) ||
        p.crackJumpBoosted ||
        p.crackSpringAge > 0.1
      )
        return false;
      const impulse = S.OriginalRoutines.ordinaryJumpLaunch(
        Math.min(3, this.gear.shoes),
      );
      p.romVerticalVelocity += impulse;
      p.jumpLaunchVelocity += impulse;
      p.vz = (p.romVerticalVelocity * 60) / 64;
      p.crackJumpBoosted = true;
      p.crackJumpWindow = 0;
      return true;
    }
    launchFromCrack(crack) {
      const p = this.player,
        data = S.CITY_CRACK_DATA;
      const timedJump = p.crackJumpWindow > 0;
      const activated = S.OriginalCracks.activate(
        p.jumpSequence?.action === 4
          ? p.jumpSequence.savedSpeed
          : p.romSpeed || 0,
        timedJump && p.airTime <= 0.1 ? 0 : Math.round(p.z * 64),
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
        p.jumpSequence?.action === 4 ? p.jumpSequence.savedSpeed : p.romSpeed,
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
      p.skid = p.skidPose = null;
      p.air = true;
      p.edgeContact = false;
      p.spin = 0;
      p.airTime = 0;
      p.scoreGapFrames = 0;
      p.scoreTakeoffBackwards = !!p.fakie;
      p.scoreTakeoffDirection = p.romDirection ?? 4;
      p.takeoffAngle = p.angle;
      const takeoffInput = this.input.direction();
      p.fakieAirInput =
        p.fakie && takeoffInput.active
          ? Math.atan2(takeoffInput.y, takeoffInput.x)
          : null;
      p.z = 1;
      p.romVerticalVelocity = activated.vertical;
      p.jumpLaunchVelocity = activated.vertical;
      p.vz = (activated.vertical * 60) / 64;
      p.romGravity = 12;
      p.crackSpringAge = 0;
      p.crackJumpBoosted = false;
      if (timedJump) this.boostCrackJump();
      p.crackJumpWindow = 0;
      p.launchSource =
        "ROM A864 crack springboard; pad impulse table7CA4; native contact";
      this.audio.effect("springboard");
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
      const rom = S.OriginalGround,
        profile =
          p.romSurfaceProfile ??
          this.event.level.contactSample(p.x, p.y).profile,
        motion = rom.airborneTransition(
          p.romSpeed || 0,
          p.romDirection ?? 4,
          profile,
          { downhill: 2, jump: 4 }[this.event.kind],
          this.gear.board,
          rom.terrainTableReader(S.TERRAIN_TABLES),
        );
      p.vx = ((motion.dx + motion.fractionX / 256) * 60) / 64;
      p.vy = (-(motion.dy + motion.fractionY / 256) * 60) / 64;
      if (this.event.kind === "downhill")
        Object.assign(
          p,
          this.downhillTakeoffMotion(
            motion.savedSpeed,
            motion.direction,
            profile,
          ),
        );
      p.romSpeed = motion.mainSpeed;
      p.romMovementDirection = motion.direction;
      p.courseLaunchProfile = profile;
      p.courseFlightSpeed = motion.savedSpeed;
      delete p.courseShadowPlaneDrop;
      delete p.courseShadowPlaneProfile;
      p.skid = p.skidPose = null;
      p.air = true;
      p.edgeContact = false;
      p.spin = 0;
      p.airTime = 0;
      p.scoreGapFrames = 0;
      p.scoreTakeoffBackwards = !!p.fakie;
      p.scoreTakeoffDirection = p.romDirection ?? 4;
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
      if (this.event.kind === "jump") {
        p.fromRamp = true;
        this.armCourseTarget();
      }
    }
    updateDropContact() {
      const p = this.player,
        level = this.event.level;
      p.dropFall.frames++;
      const feetY = p.y - p.z,
        contactY =
          this.event.kind === "jump" ? (p.courseShadowY ?? feetY) : feetY,
        surface = level.contactSample(p.x, contactY);
      if (
        p.romVerticalVelocity < 0 &&
        p.z <= (this.event.kind === "jump" ? 0 : -4) &&
        !surface.blocked &&
        [0, 9, 10, 15, 16].includes(surface.type) &&
        (surface.profile & 7) < 3 &&
        (this.event.kind !== "jump" ||
          (p.courseShadowY !== null && feetY >= (p.courseShadowY ?? feetY)))
      ) {
        p.y = this.event.kind === "jump" ? (p.courseShadowY ?? feetY) : feetY;
        p.dropFall = null;
        this.land();
      } else if (
        feetY > level.height - 20 ||
        p.z < (p.courseShadowPlaneDrop !== undefined ? -768 : -320)
      ) {
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
    /** Infer the lower surface once, then advance its height with the
     * original9FE8 terrain reference. A downhill landing platform must drop
     * under the flying board; repeatedly clamping to its leading edge sends
     * the shadow sideways. Full9C5E layer composition is still pending.
     */
    updateCourseShadow(dt = 1 / 60) {
      const p = this.player,
        level = this.event.level;
      p.courseShadowY = null;
      p.courseShadowProfile = undefined;
      const support = (y) => {
        const surface = level.contactSample(p.x, y),
          incline = surface.profile & 7;
        // The launch curve/painted lip is not the lower landing platform.
        const launchFace =
          incline > 0 &&
          incline < 7 &&
          (surface.profile & 56) === (p.courseLaunchProfile & 56);
        return !surface.blocked &&
          incline < 3 &&
          !launchFace &&
          [0, 9, 10, 15].includes(surface.type)
          ? surface
          : null;
      };
      if (p.courseShadowPlaneDrop !== undefined) {
        // A slope gradient is local to the surface under the shadow. Carrying
        // the bowl rim's gradient over its water keeps moving the lower plane
        // sideways in isometric view, even though airborne XY is unchanged.
        // Extend a flat reference over gaps; resume grading only on support.
        const rom = S.OriginalGround,
          reader = (this.courseShadowReader ||= rom.terrainTableReader(
            S.TERRAIN_TABLES,
          )),
          reference = rom.airborneTransition(
            p.courseFlightSpeed ?? p.romSpeed ?? 0,
            p.romMovementDirection ?? p.romDirection ?? 4,
            support(p.y + p.courseShadowPlaneDrop)?.profile ?? 24,
            4,
            this.gear.board,
            reader,
          ).groundVertical;
        p.courseShadowPlaneDrop -=
          (((reference.velocity + reference.fraction / 256) * 60) / 64) * dt;
        const y = p.y + p.courseShadowPlaneDrop,
          surface = support(y);
        if (surface) {
          p.courseShadowY = y;
          p.courseShadowProfile = surface.profile;
          p.courseShadowPlaneProfile = surface.profile;
        }
        return;
      }
      for (let drop = 0; drop <= 320; drop += 2) {
        const y = p.y + drop,
          surface = support(y);
        if (!surface) continue;
        if (drop >= 8) {
          p.courseShadowPlaneDrop = drop;
          p.courseShadowPlaneProfile = surface.profile;
        }
        p.courseShadowY = y;
        p.courseShadowProfile = surface.profile;
        return;
      }
    }

    /** Native downhill adapter: retain the visible slope travel direction
     * at takeoff. Dropping its terrain-height component abruptly turns the
     * projected vector sideways, despite unchanged original XY coefficients. */
    downhillTakeoffMotion(speed, direction, profile) {
      const rom = S.OriginalGround,
        reader = rom.terrainTableReader(S.TERRAIN_TABLES);
      const coefficient = rom.surfaceCoefficients(
        direction,
        profile,
        1,
        2,
        speed,
        Math.min(3, this.gear.board),
        reader.readByte,
        reader.readWord,
      );
      const x = Math.imul(speed, coefficient.x),
        y = Math.imul(speed, coefficient.y);
      return this.projectGroundMotion(
        {
          dx: x >> 16,
          dy: y >> 16,
          fractionX: (x >>> 8) & 255,
          fractionY: (y >>> 8) & 255,
        },
        rom.surfaceVerticalMotion(speed, coefficient.vertical),
        null,
        null,
      );
    }
    launchHalfpipe(wall) {
      const p = this.player,
        rom = S.OriginalGround,
        reader = rom.terrainTableReader(S.TERRAIN_TABLES);
      const speed = Math.abs(p.romSpeed || 0);
      const jumping = this.input.held("jump") || p.halfpipeJumpQueued > 0;
      let entryDirection = p.romDirection ?? wall.upDirection;
      const requestedGrind = this.input.held("grind") && !jumping;
      if (requestedGrind) {
        // X requests the nearest coping tangent. The existing finite grind
        // controller still owns the original pose, full rail and automatic exit.
        const tangents = [
          (wall.upDirection + 14) & 15,
          (wall.upDirection + 2) & 15,
        ];
        entryDirection = tangents.reduce((best, d) =>
          Math.abs(((d - entryDirection + 24) & 15) - 8) <
          Math.abs(((best - entryDirection + 24) & 15) - 8)
            ? d
            : best,
        );
      }
      const coefficients = rom.surfaceCoefficients(
        entryDirection,
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
      // An explicit grind request selects the original low-band grind pose
      // instead of a high-speed aerial trick. Physical entry speed is retained.
      const setup = S.OriginalRampAnimation.setupRampAnimation(
        requestedGrind ? Math.min(vertical, 287) : vertical,
        requestedGrind ? Math.min(ground, 287) : ground,
        entryDirection,
        jumping ? 128 : 0,
        wall.copingProfile,
      );
      p.halfpipeFlight = {
        speed,
        wall,
        baseHeight: setup.targetHeight,
        jumping,
        entryDirection,
        trick:
          setup.action === 0x4f
            ? "grind"
            : setup.action === 0x4d
              ? "rock"
              : null,
        projectedRise: S.Halfpipe.riseForWall(this.event.level, wall, 1),
      };
      const flight = p.halfpipeFlight;
      if (flight.trick === "grind")
        this.tell(
          "GRIND \u00b7 RIDE THE COPING \u00b7 AUTO DROP AT THE END",
          3,
        );
      else if (flight.trick === "rock")
        this.tell("ROCK \u00b7 SPIN A HALF TURN OR RETURN FAKIE", 3);
      if (flight.trick === "grind")
        flight.coping = S.Halfpipe.copingSpan(this.event.level, wall);
      p.x = wall.lip.x;
      p.y = wall.lip.y;
      // Original4D/4F raise the contact target by4/8px. Admit those poses
      // above that target, rather than immediately taking the failed-contact
      // branch at the native adapter's old one-pixel takeoff height.
      p.z = flight.trick === "grind" ? 9 : flight.trick === "rock" ? 5 : 1;
      p.skid = p.skidPose = null;
      p.air = true;
      p.fromRamp = true;
      p.airTime = 0;
      p.scoreGapFrames = 0;
      p.scoreTakeoffBackwards = !!p.fakie;
      p.scoreTakeoffDirection = p.romDirection ?? 4;
      // Holding the approach stick is not a fresh air-turn request when the
      // board is already travelling backwards (same latch as ordinary jumps).
      const approachInput = this.input.direction();
      p.fakieAirInput =
        p.fakie && approachInput.active
          ? Math.atan2(approachInput.y, approachInput.x)
          : null;
      p.spin = 0;
      p.romDirection = p.romMovementDirection = entryDirection;
      const entryFace = (entryDirection + (p.fakie ? 8 : 0)) & 15;
      p.romFacingDirection = p.fakie ? entryFace : undefined;
      p.angle = p.takeoffAngle = Math.atan2(
        -rom.tables.y[entryFace],
        rom.tables.x[entryFace],
      );
      p.vx = p.vy = 0;
      const motion = rom.airborneTransition(
        speed,
        entryDirection,
        wall.copingProfile,
        3,
        this.gear.board,
        reader,
      );
      const tangent = flight.trick === "grind";
      const velocityX = tangent ? motion.dx : 0,
        velocityY = tangent ? motion.dy : 0;
      if (tangent) {
        p.vx = ((velocityX + motion.fractionX / 256) * 60) / 64;
        p.vy = (-(velocityY + motion.fractionY / 256) * 60) / 64;
      }
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
              velocityX: velocityX & 65535,
              velocityY: velocityY & 65535,
              fractionX: tangent ? motion.fractionX : 0,
              fractionY: tangent ? motion.fractionY : 0,
            }
          : null;
      if (jumping && !flight.trick) this.boostFakieJump(wall.copingProfile);
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
        ((state.profile === 7 ? 0x2600 : 0xe000) -
          256 +
          state.targetHeight -
          flight.baseHeight -
          Math.round(p.z * 64)) &
        65535;
      state.vertical = p.romVerticalVelocity & 65535;
      state.direction = S.Halfpipe.heading(p.angle, S.OriginalGround.tables);
      if (
        flight.trick === "rock" &&
        Math.abs(p.spin) > 0 &&
        Math.abs(p.spin) < Math.PI
      ) {
        // A deliberate rock turn must finish its half turn before facing
        // input can interrupt the recovered stall/release sequence.
        state.direction = flight.entryDirection;
      }
      if (flight.trick === "grind" && state.action === 0x44) {
        // Native playability extension: keep the recovered hold pose while
        // rail remains, then run its original release automatically at the end.
        if (flight.exitRequested) state.hold = 1;
        else if (state.hold <= 1) state.hold = 40;
      }
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
      if (
        (flight.trick === "grind" || flight.trick === "rock") &&
        state.gravity === 0
      )
        flight.contactHeight = p.z;
      if (flight.trick === "grind" && !flight.exitRequested) {
        p.vx =
          ((((state.velocityX << 16) >> 16) + (state.fractionX || 0) / 256) *
            60) /
          64;
        p.vy =
          (-(((state.velocityY << 16) >> 16) + (state.fractionY || 0) / 256) *
            60) /
          64;
      }
      S.OriginalRampAnimation.tickRampClocks(
        state,
        this.objectRegistry.readTypeWord,
        S.OriginalRoutines.tickMotionAnimation,
      );
    }
    /** Project fixed-point surface motion consistently on touchdown and while
     * riding. Using a stale aerial vector for the touchdown tick shifts lanes. */
    projectGroundMotion(motion, vertical, wall, level) {
      const dx = motion.dx + motion.fractionX / 256,
        dy = motion.dy + motion.fractionY / 256,
        groundY = vertical.velocity + vertical.fraction / 256;
      if (!wall) return { vx: (dx * 60) / 64, vy: (-(dy + groundY) * 60) / 64 };
      // Wall artwork already includes the rise. Project height travel along
      // its isometric axis, avoiding a second screen-Y rise that shifts lanes.
      // travelScale restores equal physical travel on the compressed south wall.
      const along = (dx - 2 * dy) / 2,
        across =
          (dx + 2 * dy) / 2 + (wall.rawProfile === 1 ? 1 : -1) * 2 * groundY,
        mappedAcross = across * S.Halfpipe.travelScale(level, wall);
      return {
        vx: ((along + mappedAcross) * 60) / 64,
        vy: ((along - mappedAcross) * 30) / 64,
      };
    }
    landHalfpipe() {
      const p = this.player,
        flight = p.halfpipeFlight;
      // Travel reverses down the wall, but facing follows the completed air.
      // Zero/full turns return fakie; a half turn returns forward. Never force
      // the body to face downhill merely because the descent is constrained.
      const facing = S.OriginalContact.playerDirection(
        { air: true, angle: p.angle },
        S.OriginalGround.tables,
      );
      const difference = (facing - flight.wall.returnDirection + 16) & 15;
      const returnFakie = difference >= 6 && difference <= 10;
      this.land();
      p.halfpipeFlight = p.rampAnimation = null;
      if (p.bail) return;
      // A128-A14A's FCD0 heading aligns the steep wall before descending.
      p.x = flight.wall.lip.x;
      p.y = flight.wall.lip.y;
      if (flight.trick === "grind" && flight.exitPoint) {
        p.x = flight.exitPoint.x;
        p.y = flight.exitPoint.y;
        p.copingReturn = S.Halfpipe.returnPath(
          this.event.level,
          { x: p.x, y: p.y },
          flight.wall,
          flight.projectedRise,
        );
      }
      // A contour may cut a few pixels into a raster lip. Start the wheels on
      // its rideable side, rather than inside the fence mesh on landing.
      const level = this.event.level,
        sign = flight.wall.rawProfile === 1 ? -1 : 1;
      for (let inset = 0; !p.copingReturn && inset <= 16; inset += 2) {
        const x = flight.wall.lip.x + sign * inset,
          y = flight.wall.lip.y - sign * inset * 0.5;
        if (!level.contactSample(x, y).blocked) {
          p.x = x;
          p.y = y;
          break;
        }
      }
      p.romSpeed = flight.speed;
      p.romDirection = p.romMovementDirection = flight.wall.returnDirection;
      // Facing and travel are separate for fakie. Keep the recovered reverse
      // pose while the positive drive scalar follows the descent coefficients.
      p.romFacingDirection = returnFakie
        ? (p.romDirection + 8) & 15
        : undefined;
      p.fakie = returnFakie;
      const returnFace = p.romFacingDirection ?? p.romDirection;
      p.angle = Math.atan2(
        -S.OriginalGround.tables.y[returnFace],
        S.OriginalGround.tables.x[returnFace],
      );
      // The analog dial lives in an unprojected plane. Feeding it the screen
      // angle selects the adjacent heading when rotate mode resumes.
      p.romDialAngle = Math.atan2(
        -S.OriginalGround.tables.y[p.romDirection] * 2,
        S.OriginalGround.tables.x[p.romDirection],
      );
      p.jumpSequence = p.jumpRecovery = p.jumpAnimation = null;
      p.halfpipeReturning = true;
      p.halfpipePoseProfile = flight.wall.profile;
      // Land() retains airborne momentum for ordinary fakie jumps. A coping
      // return explicitly changes travel, so replace that vector immediately.
      if (p.copingReturn) p.vx = p.vy = 0;
      else {
        const rom = S.OriginalGround,
          reader = rom.terrainTableReader(S.TERRAIN_TABLES);
        const coefficient = rom.surfaceCoefficients(
          p.romDirection,
          flight.wall.profile,
          1,
          3,
          p.romSpeed,
          Math.min(3, this.gear.board),
          reader.readByte,
          reader.readWord,
        );
        const productX = Math.imul(p.romSpeed, coefficient.x),
          productY = Math.imul(p.romSpeed, coefficient.y);
        const motion = {
          dx: productX >> 16,
          dy: productY >> 16,
          fractionX: (productX >>> 8) & 255,
          fractionY: (productY >>> 8) & 255,
        };
        p.romGroundVertical = rom.surfaceVerticalMotion(
          p.romSpeed,
          coefficient.vertical,
        );
        p.halfpipeWall = flight.wall;
        Object.assign(
          p,
          this.projectGroundMotion(
            motion,
            p.romGroundVertical,
            flight.wall,
            level,
          ),
        );
      }
    }
    updateCopingTravel() {
      const p = this.player,
        flight = p.halfpipeFlight,
        state = p.rampAnimation;
      if (flight?.trick !== "grind" || !state) return;
      const span = flight.coping;
      if (p.x <= span.minX || p.x >= span.maxX) {
        p.x = S.clamp(p.x, span.minX, span.maxX);
        p.y = p.x * 0.5 + span.q;
        flight.exitRequested = true;
        flight.exitPoint = { x: p.x, y: p.y };
        p.vx =
          p.vy =
          state.velocityX =
          state.velocityY =
          state.fractionX =
          state.fractionY =
            0;
      }
      const wall = S.Halfpipe.copingAt(
        this.event.level,
        p.x,
        p.y,
        flight.wall.rawProfile,
      );
      if (wall) flight.wall = wall;
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
      delete p.courseShadowY;
      delete p.courseShadowProfile;
      let boost = 1;
      const level = this.event?.level || this.city.level,
        surface = level.contactSample(p.x, p.y);
      const ahead = level.contactSample(
        p.x + Math.cos(p.angle) * 24,
        p.y + Math.sin(p.angle) * 24,
      );
      const lateCourseLip =
        this.event?.kind === "jump" &&
        p.romGroundActive &&
        !p.jumpSequence &&
        (surface.blocked ||
          (surface.profile & 7) === 7 ||
          surface.type === 16) &&
        (p.romSurfaceProfile & 7) >= 1 &&
        (p.romSurfaceProfile & 7) <= 6 &&
        (p.romGroundVertical?.velocity || 0) > 0;
      const flightProfile = lateCourseLip
        ? p.romSurfaceProfile
        : surface.profile;
      if (lateCourseLip)
        p.jumpSequence = S.OriginalRoutines.beginSurfaceJumpAnimation(
          p.romSpeed || 0,
          p.romGroundVertical.velocity,
          Math.min(3, this.gear.shoes),
        );
      p.courseLaunchProfile = flightProfile;
      p.courseFlightSpeed = Math.abs(p.romSpeed || 0);
      delete p.courseShadowPlaneDrop;
      delete p.courseShadowPlaneProfile;
      p.fromRamp =
        !!p.jumpSequence?.risingSurface ||
        (!p.jumpSequence &&
          !surface.blocked &&
          (surface.type === 16 ||
            ![24, 32, 120].includes(surface.profile) ||
            ahead.blocked));
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
          flightProfile,
          { slalom: 1, downhill: 2, ramp: 3, jump: 4 }[this.event?.kind] || 0,
          Math.min(3, this.gear.board),
          rom.terrainTableReader(S.TERRAIN_TABLES),
        );
        p.romSpeed = motion.mainSpeed;
        p.courseFlightSpeed = motion.savedSpeed;
        p.romMovementDirection = motion.direction;
        p.airborneTerrainReference = motion.groundVertical;
        p.jumpGroundVertical = { velocity: 0, fraction: 0 };
        p.jumpSequence.savedSpeed = motion.savedSpeed & 65535;
        p.vx = ((motion.dx + motion.fractionX / 256) * 60) / 64;
        p.vy = (-(motion.dy + motion.fractionY / 256) * 60) / 64;
        if (this.event?.kind === "downhill")
          Object.assign(
            p,
            this.downhillTakeoffMotion(
              motion.savedSpeed,
              motion.direction,
              flightProfile,
            ),
          );
        p.jumpAnimation = p.jumpSequence;
      } else {
        const rate = S.OriginalRoutines.jumpAnimationRate(p.romSpeed || 0);
        p.jumpAnimation = { rate, countdown: rate, phase: 0 };
      }
      p.skid = p.skidPose = null;
      p.air = true;
      p.edgeContact = false;
      p.spin = 0;
      p.airTime = 0;
      p.scoreGapFrames = 0;
      p.scoreTakeoffBackwards = !!p.fakie;
      p.scoreTakeoffDirection = p.romDirection ?? 4;
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
      this.boostFakieJump(flightProfile);
      this.audio.effect("jump");
      if (this.event?.kind === "jump" && p.fromRamp) this.armCourseTarget();
    }
    /** The same target attempt applies to a jumped or rolled-off lip. */
    armCourseTarget() {
      const p = this.player;
      const launch = this.event.ramps.find(
        (r) => Math.abs(r.y - p.y) < 192 && Math.abs(r.x - p.x) < 256,
      );
      if (launch)
        p.jumpTarget = this.event.targets.findIndex((t) => t.y > launch.y + 35);
    }

    land() {
      const p = this.player;
      const scoreDrop = p.courseShadowPlaneDrop || 0;
      p.fencePlantAir = false;
      delete p.courseShadowY;
      delete p.courseShadowProfile;
      delete p.courseShadowPlaneDrop;
      delete p.courseShadowPlaneProfile;
      delete p.courseFlightSpeed;
      delete p.courseLaunchProfile;
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
      const landingSurface = (
        this.event?.level || this.city.level
      ).contactSample(p.x, p.y);
      // Original7ADA supplies rotation-aware landing points. Preserve the
      // separate7E44 airtime path for parks whose caller is not yet translated.
      const landingFacing = S.OriginalContact.playerDirection(
        { air: true, angle: p.angle },
        S.OriginalGround.tables,
      );
      const landingTurn =
        (landingFacing - (p.romMovementDirection ?? p.romDirection ?? 4) + 16) &
        15;
      let award;
      if (kind === 2 || kind === 4) {
        const state = (this.event.landingScore ||=
          S.OriginalLandingScore.createState());
        award = S.OriginalLandingScore.award(
          {
            kind,
            frames: Math.round(p.airTime * 60),
            rotation: (p.spin * 288) / (Math.PI * 2),
            drop: Math.floor(scoreDrop / 8),
            gapCount: p.scoreGapFrames || 0,
            gap: (p.scoreGapFrames || 0) > 0,
            backwards: landingTurn >= 6 && landingTurn <= 10,
            takeoffBackwards: !!p.scoreTakeoffBackwards,
            takeoffDirection: p.scoreTakeoffDirection ?? p.romDirection ?? 4,
            direction: S.OriginalContact.playerDirection(
              { air: true, angle: p.angle },
              S.OriginalGround.tables,
            ),
            profile: landingSurface.profile,
            target: landingSurface.type === 15,
            classIndex: this.event.difficulty,
          },
          state,
          S.LANDING_SCORE_DATA,
        );
        award.deferred = kind === 4;
        this.event.lastLandingAward = {
          ...award,
          spin: Math.round(degrees),
          gap: (p.scoreGapFrames || 0) > 0,
        };
      } else
        award = S.OriginalRoutines.airtimeAward(
          Math.round(p.airTime * 60),
          kind,
        );
      if (award.deferred) {
        this.event.originalPendingPoints =
          ((this.event.originalPendingPoints || 0) + award.points) & 65535;
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
        effect.groundRise = S.Halfpipe.groundRise(this.event?.level, p);
        // F064 setup occurs before the original frame's B378 clock pass.
        S.OriginalEffects.tickLandingEffect(effect, p.x, p.y);
        this.floats = this.floats.filter((f) => !f.originalLanding);
        this.floats.push(effect);
      }
      this.audio.effect("land");
      // Facing and rolling direction are independent. A half-turn lands
      // fakie: retain the existing velocity/scalar and select the opposite
      // original body/board pose. A later half-turn can land forward again.
      const travel = (p.romMovementDirection ?? p.romDirection ?? 4) & 15,
        facing = S.OriginalContact.playerDirection(
          { air: true, angle: p.angle },
          S.OriginalGround.tables,
        ),
        delta = (facing - travel + 16) & 15;
      p.romDirection = travel;
      p.romDialAngle = Math.atan2(
        -S.OriginalGround.tables.y[travel] * 2,
        S.OriginalGround.tables.x[travel],
      );
      p.fakie = delta >= 6 && delta <= 10;
      p.romFacingDirection = p.fakie ? (travel + 8) & 15 : undefined;
      const face = p.romFacingDirection ?? travel;
      p.angle = Math.atan2(
        -S.OriginalGround.tables.y[face],
        S.OriginalGround.tables.x[face],
      );
      // A held stick that supplied the air turn is not a fresh request to
      // reverse rolling direction on the first grounded frame.
      p.fakiePointAnchor = null;
      const landingInput = this.input.direction();
      p.fakieSteeringTarget =
        p.fakie && landingInput.active
          ? (this.pointHeading(landingInput) + 8) & 15
          : null;
      p.fakieTurnLatch = p.fakie ? this.input.stick.x : null;
      p.spin = 0;
      if (this.event?.kind === "ramp" && p.fromRamp) this.event.rampHits++;
      if (this.event?.kind === "jump") {
        if (landingSurface.type === 15)
          S.OriginalTargetPalette.trigger(this.event);
        const targetIndex = this.event.targets.findIndex(
          (t) =>
            [10, 15].includes(landingSurface.type) && S.distance(p, t) < 160,
        );
        if (targetIndex >= 0 && !this.event.passed.has(targetIndex)) {
          this.event.passed.add(targetIndex);
          this.event.jumpsLanded++;
          // Original landing burst/points are shown by the same F064 actor
          // used for other scored landings; no replacement target artwork.
          this.popup("TARGET LANDED");
          this.audio.effect("coin");
        }
        p.jumpTarget = undefined;
      }
    }
    crash(reason) {
      const p = this.player;
      p.skid = p.skidPose = null;
      p.groundPivot = p.groundPivotPose = null;
      if (p.curbGrind) this.releaseCurbGrind();
      if (p.vehicleTow) this.releaseVehicleTow();
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
      p.copingReturn = null;
      p.romFacingDirection = undefined;
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
      this.audio.effect("crash", {
        water: level.name === "city" && surface.type === 18,
      });
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
      this.camera.x +=
        (p.x + S.Halfpipe.groundShift(this.event?.level, p) - this.camera.x) *
        Math.min(1, dt * 7);
      this.camera.y +=
        (this.cameraTargetY(p) - this.camera.y) * Math.min(1, dt * 7);
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
      this.tell(`THE BEES GOT YOU \u00b7 ${this.lives} BOARDS LEFT`, 4);
    }
    finishEvent() {
      if (this.mode !== "event") return;
      const e = this.event;
      e.finished = true;
      this.mapDifficulty = e.difficulty;
      let performance = 0;
      if (e.kind === "slalom") performance = e.gatesHit / e.gates.length;
      if (e.kind === "downhill")
        performance =
          (e.crossedFinish || this.player.y >= e.level.finish.y - 30 ? 1 : 0) *
          Math.max(
            0.25,
            1 - e.elapsed / (e.level.height / 30) - e.crashes * 0.05,
          );
      // Original0258 is deferred park score for ramp/jump; race parks use
      // the separate0F20 counter and remain on the native adapter for now.
      const originalResult = ["ramp", "jump"].includes(e.kind)
        ? S.OriginalEventResult.result(
            e.kind,
            e.originalPendingPoints || 0,
            S.OriginalRoutines.setupTableIndex(
              e.difficulty,
              e.kind === "ramp" ? 2 : 3,
              this.medals.length,
            ),
            S.EVENT_RESULT_DATA,
          )
        : null;
      e.originalResult = originalResult;
      const medal =
        originalResult?.medal ??
        (performance >= 0.8
          ? "GOLD"
          : performance >= 0.5
            ? "SILVER"
            : performance >= 0.2
              ? "BRONZE"
              : "PARTICIPATION");
      const cash =
        originalResult?.cash ??
        { GOLD: 300, SILVER: 200, BRONZE: 100, PARTICIPATION: 50 }[medal];
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
        if (tally.done) break; // Signed overflow/nonpositive source words stop tallying.
      }
      e.originalPendingPoints = 0;
      this.cash = originalResult
        ? (this.cash + cash) & 65535
        : this.cash + cash;
      this.medals.push({
        park: e.kind,
        round: e.round,
        medal,
        points: e.points,
        packedMedal: originalResult?.packedMedal ?? null,
      });
      this.clears[e.kind] = Math.min(4, this.clears[e.kind] + 1);
      this.result = {
        medal,
        cash,
        bonus,
        kind: e.kind,
        points: e.points,
        original: originalResult,
      };
      this.mode = "result";
      this.audio.effect("medal");
      this.changed?.();
    }
    /** Find clear pavement connected to the actual entrance, not an offset
     * that can land behind its fence. Keep a board-sized clearance around it.
     */
    cityReturnPosition(gate) {
      const level = this.city.level,
        entered = this.cityEntryPosition || gate,
        anchor = level.contactSample(entered.x, entered.y).blocked
          ? gate
          : entered;
      const target = { x: gate.x, y: gate.y + 96 };
      let best = null,
        distance = Infinity;
      for (let dy = -192; dy <= 192; dy += 8)
        for (let dx = -192; dx <= 192; dx += 8) {
          const point = { x: target.x + dx, y: target.y + dy },
            cost = dx * dx + dy * dy;
          if (cost >= distance) continue;
          if (
            ![
              [0, 0],
              [-16, 0],
              [16, 0],
              [0, -8],
              [0, 8],
              [-16, -8],
              [16, -8],
              [-16, 8],
              [16, 8],
            ].every(([x, y]) => {
              const s = level.contactSample(point.x + x, point.y + y);
              return !s.blocked && s.type === 0 && (s.profile & 7) <= 2;
            })
          )
            continue;
          const path = S.TerrainCollision.sweep(
            level,
            anchor,
            point,
            { x: point.x - anchor.x, y: point.y - anchor.y },
            { barriersOnly: true },
          );
          if (Math.hypot(path.x - point.x, path.y - point.y) > 1) continue;
          best = point;
          distance = cost;
        }
      return best || { ...this.city.spawn };
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
      const position = this.cityReturnPosition(gate);
      this.resetPlayer(position.x, position.y);
      this.camera = { ...position };
      this.cityEntryPosition = null;
      // Every visit awards enough points toward the next ticket; a consolation
      // ticket prevents a low-scoring first park from trapping a beginner.
      this.tickets = Math.max(1, this.tickets);
      this.shopState.visitMask = 0;
      this.shopState.stockMask = S.OriginalEquipment.stockMask(this.gear, 3);
      this.shopState.attemptMask = 0;
      this.resetCityClock();
      this.tell("MEDAL CASH BUYS GEAR \u00b7 FIND THE NEXT PARK", 5);
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
    /** Carry the board at the rear of a real routed vehicle. Traffic still
     * runs its original scheduler; steering never redirects the car.
     */
    tryVehicleTow() {
      const p = this.player;
      if (
        p.vehicleTow ||
        p.air ||
        p.bail ||
        p.fallen > 0 ||
        p.towReleaseTime > this.elapsed ||
        this.input.held("jump")
      )
        return;
      for (const actor of this.trafficActors || []) {
        const rear = S.OriginalContact.vehicleRear(
          actor,
          this.objectRegistry.readContactWord,
        );
        if (
          !rear ||
          !S.OriginalContact.towHeadingAllowed(
            p.romDirection ?? 4,
            rear.direction,
          )
        )
          continue;
        const dx = p.x - rear.x,
          dy = (p.y - rear.y) * 2,
          along = dx * rear.ux + dy * rear.uy,
          side = dx * -rear.uy + dy * rear.ux;
        // Only the short strip behind the bumper admits a grab. Nose/side
        // contacts continue through the existing original crash response.
        if (
          along < -24 ||
          along > 8 ||
          Math.abs(side) > 14 ||
          p.vx * rear.ux + p.vy * 2 * rear.uy <= 0
        )
          continue;
        if (this.city.level.contactSample(rear.x, rear.y).blocked) continue;
        // Native towing assist: once caught, this car runs three original
        // motion clocks per simulation tick for the rest of its visible trip.
        // This provides the requested above-kick-speed tow without changing
        // ROM vectors, graphics, route selection or other traffic clocks.
        actor.towBoost = 3;
        p.vehicleTow = {
          actor, // Identity prevents latching to a replacement reusing this slot.
          sprite: actor.sprite,
          slot: actor.slot,
          actorX: actor.actorX,
          actorY: actor.actorY,
        };
        p.attachedSprite = actor.sprite;
        p.air = false;
        p.z = 0;
        p.fakie = false;
        p.jumpSequence = p.jumpRecovery = p.kickAnimation = null;
        p.romFacingDirection = undefined;
        p.x = rear.x;
        p.y = rear.y;
        p.kickWasHeld = this.input.held("kick");
        return;
      }
    }
    /** Native trigger turns rotate facing while wheel momentum stays separate. */
    requestGroundPivot(side) {
      const p = this.player;
      if (
        p.air ||
        p.bail ||
        p.fallen > 0 ||
        p.jumpSequence ||
        p.jumpRecovery ||
        p.vehicleTow ||
        p.curbGrind ||
        p.halfpipeWall ||
        p.halfpipeFlight ||
        p.copingReturn
      )
        return false;
      const last = p.lastTriggerPivot;
      const double =
        last &&
        last.side === side &&
        !last.doubleUsed &&
        this.elapsed - last.time <= 0.32;
      if (p.groundPivot) {
        if (!double) return false;
        p.groundPivot.total = Math.PI * 2;
        p.groundPivot.skid = true;
        last.doubleUsed = true;
        this.audio.effect("skid");
        return true;
      }
      p.groundPivot = {
        side,
        start: p.angle,
        total: Math.PI,
        elapsed: 0,
        skid: !!double,
        vx: p.vx,
        vy: p.vy,
        travel: p.romDirection ?? 4,
      };
      if (double) last.doubleUsed = true;
      else p.lastTriggerPivot = { side, time: this.elapsed, doubleUsed: false };
      p.skid = p.skidPose = null;
      p.kickAnimation = null;
      if (double) this.audio.effect("skid");
      return true;
    }
    updateGroundPivot(dt) {
      const p = this.player,
        state = p.groundPivot;
      if (!state) return false;
      state.elapsed += dt;
      const angle = Math.min(state.total, (state.elapsed * Math.PI) / 0.28);
      p.angle = state.start + state.side * angle;
      const drag = state.skid ? Math.exp(-dt * 0.65) : 1;
      state.vx *= drag;
      state.vy *= drag;
      p.romSpeed = Math.round((p.romSpeed || 0) * drag);
      p.vx = state.vx;
      p.vy = state.vy;
      p.romFacingDirection = S.OriginalContact.playerDirection(
        { air: true, angle: p.angle },
        S.OriginalGround.tables,
      );
      p.groundPivotPose = S.OriginalRoutines.sharpTurnAnimationEntries(
        p.romFacingDirection,
        state.side,
      );
      p.terrainStepOrigin = { x: p.x, y: p.y };
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      this.collideWithRecoveredTerrain();
      if (!p.groundPivot) return true;
      state.vx = p.vx;
      state.vy = p.vy;
      if (angle >= state.total) {
        const difference = (p.romFacingDirection - state.travel + 16) & 15;
        p.fakie = difference >= 6 && difference <= 10;
        p.romDirection = p.romMovementDirection = state.travel;
        p.romFacingDirection = p.fakie ? (state.travel + 8) & 15 : undefined;
        const direction = this.input.direction();
        // A trigger turn changes the stance under a held stick, unlike an
        // airborne turn which usually changes the stick heading too. Anchor
        // point steering here so the next small adjustment cannot snap travel
        // through 180 degrees. Rotation mode retains its reversed dial.
        p.fakiePointAnchor =
          p.fakie && direction.active
            ? { input: this.pointHeading(direction), travel: state.travel }
            : null;
        p.fakieSteeringTarget =
          p.fakie && direction.active ? state.travel : null;
        p.fakieTurnLatch = p.fakie ? this.input.stick.x : null;
        p.romDialAngle = Math.atan2(
          -S.OriginalGround.tables.y[state.travel] * 2,
          S.OriginalGround.tables.x[state.travel],
        );
        p.groundPivot = p.groundPivotPose = null;
      }
      if (this.mode === "city") this.updateCity(dt);
      else this.updateEvent(dt);
      this.camera.x += (p.x - this.camera.x) * Math.min(1, dt * 7);
      this.camera.y +=
        (this.cameraTargetY(p) - this.camera.y) * Math.min(1, dt * 7);
      return true;
    }
    /** Grind-button assist follows existing curb contours, never new walls. */
    tryCurbGrind() {
      const p = this.player;
      if (!this.input.held("grind")) p.curbGrindLatch = false;
      if (
        this.mode !== "city" ||
        p.curbGrind ||
        p.curbGrindLatch ||
        this.elapsed < (p.curbGrindCooldown || 0) ||
        !this.input.held("grind")
      )
        return;
      const mesh = S.TerrainCollision.debugMesh(this.city.level, "curbs");
      const state = S.CurbGrind.acquire(mesh, p);
      if (!state) return;
      if (p.air) {
        this.land();
        if (p.bail) return;
      }
      p.curbGrind = state;
      state.kickHeld = this.input.held("kick");
      p.skid = p.skidPose = null;
      p.jumpSequence =
        p.jumpAnimation =
        p.jumpRecovery =
        p.kickAnimation =
          null;
      p.air = false;
      p.z = 0;
      p.fakie = false;
      p.romFacingDirection = undefined;
      p.x = state.x;
      p.y = state.y;
    }
    releaseCurbGrind() {
      const p = this.player;
      if (!p.curbGrind) return;
      p.curbGrind = null;
      p.curbGrindPose = null;
      p.curbGrindLatch = true;
      p.curbGrindCooldown = this.elapsed + 0.35;
      p.z = 0;
      p.air = false;
      // Preserve outgoing tangent momentum in the normal ground controller.
      const unit = S.OriginalGround.velocity(1024, p.romDirection ?? 4);
      const speed =
        (Math.hypot(
          unit.dx + unit.fractionX / 256,
          (unit.dy + unit.fractionY / 256) * 2,
        ) *
          60) /
        64;
      p.romSpeed = Math.round(
        (Math.hypot(p.vx, p.vy * 2) / Math.max(0.001, speed)) * 1024,
      );
    }
    updateCurbGrind(dt) {
      const p = this.player,
        state = p.curbGrind;
      if (!state) return false;
      const kick = this.input.held("kick");
      if (!this.input.held("grind") || (kick && !state.kickHeld)) {
        if (kick && !state.kickHeld) p.kickWasHeld = false;
        this.releaseCurbGrind();
        return false;
      }
      state.kickHeld = kick;
      S.CurbGrind.step(state, dt);
      p.x = state.x;
      p.y = state.y;
      p.vx = state.vx;
      p.vy = state.vy;
      p.angle = Math.atan2(p.vy, p.vx);
      p.romDirection = p.romMovementDirection =
        S.OriginalContact.playerDirection(
          { air: true, angle: p.angle },
          S.OriginalGround.tables,
        );
      p.curbGrindPose = S.OriginalRoutines.sharpTurnAnimationEntries(
        p.romDirection,
        1,
      );
      p.terrainStepOrigin = null;
      p.lastSafe = { x: p.x, y: p.y };
      if (state.finished) this.releaseCurbGrind();
      this.updateCity(dt);
      this.camera.x += (p.x - this.camera.x) * Math.min(1, dt * 7);
      this.camera.y +=
        (this.cameraTargetY(p) - this.camera.y) * Math.min(1, dt * 7);
      return true;
    }
    releaseVehicleTow() {
      const p = this.player;
      if (!p.vehicleTow) return;
      p.towReleasedSprite = p.vehicleTow.sprite;
      p.towReleaseTime = this.elapsed + 0.65;
      p.vehicleTow = null;
      p.attachedSprite = 0;
      // Convert inherited car motion back to the existing original scalar,
      // preserving coasting/jump momentum rather than resetting to kick speed.
      const unit = S.OriginalGround.velocity(1024, p.romDirection ?? 4),
        vx = ((unit.dx + unit.fractionX / 256) * 60) / 64,
        vy = (-(unit.dy + unit.fractionY / 256) * 60) / 64;
      p.romSpeed = Math.round(
        (Math.hypot(p.vx, p.vy) / Math.max(0.001, Math.hypot(vx, vy))) * 1024,
      );
    }
    updateVehicleTow(dt) {
      const p = this.player,
        tow = p.vehicleTow;
      if (!tow) return false;
      const actor = this.trafficActors.find(
          (a) =>
            a === tow.actor && a.sprite === tow.sprite && a.slot === tow.slot,
        ),
        rear =
          actor &&
          S.OriginalContact.vehicleRear(
            actor,
            this.objectRegistry.readContactWord,
          );
      if (
        !rear ||
        this.mode !== "city" ||
        this.city.level.contactSample(rear.x, rear.y).blocked
      ) {
        this.releaseVehicleTow();
        return false;
      }
      p.vx = (actor.actorX - tow.actorX) / dt;
      p.vy = (actor.actorY - tow.actorY) / dt;
      tow.actorX = actor.actorX;
      tow.actorY = actor.actorY;
      p.romDirection = p.romMovementDirection = rear.direction;
      p.angle = Math.atan2(
        -S.OriginalGround.tables.y[rear.direction],
        S.OriginalGround.tables.x[rear.direction],
      );
      const kick = this.input.held("kick"),
        pressed = kick && !p.kickWasHeld;
      p.kickWasHeld = kick;
      if (pressed) {
        this.releaseVehicleTow();
        return false;
      }
      p.x = rear.x;
      p.y = rear.y;
      p.romSurfaceProfile = 24;
      p.romGroundActive = true;
      this.updateCity(dt);
      this.camera.x += (p.x - this.camera.x) * Math.min(1, dt * 7);
      this.camera.y +=
        (this.cameraTargetY(p) - this.camera.y) * Math.min(1, dt * 7);
      return true;
    }
    update(dt) {
      if (this.paused || !["city", "event"].includes(this.mode)) return;
      if (!(this.event?.level || this.city.level).ready) return;
      const p = this.player,
        e = this.event;
      this.elapsed += dt;
      if (e?.kind === "jump") S.OriginalTargetPalette.tick(e);
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
      p.crackJumpWindow = Math.max(0, (p.crackJumpWindow || 0) - 1);
      p.fenceJumpWindow = Math.max(0, (p.fenceJumpWindow || 0) - 1);
      if (p.fencePlantAir) p.fencePlantAge = (p.fencePlantAge || 0) + dt;
      if (p.crackSpringAge !== undefined) {
        if (p.air) p.crackSpringAge += dt;
        else delete p.crackSpringAge;
      }
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
      if (this.updateVehicleTow(dt)) return;
      this.tryCurbGrind();
      if (this.updateCurbGrind(dt)) return;
      if (this.updateGroundPivot(dt)) return;
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
      if (kickPressed && p.fakie && !p.air) this.exitFakieWithKick(direction);
      if (kickPressed && !p.halfpipeReturning && !p.fakie)
        p.romFacingDirection = undefined;
      p.kickWasHeld = kick;
      const stick = this.input.stick,
        rotating = this.input.controlMode === "rotate";
      const beforeSteering = {
        vx: p.vx,
        vy: p.vy,
        direction: p.romDirection ?? 4,
      };
      p.skidRequest = null;
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
          if (
            !p.fakie &&
            (stick.active ||
              this.input.held("left") ||
              this.input.held("right") ||
              kickPressed)
          )
            p.romFacingDirection = undefined;
          // Continuous analog dial adapter, followed by the original lookup.
          p.romDialAngle =
            (p.romDialAngle ?? p.angle) +
            (stick.active
              ? p.fakie &&
                p.fakieTurnLatch !== null &&
                Math.abs(stick.x - p.fakieTurnLatch) < 0.05
                ? 0
                : stick.x
              : Number(this.input.held("right")) -
                Number(this.input.held("left"))) *
              3.8 *
              dt *
              (p.fakie ? -1 : 1);
          p.romDialCounter = dialFromAngle(p.romDialAngle);
          p.romDirection = S.OriginalGround.dialDirection(p.romDialCounter);
          p.angle = isoAngle(p.romDirection);
        }
        if (direction.active && !rotating && !p.halfpipeReturning) {
          if (!p.fakie) p.romFacingDirection = undefined;
          const dial = dialFromAngle(Math.atan2(direction.y * 2, direction.x));
          const rawTarget = S.OriginalGround.dialDirection(dial);
          // Point input describes the facing axis; while fakie the board
          // rolls along its opposite axis. This makes steering reverse around
          // the held direction that established the backward stance.
          const anchor = p.fakie ? p.fakiePointAnchor : null;
          const target = anchor
            ? (anchor.travel + anchor.input - rawTarget + 16) & 15
            : (rawTarget + (p.fakie ? 8 : 0)) & 15;
          let current = p.romDirection;
          if (current === undefined)
            current = S.OriginalGround.dialDirection(dialFromAngle(p.angle));
          const latched =
            (p.fakie && target === p.fakieSteeringTarget) ||
            rawTarget === p.exitFakieTarget;
          if (!latched) p.fakieSteeringTarget = p.exitFakieTarget = null;
          const turn = S.OriginalRoutines.steeringDifference(
            latched ? 0 : target - current,
          );
          if (turn.distance >= 4 && rawTarget !== p.skidInputTarget)
            p.skidRequest = { direction: target, side: turn.step };
          p.skidInputTarget = rawTarget;
          p.romDirection = (current + turn.step + 16) & 15;
          p.romDialCounter = dial;
          p.romDialAngle = Math.atan2(direction.y, direction.x);
          p.angle = isoAngle(p.romDirection);
        }
        if (!direction.active) p.exitFakieTarget = null;
        if (p.fakie && !p.halfpipeReturning) {
          if (!direction.active)
            p.fakieSteeringTarget = p.fakiePointAnchor = null;
          if (!stick.active || Math.abs(stick.x) < 0.1) p.fakieTurnLatch = null;
          p.romFacingDirection = ((p.romDirection ?? 4) + 8) & 15;
          p.angle = isoAngle(p.romFacingDirection);
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
        p.halfpipeWall = p.copingReturn
          ? {
              rawProfile: p.copingReturn.rawProfile,
              profile:
                (p.copingReturn.rawProfile & 56) +
                S.Halfpipe.inclination(1 - p.copingReturn.t),
              progress: 1 - p.copingReturn.t,
            }
          : e?.kind === "ramp"
            ? S.Halfpipe.wallAt(e.level, p.x, p.y)
            : null;
        p.halfpipePoseProfile = p.halfpipeWall?.profile;
        // Complete the descent before handing steering back. Releasing this
        // midway down lets a still-held uphill stick reverse the skater on
        // the curve, repeatedly swapping poses without reaching the floor.
        if (p.halfpipeReturning && !p.halfpipeWall) p.halfpipeReturning = false;
        if (p.halfpipeWall)
          surface = { ...surface, profile: p.halfpipeWall.profile };
        // Recovered surface coefficients and grounded arithmetic apply to flag0.
        // The input adapter still supplies turning and kick state timing.
        if (
          (surface.type === 0 ||
            (!e && [5, 6, 7, 8, 17].includes(surface.type)) ||
            // Painted course markers (direction/start, finish, target, lip)
            // carry gameplay flags, not a different physical road surface.
            (["slalom", "downhill", "jump"].includes(e?.kind) &&
              [9, 10, 15, 16].includes(surface.type)) ||
            (!e &&
              (surface.terrainLayer === "raised" ||
                (surface.type >= 128 && surface.profile === 32))) ||
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
            p.fakie ? S.CONFIG.fakieTopSpeed : 1,
          );
          // The original flat kick target can sit below downhill momentum.
          // A fresh push still adds a small amount; holding A does not repeat it.
          if (kind === 2 && kickPressed && scalar > 0) {
            const limit =
              (S.CONFIG.downhillKickLimit + gear * 128) *
              (p.fakie ? S.CONFIG.fakieTopSpeed : 1);
            scalar += Math.max(
              0,
              Math.min(
                S.CONFIG.downhillKickImpulse,
                Math.floor(limit - scalar),
              ),
            );
          }
          // Fakie reverses the body pose, not the rolling vector. Selecting
          // coefficients from its facing angle reverses travel one frame
          // after landing. Keep movement tied to the retained travel heading.
          let best = Infinity,
            direction = 0;
          for (let i = 0; i < 16; i++) {
            const error = Math.abs(
              S.angleDelta(
                Math.atan2(-rom.tables.y[i], rom.tables.x[i]),
                p.fakie ? isoAngle(p.romDirection ?? 4) : p.angle,
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
          const groundY =
            p.romGroundVertical.velocity + p.romGroundVertical.fraction / 256;
          Object.assign(
            p,
            this.projectGroundMotion(
              motion,
              p.romGroundVertical,
              p.halfpipeWall,
              e?.level,
            ),
          );
          if (p.copingReturn) {
            const path = p.copingReturn;
            const travel =
              Math.hypot(
                motion.dx + motion.fractionX / 256,
                motion.dy + motion.fractionY / 256,
                groundY,
              ) / 64;
            path.t = Math.min(1, path.t + travel / path.length);
            const next = S.Halfpipe.returnPoint(path, path.t);
            p.vx = (next.x - p.x) * 60;
            p.vy = (next.y - p.y) * 60;
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
          const travelAngle = p.fakie ? isoAngle(p.romDirection ?? 4) : p.angle;
          p.vx += Math.cos(travelAngle) * acceleration * dt;
          p.vy += Math.sin(travelAngle) * acceleration * dt;
          const drag = Math.exp(
            -((kick ? 0.65 : 1.55) + this.input.brake * 6) * dt,
          );
          p.vx *= drag;
          p.vy *= drag;
        }
        // Native traction adapter: original steering changes headings in
        // steps, which previously redirected all momentum on each step.
        // A fast, fresh quarter turn now retains wheel-side momentum briefly.
        // Original E458 pose tables supply the graphics; traction duration is
        // a deliberate gameplay enhancement, not a claimed ROM constant.
        if (
          p.skidRequest &&
          !p.skid &&
          !p.fakie &&
          !p.halfpipeReturning &&
          !p.copingReturn &&
          (surface.profile & 7) === 0 &&
          Math.abs(p.romSpeed || 0) >= 0x500
        ) {
          p.skid = {
            ...beforeSteering,
            side: p.skidRequest.side,
            remaining: 0.38,
          };
          p.romDirection = p.skidRequest.direction;
          p.angle = isoAngle(p.romDirection);
          this.audio.effect("skid");
        }
        if (p.skid) {
          const skid = p.skid;
          if (
            (surface.profile & 7) !== 0 ||
            p.copingReturn ||
            p.halfpipeReturning
          )
            skid.remaining = 0;
          if (skid.remaining > 0) {
            const grip = 1 - Math.exp(-dt * 5);
            skid.vx += (p.vx - skid.vx) * grip;
            skid.vy += (p.vy - skid.vy) * grip;
            p.vx = skid.vx;
            p.vy = skid.vy;
            skid.remaining -= dt;
            p.skidPose = S.OriginalRoutines.sharpTurnAnimationEntries(
              p.romDirection,
              skid.side,
            );
          } else {
            p.skid = null;
            p.skidPose = null;
          }
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
          const heldFakieInput =
            p.fakie &&
            p.fakieAirInput !== null &&
            Math.abs(S.angleDelta(target, p.fakieAirInput)) < 0.01;
          if (!heldFakieInput) {
            p.fakieAirInput = null;
            p.spin += S.angleDelta(target, p.angle);
          }
        } else p.spin += spinDirection * spinRate * dt;
        if (!direction.active) p.fakieAirInput = null;
        p.angle = p.takeoffAngle + p.spin;
        p.airTime += dt;
        // The original gap counter increments while airborne over the gap
        // contact flag (bank1E000 CPU5494). Count fixed simulation ticks.
        if (
          (e?.level || this.city.level).sample(p.x, p.y).type === 18 ||
          (e?.level || this.city.level).sample(p.x, p.y).type === 11
        )
          p.scoreGapFrames = (p.scoreGapFrames || 0) + 1;
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
          if (
            ["downhill", "jump"].includes(e?.kind) &&
            (support.blocked ||
              (e?.kind === "jump" &&
                (p.courseShadowY === null || p.courseShadowY > p.y + 1)))
          ) {
            // Crossing the takeoff plane over empty scenery is still flight.
            // Keep the current impulse/momentum until lower support is found.
            p.dropFall = { frames: 0 };
          } else if (p.halfpipeFlight) this.landHalfpipe();
          else this.land();
        }
      }
      const maxSpeed =
        (kick ? 220 + this.gear.board * 24 : 180 + this.gear.board * 20) *
        (p.fakie ? S.CONFIG.fakieTopSpeed : 1);
      const speed = Math.hypot(p.vx, p.vy);
      if (
        !p.romGroundActive &&
        !p.jumpSequence &&
        !p.fencePlantAir &&
        speed > maxSpeed
      ) {
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
      this.updateCopingTravel();
      if (p.copingReturn?.t >= 1) {
        p.x = p.copingReturn.floor.x;
        p.y = p.copingReturn.floor.y;
        p.lastSafe = { x: p.x, y: p.y };
        p.copingReturn = null;
        p.halfpipeReturning = false;
      }
      if (e?.kind === "jump" && p.air) this.updateCourseShadow(dt);
      if (p.dropFall) this.updateDropContact();
      this.collideWithRecoveredTerrain();
      if (this.mode === "city") this.updateCity(dt);
      else this.updateEvent(dt);
      this.camera.x +=
        (p.x + S.Halfpipe.groundShift(this.event?.level, p) - this.camera.x) *
        Math.min(1, dt * 7);
      this.camera.y +=
        (this.cameraTargetY(p) - this.camera.y) * Math.min(1, dt * 7);
    }
    /** Sprite-derived directional board outline against original actor masks.
     * Special post-impact footprint/remaining response controllers are pending.
     */
    actorMaskContact(actor, pointer = actor.extraPointer) {
      if (!pointer) return false;
      const read = this.objectRegistry.readContactWord;
      const footprint = this.boardFootprint?.(this.player);
      if (footprint) {
        const p = this.player,
          shape = S.OriginalContact.readShape(pointer, read);
        return S.BoardGeometry.touchesActor(
          footprint,
          {
            x: p.x,
            y:
              p.y -
              p.z -
              S.Halfpipe.groundRise(this.event?.level, p) +
              Math.min(Math.max(0, p.z), p.halfpipeFlight?.contactHeight || 0),
          },
          actor,
          shape,
          S.OriginalContact.maskCells(shape, read),
        );
      }
      return (
        S.OriginalContact.maskContact(
          S.OriginalContact.actorContact(actor, pointer, read),
          S.OriginalContact.playerContact(
            this.player,
            read,
            S.OriginalGround.tables,
          ),
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
      const earlyCrackJump =
        p.air &&
        p.crackJumpWindow > 0 &&
        p.airTime <= 0.1 &&
        p.crackSpringAge === undefined;
      if ((!p.air || earlyCrackJump) && !p.bail && p.fallen <= 0) {
        for (const crack of this.cracks) {
          if (
            (earlyCrackJump
              ? S.OriginalCracks.touches(p, crack)
              : this.actorMaskContact(crack, 0x7a30)) &&
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

      // Expanded isometric entrance column. Use the ground-plane position,
      // including airborne crossings, so an ollie cannot skip the doorway.
      // This is a trigger, not a solid fence. Return positions lie outside it.
      const gate =
        !p.bail && p.fallen <= 0
          ? this.city.gates.find((g) => {
              const dx = p.x - g.x,
                dy = p.y - g.y;
              return (
                Math.abs(dx + 2 * dy) <= 112 && Math.abs(dx - 2 * dy) <= 112
              );
            })
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
        this.tell("SKATE OR DIE! \u00b7 GET TO A PARK!", 6);
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
        this.tryVehicleTow();
        const read = this.objectRegistry.readContactWord;
        const contact = [...(this.trafficActors || [])]
          .sort((a, b) => b.sprite - a.sprite)
          .find(
            (actor) =>
              actor.sprite !== p.attachedSprite &&
              !(
                actor.sprite === p.towReleasedSprite &&
                p.towReleaseTime > this.elapsed
              ) &&
              this.actorMaskContact(actor),
          );
        if (!contact) p.lastOriginalContact = 0;
        else {
          const code = S.OriginalContact.responseCode(
            contact.kind,
            !p.air,
            Math.round(p.z * 64),
            this.objectRegistry.readTypeByte,
          );
          // A70C uses the original cash table and retires rider types56..65.
          // The response height gate still admits jumps in front/onto them
          // near board contact, while a high clear jump remains a pass-over.
          if (code === 8 && contact.sprite !== (p.attachedSprite || 0)) {
            const cash = S.OriginalContact.riderCash(contact.kind);
            if (cash && p.lastOriginalContact !== contact.sprite) {
              this.cash = Math.max(0, Math.min(9999, this.cash + cash));
              this.trafficRuntime.remove(contact.slot);
              this.trafficActors = this.trafficActors.filter(
                (a) => a !== contact,
              );
              this.audio.effect("takedown");
            }
            p.lastOriginalContact = contact.sprite;
            return;
          }
          const airbornePedestrian =
            code === 6 &&
            p.air &&
            contact.sprite !== (p.attachedSprite || 0) &&
            !S.OriginalContact.pedestrianKnockdown(
              Math.round(p.z * 64) - (contact.height || 0),
              contact.sprite,
              p.attachedSprite || 0,
            );
          if (airbornePedestrian && p.lastOriginalContact !== contact.sprite) {
            const award = S.OriginalContact.airbornePedestrianReward(
              this.pedestrianReward,
              contact.kind,
            );
            if (award.points) {
              this.addScore(award.points);
              const effect = S.OriginalEffects.beginLandingEffect(
                award.index,
                p.x,
                p.y - p.z,
                0,
              );
              S.OriginalEffects.tickLandingEffect(effect, p.x, p.y - p.z);
              this.floats.push(effect);
            }
            S.OriginalContact.saveActorMotion(
              contact,
              this.trafficRuntime.actorRecovery,
              this.trafficActors.find((a) => a.sprite === 5),
            );
            S.OriginalContact.knockDownActor(
              contact,
              this.objectRegistry.readTypeWord,
            );
            S.OriginalActorRoutes.release(
              contact.bitmapIndex,
              this.objectRegistry,
            );
            this.trafficRuntime.sync(contact);
            p.lastOriginalContact = contact.sprite;
            return;
          }
          // Grounded/low pedestrian contacts retain their original player bail.
          const pedestrianHit =
            code === 6 &&
            S.OriginalContact.pedestrianKnockdown(
              Math.round(p.z * 64) - (contact.height || 0),
              contact.sprite,
              p.attachedSprite || 0,
            );
          if (
            (code === 2 || code === 7 || pedestrianHit) &&
            p.lastOriginalContact !== contact.sprite &&
            p.invulnerable <= 0
          ) {
            const player = S.OriginalContact.playerContact(
              p,
              read,
              S.OriginalGround.tables,
            );
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
            this.crash(
              pedestrianHit ? "PEDESTRIAN COLLISION" : "TRAFFIC COLLISION",
            );
            if (pedestrianHit) {
              S.OriginalContact.saveActorMotion(
                contact,
                this.trafficRuntime.actorRecovery,
                this.trafficActors.find((actor) => actor.sprite === 5),
              );
              S.OriginalContact.knockDownActor(
                contact,
                this.objectRegistry.readTypeWord,
              );
              S.OriginalActorRoutes.release(
                contact.bitmapIndex,
                this.objectRegistry,
              );
              this.trafficRuntime.sync(contact);
            }
          }
          if (code !== null) p.lastOriginalContact = contact.sprite;
        }
      }
      // Speaker87 maps to61DA response0: its original contact causes no bail.
      // Scenery/terrain contact remains responsible for its solid platform.
    }
    boostFencePlant() {
      const p = this.player;
      if (!p.fencePlantAir || p.fencePlantBoosted) return false;
      p.fencePlantBoosted = true;
      p.fenceJumpWindow = 0;
      const impulse = S.OriginalRoutines.ordinaryJumpLaunch(
        Math.min(3, this.gear.shoes),
      );
      p.romVerticalVelocity += Math.round(
        impulse * S.CONFIG.fencePlantExtraImpulse,
      );
      p.vz = (p.romVerticalVelocity * 60) / 64;
      p.vx *= S.CONFIG.fencePlantSpeedBoost;
      p.vy *= S.CONFIG.fencePlantSpeedBoost;
      p.romSpeed = Math.round(
        (p.romSpeed || 0) * S.CONFIG.fencePlantSpeedBoost,
      );
      this.popup("BOOSTED FENCE PLANT");
      return true;
    }
    /** Native boneless-style fence rebound; original jump art supplies poses. */
    fencePlant() {
      const p = this.player;
      if (this.elapsed - (p.lastFencePlant ?? -Infinity) < 0.25) return;
      p.lastFencePlant = this.elapsed;
      p.fencePlantAir = true;
      p.fencePlantAge = 0;
      p.fencePlantBoosted = false;
      p.romVerticalVelocity = Math.max(
        p.romVerticalVelocity || 0,
        Math.round(
          S.OriginalRoutines.ordinaryJumpLaunch(Math.min(3, this.gear.shoes)) *
            S.CONFIG.fencePlantImpulse,
        ),
      );
      p.vz = (p.romVerticalVelocity * 60) / 64;
      p.romGravity = 12;
      p.angle = p.takeoffAngle = Math.atan2(p.vy, p.vx);
      p.spin = 0;
      p.fakie = false;
      p.romFacingDirection = undefined;
      p.romDirection = p.romMovementDirection =
        S.OriginalContact.playerDirection(
          { air: true, angle: p.angle },
          S.OriginalGround.tables,
        );
      p.scoreTakeoffDirection = p.romDirection;
      p.scoreTakeoffBackwards = false;
      p.scoreGapFrames = 0;
      p.jumpSequence = p.jumpRecovery = null;
      const rate = S.OriginalRoutines.jumpAnimationRate(p.romSpeed || 0);
      p.jumpAnimation = { phase: 1, rate, countdown: rate };
      p.airTime = 0;
      this.audio.effect("jump");
      this.popup("FENCE PLANT");
      if (p.fenceJumpWindow > 0) this.boostFencePlant();
    }
    collideWithRecoveredTerrain() {
      const p = this.player,
        level = this.event?.level || this.city.level;
      if (p.dropFall) return;
      // These motions already follow a finite, clamped coping path.
      if (p.copingReturn || p.halfpipeFlight?.trick === "grind") {
        p.terrainStepOrigin = null;
        p.edgeContact = false;
        return;
      }
      const wall = p.halfpipeWall;
      if (
        this.event?.kind === "ramp" &&
        !p.air &&
        !p.bail &&
        wall &&
        wall.progress > 0.7 &&
        !S.Halfpipe.wallAt(level, p.x, p.y) &&
        (p.romGroundVertical?.velocity || 0) > 0
      ) {
        if (this.launchHalfpipe(wall)) return;
      }
      // Halfpipe enclosure walls stay solid during airs and bail motion.
      // Support gaps remain airborne space; only the wall mesh blocks a jump.
      const halfpipeBoundary = this.event?.kind === "ramp";
      if (
        ((!p.bail && p.fallen <= 0) || halfpipeBoundary) &&
        p.terrainStepOrigin
      ) {
        const slide = S.TerrainCollision.sweep(
          level,
          p.terrainStepOrigin,
          p,
          {
            x: p.vx,
            y: p.vy,
          },
          {
            bounce: p.air && !p.bail && !p.halfpipeFlight,
            barriersOnly:
              p.air ||
              p.bail ||
              ["downhill", "jump"].includes(this.event?.kind),
          },
        );
        if (slide.hits) {
          p.x = slide.x;
          p.y = slide.y;
          p.vx = slide.vx;
          p.vy = slide.vy;
          p.diagonalContacts = slide.hits;
          if (p.air && !p.bail && !p.halfpipeFlight) this.fencePlant();
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
      for (const actor of e.actors || []) {
        const motion = S.OriginalActors.stepMotionActor(
          actor,
          this.actorMemory,
        );
        actor.actorX += motion.dx / 64;
        actor.actorY -= motion.dy / 64;
      }
      e.elapsed += dt;
      e.timer -= dt;
      if (e.kind === "ramp") {
        // The decoded surface profiles supply wall travel. Do not clamp the
        // pipe to a guessed rotated rectangle or reflect against an invisible
        // lip: those limits cut through valid ramp lanes and its grass apron.
      } else {
        if (e.kind === "slalom") {
          const previous = e.gateProbe || { x: p.x, y: p.y };
          if (!p.air && !p.bail)
            for (const gate of e.gates) {
              if (gate.hit || gate.missed) continue;
              // Sweep the board against the original pass mask, so a fast
              // crossing cannot skip it and touching a nearby pole cannot score.
              const end = { x: p.x, y: p.y };
              const steps = Math.min(
                32,
                Math.max(
                  1,
                  Math.ceil(
                    Math.hypot(end.x - previous.x, end.y - previous.y) / 4,
                  ),
                ),
              );
              let passed = false;
              for (let n = 1; n <= steps && !passed; n++) {
                p.x = previous.x + ((end.x - previous.x) * n) / steps;
                p.y = previous.y + ((end.y - previous.y) * n) / steps;
                passed = this.actorMaskContact(gate.actor);
              }
              p.x = end.x;
              p.y = end.y;
              if (passed) {
                gate.hit = true;
                e.gatesHit++;
                // A7D6 updates the race counter; A7F0 selects frame2 (+4).
                e.originalRaceCounter = Math.min(
                  128,
                  (e.originalRaceCounter || 0) + 6,
                );
                gate.actor.pointer += 4;
                if (gate.companion) gate.companion.pointer += 4;
                this.addScore(300, "GATE +300"); // Native award pending race tally integration.
                this.audio.effect("coin");
              }
            }
          e.gateProbe = { x: p.x, y: p.y };
        }
        if (e.kind === "jump") {
          for (const ramp of e.ramps) {
            if (
              Math.abs(p.y - ramp.y) < 80 &&
              Math.abs(p.x - ramp.x) < 125 &&
              !p.air
            )
              this.tell("JUMP AT THE LIP \u00b7 LAND ON THE NEXT PLATFORM", 2);
          }
        }
        const finishPoint = {
          x: p.x,
          y: p.air && Number.isFinite(p.courseShadowY) ? p.courseShadowY : p.y,
        };
        if (
          S.FinishTrigger.crosses(
            e.level.finishTrigger,
            e.finishProbe || finishPoint,
            finishPoint,
          )
        )
          e.crossedFinish = true;
        e.finishProbe = finishPoint;
        // Jump-park scoring resolves at touchdown. Remember an airborne
        // crossing so the finish cannot be skipped, but let land() score the
        // final target before displaying the result.
        if (e.crossedFinish && (e.kind !== "jump" || !p.air)) {
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
          towing: p.vehicleTow?.sprite ?? null,
          fakie: !!p.fakie,
          skidding: !!p.skid || !!p.groundPivot?.skid,
          triggerTurning: !!p.groundPivot,
          curbGrinding: !!p.curbGrind,
          facingDirection: p.romFacingDirection ?? p.romDirection,
          travelDirection: p.romMovementDirection ?? p.romDirection,
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
            "original accumulator, airtime and ramp/jump medal/cash; race results provisional",
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
