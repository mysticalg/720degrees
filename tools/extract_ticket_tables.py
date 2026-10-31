"""Refresh original5212/523A ticket data from the assembled720 program image."""
from pathlib import Path
import json
import re
import struct
import sys

rom = Path(sys.argv[1]).read_bytes()
words = struct.unpack_from("<20H", rom, 0x1F212)
increments = [list(words[index:index+5]) for index in range(0, 20, 5)]
initial = list(rom[0x1F23A:0x1F23E])
if len(initial) != 4:
    raise ValueError("Incomplete ticket table")
target = Path(__file__).resolve().parents[1] / "src/original-tickets.js"
text = target.read_text(encoding="utf-8")
for name, values in [("increments", increments), ("initial", initial)]:
    text, count = re.subn(r"const " + name + r" = \[[\s\S]*?\];",
                          "const " + name + " = " + json.dumps(values) + ";", text, count=1)
    if count != 1:
        raise ValueError("Ticket data declaration not found")
target.write_text(text, encoding="utf-8")
print("Extracted20 threshold words and4 initial ticket bytes from5212/523A")
