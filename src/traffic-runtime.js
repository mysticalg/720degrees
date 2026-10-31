/** Live adapter composing the translated static traffic routines.
 * Original tables choose paths, poses, speeds, reservations and deadlines.
 * Browser camera coordinates and PNG unwrapping remain explicit adapters.
 * Traffic replacement requests use the original population selector.
 * Recovered sprite masks supply contact; engine audio decoding is pending.
 */
(() => {
  const word = (n) => n & 65535,
    signed = (n) => (n << 16) >> 16;
  class TrafficRuntime {
    constructor(S, memory, spriteReader, fixedSlots = []) {
      this.S = S;
      this.memory = { ...memory, readSpriteByte: spriteReader };
      this.fixedSlots = new Set(fixedSlots);
      this.actors = new Map();
      this.visible = [];
      this.requests = [];
      this.population = { counts: new Uint8Array(21), total: 0, difficulty: 1 };
      // Browser entropy replaces cabinet entropy only. Selection and routing
      // still use the original population routines and original candidate tables.
      this.entropy = {
        bytes: crypto.getRandomValues(new Uint8Array(32)),
        index: 0,
      };
      this.entropyReads = 0;
      this.soundCommands = [];
      this.previousCamera = null;
      this.difficulty = 1;
      this.dynamicCursor = 63;
      S.OriginalPopulation.resetRequests(this.population, 1, this.memory);
      this.actorRecovery = { timer: 0, sprite: 255 };
      memory.writeRamByte(0x0e96, 14);
      memory.writeRamByte(0x0e97, 2);
      // Type1 event-pad actors are not in this native renderer's pool yet.
      this.write(0x09a8, 65535);
      this.services = {
        resolve: S.OriginalRoutines.resolveObjectPlacement,
        coordinates: S.OriginalRoutines.objectCoordinates,
        request: (g) => {
          this.requests.push(g);
          S.OriginalPopulation.request(this.population, g);
        },
        remove: (slot) => this.remove(slot, true),
        prepareTraffic: (kind) =>
          S.OriginalTrafficSound.acquire(
            kind,
            this.memory,
            S.ACTOR_TABLE_DATA.trafficSound,
            (c) => this.soundCommands.push(c),
          ),
        releaseTraffic: (kind) =>
          S.OriginalTrafficSound.release(kind, this.memory, (c) =>
            this.soundCommands.push(c),
          ),
      };
    }
    /** D2AE's class-specific city actors. Refresh only the static registry;
     * fixed scenery and the player's equipment survive course returns.
     * mapDifficulty is supplied by the existing native progression adapter.
     */
    setDifficulty(difficulty) {
      difficulty = Math.max(1, Math.min(10, difficulty));
      if (difficulty === this.difficulty) return;
      for (let slot = 0; slot < 255; slot++)
        if (
          !this.fixedSlots.has(slot) &&
          this.memory.readRamByte(0x09b8 + slot)
        )
          this.remove(slot);
      this.S.OriginalPopulation.resetRequests(
        this.population,
        difficulty,
        this.memory,
      );
      this.write(0x09ae, 65535);
      for (const record of [
        ...this.S.ACTOR_TABLE_DATA.gateInitial,
        ...this.S.ACTOR_TABLE_DATA.cityInitial[difficulty],
      ]) {
        const result = this.S.OriginalObjectRegistry.enqueue(
          record.packed,
          record.kind,
          false,
          this.memory,
          {
            inspect: this.S.OriginalActorRoutes.inspect,
            resolve: this.services.resolve,
          },
        );
        // D2C8 ignores CE24 rejection when a placement is already reserved.
        if (result.status !== 0) continue;
      }
      this.difficulty = difficulty;
    }
    /** DA02/70E8: wake only the active gate for a newly entered park.
     * This0EA4 mask is independent of the played/closed mask0F29.
     */
    setEnteredParks(mask) {
      const changed = mask & ~this.memory.readRamByte(0x0ea4);
      this.memory.writeRamByte(0x0ea4, mask);
      if (!changed) return;
      for (const actor of this.actors.values()) {
        if (this.memory.readTypeByte(0x623f + actor.kind) !== 7) continue;
        const group =
          this.memory.readTraitByte(0x4000 + actor.bitmapIndex) & 15;
        if (group && changed & (1 << (group - 1))) actor.duration = 1;
      }
    }
    read(a) {
      return this.memory.readRamByte(a) | (this.memory.readRamByte(a + 1) << 8);
    }
    write(a, n) {
      this.memory.writeRamByte(a, n);
      this.memory.writeRamByte(a + 1, n >> 8);
    }
    remove(slot, budgetReturned = false) {
      const actor = this.actors.get(slot);
      if (actor && !budgetReturned) {
        const flags = this.memory.readTypeByte(0x649d + actor.kind);
        if (flags & 16)
          this.memory.writeRamByte(0x0e96, this.memory.readRamByte(0x0e96) + 1);
        if (flags & 64) {
          this.memory.writeRamByte(0x0e97, this.memory.readRamByte(0x0e97) + 1);
          this.services.releaseTraffic(actor.kind);
        }
      }
      this.S.OriginalObjectRegistry.remove(slot, this.memory, {
        ...this.services,
        release: this.S.OriginalActorRoutes.release,
        retireSprite: (sprite) =>
          this.S.OriginalActorSpawning.retireSprite(sprite, this.memory),
      });
      this.actors.delete(slot);
    }
    retire(slot) {
      const result = this.S.OriginalActorSpawning.retireActor(
        slot,
        this.memory,
        this.services,
      );
      if (result.status !== "retained") this.actors.delete(slot);
      return result;
    }
    camera(camera, width, height) {
      const left = Math.round(this.S.clamp(camera.x, 256, width - 256) - 256);
      const top = Math.round(this.S.clamp(camera.y, 192, height - 192) - 192);
      const cx = word(left * 64),
        cy = word((top - 128) * 64);
      if (
        !this.previousCamera ||
        Math.abs(left - this.previousCamera.left) > 128 ||
        Math.abs(top - this.previousCamera.top) > 128
      ) {
        for (const slot of [...this.actors.keys()]) this.retire(slot);
        let lo = Math.floor(left / 256) * 16 - 16,
          hi = lo + 64;
        let row = Math.floor((top - 128) / 256),
          bottom = row + 3,
          phase = 0;
        while (bottom > 12) {
          row -= 12;
          bottom -= 12;
          lo += 80;
          hi += 80;
          phase--;
        }
        while (bottom < 0) {
          row += 12;
          bottom += 12;
          lo -= 80;
          hi -= 80;
          phase++;
        }
        for (const [a, n] of [
          [0x0996, lo],
          [0x0998, hi],
          [0x099a, row],
          [0x099c, bottom],
          [0x099e, 12],
          [0x09a0, cx & 0xc000],
          [0x09a2, cy & 0xc000],
        ])
          this.write(a, n);
        this.memory.writeRamByte(0x0e9b, phase);
      }
      for (const [a, n] of [
        [0x01ac, cx],
        [0x01ae, cy],
        [0x01a8, cx],
        [0x01aa, cy],
      ])
        this.write(a, n);
      this.S.OriginalMapState.updateActorViewport(this.memory);
      this.previousCamera = { left, top };
    }
    position(actor) {
      const m = this.memory;
      return this.S.OriginalRoutines.objectCoordinates(
        actor.packed,
        actor.bitmapIndex,
        m.readRamByte(0x0e9b),
        this.read(0x099c),
        m.readCoordinateOrFixedWord,
      );
    }
    route(actor) {
      const S = this.S,
        m = this.memory,
        placement = this.services.resolve(
          actor.packed,
          actor.slot,
          m.readObjectWord,
        );
      actor.bitmapIndex = placement.bitmapIndex;
      const prepare = (next, address) => {
        const direction = m.readObjectByte(address + 2),
          route = m.readObjectByte(address + 3);
        const result = S.OriginalActors.updateRouteActor(
          actor,
          direction,
          route,
          m,
          (a) => S.OriginalActors.reprojectTurn(a, this.position(a), m),
        );
        return result.placementPending ? 1 : 0;
      };
      const primary = (address) =>
        S.OriginalActorRoutes.tryAdvance(
          actor,
          m.readObjectWord(address),
          placement.bitmapIndex,
          m,
          (next) => prepare(next, address),
        );
      const alternate = (address) =>
        S.OriginalActorRoutes.tryAlternate(
          actor,
          address,
          placement.bitmapIndex,
          m,
          prepare,
        );
      const result = S.OriginalActorRoutes.chooseRouteRecord(
        actor,
        placement.bitmapIndex,
        placement.recordPointer,
        m,
        {
          primary,
          alternate,
          resume: (address) => {
            // CA68 calls BFBC after BE7C without testing availability again.
            const target = m.readObjectWord(address);
            const next = S.OriginalActorRoutes.inspect(target, actor.slot, m);
            if (prepare(next, address))
              return { status: 1, placementPending: true };
            Object.assign(
              actor,
              S.OriginalActorRoutes.commit(
                actor.packed,
                target,
                actor.slot,
                placement.bitmapIndex,
                next.bitmapIndex,
                actor.paletteFlags,
                m,
              ),
            );
            return { status: 0, advanced: true, next };
          },
        },
      );
      if (result.advanced) actor.bitmapIndex = result.next.bitmapIndex;
      this.write(0x0af8 + actor.slot * 2, actor.packed);
    }
    sync(actor) {
      const m = this.memory,
        s = actor.sprite;
      for (const [field, base] of [
        ["x", 0x06f0],
        ["y", 0x0730],
        ["pointer", 0x03b0],
        ["extraPointer", 0x03f0],
        ["duration", 0x0430],
        ["dx", 0x04f0],
        ["dy", 0x0570],
      ])
        this.write(base + s * 2, actor[field] || 0);
      for (const [field, base] of [
        ["flags", 0x0490],
        ["routeFlags", 0x04b0],
        ["rate", 0x0770],
        ["countdown", 0x0790],
        ["direction", 0x07d0],
        ["paletteFlags", 0x0470],
      ])
        m.writeRamByte(base + s, actor[field] || 0);
      this.write(0x0630 + s * 2, actor.x - this.read(0x01a8));
      this.write(
        0x0670 + s * 2,
        actor.y + this.read(0x01aa) + (actor.height || 0),
      );
      const location = actor.packed & 511,
        col = location >> 4,
        row = location & 15;
      actor.actorX = col * 256 + signed(actor.x - col * 256 * 64) / 64;
      actor.actorY =
        (row + 1) * 256 + signed(0xa000 - actor.y - (row + 1) * 256 * 64) / 64;
    }
    /** CB56-CDC8 visits controllers by descending sprite, independently of
     * B378-B4AE's descending motion pass. Keep that ordering in the native
     * 60Hz composition: a partner's signal must reach its descriptor before
     * any actor advances that descriptor/moves this tick. Map insertion order
     * reflects camera activation, not the original sprite scheduler.
     */
    advanceActors() {
      const S = this.S,
        m = this.memory;
      const ordered = [...this.actors.values()].sort(
        (a, b) => b.sprite - a.sprite,
      );
      const live = ordered;
      // Towing is an explicit native assist. Extra car clocks still use
      // controller then motion, including turns, rather than scaled XY.
      const clocks = Math.max(1, ...live.map((actor) => actor.towBoost || 1));
      for (let clock = 0; clock < clocks; clock++) {
        for (const actor of live) {
          if (
            clock >= (actor.towBoost || 1) ||
            this.actors.get(actor.slot) !== actor
          )
            continue;
          const category = m.readTypeByte(0x623f + actor.kind);
          const passive = S.OriginalActors.passiveActorStep(actor, category);
          // remove() returns the original population budget and requests
          // replacement. Passive category6/9 have the type16 budget flag.
          if (passive === "retire") {
            this.remove(actor.slot);
            continue;
          }
          if (passive === "viewport") {
            this.sync(actor);
            S.OriginalActorSpawning.processRecord(actor.slot, m, {
              retire: (slot) => this.retire(slot),
              // This actor's registry entry is active. A pending entry is
              // handled by the ordinary visibility scanner, not respawned.
              spawn: () => {},
            });
            if (this.actors.get(actor.slot) !== actor) continue;
          }
          // Category0 scenery has a descriptor clock but no route controller.
          // Categories1/3/8 share CA4C routing. Categories3/8 also signal
          // their original partner poses before advancing the sender.
          if (category === 7 && S.OriginalActors.gateRouteDue(actor, m))
            this.route(actor);
          if (
            [1, 3, 8].includes(category) &&
            S.OriginalActors.trafficRouteDue(actor)
          ) {
            if (category === 3) {
              const partner = S.OriginalActors.signalRoutePartner(
                actor,
                m,
                (slot) => this.actors.get(slot),
              );
              if (partner) this.sync(partner);
            }
            if (category === 8) {
              const partner = S.OriginalActors.updatePairedRoute(
                actor,
                m,
                (slot) => this.actors.get(slot),
                () => this.route(actor),
              );
              if (partner) this.sync(partner);
            } else this.route(actor);
          }
          this.sync(actor);
        }
        for (const actor of live) {
          if (
            clock >= (actor.towBoost || 1) ||
            this.actors.get(actor.slot) !== actor
          )
            continue;
          const motion = S.OriginalActors.stepMotionActor(actor, m);
          actor.x = word(actor.x + motion.dx);
          actor.y = word(actor.y + motion.dy);
          actor.height = word((actor.height || 0) + motion.dz);
          this.sync(actor);
        }
      }
    }
    frame(camera, width, height) {
      const S = this.S,
        m = this.memory;
      this.camera(camera, width, height);
      S.OriginalContact.tickActorRecovery(this.actorRecovery, (sprite) =>
        [...this.actors.values()].find((actor) => actor.sprite === sprite),
      );
      this.advanceActors();
      if (this.population.total) {
        S.OriginalPopulation.spawnOne(
          this.population,
          {
            phase: 1,
            bounds: {
              left: this.read(0x0996),
              right: this.read(0x0998),
              top: this.read(0x099a),
              bottom: this.read(0x099c),
            },
          },
          m,
          () => {
            if (this.entropyReads && !(this.entropyReads & 31))
              crypto.getRandomValues(this.entropy.bytes);
            this.entropyReads++;
            return S.OriginalPopulation.nextBufferedRandom(this.entropy);
          },
          (candidate) =>
            S.OriginalObjectRegistry.enqueue(
              candidate.packed,
              candidate.kind,
              candidate.dynamic,
              m,
              {
                inspect: S.OriginalActorRoutes.inspect,
                resolve: this.services.resolve,
              },
            ).status,
        );
      }
      const scanner = {
        process: (slot) => {
          if (this.fixedSlots.has(slot)) return;
          S.OriginalActorSpawning.processRecord(slot, m, {
            retire: (s) => this.retire(s),
            spawn: (s) => {
              const result = S.OriginalActorSpawning.spawnActor(
                s,
                m,
                this.services,
              );
              if (result.status === "active") {
                const actor = result.actor;
                actor.flags = m.readRamByte(0x0490 + actor.sprite);
                actor.routeFlags = m.readRamByte(0x04b0 + actor.sprite);
                actor.packed = result.packed;
                actor.phase = 0;
                actor.height = 0;
                const flags = m.readTypeByte(0x6438 + actor.kind);
                actor.columns = m.readTypeByte(0x5c96 + actor.kind);
                actor.palette = (flags >> 4) & 3;
                this.actors.set(s, actor);
                this.sync(actor);
              }
            },
          });
        },
      };
      // The browser composes both cabinet scheduling passes each tick.
      // Preserve their cursors independently: the static pass masks09AC to63
      // and would otherwise starve dynamic records beyond the first slots.
      const staticCursor = this.read(0x09ac);
      this.write(0x09ac, this.dynamicCursor);
      S.OriginalActorSpawning.scanRecords(true, m, scanner);
      this.dynamicCursor = this.read(0x09ac);
      this.write(0x09ac, staticCursor);
      S.OriginalActorSpawning.scanRecords(false, m, scanner);
      this.visible = [...this.actors.values()];
      return this.visible;
    }
  }
  window.Skate720.TrafficRuntime = TrafficRuntime;
})();
