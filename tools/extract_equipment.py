"""Recover original shop tables and indexed motion pixels; no ROM execution.
Usage: python tools/extract_equipment.py path/to/720.zip
The existing extraction-data.json supplies the captured original base palette.
"""
from pathlib import Path
import json
import struct
import sys
import zipfile
from PIL import Image
from extract_assets import decode

root = Path(__file__).resolve().parents[1]
with zipfile.ZipFile(sys.argv[1]) as archive:
    def chip(number):
        return archive.read(next(name for name in archive.namelist()
                                 if name.startswith(f"136047-{number}.")))

    program = bytearray(0x90000)
    for even, odd, offset in [(3126, 3127, 0x8000), (3128, 4131, 0x10000),
                              (1129, 1132, 0x30000), (1130, 1133, 0x50000)]:
        low, high = chip(even), chip(odd)
        program[offset:offset + len(low) * 2:2] = low
        program[offset + 1:offset + len(high) * 2:2] = high

    motion = bytearray(0x100000)
    for index in range(16):
        number = 1109 + index if index < 8 else 1101 + index - 8
        raw = chip(number)
        offset = (index // 4) * 0x40000 + (index % 4) * 0x8000
        motion[offset:offset + 0x8000] = raw[0x8000:]
        motion[offset + 0x20000:offset + 0x28000] = raw[:0x8000]
    motion = bytes(value ^ 255 for value in motion)
    pixels = decode(motion, 16, [0, 4, len(motion) * 4, len(motion) * 4 + 4], 8192)

# Verify the caller really indexes helmet025D into the recovered turn table.
assert program[0x1ab0a:0x1ab12] == bytes.fromhex("c0975d02009ca07c")
reference = json.loads((root / "assets/extraction-data.json").read_text(encoding="utf-8"))
data = {"priceStages": list(program[0xfe7c:0xfe8c]),
        "prices": list(program[0xfe70:0xfe7b]),
        "palette": reference["palette"][:32], "colors": {},
        "airTurnSteps": list(program[0x15ca0:0x15ca4]),
        "airTurnSource": "ROM1AB0A helmet025D -> bank2C00:7CA0; 288 angle units/revolution"}
# Palette service maps this bank into both windows: CPU7Axx is physical13Axx.
for name, address in [("shoes", 0x7a4c), ("shoeTrim", 0x7a58),
                      ("board", 0x7a64), ("pads", 0x7a70)]:
    data["colors"][name] = list(struct.unpack_from("<8H", program, 0x12000 + address - 0x6000))
(root / "src/equipment-data.js").write_text(
    "/** Recovered shop price and equipment colour tables. */\nwindow.Skate720.EQUIPMENT_DATA="
    + json.dumps(data) + ";\n", encoding="utf-8")
atlas = Image.new("L", (2048, 1024))
for code, tile in enumerate(pixels):
    atlas.paste(Image.frombytes("L", (16, 16), tile), ((code % 128) * 16, (code // 128) * 16))
atlas.save(root / "assets/motion-indices.png")
print("Recovered original equipment tables and indexed sprite atlas")
