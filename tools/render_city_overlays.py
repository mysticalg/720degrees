"""Render the original initial-class EC20 overlay cells without replacement art.
Run node tools/build_city_overlays.cjs first, then this script with 720.zip.
"""
from pathlib import Path
import json,sys,zipfile
import numpy as np
from PIL import Image
from extract_assets import decode
root=Path(__file__).resolve().parents[1]
with zipfile.ZipFile(sys.argv[1]) as z:
 def chip(n):return z.read(next(x for x in z.namelist() if x.startswith(f'136047-{n}.')))
 scenery=b''.join(chip(n) for n in [1121,1122,1123,1124,1117,1118,1119,1120])
tiles=np.array([list(tile) for tile in decode(scenery,8,[0,4,len(scenery)*4,len(scenery)*4+4],8192)],np.uint8).reshape(8192,8,8)
palette=np.array(json.loads((root/'assets/extraction-data.json').read_text(encoding='utf-8'))['palette'],np.uint8)
image=Image.new('RGBA',(6144,3072))
changes=json.loads((root/'assets/city-overlay-cells.json').read_text(encoding='utf-8'))
for cell in changes:
 y,x=divmod(cell['index'],768);colors=palette[tiles[cell['tile']]+128+((cell['rawWord']>>11)&7)*16]
 image.paste(Image.fromarray(colors).convert('RGBA'),(x*8,y*8))
image.save(root/'assets/city-overlays.png',optimize=True)
print('Rendered',len(changes),'original scenery overlay cells')
