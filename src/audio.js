/** The music/voice files were rendered offline from the user's sound ROM.
 * The delivered game plays ordinary local MP3s: no sound CPU or chip emulator.
 * Unrecovered cues are silent rather than replaced with invented effects.
 */
(() => {
  class AudioSystem {
    constructor() {
      this.muted = false;
      this.musicMuted = false;
      this.musicVolume = 0.38;
      try {
        const saved = localStorage.getItem("720-music-volume");
        if (saved !== null && Number.isFinite(Number(saved)))
          this.musicVolume = Math.max(0, Math.min(1, Number(saved)));
        this.musicMuted = localStorage.getItem("720-music-muted") === "true";
      } catch {}
      this.context = null;
      this.music = new Audio("assets/skate-city.mp3");
      this.music.loop = true;
      this.music.volume = this.musicVolume;
      this.music.muted = this.musicMuted;
      this.clips = {
        start: new Audio("assets/start.mp3"),
        bees: new Audio("assets/bees.mp3"),
      };
      for (const audio of Object.values(this.clips)) audio.volume = 0.55;
    }
    unlock() {
      if (!this.context)
        this.context = new (window.AudioContext || window.webkitAudioContext)();
      this.context.resume().catch(() => {});
    }
    playMusic() {
      if (!this.muted) this.music.play().catch(() => {});
    }
    pauseMusic() {
      this.music.pause();
    }
    stop() {
      this.pauseMusic();
      this.music.currentTime = 0;
      for (const a of Object.values(this.clips)) {
        a.pause();
        a.currentTime = 0;
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
      this.music.muted = this.muted || this.musicMuted;
      for (const a of Object.values(this.clips)) a.muted = this.muted;
      return this.muted;
    }
    setMusicVolume(value) {
      this.musicVolume = Math.max(0, Math.min(1, value));
      this.music.volume = this.musicVolume;
      try {
        localStorage.setItem("720-music-volume", String(this.musicVolume));
      } catch {}
    }
    toggleMusic() {
      this.musicMuted = !this.musicMuted;
      this.music.muted = this.muted || this.musicMuted;
      try {
        localStorage.setItem("720-music-muted", String(this.musicMuted));
      } catch {}
      return this.musicMuted;
    }
    /** Unrecovered cues remain silent: no replacement synthesized sounds. */
    effect(name) {}
  }
  window.Skate720.AudioSystem = AudioSystem;
})();
