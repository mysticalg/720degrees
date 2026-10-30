/** Original crack springboard controller A864-A8B8 and one-shot B378 clock. */
(() => {
  const word = (n) => n & 65535,
    signed = (n) => (n << 16) >> 16;
  function activate(speed, height, groundHeight, vertical, pads, impulses) {
    let magnitude = signed(word(speed));
    if (magnitude < 0) magnitude = signed(word(-magnitude));
    if (word(height) !== word(groundHeight) || magnitude < 384) return null;
    return {
      vertical: signed(word(vertical + impulses[pads & 3])),
      rate: 2,
      countdown: 2,
      phase: 0,
    };
  }
  function tick(crack) {
    if (!crack.rate) return;
    if (crack.countdown) {
      crack.countdown--;
      return;
    }
    crack.countdown = crack.rate;
    crack.phase++;
    if (crack.phase === 8) {
      crack.phase = 0;
      crack.rate = 0;
    }
  }
  /** Native unwrapped broad phase, using original 7106/7A30 rectangles.
   * Full 572A polygon contact remains pending. Coordinates here are pixels.
   */
  function touches(player, crack) {
    return (
      player.x + 16 > crack.actorX + 12 &&
      player.x - 16 < crack.actorX + 20 &&
      player.y + 1 > crack.actorY - 11 &&
      player.y - 11 < crack.actorY - 3
    );
  }
  const api = Object.freeze({ activate, tick, touches });
  if (typeof module !== "undefined") module.exports = api;
  else window.Skate720.OriginalCracks = api;
})();
