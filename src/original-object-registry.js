/** Native translation of the original pending-object registry, CE24-CFD4.
 * This manages placement records and reservations, not a CPU or interpreter.
 * The separate renderer/spawn scheduler owns actual motion-object slots.
 */
(() => {
  const word = (n) => n & 65535,
    signed = (n) => (n << 16) >> 16;
  const rw = (m, a) => (m.readRamByte(a) | (m.readRamByte(a + 1) << 8)) & 65535;
  const ww = (m, a, v) => {
    m.writeRamByte(a, v & 255);
    m.writeRamByte(a + 1, (v >> 8) & 255);
  };
  /** CFD6-D004, before D01A queues the city's fixed placements. */
  function initialize(memory) {
    for (let a = 0x09aa; a <= 0x0e9a; a++) memory.writeRamByte(a, 0);
    ww(memory, 0x09ae, 65535);
    ww(memory, 0x09b0, 63);
    memory.writeRamByte(0x0e98, 64);
  }
  /** CE24-CF5C. dynamic chooses the registry partition; it does not mean
   * that the actor moves. Kind byte09B8 is a pending type until spawned.
   */
  function enqueue(packed, kind, dynamic, memory, services) {
    const probeSlot = dynamic ? 64 : 0;
    ww(memory, 0x09aa, probeSlot);
    if (services.inspect(packed, probeSlot, memory).status !== 0)
      return { status: -1, slot: null };
    let slot = dynamic ? memory.readRamByte(0x0e98) : 0;
    while (slot < 255 && memory.readRamByte(0x09b8 + slot)) slot++;
    if (slot >= 255)
      throw new RangeError("Original pending-object registry exhausted");
    ww(memory, 0x0af8 + slot * 2, packed);
    ww(memory, 0x09aa, slot);
    const placement = services.resolve(packed, slot, memory.readObjectWord);
    if (!(memory.readTypeByte(0x6438 + (kind & 65535)) & 2)) {
      const address = 0x0cf6 + (placement.bitmapIndex >> 3);
      memory.writeRamByte(
        address,
        memory.readRamByte(address) | (1 << (placement.bitmapIndex & 7)),
      );
    }
    if (!dynamic && !(memory.readTypeByte(0x649d + (kind & 65535)) & 128))
      memory.writeRamByte(
        0x0ab8 + slot,
        (memory.readRamByte(0x0e9a) + 8) & 255,
      );
    memory.writeRamByte(0x09b8 + slot, kind & 255);
    const highAddress = dynamic ? 0x09b0 : 0x09ae;
    let highest = signed(rw(memory, highAddress));
    if (slot > highest) highest = slot;
    else
      while (highest >= 0 && !memory.readRamByte(0x09b8 + highest)) highest--;
    ww(memory, highAddress, highest);
    memory.writeRamByte(0x0e99, 1);
    return { status: 0, slot, ...placement };
  }
  /** CF5E-CFD4: retire an active sprite if needed, release its placement,
   * and request a replacement for dynamic objects through D348's callback.
   */
  function remove(slot, memory, services) {
    ww(memory, 0x09aa, slot);
    const packed = rw(memory, 0x0af8 + slot * 2),
      entry = memory.readRamByte(0x09b8 + slot);
    let kind;
    if (packed & 32768) {
      const sprite = entry & 63;
      kind = memory.readRamByte(0x0370 + sprite);
      services.retireSprite(sprite, kind);
    } else kind = entry & 127;
    const placement = services.resolve(packed, slot, memory.readObjectWord);
    services.release(placement.bitmapIndex, memory);
    if (slot < 64) memory.writeRamByte(0x0ab8 + slot, 0);
    else
      services.request(
        memory.readTraitByte(0x4000 + placement.bitmapIndex) & 15,
      );
    ww(memory, 0x0af8 + slot * 2, 0);
    memory.writeRamByte(0x09b8 + slot, 0);
    const classByte =
      memory.readTraitByte(0x4000 + placement.bitmapIndex) & 255;
    return {
      slot,
      kind,
      bitmapIndex: placement.bitmapIndex,
      classValue: (classByte << 24) >> 24,
    };
  }
  /** Readers over extracted inert table ranges, with original field storage.
   * This field buffer is intentionally separate from browser actor objects.
   */
  function createMemory(data, decodeBase64) {
    const ram = new Uint8Array(4096),
      objects = decodeBase64(data.directories),
      traits = decodeBase64(data.traits),
      types = decodeBase64(data.typeFlags);
    const read = (bytes, index) => {
      if (!Number.isInteger(index) || index < 0 || index >= bytes.length)
        throw new RangeError(
          "Original registry table address outside extracted data",
        );
      return bytes[index];
    };
    const memory = {
      ram,
      readRamByte: (a) => read(ram, a),
      writeRamByte: (a, v) => {
        if (a < 0 || a >= ram.length)
          throw new RangeError("Original registry field address outside data");
        ram[a] = v & 255;
      },
      readObjectWord: (a) =>
        read(objects, a - 0x7a00) | (read(objects, a - 0x7a00 + 1) << 8),
      readTraitByte: (a) => read(traits, a - 0x4000),
      readTypeByte: (a) => read(types, a - 0x6438),
    };
    initialize(memory);
    return memory;
  }
  const api = Object.freeze({ initialize, enqueue, remove, createMemory });
  if (typeof module !== "undefined") module.exports = api;
  else window.Skate720.OriginalObjectRegistry = api;
})();
