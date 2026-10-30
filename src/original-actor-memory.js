/** Explicit table readers shared by native actor routines.
 * The registry field buffer stores original state; no instructions are run.
 */
(() => {
  function createMemory(registry, data, decode) {
    const types = data.types.map(decode),
      coordinates = decode(data.coordinates),
      objects = decode(data.objects),
      motion = decode(data.motion),
      fixed = decode(data.fixed);
    const at = (bytes, index) => {
      if (!Number.isInteger(index) || index < 0 || index >= bytes.length)
        throw new RangeError("Actor table read outside extracted range");
      return bytes[index];
    };
    const typeByte = (a) =>
      a < 0x6000 ? at(types[0], a - 0x4000) : at(types[1], a - 0x6000);
    const objectByte = (a) => at(objects, a - 0x6000);
    const coordinateByte = (a) => at(coordinates, a - 0x4000);
    const motionByte = (a) => at(motion, a - 0x3ff8);
    const word = (read, a) => read(a) | (read(a + 1) << 8);
    return {
      ...registry,
      readTypeByte: typeByte,
      readTypeWord: (a) => word(typeByte, a),
      readObjectByte: objectByte,
      readObjectWord: (a) => word(objectByte, a),
      readTraitByte: coordinateByte,
      readCoordinateWord: (a) => word(coordinateByte, a),
      readMotionByte: motionByte,
      readMotionWord: (a) => word(motionByte, a),
      readFixedByte: (a) => at(fixed, a - (data.fixedBase ?? 0xfd8a)),
      readCoordinateOrFixedWord: (a) =>
        a >= 0x8000
          ? word((b) => at(fixed, b - (data.fixedBase ?? 0xfd8a)), a)
          : word(coordinateByte, a),
    };
  }
  const api = Object.freeze({ createMemory });
  if (typeof module !== "undefined") module.exports = api;
  else window.Skate720.OriginalActorMemory = api;
})();
