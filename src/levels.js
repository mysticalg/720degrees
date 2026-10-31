/** Recovered level data, independent of the simulation and renderer.
 *
 * Native decompression retains the CPU-visible scenery words separately
 * from their aliased tile identities. Profile and flag tables are original
 * ROM data; the rendered PNG supplies the same original scenery graphics.
 */
(() => {
  const S = window.Skate720,
    data = S.ROM_DATA;
  function bytes(base64) {
    return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  }
  const profiles = bytes(data.profileTable || data.heightTable),
    flags = bytes(data.flagTable),
    cache = new Map();
  class Level {
    constructor(info) {
      Object.assign(this, info);
      if (info.name === "ramp-1") this.start = { x: 676, y: 688 };
      if (this.kind === "ramp")
        this.halfpipeWallAt = (x, y) => S.Halfpipe.wallAt(this, x, y);
      // Native E908-EA5C decompression supplies the original CPU-visible
      // words. Visual palette packing cannot preserve collision bit4000.
      this.originalMap = S.OriginalMapDecoder.decodeLevel(
        info.name,
        S.COMPRESSED_MAP_DATA,
        bytes,
      );
      if (info.name === "city") {
        // Initial class/gear variant. Dynamic park/shop state selection is
        // still pending; retain the complete original variant tables.
        this.originalOverlayChanges = S.OriginalMapDecoder.applyCityOverlays(
          this.originalMap,
          S.COMPRESSED_MAP_DATA.cityOverlays,
          () => 0,
        );
      }
      this.cells = this.originalMap.tiles;
      this.finishTrigger =
        this.kind !== "city" && this.kind !== "ramp"
          ? S.FinishTrigger.create(
              this.cells,
              info.columns,
              flags,
              S.BoardGeometry.hull,
            )
          : null;
      if (
        this.originalMap.columns !== info.columns ||
        this.originalMap.rows !== info.rows
      )
        throw new Error(`Original map dimensions disagree: ${info.name}`);
      this.image = new Image();
      this.ready = false;
      this.loaded = new Promise((resolve, reject) => {
        this.image.onload = () => {
          // Build static contours during scenery loading, before movement.
          S.TerrainCollision.contours(this);
          S.TerrainCollision.contours(this, true);
          if (this.kind !== "city") S.app?.renderer.primeImage?.(this.image);
          this.ready = true;
          resolve(this);
        };
        this.image.onerror = () =>
          reject(new Error(`Cannot load original map ${this.name}`));
      });
      if (info.kind === "jump") {
        this.targetPaletteImage = new Image();
        this.targetPaletteImage.onload = () =>
          S.app?.renderer.primeImage?.(this.targetPaletteImage);
        this.targetPaletteImage.src = `assets/levels/${info.name}-target-cycle.png`;
      }
      this.image.src = `assets/levels/${info.name}.png`;
    }
    sample(x, y) {
      const col = Math.floor(x / 8),
        row = Math.floor(y / 8);
      if (col < 0 || row < 0 || col >= this.columns || row >= this.rows)
        return { blocked: true, profile: 120, type: 19, tile: 0 };
      const index = row * this.columns + col,
        rawWord = this.originalMap.raw[index],
        tile = this.cells[index] & 8191,
        profile = profiles[tile],
        type = flags[tile];
      // Profile 120 is also used by perfectly valid flat wooden platforms.
      // Only the ROM's water/void flags determine whether a cell is a gap.
      return {
        tile,
        rawWord,
        originalSolid: !!(rawWord & 0x4000),
        aliasHigh: this.originalMap.aliases[index],
        profile,
        type,
        // Halfpipe tile7168 is grass, not an invisible course fence.
        blocked: type === 18 || type === 19,
      };
    }
    /** Improved diagonal support geometry, separate from untouched ROM samples. */
    contactSample(x, y) {
      const wall = this.halfpipeWallAt?.(x, y);
      if (wall)
        return {
          ...this.sample(x, y),
          profile: wall.profile,
          type: 0,
          blocked: false,
          contactGeometry: "halfpipe-curve",
        };
      const sample = S.TerrainCollision.surface(this, x, y);
      const profile = this.surfaceProfile(sample);
      return !this.usesRaisedProfile(sample)
        ? sample
        : {
            ...sample,
            primaryProfile: sample.profile,
            profile,
            terrainLayer: "raised",
          };
    }
    /** Raised city ramps encode their individual faces in flag bytes. This
     * native layer-admission adapter selects the original mode2 decoder for
     * known rideable platform materials; overhead scenery stays on its layer.
     */
    surfaceProfile(sample) {
      if (this.usesRaisedProfile(sample))
        return S.OriginalTerrainProbe.resolveProfile(
          sample.profile,
          sample.type,
          2,
        );
      return sample.profile;
    }
    usesRaisedProfile(sample) {
      return (
        this.name === "city" &&
        [32, 48].includes(sample.profile) &&
        sample.type & 128 &&
        (sample.type < 192 || sample.type === 248)
      );
    }
    /** A navigation aid sampled from the decoded surface, never a replacement road. */
    centerAt(y) {
      if (!this.path.length) return this.start.x;
      let closest = this.path[0];
      for (const point of this.path) {
        if (Math.abs(point.y - y) < Math.abs(closest.y - y)) closest = point;
      }
      return closest.x;
    }
  }
  S.Levels = {
    get(name) {
      if (!cache.has(name)) {
        const info = data.levels[name];
        if (!info) throw new Error(`Unknown layout ${name}`);
        cache.set(name, new Level(info));
      }
      return cache.get(name);
    },
    course(kind, round, experienced = false, originalClass = null) {
      // The original class-to-map directory contains six variants for ten classes.
      const difficulty =
        originalClass ??
        Math.min(10, 1 + (round - 1) * 2 + (experienced ? 3 : 0));
      const variant = data.classVariants[difficulty];
      return this.get(kind === "ramp" ? "ramp-1" : `${kind}-${variant + 1}`);
    },
    names: Object.keys(data.levels),
  };
})();
