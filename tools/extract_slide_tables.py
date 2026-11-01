"""Extract original slide data from an assembled revision-4 main.bin.
Usage: python tools/extract_slide_tables.py path/to/main.bin
A2BE reads bank2C00:7988; A45A selects bank0000:4EAC/4EBC.
Prints inert arrays only, for comparison with original-slide.js.
"""
from pathlib import Path
import json,struct,sys
rom=Path(sys.argv[1]).read_bytes()
print(json.dumps({'angleMasks':list(rom[0x15988:0x159a8]),
 'boardPositive':list(struct.unpack_from('<8H',rom,0x28eac)),
 'boardNegative':list(struct.unpack_from('<8H',rom,0x28ebc))},indent=2))
