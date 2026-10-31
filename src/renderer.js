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
          "motion-indices",
          "motion-tiles",
          "motion-tiles-1",
          "motion-tiles-2",
          "motion-tiles-3",
          "skater",
          "board",
          "shadow",
          "pavement",
          "city-background",
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
        const indexed = document.createElement("canvas");
        indexed.width = 2048;
        indexed.height = 1024;
        const context = indexed.getContext("2d", { willReadFrequently: true });
        context.drawImage(this.assets["motion-indices"], 0, 0);
        this.motionIndices = context.getImageData(0, 0, 2048, 1024).data;
        this.equipmentTiles = new Map();
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
      // Loaded scenery is opaque and already covers the viewport. Avoid a
      // redundant world-sized pattern fill (and pattern state) underneath it.
      if (!(event ? event.level.ready : game.city.level.ready)) {
        c.fillStyle = this.pavement;
        c.fillRect(-this.offset.x, -this.offset.y, 512, 384);
      }
      if (event) this.course(game, event);
      else this.city(game);
      if (game.bees && !event) this.swarm(game.bees, game.elapsed);
      for (const f of game.floats) {
        c.globalAlpha = Math.min(1, f.life);
        if (f.originalLanding)
          this.descriptorSkater(
            f.x,
            f.y - (f.groundRise || 0),
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
          "F8: RED EDGE / AMBER WALL / PURPLE SLOPE / GREEN CURB / CYAN MASK / WHITE FINISH",
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
      const projectSlope = (point) =>
        S.Halfpipe.projectSlopePoint(level, point);
      const area = (mesh, color, projected = false) => {
        if (!mesh) return;
        c.beginPath();
        if (mesh.outside) c.rect(left - 1, top - 1, 514, 386);
        for (const path of mesh.paths) {
          if (!path.length) continue;
          const points = projected ? path.map(projectSlope) : path;
          c.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i++)
            c.lineTo(points[i].x, points[i].y);
          c.closePath();
        }
        c.fillStyle = color;
        c.fill("evenodd");
      };
      if (level.finishTrigger) {
        this.polygon(
          level.finishTrigger.map((p) => [p.x, p.y]),
          "#ffffff24",
          "#ffffffcc",
        );
      }
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
      // Inclined terrain is rideable. Its coverage needs its own diagnostic
      // layer, rather than being shown as an impassable support/fence region.
      const slopes = S.TerrainCollision.debugMesh(level, "slopes");
      area(slopes, "#b276ff55", true);
      c.strokeStyle = "#d8acff";
      c.lineWidth = 0.8;
      c.beginPath();
      for (const edge of slopes?.segments || []) {
        if (
          Math.max(edge.a.x, edge.b.x) < left ||
          Math.min(edge.a.x, edge.b.x) > left + 512 ||
          Math.max(edge.a.y, edge.b.y) < top ||
          Math.min(edge.a.y, edge.b.y) > top + 384
        )
          continue;
        const a = projectSlope(edge.a),
          b = projectSlope(edge.b);
        c.moveTo(a.x, a.y);
        c.lineTo(b.x, b.y);
      }
      c.stroke();
      // Incline changes inside one ramp need visible divisions too.
      c.strokeStyle = "#f1dfffaa";
      c.lineWidth = 0.6;
      c.beginPath();
      for (const edge of S.TerrainCollision.slopeDivisions(level)) {
        if (
          Math.max(edge.a.x, edge.b.x) < left ||
          Math.min(edge.a.x, edge.b.x) > left + 512 ||
          Math.max(edge.a.y, edge.b.y) < top ||
          Math.min(edge.a.y, edge.b.y) > top + 384
        )
          continue;
        const a = projectSlope(edge.a),
          b = projectSlope(edge.b);
        c.moveTo(a.x, a.y);
        c.lineTo(b.x, b.y);
      }
      c.stroke();
      // Highlight the same curve-to-vert join used by halfpipe physics.
      c.strokeStyle = "#ffe790";
      c.lineWidth = 1.1;
      c.beginPath();
      for (const edge of S.Halfpipe.transitionSegments(level)) {
        c.moveTo(edge.a.x, edge.a.y);
        c.lineTo(edge.b.x, edge.b.y);
      }
      c.stroke();
      // Curbs are shallow, rideable terrain rather than solid fences. Show
      // their full width and both ends using the exact physics contour.
      if (level.name === "city") {
        const curbs = S.TerrainCollision.debugMesh(level, "curbs");
        area(curbs, "#50ffb84d");
        c.strokeStyle = "#75ffd9";
        c.fillStyle = "#d0fff1";
        c.lineWidth = 0.8;
        c.beginPath();
        for (const edge of curbs?.segments || []) {
          c.moveTo(edge.a.x, edge.a.y);
          c.lineTo(edge.b.x, edge.b.y);
        }
        c.stroke();
        for (const path of curbs?.paths || [])
          for (const point of path)
            if (
              point.x >= left &&
              point.x <= left + 512 &&
              point.y >= top &&
              point.y <= top + 384
            )
              c.fillRect(point.x - 1, point.y - 1, 2, 2);
      }
      if (!game.event) {
        c.fillStyle = "#bcff5030";
        c.strokeStyle = "#d7ff89";
        c.lineWidth = 0.8;
        for (const gate of game.city.gates) {
          c.beginPath();
          c.moveTo(gate.x, gate.y - 56);
          c.lineTo(gate.x + 112, gate.y);
          c.lineTo(gate.x, gate.y + 56);
          c.lineTo(gate.x - 112, gate.y);
          c.closePath();
          c.fill();
          c.stroke();
        }
      }
      const read = game.objectRegistry?.readContactWord;
      if (!read) return;
      const mask = (x, bottom, pointer, color, board = false) => {
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
        if (!board) {
          c.strokeStyle = "#eaffff99";
          c.strokeRect(left, base - height, width, height);
        }
        c.fillStyle = color;
        const cells = S.OriginalContact.maskCells(shape, read);
        for (const cell of cells)
          c.fillRect(left + cell.x, base - cell.y - 4, 4, 4);
        if (board) {
          const occupied = new Set(cells.map((p) => p.x + "," + p.y));
          c.strokeStyle = "#b8fff3";
          c.lineWidth = 0.65;
          c.beginPath();
          for (const cell of cells) {
            const x = left + cell.x,
              y = base - cell.y - 4;
            for (const [dx, dy, ax, ay, bx, by] of [
              [0, 4, 0, 0, 4, 0],
              [4, 0, 4, 0, 4, 4],
              [0, -4, 4, 4, 0, 4],
              [-4, 0, 0, 4, 0, 0],
            ])
              if (!occupied.has(cell.x + dx + "," + (cell.y + dy))) {
                c.moveTo(x + ax, y + ay);
                c.lineTo(x + bx, y + by);
              }
          }
          c.stroke();
        }
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
      if (game.event?.kind === "slalom")
        for (const gate of game.event.gates)
          mask(
            gate.actor.actorX,
            gate.actor.actorY,
            gate.actor.extraPointer,
            gate.hit ? "#55ff7766" : "#00e9ff66",
          );
      const footprint = game.boardFootprint?.(game.player);
      if (!game.player.bail && footprint) {
        const p = game.player,
          originX = p.x + S.Halfpipe.groundShift(level, p),
          originY =
            p.y -
            p.z -
            S.Halfpipe.groundRise(level, p) +
            Math.min(Math.max(0, p.z), p.halfpipeFlight?.contactHeight || 0);
        c.beginPath();
        for (let i = 0; i < footprint.polygon.length; i++) {
          const a = footprint.polygon[i];
          if (i) c.lineTo(originX + a.x, originY + a.y);
          else c.moveTo(originX + a.x, originY + a.y);
        }
        c.closePath();
        c.fillStyle = "#00ffcc44";
        c.fill();
        c.strokeStyle = "#b8fff3";
        c.lineWidth = 0.7;
        c.stroke();
      } else if (!game.player.bail)
        mask(
          game.player.x + S.Halfpipe.groundShift(level, game.player) - 40,
          game.player.y +
            11 -
            game.player.z -
            S.Halfpipe.groundRise(level, game.player) +
            Math.min(
              Math.max(0, game.player.z),
              game.player.halfpipeFlight?.contactHeight || 0,
            ),
          S.OriginalContact.playerShapePointer(
            S.OriginalContact.playerDirection(
              game.player,
              S.OriginalGround.tables,
            ),
            read,
          ),
          "#00ffcc55",
          true,
        );
      c.fillStyle = "#ffffff";
      c.fillRect(
        game.player.x + S.Halfpipe.groundShift(level, game.player) - 1,
        game.player.y - S.Halfpipe.groundRise(level, game.player) - 1,
        2,
        2,
      );
    }
    /** Crop scenery at source, avoiding full-map draw submissions on mobile. */
    worldImage(image) {
      const left = -this.offset.x,
        top = -this.offset.y;
      const right = Math.min(image.width, left + 512),
        bottom = Math.min(image.height, top + 384);
      // Some embedded browsers stall when a large image backs a canvas draw,
      // even with a tiny source crop. Submit only small cached canvas textures.
      for (
        let y = Math.max(0, Math.floor(top / 256) * 256);
        y < bottom;
        y += 256
      )
        for (
          let x = Math.max(0, Math.floor(left / 256) * 256);
          x < right;
          x += 256
        )
          this.ctx.drawImage(this.imageRegion(image, x, y, 256, true), x, y);
    }
    /** Bounded LRU caches: at most 8MB of world tiles and 1MB of sprite pixels.
     * Cropping uses a CPU-backed staging canvas; large source images never
     * enter the frequently redrawn main canvas in Facebook's embedded browser.
     */
    imageRegion(image, x, y, size, opaque = false) {
      if (x < 0 || y < 0 || x >= image.width || y >= image.height) {
        if (!this.emptyImageRegion) {
          this.emptyImageRegion = document.createElement("canvas");
          this.emptyImageRegion.width = this.emptyImageRegion.height = 1;
        }
        return this.emptyImageRegion;
      }
      this.regionImageIds ||= new WeakMap();
      if (!this.regionImageIds.has(image))
        this.regionImageIds.set(
          image,
          (this.nextRegionImageId = (this.nextRegionImageId || 0) + 1),
        );
      const cache = opaque
        ? (this.worldRegions ||= new Map())
        : (this.spriteRegions ||= new Map());
      const key = `${this.regionImageIds.get(image)}:${x}:${y}:${size}`;
      let tile = cache.get(key);
      if (tile) {
        cache.delete(key);
        cache.set(key, tile);
        return tile;
      }
      tile = document.createElement("canvas");
      tile.width = Math.min(size, image.width - x);
      tile.height = Math.min(size, image.height - y);
      tile
        .getContext("2d", { alpha: !opaque, willReadFrequently: true })
        .drawImage(
          image,
          x,
          y,
          tile.width,
          tile.height,
          0,
          0,
          tile.width,
          tile.height,
        );
      if (cache.size >= (opaque ? 32 : 1024))
        cache.delete(cache.keys().next().value);
      cache.set(key, tile);
      return tile;
    }
    city(game) {
      const c = this.ctx,
        city = game.city;
      if (city.level.ready) {
        // Original map plus unchanged EC20 decorations, composited offline.
        // The opaque image avoids a costly full-map alpha blend on mobile.
        this.worldImage(this.assets["city-background"]);
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
              ["body", "board", "flags", "shadow"][actor.palette],
              null,
              0,
              actor.pointer,
              actor.columns,
            ),
        })),
        {
          // A gripping skater overlaps the rear bumper: draw its crouched
          // original body after that vehicle instead of hiding it underneath.
          y: game.player.vehicleTow
            ? Math.max(
                game.player.y,
                (game.trafficActors.find(
                  (a) => a.sprite === game.player.vehicleTow.sprite,
                )?.actorY ?? game.player.y) + 0.01,
              )
            : game.player.y,
          draw: () =>
            this.skater(
              game.player,
              game.elapsed,
              city.level.contactSample(game.player.x, game.player.y).profile,
              game.gear,
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
    /** One board-directory selection shared by drawing and contact geometry. */
    boardEntry(p, profile) {
      if (p.bail) return 0x50fa;
      if (p.rampAnimation?.currentBoard !== undefined)
        return p.rampAnimation.currentBoard;
      const frame = S.OriginalContact.playerDirection(
          p,
          S.OriginalGround.tables,
        ),
        dir = this.motionBanks[0];
      const read = (a) => dir[a - 0x4000] | (dir[a - 0x4000 + 1] << 8);
      const phase = p.jumpSequence
        ? p.jumpSequence.phase
        : p.air
          ? Math.min(3, p.jumpAnimation?.phase || 0)
          : p.jumpRecovery?.action === 9
            ? 4
            : null;
      return phase === null
        ? S.OriginalRoutines.groundPoseEntries(frame, profile, 0, read).board
        : read(0x4f44 + frame * 2) + Math.max(0, Math.min(4, phase)) * 2;
    }
    /** Decode opaque pixels from the existing ROM atlas, once per pose.
     * Row extrema suffice for a convex outline; no image readback per frame.
     */
    boardFootprint(p, profile) {
      if (!this.ready) return null;
      if (p.bail) return { entry: 0x50fa, polygon: [] };
      const entry = this.boardEntry(p, profile);
      this.boardFootprints ||= new Map();
      if (this.boardFootprints.has(entry))
        return this.boardFootprints.get(entry);
      const [dir, low, high] = this.motionBanks,
        index = entry - 0x4000,
        offset = dir[index] | (dir[index + 1] << 8);
      const read = (a) => (a < 0x6000 ? low : high)[a & 8191];
      const records = S.OriginalRoutines.spriteDescriptor(
        read,
        0x4000 + offset,
        2,
        (-40 * 64) & 65535,
        (-11 * 64) & 65535,
      ).records;
      const rows = new Map();
      for (let column = 0; column < records.length; column++) {
        const record = records[column],
          height = ((record.code >> 11) & 7) + 1,
          code = (record.code & 2047) + (record.y & 7) * 2048;
        let top = (-(record.y >> 6) - height * 16) & 511;
        top += Math.round((-40 - top) / 512) * 512;
        let left = (records[0].x >> 6) + column * 16;
        left += Math.round(-left / 1024) * 1024;
        for (let row = 0; row < height; row++)
          for (let py = 0; py < 16; py++)
            for (let px = 0; px < 16; px++) {
              const tile = code + row,
                alpha =
                  ((Math.floor(tile / 128) * 16 + py) * 2048 +
                    (tile % 128) * 16 +
                    px) *
                    4 +
                  3;
              // The index atlas is opaque; original pen15 is transparent.
              if (this.motionIndices[alpha - 3] === 15) continue;
              const x = left + (record.code & 0x4000 ? 15 - px : px),
                y = top + row * 16 + py,
                extents = rows.get(y) || [Infinity, -Infinity];
              extents[0] = Math.min(extents[0], x);
              extents[1] = Math.max(extents[1], x + 1);
              rows.set(y, extents);
            }
      }
      const points = [];
      for (const [y, [left, right]] of rows)
        points.push(
          { x: left, y },
          { x: right, y },
          { x: left, y: y + 1 },
          { x: right, y: y + 1 },
        );
      const polygon = S.BoardGeometry.hull(points),
        footprint = { entry, polygon };
      this.boardFootprints.set(entry, footprint);
      return footprint;
    }
    skater(
      p,
      time,
      profile = p.romSurfaceProfile ?? 24,
      gear = {},
      groundRise = 0,
      groundShift = 0,
    ) {
      const c = this.ctx,
        x = p.x + groundShift;
      if (p.invulnerable > 0 && Math.floor(time * 14) % 2) c.globalAlpha = 0.35;
      const contactHeight = Math.min(
        Math.max(0, p.z),
        p.halfpipeFlight?.contactHeight || 0,
      );
      const y = p.y - p.z - groundRise + contactHeight;
      // Use the same original direction index as movement. Canvas angles are
      // isometric: reversing/quantizing them again selects the wrong pose.
      let frame = p.romFacingDirection ?? p.romDirection;
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
        p.vehicleTow ? 2 : profile,
        p.vehicleTow ? 0x0500 : p.halfpipePoseProfile ? 0 : p.romSpeed || 0,
        (a) => directory[a - 0x4000] | (directory[a - 0x4000 + 1] << 8),
      );
      const equipment = S.OriginalEquipment.palettes(
        gear,
        Math.floor(time * 60),
        S.EQUIPMENT_DATA,
      );
      const bodyPalette = gear.pads || gear.shoes ? equipment.body : null;
      const boardPalette = gear.board ? equipment.board : null;
      const kicking =
        !p.air &&
        !!p.kickAnimation &&
        // Inclined surfaces keep their original terrain stance while kicking;
        // road kick frames must not hide either face of a curved ramp.
        !p.halfpipePoseProfile &&
        (profile & 7) === 0;
      const kickPhase = p.kickAnimation?.phase ?? 0;
      const jumpPhase = p.jumpSequence
        ? p.jumpSequence.phase
        : p.air
          ? Math.min(3, p.jumpAnimation?.phase || 0)
          : p.jumpRecovery?.action === 9
            ? 4
            : null;
      if (!(p.air && p.courseShadowY === null)) {
        // Retain the original board silhouette on the ground as well as in
        // flight. A small offset keeps the landed shadow visible under the
        // wheels; translucent blur softens it without replacement artwork.
        c.save();
        c.globalAlpha *= p.air ? 0.28 : 0.2;
        this.softShadowPass = true;
        this.descriptorSkater(
          x + (p.air ? 0 : 1),
          (p.air ? (p.courseShadowY ?? p.y) : p.y + 2) - groundRise,
          frame,
          false,
          "shadow",
          null,
          0,
          p.bail
            ? 0x50fa
            : S.OriginalRoutines.groundPoseEntries(
                frame,
                p.air ? (p.courseShadowProfile ?? 24) : profile,
                0,
                (a) => directory[a - 0x4000] | (directory[a - 0x4000 + 1] << 8),
              ).shadow,
        );
        this.softShadowPass = false;
        c.restore();
      }
      this.descriptorSkater(
        x,
        y,
        frame,
        kicking,
        "board",
        jumpPhase,
        kickPhase,
        p.skidPose?.board ?? this.boardEntry(p, profile),
        null,
        boardPalette,
      );
      const bodyEntry = this.descriptorSkater(
        x,
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
            : p.skidPose
              ? p.skidPose.body
              : jumpPhase === null && !kicking
                ? groundPose.body
                : null,
        null,
        bodyPalette,
      );
      // E5AE-E5CA adds a separate original helmet descriptor, paired with
      // the current body entry; actor3 has two columns and the body palette.
      if (gear.helmet && !p.bail)
        this.descriptorSkater(
          x,
          y,
          frame,
          false,
          "helmet",
          null,
          0,
          bodyEntry + 0x061e,
          2,
          bodyPalette,
        );
      c.globalAlpha = 1;
      if (p.air && Math.abs(p.spin) > Math.PI)
        this.text(
          `${Math.floor((Math.abs(p.spin) * 180) / Math.PI)}\u00b0`,
          x,
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
      palette = null,
    ) {
      // Generous bounds include descriptor wrapping, wide vehicles and tall
      // poses. Off-screen actors still simulate; only their drawing is skipped.
      if (
        this.offset &&
        (x + this.offset.x < -384 ||
          x + this.offset.x > 896 ||
          y + this.offset.y < -384 ||
          y + this.offset.y > 768)
      )
        return;
      const [directory, low, high] = this.motionBanks;
      // Native kick timing remains provisional; directory selection is original.
      const board = component !== "body" && component !== "helmet";
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
          : component === "flags"
            ? "motion-tiles-2"
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
          const screenX = left + this.offset.x,
            screenY = top + row * 16 + this.offset.y;
          // Allow a halo for the original softened board-shadow filter.
          if (screenX < -18 || screenX > 514 || screenY < -18 || screenY > 386)
            continue;
          this.ctx.save();
          this.ctx.translate(
            left + (record.code & 0x4000 ? 16 : 0),
            top + row * 16,
          );
          if (record.code & 0x4000) this.ctx.scale(-1, 1);
          if (component === "shadow" && this.softShadowPass) {
            // Blur the original tile once, not on every main-canvas draw.
            this.ctx.drawImage(this.softShadowTile(tile), -2, -2);
          } else if (palette)
            this.ctx.drawImage(this.equipmentTile(tile, palette), 0, 0);
          else
            this.ctx.drawImage(
              this.imageRegion(
                this.assets[atlas],
                (tile % 128) * 16,
                Math.floor(tile / 128) * 16,
                16,
              ),
              0,
              0,
            );
          this.ctx.restore();
        }
      }
      return entry;
    }
    /** Small cached original shadow tiles avoid live blur passes on mobile. */
    softShadowTile(code) {
      this.softShadowTiles ||= new Map();
      if (this.softShadowTiles.has(code)) return this.softShadowTiles.get(code);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 20;
      const context = canvas.getContext("2d");
      context.imageSmoothingEnabled = false;
      context.filter = "blur(0.45px)";
      context.drawImage(
        this.assets["motion-tiles-3"],
        (code % 128) * 16,
        Math.floor(code / 128) * 16,
        16,
        16,
        2,
        2,
        16,
        16,
      );
      // Bound the cache even if a future animation adds many distinct tiles.
      if (this.softShadowTiles.size >= 256)
        this.softShadowTiles.delete(this.softShadowTiles.keys().next().value);
      this.softShadowTiles.set(code, canvas);
      return canvas;
    }
    /** Recolour original indexed pixels using recovered palette-RAM words.
     * Cached16px tiles avoid copying/repainting a full atlas during play.
     */
    equipmentTile(code, palette) {
      const key =
        code + ":" + palette.map((color) => color.join(",")).join(";");
      if (this.equipmentTiles.has(key)) return this.equipmentTiles.get(key);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 16;
      const context = canvas.getContext("2d"),
        image = context.createImageData(16, 16);
      const left = (code % 128) * 16,
        top = Math.floor(code / 128) * 16;
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++) {
          const pen = this.motionIndices[((top + y) * 2048 + left + x) * 4],
            offset = (y * 16 + x) * 4;
          if (pen === 15) continue;
          image.data.set([...palette[pen], 255], offset);
        }
      context.putImageData(image, 0, 0);
      this.equipmentTiles.set(key, canvas);
      return canvas;
    }
    course(game, e) {
      const c = this.ctx,
        level = e.level;
      if (level.ready) this.worldImage(level.image);
      else
        this.text(
          "LOADING ORIGINAL COURSE...",
          game.player.x,
          game.player.y - 80,
          "#fff",
          11,
          "center",
        );
      for (const actor of e.actors || [])
        this.descriptorSkater(
          actor.actorX + 40,
          actor.actorY - 11,
          0,
          false,
          ["body", "board", "flags", "shadow"][actor.palette],
          null,
          0,
          actor.pointer,
          actor.columns,
        );
      this.skater(
        game.player,
        game.elapsed,
        game.player.halfpipePoseProfile ??
          level.sample(game.player.x, game.player.y).profile,
        game.gear,
        S.Halfpipe.groundRise(level, game.player),
        S.Halfpipe.groundShift(level, game.player),
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
        `TICKETS ${game.practice ? "\u221e" : game.tickets}`,
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
          `${event.kind.toUpperCase()} \u00b7 CLASS ${event.difficulty}`,
          256,
          65,
          S.COLORS[event.kind],
          11,
          "center",
        );
        const detail =
          event.kind === "slalom"
            ? `GATES ${event.gatesHit}/${event.gates.length}`
            : event.kind === "jump"
              ? `TARGETS ${event.jumpsLanded}/3`
              : `EVENT ${S.format(event.points)}`;
        this.text(detail, 256, 80, "#233753", 10, "center");
      }
      const near = game.nearestInteraction();
      let message = game.messageTime > 0 ? game.message : "";
      if (near) {
        message = `E / Y: ${near.kind.toUpperCase()} \u00b7 ${game.available(near.kind) ? "SKATE ONTO ENTRY PAD" : "COMPLETE OTHER PARKS"}`;
      }
      if (message) {
        c.fillStyle = "#05154de8";
        c.fillRect(10, 355, 492, 21);
        c.strokeStyle = "#4485bf";
        c.strokeRect(10.5, 355.5, 491, 20);
        this.text(message, 256, 362, "#fff9ba", 8, "center");
      } else {
        this.text(
          `NEXT TICKET ${S.format(game.nextTicket || 3000)} \u00b7 TAB FOR MAP`,
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
        "BLUE SHOPS = EQUIPMENT \u00b7 WHITE DOT = YOU",
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
