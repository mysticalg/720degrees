/** Canvas-only renderer at the arcade's 512x384 resolution.
 * Sprite animation and scenery use decoded ROM PNGs, with nearest-neighbour
 * scaling. Geometric course additions and the HUD are drawn in JavaScript.
 */
(() => {
  const S = window.Skate720;
  class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d", { alpha: false });
      this.assets = {};
      this.motionBanks = S.MOTION_BANKS.map((s) =>
        Uint8Array.from(atob(s), (c) => c.charCodeAt(0)),
      );
      this.ready = false;
      this.loadPromise = Promise.all(
        [
          "motion-tiles",
          "motion-tiles-1",
          "motion-tiles-3",
          "skater",
          "board",
          "shadow",
          "pavement",
          "city-overlays",
          "ramp",
          "slalom",
          "jump",
          "ramp-sign",
          "downhill",
        ].map(
          (name) =>
            new Promise((resolve, reject) => {
              const image = new Image();
              image.onload = () => {
                this.assets[name] = image;
                resolve();
              };
              image.onerror = () => reject(new Error(`Missing asset: ${name}`));
              image.src = `assets/${name}.png`;
            }),
        ),
      ).then(() => {
        this.ready = true;
        this.pavement = this.ctx.createPattern(this.assets.pavement, "repeat");
      });
    }
    text(text, x, y, color = "#fff", size = 9, align = "left") {
      const c = this.ctx;
      c.font = `bold ${size}px monospace`;
      c.textAlign = align;
      c.textBaseline = "top";
      c.fillStyle = "#0009";
      c.fillText(text, x + 1, y + 1);
      c.fillStyle = color;
      c.fillText(text, x, y);
    }
    polygon(points, fill, stroke) {
      const c = this.ctx;
      c.beginPath();
      points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.closePath();
      c.fillStyle = fill;
      c.fill();
      if (stroke) {
        c.strokeStyle = stroke;
        c.lineWidth = 1;
        c.stroke();
      }
    }
    diamond(x, y, rx, ry, color, outline) {
      this.polygon(
        [
          [x, y - ry],
          [x + rx, y],
          [x, y + ry],
          [x - rx, y],
        ],
        color,
        outline,
      );
    }
    draw(game) {
      const c = this.ctx;
      c.imageSmoothingEnabled = false;
      c.fillStyle = "#101329";
      c.fillRect(0, 0, 512, 384);
      if (!this.ready) {
        this.text("DECODING SKATE CITY...", 256, 180, "#d7ff35", 13, "center");
        return;
      }
      const event =
        game.event && ["event", "result"].includes(game.mode)
          ? game.event
          : null;
      const width = event ? event.width : game.city.width,
        height = event ? event.height : game.city.height;
      const camX = S.clamp(game.camera.x, 256, width - 256),
        camY = S.clamp(game.camera.y, 192, height - 192);
      this.offset = { x: Math.round(256 - camX), y: Math.round(192 - camY) };
      c.save();
      c.translate(this.offset.x, this.offset.y);
      c.fillStyle = this.pavement;
      c.fillRect(0, 0, width, height);
      if (event) this.course(game, event);
      else this.city(game);
      if (game.bees && !event) this.swarm(game.bees, game.elapsed);
      for (const f of game.floats) {
        c.globalAlpha = Math.min(1, f.life);
        if (f.originalLanding)
          this.descriptorSkater(
            f.x,
            f.y,
            0,
            false,
            "body",
            null,
            0,
            f.entry,
            2,
          );
        else this.text(f.text, f.x, f.y, f.color, 11, "center");
      }
      c.globalAlpha = 1;
      if (this.showCollisions)
        this.collisionOverlay(game, event?.level || game.city.level);
      c.restore();
      this.hud(game, event);
      if (game.mapFrames > 0 && !event) this.map(game);
      if (this.showCollisions) {
        c.fillStyle = "#08111be6";
        c.fillRect(0, 370, 512, 14);
        this.text(
          "F8: COLLISIONS · RED EDGE / AMBER WALL / CYAN MASK",
          8,
          373,
          "#e8f7ff",
          7,
        );
      }
    }
    /** Developer view only. It reads the exact terrain mesh and recovered
     * sprite masks used by contact, without modifying any gameplay state.
     */
    collisionOverlay(game, level) {
      const c = this.ctx,
        left = -this.offset.x,
        top = -this.offset.y;
      const area = (mesh, color) => {
        if (!mesh) return;
        c.beginPath();
        if (mesh.outside) c.rect(left - 1, top - 1, 514, 386);
        for (const path of mesh.paths) {
          if (!path.length) continue;
          c.moveTo(path[0].x, path[0].y);
          for (let i = 1; i < path.length; i++) c.lineTo(path[i].x, path[i].y);
          c.closePath();
        }
        c.fillStyle = color;
        c.fill("evenodd");
      };
      area(S.TerrainCollision.debugMesh(level), "#ff38533b");
      const walls = S.TerrainCollision.debugMesh(level, true);
      area(walls, "#ffb72e55");
      c.lineWidth = 0.75;
      c.strokeStyle = "#ffc64fcc";
      c.beginPath();
      for (const edge of walls?.segments || []) {
        c.moveTo(edge.a.x, edge.a.y);
        c.lineTo(edge.b.x, edge.b.y);
      }
      c.stroke();
      const read = game.objectRegistry?.readContactWord;
      if (!read) return;
      const mask = (x, bottom, pointer, color) => {
        if (pointer < 0x4000 || pointer >= 0x7ff4) return;
        const shape = S.OriginalContact.readShape(pointer, read);
        if (shape.width >>> 8 > 48 || shape.height >>> 8 > 64) return;
        const left = x + shape.x / 64,
          base = bottom - shape.y / 64,
          width = shape.width / 64,
          height = shape.height / 64;
        if (
          left + width < -this.offset.x ||
          left > -this.offset.x + 512 ||
          base < -this.offset.y ||
          base - height > -this.offset.y + 384
        )
          return;
        c.strokeStyle = "#eaffff99";
        c.strokeRect(left, base - height, width, height);
        c.fillStyle = color;
        for (const cell of S.OriginalContact.maskCells(shape, read))
          c.fillRect(left + cell.x, base - cell.y - 4, 4, 4);
      };
      if (!game.event) {
        for (const actor of [...game.cityActors, ...game.trafficActors])
          mask(
            actor.actorX,
            actor.actorY - (actor.height || 0) / 64,
            actor.extraPointer || 0,
            "#00e9ff66",
          );
        for (const crack of game.cracks)
          mask(crack.actorX, crack.actorY, 0x7a30, "#88ff5566");
      }
      mask(
        game.player.x - 40,
        game.player.y + 11 - game.player.z,
        0x7114,
        "#00ffccb3",
      );
      c.fillStyle = "#ffffff";
      c.fillRect(game.player.x - 1, game.player.y - 1, 2, 2);
    }
    city(game) {
      const c = this.ctx,
        city = game.city;
      if (city.level.ready) {
        c.drawImage(city.level.image, 0, 0);
        // EC20 supplies the original class and shop decorations.
        c.drawImage(this.assets["city-overlays"], 0, 0);
      }
      const objects = [
        ...game.cracks.map((crack) => ({
          y: crack.actorY,
          draw: () =>
            this.descriptorSkater(
              crack.actorX + 40,
              crack.actorY - 11,
              0,
              false,
              "shadow",
              null,
              0,
              S.CITY_CRACK_DATA.entry + crack.phase * 2,
              S.CITY_CRACK_DATA.columns,
            ),
        })),
        ...[...game.cityActors, ...(game.trafficActors || [])].map((actor) => ({
          y: actor.actorY,
          draw: () =>
            this.descriptorSkater(
              actor.actorX + 40,
              actor.actorY - (actor.height || 0) / 64 - 11,
              0,
              false,
              ["body", "board", null, "shadow"][actor.palette],
              null,
              0,
              actor.pointer,
              actor.columns,
            ),
        })),
        {
          y: game.player.y,
          draw: () =>
            this.skater(
              game.player,
              game.elapsed,
              city.level.sample(game.player.x, game.player.y).profile,
            ),
        },
      ];
      objects.sort((a, b) => a.y - b.y).forEach((object) => object.draw());
      for (const gate of city.gates) {
        if (S.distance(game.player, gate) < 170) {
          this.diamond(gate.x, gate.y, 35, 17, "#fff53022", "#fff533");
          this.text(
            `CLASS ${Math.min(10, 1 + game.clears[gate.kind] * 2)}`,
            gate.x,
            gate.y - 48,
            "#fff54c",
            9,
            "center",
          );
        }
      }
    }
    skater(p, time, profile = p.romSurfaceProfile ?? 24) {
      const c = this.ctx;
      if (p.invulnerable > 0 && Math.floor(time * 14) % 2) c.globalAlpha = 0.35;
      const y = p.y - p.z;
      // Use the same original direction index as movement. Canvas angles are
      // isometric: reversing/quantizing them again selects the wrong pose.
      let frame = p.romDirection;
      if (p.air || frame === undefined) {
        let best = Infinity;
        for (let i = 0; i < 16; i++) {
          const angle = Math.atan2(
            -S.OriginalGround.tables.y[i],
            S.OriginalGround.tables.x[i],
          );
          const error = Math.abs(S.angleDelta(angle, p.angle));
          if (error < best) {
            best = error;
            frame = i;
          }
        }
      }
      const directory = this.motionBanks[0];
      const groundPose = S.OriginalRoutines.groundPoseEntries(
        frame,
        profile,
        p.romSpeed || 0,
        (a) => directory[a - 0x4000] | (directory[a - 0x4000 + 1] << 8),
      );
      const kicking = !p.air && !!p.kickAnimation;
      const kickPhase = p.kickAnimation?.phase ?? 0;
      const jumpPhase = p.jumpSequence
        ? p.jumpSequence.phase
        : p.air
          ? Math.min(3, p.jumpAnimation?.phase || 0)
          : p.jumpRecovery?.action === 9
            ? 4
            : null;
      this.descriptorSkater(
        p.x,
        p.y,
        frame,
        kicking,
        "shadow",
        jumpPhase,
        kickPhase,
        p.bail ? 0x50fa : jumpPhase === null ? groundPose.shadow : null,
      );
      this.descriptorSkater(
        p.x,
        y,
        frame,
        kicking,
        "board",
        jumpPhase,
        kickPhase,
        p.bail
          ? 0x50fa
          : (p.rampAnimation?.currentBoard ??
              (jumpPhase === null ? groundPose.board : null)),
      );
      this.descriptorSkater(
        p.x,
        y,
        frame,
        kicking,
        "body",
        jumpPhase,
        kickPhase,
        p.bail
          ? p.bail.pointer
          : p.rampAnimation
            ? p.rampAnimation.currentBody
            : jumpPhase === null && !kicking
              ? groundPose.body
              : null,
      );
      c.globalAlpha = 1;
      if (p.air && Math.abs(p.spin) > Math.PI)
        this.text(
          `${Math.floor((Math.abs(p.spin) * 180) / Math.PI)}°`,
          p.x,
          y - 73,
          "#fff637",
          9,
          "center",
        );
    }
    /** Draw the original column records produced by B266-B328's translation.
     * Bank data is inert graphics data; no ROM instructions execute here.
     */
    descriptorSkater(
      x,
      y,
      direction,
      kicking = false,
      component = "body",
      jumpPhase = null,
      kickPhase = 0,
      overrideEntry = null,
      overrideColumns = null,
    ) {
      const [directory, low, high] = this.motionBanks;
      // Native kick timing remains provisional; directory selection is original.
      const board = component !== "body";
      let entry = board
        ? 0x4f64 + direction * 2
        : S.OriginalRoutines.animationEntry(direction, 0, 0, 0, {});
      if (kicking && !board) {
        const dir = 0x4330 + direction * 2 - 0x4000;
        entry =
          (directory[dir] | (directory[dir + 1] << 8)) +
          Math.min(2, kickPhase) * 2;
      }
      if (jumpPhase !== null) {
        const jumpDirectory =
          (board ? 0x4f44 : 0x43c8) + direction * 2 - 0x4000;
        entry =
          (directory[jumpDirectory] | (directory[jumpDirectory + 1] << 8)) +
          Math.max(0, Math.min(board ? 4 : 5, jumpPhase)) * 2;
      }
      if (overrideEntry !== null) entry = overrideEntry;
      const index = entry - 0x4000;
      const offset = directory[index] | (directory[index + 1] << 8);
      const atlas =
        component === "shadow"
          ? "motion-tiles-3"
          : board
            ? "motion-tiles-1"
            : "motion-tiles";
      const read = (address) => (address < 0x6000 ? low : high)[address & 8191];
      const records = S.OriginalRoutines.spriteDescriptor(
        read,
        0x4000 + offset,
        // Original04D0 allocation: body actor2 has four columns; the
        // board and shadow actors each have two. Descriptor markers can
        // terminate a narrow pose early, but wider arms must not be clipped.
        overrideColumns ?? (component === "body" ? 4 : 2),
        Math.round((x - 40) * 64) & 65535,
        Math.round(-(y + 11) * 64) & 65535,
      ).records;
      for (let column = 0; column < records.length; column++) {
        const record = records[column],
          height = ((record.code >> 11) & 7) + 1;
        const code = (record.code & 2047) + (record.y & 7) * 2048;
        let top = (-(record.y >> 6) - height * 16) & 511;
        top += Math.round((y - 40 - top) / 512) * 512;
        let left = (records[0].x >> 6) + column * 16;
        left += Math.round((x - left) / 1024) * 1024;
        for (let row = 0; row < height; row++) {
          const tile = code + row;
          this.ctx.save();
          this.ctx.translate(
            left + (record.code & 0x4000 ? 16 : 0),
            top + row * 16,
          );
          if (record.code & 0x4000) this.ctx.scale(-1, 1);
          this.ctx.drawImage(
            this.assets[atlas],
            (tile % 128) * 16,
            Math.floor(tile / 128) * 16,
            16,
            16,
            0,
            0,
            16,
            16,
          );
          this.ctx.restore();
        }
      }
    }
    course(game, e) {
      const c = this.ctx,
        level = e.level;
      if (level.ready) c.drawImage(level.image, 0, 0);
      else
        this.text(
          "LOADING ORIGINAL COURSE...",
          game.player.x,
          game.player.y - 80,
          "#fff",
          11,
          "center",
        );
      this.skater(
        game.player,
        game.elapsed,
        level.sample(game.player.x, game.player.y).profile,
      );
      if (e.kind !== "ramp" && Math.abs(game.player.y - level.finish.y) < 250)
        this.text(
          "FINISH",
          level.finish.x,
          level.finish.y + 35,
          "#fafd7c",
          13,
          "center",
        );
    }
    swarm(bees, time) {
      // The old16-frame sheet was the landing-points effect. Type4's
      // verified default bee loop is separate and uses four palette1 columns.
      const effects = S.OriginalEffects;
      const entry = effects.beeEntry(
        Math.floor((time - (bees.born || 0)) * 60),
      );
      this.descriptorSkater(
        bees.x,
        bees.y,
        0,
        false,
        "board",
        null,
        0,
        entry,
        effects.beeColumns,
      );
    }
    hud(game, event) {
      const c = this.ctx;
      c.fillStyle = "#03232be8";
      c.fillRect(8, 8, 123, 54);
      c.strokeStyle = "#b0ff41";
      c.strokeRect(8.5, 8.5, 123, 54);
      this.text("PLAYER 1", 14, 12, "#d9ff37", 9);
      this.text(S.format(game.score), 123, 24, "#fff23f", 17, "right");
      this.text(`CASH $${game.cash}`, 14, 46, "#62f047", 10);
      this.text(`BOARDS ${game.lives}`, 138, 12, "#e7eeff", 9);
      c.fillStyle = "#052435e8";
      c.fillRect(388, 8, 116, 48);
      this.text(
        `TICKETS ${game.practice ? "âˆž" : game.tickets}`,
        496,
        12,
        "#ffeb57",
        10,
        "right",
      );
      const seconds = event
        ? Math.ceil(event.timer)
        : game.practice
          ? "FREE"
          : Math.max(0, Math.ceil(game.cityTimer));
      this.text(
        `TIME ${seconds}`,
        496,
        31,
        Number(seconds) < 10 && !game.practice ? "#ff6655" : "#fff",
        13,
        "right",
      );
      if (event) {
        this.text(
          `${event.kind.toUpperCase()} Â· CLASS ${event.difficulty}`,
          256,
          65,
          S.COLORS[event.kind],
          11,
          "center",
        );
        const detail =
          event.kind === "slalom"
            ? `GATES ${event.gatesHit}/10`
            : event.kind === "jump"
              ? `TARGETS ${event.jumpsLanded}/3`
              : `EVENT ${S.format(event.points)}`;
        this.text(detail, 256, 80, "#233753", 10, "center");
      }
      const near = game.nearestInteraction();
      let message = game.messageTime > 0 ? game.message : "";
      if (near) {
        message =
          near.type === "park"
            ? `E / Y: ${near.kind.toUpperCase()} · ${game.available(near.kind) ? "SKATE ONTO ENTRY PAD" : "COMPLETE OTHER PARKS"}`
            : `E: ${near.label} Â· $${100 * (game.gear[near.kind] + 1)}`;
      }
      if (message) {
        c.fillStyle = "#05154de8";
        c.fillRect(10, 355, 492, 21);
        c.strokeStyle = "#4485bf";
        c.strokeRect(10.5, 355.5, 491, 20);
        this.text(message, 256, 362, "#fff9ba", 8, "center");
      } else {
        this.text(
          `NEXT TICKET ${S.format(game.nextTicket || 3000)} Â· TAB FOR MAP`,
          12,
          365,
          "#132d42",
          8,
        );
      }
      // Map visibility is timed by the game; there is no permanent navigator.
    }
    miniMap(game, x, y, w, h) {
      const c = this.ctx;
      c.fillStyle = "#112239c9";
      c.fillRect(x, y, w, h);
      c.strokeStyle = "#87a1b2";
      c.strokeRect(x + 0.5, y + 0.5, w, h);
      for (const g of game.city.gates) {
        c.fillStyle = S.COLORS[g.kind];
        c.fillRect(
          x + (g.x / game.city.width) * w - 2,
          y + (g.y / game.city.height) * h - 2,
          4,
          4,
        );
      }
      c.fillStyle = "#fff";
      c.fillRect(
        x + (game.player.x / game.city.width) * w - 1,
        y + (game.player.y / game.city.height) * h - 1,
        3,
        3,
      );
    }
    map(game) {
      const c = this.ctx;
      c.fillStyle = "#07162cf5";
      c.fillRect(94, 76, 324, 230);
      this.text("SKATE CITY", 256, 91, "#d7ff35", 19, "center");
      this.miniMap(game, 154, 128, 204, 150);
      for (const g of game.city.gates)
        this.text(
          g.kind.toUpperCase(),
          154 + (g.x / game.city.width) * 204,
          128 +
            (g.y / game.city.height) * 150 +
            (g.y < game.city.height / 2 ? -18 : 10),
          S.COLORS[g.kind],
          8,
          "center",
        );
      this.text(
        "BLUE SHOPS = EQUIPMENT Â· WHITE DOT = YOU",
        256,
        290,
        "#cad6e7",
        8,
        "center",
      );
    }
  }
  S.Renderer = Renderer;
})();
