/** Original two-channel traffic sound allocation, bank1800:5CC0-5D52.
 * Commands come from original5B0B/5B11 tables. The sink only plays cues
 * that have actually been recovered; it must never synthesize substitutes.
 */
(() => {
  function acquire(kind, memory, commands, send) {
    const category = memory.readTypeByte(0x6567 + kind) & 255;
    if (!category) return null;
    for (let channel = 0; channel < 2; channel++) {
      const address = 0x01a6 + channel;
      if (memory.readRamByte(address)) continue;
      memory.writeRamByte(address, category);
      const command = commands[channel][category] & 255;
      send(command);
      return { channel, category, command };
    }
    return null;
  }
  function release(kind, memory, send) {
    const category = memory.readTypeByte(0x6567 + kind) & 255;
    if (!category) return null;
    for (let channel = 0; channel < 2; channel++) {
      const address = 0x01a6 + channel;
      if (memory.readRamByte(address) !== category) continue;
      memory.writeRamByte(address, 0);
      const command = channel ? 0x76 : 0x70;
      send(command);
      return { channel, category, command };
    }
    return null;
  }
  const api = Object.freeze({ acquire, release });
  if (typeof module !== "undefined") module.exports = api;
  else window.Skate720.OriginalTrafficSound = api;
})();
