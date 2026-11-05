/** Music uses the user's selected720 soundtrack pack; voices use sound-ROM captures.
 * The delivered game plays ordinary local MP3s: no sound CPU or chip emulator.
 * Optional user-supplied skate recordings live in a separate enhancement layer.
 */
(() => {
  class AudioSystem {
    constructor() {
      this.muted = false;
      this.foley = new window.Skate720.SkateFoley(this);
      this.musicMuted = false;
      this.musicVolume = 0.38;
      this.soundtrack = "surf";
      try {
        const saved = localStorage.getItem("720-music-volume");
        if (saved !== null && Number.isFinite(Number(saved)))
          this.musicVolume = Math.max(0, Math.min(1, Number(saved)));
        this.musicMuted = localStorage.getItem("720-music-muted") === "true";
        if (localStorage.getItem("720-soundtrack") === "original")
          this.soundtrack = "original";
      } catch {}
      this.shopVoice = null;
      this.motionClips = {};
      this.context = null;
      this.introActive = false;
      this.musicPaused = true;
      this.musicCue = "select";
      this.musicContext = null;
      this.musicSource = this.musicPath("select");
      this.music = new Audio(this.musicSource);
      this.music.preload = "none";
      this.music.loop = true;
      this.music.volume = this.musicVolume;
      this.music.muted = this.musicMuted;
      this.clips = {
        start: new Audio(this.creditPath()),
        bees: new Audio("assets/bees.mp3?v=skate-library-84"),
        coin: new Audio("assets/coin.mp3?v=skate-library-84"),
        purchase: new Audio("assets/purchase.mp3?v=skate-library-84"),
        takedown: new Audio("assets/takedown.mp3?v=skate-library-84"),
        springboard: new Audio("assets/springboard.mp3?v=skate-library-84"),
      };
      // Captured command clips are inert audio assets, never a sound emulator.
      for (const command of [
        0x54, 0x56, 0x57, 0x5a, 0x5b, 0x63, 0x64, 0x65, 0x66,
      ]) {
        const clip = new Audio(`assets/rom-sfx/${command.toString(16)}.mp3`);
        clip.preload = command <= 0x57 ? "auto" : "none";
        this.clips[`rom-${command}`] = clip;
      }
      for (const audio of Object.values(this.clips)) audio.volume = 0.55;
      // The selected credit arrangement plays once, under music controls.
      this.clips.start.volume = this.musicVolume;
      this.clips.start.muted = this.musicMuted;
      this.clips.start.onended = () => {
        this.introActive = false;
        if (!this.musicPaused) {
          // Select the current city before playback, avoiding a brief return
          // to the title track when the credit arrangement finishes.
          this.musicContext = null;
          if (this.foley.game) this.syncMusic(this.foley.game);
          else this.playMusic();
        }
      };
    }
    /** 1E000:52B2/52E8/541A select recorded sound-ROM phrases from
     * FE1E/FE26/FE2A. Cabinet entropy is adapted with browser randomness.
     * Phrases are captured original audio, never runtime speech synthesis.
     */
    playShopVoice(outcome) {
      if (this.muted) return;
      const commands = {
        purchased: [0x80, 0x81, 0x8a, 0x8c, 0xb0, 0xb1, 0xb2, 0xb3],
        funds: [0x82, 0x83, 0x8b, 0xb5],
        ticket: [0x88, 0x89, 0xb6, 0x88],
      }[outcome];
      if (!commands) return;
      this.shopVoice?.pause();
      const command = commands[Math.floor(Math.random() * commands.length)];
      this.shopVoice = new Audio(
        `assets/shop-voice/${command.toString(16)}.mp3`,
      );
      this.shopVoice.volume = 0.55;
      this.shopVoice.play().catch(() => {});
    }
    unlock() {
      if (!this.context)
        this.context = new (window.AudioContext || window.webkitAudioContext)();
      this.context.resume().catch(() => {});
    }
    playStartCue() {
      this.stop();
      this.musicContext = null;
      this.introActive = true;
      this.playMusic();
    }
    musicPath(cue) {
      if (this.soundtrack === "original") return "assets/skate-city.mp3";
      const names = {
        select: "02-select",
        slalom: "03-slalom-park",
        downhill: "04-downhill-park",
        ramp: "05-ramp-park",
        jump: "06-jump-park",
        scores: "15-high-score-entry",
      };
      const city = /^city-([1-8])$/.exec(cue);
      const name = city
        ? `${String(6 + Number(city[1])).padStart(2, "0")}-skate-city-${city[1]}`
        : names[cue] || names.select;
      return `assets/music/${name}.mp3`;
    }
    creditPath() {
      return this.soundtrack === "original"
        ? "assets/start.mp3"
        : "assets/music/01-credit.mp3";
    }
    /** Switch recordings in place, retaining pause, mute and gain. The
     * original option restores the previous city loop and start recording.
     */
    setSoundtrack(value) {
      if (!["original", "surf"].includes(value) || value === this.soundtrack)
        return;
      const playing = !this.musicPaused;
      this.music.pause();
      this.clips.start.pause();
      this.soundtrack = value;
      this.musicSource = this.musicPath(this.musicCue);
      this.music.src = this.musicSource;
      this.clips.start.src = this.creditPath();
      try {
        localStorage.setItem("720-soundtrack", value);
      } catch {}
      if (playing) this.playMusic();
    }
    /** Native state-to-track mapping. City progression cycles the eight
     * selected arrangements; this is not a translation of the sound CPU.
     * Change the source only at a cue boundary, never on every frame.
     */
    syncMusic(game) {
      const waiting =
        game.mode === "event" && game.event?.clock && !game.event.clock.started;
      this.courseWaiting = waiting;
      if (waiting) {
        this.music.pause();
        this.clips.start.pause();
        this.introActive = false;
        this.musicPaused = true;
        this.musicContext = null;
        return;
      }

      const cue = ["continue", "gameover", "victory"].includes(game.mode)
        ? "scores"
        : game.event && ["event", "result"].includes(game.mode)
          ? game.event.kind
          : game.mode === "city"
            ? `city-${((Math.max(1, game.mapDifficulty || 1) - 1) % 8) + 1}`
            : "select";
      if (this.introActive && game.mode === "city") return;
      if (this.musicContext === cue) return;
      this.musicContext = cue;
      if (this.introActive) {
        this.clips.start.pause();
        this.introActive = false;
      }
      this.musicCue = cue;
      const source = this.musicPath(cue);
      if (this.musicSource !== source) {
        this.music.pause();
        this.musicSource = source;
        this.music.src = source;
      }
      if (this.context && !game.paused) this.playMusic();
    }
    playMusic() {
      this.musicPaused = false;
      const track = this.introActive ? this.clips.start : this.music;
      if (!this.muted && !this.courseWaiting) track.play().catch(() => {});
    }
    pauseMusic() {
      this.foley.stop();
      this.musicPaused = true;
      this.music.pause();
      this.clips.start.pause();
    }
    stop() {
      this.shopVoice?.pause();
      this.foley.stop();
      this.pauseMusic();
      this.introActive = false;
      this.music.currentTime = 0;
      this.motionClips = {};
      for (const a of Object.values(this.clips)) {
        a.pause();
        a.currentTime = 0;
      }
    }
    stopMotionCue(kind) {
      const cue = this.motionClips[kind];
      if (!cue) return;
      cue.audio.pause();
      cue.audio.currentTime = 0;
      delete this.motionClips[kind];
    }
    /** Static captures of the initialized original sound-sequence states.
     * Source55/58 end the bail/slide state. Browser samples adapt that lifetime;
     * no sound CPU, instruction interpreter or synthesized replacement is used.
     */
    playMotionCue(kind, command, loop = false) {
      this.stopMotionCue(kind);
      if (kind === "impact") this.stopMotionCue("slide");
      const audio = this.clips[`rom-${command}`];
      if (this.muted || !audio) return false;
      const cue = { audio, paused: false };
      this.motionClips[kind] = cue;
      audio.loop = loop;
      audio.currentTime = 0;
      audio.onended = () => {
        if (!loop && this.motionClips[kind] === cue)
          delete this.motionClips[kind];
      };
      audio.play().catch(() => {});
      return true;
    }
    /** Follow actual simulation state, including cancelled jumps and courses.
     * A paused game retains sample position; recovery/cancellation clears it.
     */
    syncOriginalMotion(game) {
      for (const [kind, cue] of Object.entries(this.motionClips)) {
        const playing = ["city", "event"].includes(game.mode);
        const active =
          playing &&
          (kind === "impact"
            ? !!game.player.bail
            : !!game.player.skid?.original);
        if (!active) {
          this.stopMotionCue(kind);
          continue;
        }
        if (game.paused || this.muted) {
          cue.audio.pause();
          cue.paused = true;
        } else if (cue.paused) {
          cue.paused = false;
          cue.audio.play().catch(() => {});
        }
      }
    }
    clip(name) {
      const a = this.clips[name];
      if (a && !this.muted) {
        a.currentTime = 0;
        a.play().catch(() => {});
      }
    }
    toggle() {
      this.muted = !this.muted;
      if (this.shopVoice) this.shopVoice.muted = this.muted;
      if (this.muted) this.foley.stop();
      this.music.muted = this.muted || this.musicMuted;
      for (const a of Object.values(this.clips)) a.muted = this.muted;
      this.clips.start.muted = this.muted || this.musicMuted;
      return this.muted;
    }
    setMusicVolume(value) {
      this.musicVolume = Math.max(0, Math.min(1, value));
      this.music.volume = this.musicVolume;
      this.clips.start.volume = this.musicVolume;
      try {
        localStorage.setItem("720-music-volume", String(this.musicVolume));
      } catch {}
    }
    toggleMusic() {
      this.musicMuted = !this.musicMuted;
      this.music.muted = this.muted || this.musicMuted;
      this.clips.start.muted = this.muted || this.musicMuted;
      try {
        localStorage.setItem("720-music-muted", String(this.musicMuted));
      } catch {}
      return this.musicMuted;
    }
    /** Verified original command captures play independently of music.
     * Optional imported skate cues are routed separately from ROM captures.
     * Credit still supplies the provisional shared ticket/park-entry cue.
     */
    /** Small native fence enhancement, not a claimed sound-ROM recording.
     * A cached noise buffer and swept pulse make a brief electrical crackle.
     * Uses the saved skate SFX controls, independently of music volume.
     */
    fenceZap() {
      if (
        this.muted ||
        !this.foley.enabled ||
        !this.foley.volume ||
        !this.context
      )
        return false;
      const ctx = this.context;
      if (ctx.state !== "running") return false;
      this.zapBuffer ||= (() => {
        const buffer = ctx.createBuffer(
          1,
          Math.ceil(ctx.sampleRate * 0.16),
          ctx.sampleRate,
        );
        const data = buffer.getChannelData(0);
        let seed = 720;
        for (let i = 0; i < data.length; i++) {
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          data[i] = seed / 2147483648 - 1;
        }
        return buffer;
      })();
      const now = ctx.currentTime,
        gain = ctx.createGain(),
        filter = ctx.createBiquadFilter();
      const noise = ctx.createBufferSource(),
        pulse = ctx.createOscillator();
      noise.buffer = this.zapBuffer;
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(3200, now);
      filter.frequency.exponentialRampToValueAtTime(380, now + 0.16);
      pulse.type = "sawtooth";
      pulse.frequency.setValueAtTime(190, now);
      pulse.frequency.exponentialRampToValueAtTime(48, now + 0.16);
      gain.gain.setValueAtTime(this.foley.volume * 0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      noise.connect(filter);
      pulse.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start(now);
      pulse.start(now);
      pulse.stop(now + 0.16);
      pulse.onended = () => {
        noise.disconnect();
        pulse.disconnect();
        filter.disconnect();
        gain.disconnect();
      };
      return true;
    }
    effect(name, details) {
      if (name === "fence-zap") return this.fenceZap();
      const enhanced = this.foley.effect(name, details);
      if (name === "crash" && [0x54, 0x56].includes(details?.originalCommand))
        return (
          this.playMotionCue("impact", details.originalCommand) || enhanced
        );
      if (name === "skid" && details?.originalCommand === 0x57)
        return this.playMotionCue("slide", 0x57, true) || enhanced;
      const command =
        name === "medal" &&
        Number.isInteger(details?.rank) &&
        details.rank >= 0 &&
        details.rank <= 3
          ? 0x63 + details.rank
          : name === "crash" && [0x5a, 0x5b].includes(details?.originalCommand)
            ? details.originalCommand
            : null;
      if (command !== null && !this.muted) {
        this.clip(`rom-${command}`);
        return true;
      }
      if (
        !["coin", "purchase", "takedown", "springboard"].includes(name) ||
        this.muted
      )
        return enhanced;
      this.clip(name);
      return true;
    }
  }
  window.Skate720.AudioSystem = AudioSystem;
})();
