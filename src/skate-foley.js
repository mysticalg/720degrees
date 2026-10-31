/** Bundled skate recordings with optional user-supplied overrides. No game physics are modified here.
 * HTMLAudio and file-picker object URLs support both file:// and GitHub Pages.
 */
(() => {
  class SkateFoley {
    constructor(owner) {
      this.owner = owner;
      this.volume = 0.45;
      this.enabled = true;
      try {
        const saved = localStorage.getItem("720-skate-volume");
        if (saved !== null && Number.isFinite(Number(saved)))
          this.volume = Math.max(0, Math.min(1, Number(saved)));
        this.enabled = localStorage.getItem("720-skate-muted") !== "true";
      } catch {
        /* Storage restrictions must not prevent playback. */
      }
      this.urls = {};
      this.loops = {};
      this.voices = [];
      this.lastCue = {};
      this.material = "concrete";
      this.counter = 0;
      this.cueCounters = {};
      this.imported = new Set();
      // Relative asset URLs work on GitHub Pages and from local HTML files.
      for (const key of SkateFoley.keys)
        this.urls[key] = `assets/skate-sfx/${key}.mp3?v=skate-library-84`;
    }
    setVolume(value) {
      if (!Number.isFinite(value)) return;
      this.volume = Math.max(0, Math.min(1, value));
      try {
        localStorage.setItem("720-skate-volume", String(this.volume));
      } catch {}
    }
    toggleMuted() {
      this.enabled = !this.enabled;
      if (!this.enabled) this.stop();
      try {
        localStorage.setItem("720-skate-muted", String(!this.enabled));
      } catch {}
      return !this.enabled;
    }
    /** Import only the known filenames, retaining no access to the source folder. */
    load(files) {
      this.stop();
      for (const url of Object.values(this.urls))
        if (url.startsWith("blob:")) URL.revokeObjectURL(url);
      this.urls = Object.fromEntries(
        SkateFoley.keys.map((key) => [
          key,
          `assets/skate-sfx/${key}.mp3?v=skate-library-84`,
        ]),
      );
      this.loops = {};
      this.imported.clear();
      for (const file of files) {
        const key = file.name.replace(/\.mp3$/i, "");
        if (SkateFoley.keys.includes(key) && /\.mp3$/i.test(file.name)) {
          this.urls[key] = URL.createObjectURL(file);
          this.imported.add(key);
        }
      }
      return this.imported.size;
    }
    effect(name, details = {}) {
      if (!this.enabled || this.owner.muted) return false;
      const now = performance.now();
      if (
        now - (this.lastCue[name] ?? -Infinity) <
        // Trigger turns are already edge-debounced by the input system.
        // Do not let a recent scrape silence the return turn out of fakie.
        (name === "skid" ? (details.freshPress ? 0 : 600) : 110)
      )
        return false;
      // Read at the event position, not the previous render frame: the
      // landing surface can differ from the material at takeoff.
      const game = details.game || this.game;
      const material =
        details.material ||
        (game ? this.surface(game, game.player) : this.material) ||
        "concrete";
      const pools = window.Skate720.SKATE_SOUND_POOLS || {};
      const speed = game
        ? Math.hypot(game.player.vx || 0, (game.player.vy || 0) * 2)
        : 0;
      let choices =
        name === "kick"
          ? pools.kick?.[material]?.[speed > 180 ? "fast" : "slow"]
          : name === "crash" && details.water
            ? pools.water
            : pools[name]?.[material];
      const legacy = ["jump", "land", "kick", "crash"].includes(name)
        ? [1, 2, 3].map((n) => `${name}-${n}`)
        : [name];
      // Older imported packs still override their matching legacy action.
      const custom = legacy.filter((key) => this.imported.has(key));
      choices = custom.length
        ? custom
        : (choices || legacy).filter((key) => this.urls[key]);
      if (!choices.length) return false;
      const group = `${name}:${material}:${details.water ? "water" : "dry"}`;
      const index = this.cueCounters[group] || 0;
      this.cueCounters[group] = index + 1;
      const key = choices[index % choices.length];
      this.lastPlayed = { name, key, material, water: !!details.water };
      if (!this.urls[key]) return false;
      this.lastCue[name] = now;
      const audio = new Audio(this.urls[key]);
      audio.volume = this.volume * (name === "kick" ? 0.65 : 0.9);
      this.voices = this.voices.filter((a) => !a.ended && !a.paused);
      if (this.voices.length >= 6) this.voices.shift().pause();
      this.voices.push(audio);
      audio.play().catch(() => {});
      return true;
    }
    stop() {
      for (const audio of [...Object.values(this.loops), ...this.voices]) {
        audio.pause();
        audio.currentTime = 0;
        audio.volume = 0;
      }
      this.voices = [];
    }
    /** Material follows the visible original terrain. This is a native audio
     * adapter: the ROM's surface flags do not encode THPS material names. */
    surface(game, p) {
      if (game.event?.kind === "ramp" || p.halfpipeWall) return "ramp";
      const level = game.event?.level || game.city?.level;
      if (!level) return "concrete";
      const sample = level.contactSample(p.x, p.y);
      if (sample.terrainLayer === "raised") return "wood";
      if (game.mode === "event") return "wood";
      const map = window.Skate720.CITY_MATERIAL;
      if (level.name === "city" && map) {
        const x = Math.max(0, Math.min(map.width - 1, Math.floor(p.x / 8)));
        const y = Math.max(0, Math.min(map.height - 1, Math.floor(p.y / 8)));
        return [null, "concrete", "asphalt"][map.cells[y * map.width + x]];
      }
      return "concrete";
    }
    update(game, dt) {
      this.game = game;
      const p = game.player;
      const active =
        p &&
        !game.paused &&
        ["city", "event"].includes(game.mode) &&
        this.enabled &&
        !this.owner.muted;
      if (!active) {
        this.stop();
        this.wasAir = undefined;
        return;
      }
      this.material = this.surface(game, p);
      // Also catches ramp transitions which bypass the ordinary jump/land cue.
      if (
        this.wasAir !== undefined &&
        !!p.air !== this.wasAir &&
        !p.bail &&
        !p.fallen &&
        !p.curbGrind
      )
        this.effect(p.air ? "jump" : "land");
      const justLaunched = !!p.air && !this.wasAir;
      this.wasAir = !!p.air;
      const speed = Math.hypot(p.vx || 0, (p.vy || 0) * 2);
      if (justLaunched) {
        this.wheelSpeed = speed;
        // Halfpipe airs pause screen XY but retain physical entry momentum.
        // Use that saved motion for free wheel spin instead of silencing it.
        const savedSpeed = p.halfpipeFlight?.speed ?? p.courseFlightSpeed;
        if (Number.isFinite(savedSpeed) && window.Skate720.OriginalGround) {
          const motion = window.Skate720.OriginalGround.velocity(
            savedSpeed,
            p.romMovementDirection ?? p.romDirection ?? 4,
          );
          this.wheelSpeed = Math.max(
            speed,
            (Math.hypot(
              motion.dx + motion.fractionX / 256,
              (motion.dy + motion.fractionY / 256) * 2,
            ) *
              60) /
              64,
          );
        }
        // A jump also lifts a slowly moving or stationary board. Keep a quiet
        // free-spin cue instead of gating ordinary jumps on screen speed.
        this.wheelSpeed = Math.max(120, this.wheelSpeed);
        this.airTime = 0;
      }
      this.airTime = p.air ? (this.airTime || 0) + dt : 0;
      const spinSpeed = Math.max(
        0,
        (this.wheelSpeed || speed) * Math.exp(-this.airTime * 0.08),
      );
      const grind = p.halfpipeFlight?.trick === "grind";
      const desired = p.curbGrind
        ? "grind-curb"
        : grind
          ? "grind-metal"
          : p.air
            ? spinSpeed > 170
              ? "wheel-fast"
              : "wheel-slow"
            : !p.air && !p.bail && !p.fallen && this.material && speed > 12
              ? `roll-${this.material}`
              : null;
      if (desired && this.urls[desired] && !this.loops[desired]) {
        const audio = new Audio(this.urls[desired]);
        audio.loop = true;
        audio.volume = 0;
        audio.preservesPitch = false;
        this.loops[desired] = audio;
      }
      for (const [key, audio] of Object.entries(this.loops)) {
        const wheel = key.startsWith("wheel-");
        const target =
          key === desired
            ? this.volume *
              (wheel
                ? Math.min(0.55, 0.38 + spinSpeed / 1400)
                : Math.min(0.65, speed / 500))
            : 0;
        const nextVolume =
          audio.volume +
          (target - audio.volume) *
            Math.min(1, dt * (wheel && target > 0 ? 24 : 10));
        if (Math.abs(target - audio.volume) > 0.00001)
          audio.volume =
            Math.abs(target - audio.volume) < 0.001 ? target : nextVolume;
        if (target > 0) {
          // Small pitch rise with wheel speed; pitch preservation is disabled.
          const rate = Math.max(
            0.85,
            Math.min(1.2, 0.9 + (wheel ? spinSpeed : speed) / 1600),
          );
          if (Math.abs(rate - audio.playbackRate) > 0.01)
            audio.playbackRate = rate;
          if (audio.paused && !audio.skatePlayPending) {
            audio.skatePlayPending = true;
            audio
              .play()
              .catch(() => {})
              .finally(() => {
                audio.skatePlayPending = false;
              });
          }
        } else if (audio.volume < 0.005) audio.pause();
      }
      // Braking scuffs the wheels, independent of the skater's fakie facing.
      if (!p.air && speed > 90 && game.input?.brake > 0.1) this.effect("skid");
    }
  }
  SkateFoley.keys = [
    "wheel-slow",
    "wheel-fast",
    "roll-concrete",
    "roll-asphalt",
    "roll-wood",
    "roll-ramp",
    "grind-metal",
    "grind-curb",
    "skid",
    ...["jump", "land", "kick", "crash"].flatMap((k) =>
      [1, 2, 3].map((n) => `${k}-${n}`),
    ),
  ];
  // Pool filenames are inert metadata; no audio is loaded until it plays.
  const collect = (value) =>
    Array.isArray(value)
      ? value.flatMap(collect)
      : value && typeof value === "object"
        ? Object.values(value).flatMap(collect)
        : typeof value === "string"
          ? [value]
          : [];
  SkateFoley.keys = [
    ...new Set([
      ...SkateFoley.keys,
      ...collect(window.Skate720.SKATE_SOUND_POOLS),
    ]),
  ];
  window.Skate720.SkateFoley = SkateFoley;
})();
