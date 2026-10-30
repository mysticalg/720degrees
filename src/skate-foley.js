/** Optional locally supplied skate recordings. No game physics are modified here.
 * HTMLAudio and file-picker object URLs support both file:// and GitHub Pages.
 */
(() => {
  class SkateFoley {
    constructor(owner) {
      this.owner = owner;
      this.volume = 0.45;
      this.enabled = true;
      this.urls = {};
      this.loops = {};
      this.voices = [];
      this.lastCue = {};
      this.material = 'concrete';
      this.counter = 0;
      const local = location.protocol === 'file:' || ['localhost','127.0.0.1'].includes(location.hostname);
      if (local) for (const key of SkateFoley.keys) this.urls[key] = `local-skate-sfx/${key}.mp3`;
    }
    /** Import only the known filenames, retaining no access to the source folder. */
    load(files) {
      this.stop();
      for (const url of Object.values(this.urls)) if (url.startsWith('blob:')) URL.revokeObjectURL(url);
      this.urls = {};
      this.loops = {};
      for (const file of files) {
        const key = file.name.replace(/\.mp3$/i,'');
        if (SkateFoley.keys.includes(key) && /\.mp3$/i.test(file.name)) this.urls[key] = URL.createObjectURL(file);
      }
      return Object.keys(this.urls).length;
    }
    effect(name) {
      if (!this.enabled || this.owner.muted) return false;
      const now = performance.now();
      if (now - (this.lastCue[name] ?? -Infinity) < (name === 'skid' ? 600 : 110)) return false;
      const key = ['jump','land','kick','crash'].includes(name) ? `${name}-${1 + (this.counter++ % 3)}` : name;
      if (!this.urls[key]) return false;
      this.lastCue[name] = now;
      const audio = new Audio(this.urls[key]);
      audio.volume = this.volume * (name === 'kick' ? 0.65 : 0.9);
      this.voices = this.voices.filter(a => !a.ended && !a.paused);
      if (this.voices.length >= 6) this.voices.shift().pause();
      this.voices.push(audio);
      audio.play().catch(() => {});
      return true;
    }
    stop() {
      for (const audio of [...Object.values(this.loops), ...this.voices]) {
        audio.pause(); audio.currentTime = 0; audio.volume = 0;
      }
      this.voices = [];
    }
    /** Material follows the visible original terrain. This is a native audio
     * adapter: the ROM's surface flags do not encode THPS material names. */
    surface(game, p) {
      if (game.event?.kind === 'ramp' || p.halfpipeWall) return 'ramp';
      const level = game.event?.level || game.city?.level;
      if (!level) return 'concrete';
      const sample = level.contactSample(p.x,p.y);
      if (sample.terrainLayer === 'raised') return 'wood';
      if (game.mode === 'event') return 'wood';
      // Sample the original map art once per tile; no collision data is altered.
      try {
        if (this.mapLevel !== level && level.image.complete) {
          this.mapLevel = level;
          this.mapPixels = null;
          const c = document.createElement('canvas');
          c.width = Math.ceil(level.image.width / 8); c.height = Math.ceil(level.image.height / 8);
          const ctx = c.getContext('2d', {willReadFrequently:true});
          ctx.drawImage(level.image,0,0,c.width,c.height);
          this.mapPixels = ctx.getImageData(0,0,c.width,c.height);
          this.mapLevel = level;
        }
        const image = this.mapPixels;
        if (image) {
          const x = Math.max(0,Math.min(image.width-1,Math.floor(p.x/8)));
          const y = Math.max(0,Math.min(image.height-1,Math.floor(p.y/8)));
          const i = (y*image.width+x)*4, [r,g,b] = image.data.slice(i,i+3);
          if (g > r*1.35 && g > b*1.2) return null;
          if ((r+g+b)/3 < 100) return 'asphalt';
        }
      } catch { /* file:// map canvas can be origin-tainted; concrete is safe. */ }
      return 'concrete';
    }
    update(game, dt) {
      const p = game.player;
      const active = p && !game.paused && ['city','event'].includes(game.mode) && this.enabled && !this.owner.muted;
      if (!active) { this.stop(); this.wasAir = undefined; return; }
      this.material = this.surface(game,p);
      // Also catches ramp transitions which bypass the ordinary jump/land cue.
      if (this.wasAir !== undefined && !!p.air !== this.wasAir) this.effect(p.air ? 'jump' : 'land');
      const justLaunched = !!p.air && !this.wasAir;
      this.wasAir = !!p.air;
      const speed = Math.hypot(p.vx || 0, (p.vy || 0)*2);
      if (justLaunched) { this.wheelSpeed = speed; this.airTime = 0; }
      this.airTime = p.air ? (this.airTime || 0) + dt : 0;
      const spinSpeed = Math.max(0, (this.wheelSpeed || speed) * Math.exp(-this.airTime * 0.08));
      const grind = p.halfpipeFlight?.trick === 'grind';
      const desired = grind ? 'grind-metal' : (p.air && spinSpeed > 12 ? (spinSpeed > 170 ? 'wheel-fast' : 'wheel-slow') : (!p.air && this.material && speed > 12 ? `roll-${this.material}` : null));
      if (desired && this.urls[desired] && !this.loops[desired]) {
        const audio = new Audio(this.urls[desired]);
        audio.loop = true; audio.volume = 0; audio.preservesPitch = false;
        this.loops[desired] = audio;
      }
      for (const [key,audio] of Object.entries(this.loops)) {
        const wheel = key.startsWith('wheel-');
        const target = key === desired ? this.volume * (wheel ? Math.min(0.28,spinSpeed/900) : Math.min(0.65,speed/500)) : 0;
        audio.volume += (target-audio.volume)*Math.min(1,dt*10);
        if (target > 0) {
          // Small pitch rise with wheel speed; pitch preservation is disabled.
          audio.playbackRate = Math.max(0.85,Math.min(1.2,0.9+(wheel ? spinSpeed : speed)/1600));
          if (audio.paused) audio.play().catch(() => {});
        } else if (audio.volume < 0.005) audio.pause();
      }
      // Braking scuffs the wheels, independent of the skater's fakie facing.
      if (!p.air && speed > 90 && game.input?.brake > 0.1) this.effect('skid');
    }
  }
  SkateFoley.keys = ['wheel-slow','wheel-fast','roll-concrete','roll-asphalt','roll-wood','roll-ramp','grind-metal','grind-curb','skid',
    ...['jump','land','kick','crash'].flatMap(k => [1,2,3].map(n => `${k}-${n}`))];
  window.Skate720.SkateFoley = SkateFoley;
})();
