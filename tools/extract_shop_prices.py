"""Render the original EC20/ECD0 dynamic price mats, not replacement text.
Usage: node tools/build_shop_prices.cjs; python tools/extract_shop_prices.py ROM.zip
"""
from pathlib import Path
import json,sys,zipfile
from PIL import Image
from extract_assets import decode
root=Path(__file__).resolve().parents[1]
with zipfile.ZipFile(sys.argv[1]) as z:
 def chip(n):return z.read(next(x for x in z.namelist() if x.startswith(f'136047-{n}.')))
 scenery=b''.join(chip(n) for n in [1121,1122,1123,1124,1117,1118,1119,1120])
tiles=decode(scenery,8,[0,4,len(scenery)*4,len(scenery)*4+4],8192)
palette=json.loads((root/'assets/extraction-data.json').read_text())['palette']
data=json.loads((root/'assets/shop-price-cells.json').read_text());background=Image.open(root/'assets/city-background.png').convert('RGB')
atlas=Image.new('RGB',(256,320));placements=[]
for slot,o in enumerate(data['overlays']):
 x,y,w,h=o['x']*8,o['y']*8,o['width']*8,o['height']*8
 placements.append({'id':o['id'],'selector':o['selector'],'x':x,'y':y,'width':w,'height':h,'atlasX':slot*64})
 for variant,row in enumerate(data['rows']):
  patch=background.crop((x,y,x+w,y+h))
  for cell in row:
   if cell['id']!=o['id']:continue
   cy,cx=divmod(cell['index'],768);bank=128+((cell['rawWord']>>11)&7)*16
   tile=Image.new('RGB',(8,8));tile.putdata([tuple(palette[bank+v]) for v in tiles[cell['tile']]])
   patch.paste(tile,(cx*8-x,cy*8-y))
  atlas.paste(patch,(slot*64,variant*32))
atlas.save(root/'assets/shop-prices.png',optimize=True)
(root/'src/shop-price-data.js').write_text('/** EC20/ECD0 original price-mat placement; rows FE7C[stage]-1. */\nwindow.Skate720.SHOP_PRICE_DATA='+json.dumps(placements,separators=(',',':'))+';\n')
print('Rendered forty original price patches in a 256x320 atlas')
