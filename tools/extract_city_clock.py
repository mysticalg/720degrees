"""Refresh the44 original51E6 city-clock bytes from720.zip or assembled main.bin."""
from pathlib import Path
import json
import re
import sys
import zipfile

source = Path(sys.argv[1])
if zipfile.is_zipfile(source):
    rom = bytearray(0x30000)
    with zipfile.ZipFile(source) as archive:
        def chip(number):
            name = next(name for name in archive.namelist()
                        if Path(name).name.startswith((f"136047-{number}.", f"{number}-")))
            return archive.read(name)
        for even, odd, offset in [(3126, 3127, 0x8000), (3128, 4131, 0x10000)]:
            low, high = chip(even), chip(odd)
            rom[offset:offset + len(low)*2:2] = low
            rom[offset+1:offset + len(high)*2:2] = high
else:
    rom = source.read_bytes()
periods = list(rom[0x1F1E6:0x1F212])
if len(periods) != 44 or not all(periods):
    raise ValueError("City-clock table is incomplete")
target = Path(__file__).resolve().parents[1] / "src/original-city-clock.js"
text = target.read_text(encoding="utf-8")
text, count = re.subn(r"const periods = \[[\s\S]*?\];",
                      "const periods = " + json.dumps(periods) + ";", text, count=1)
if count != 1:
    raise ValueError("City-clock data declaration not found")
target.write_text(text, encoding="utf-8")
print("Extracted44 original city-clock bytes from bank3800:51E6")
