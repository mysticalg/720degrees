"""Recover Player2 colours from DB8C-DBC0; retain user-named cosmetic variants.
Usage: python tools/extract_skater_palettes.py path/to/720.zip
"""
from pathlib import Path
import json,struct,zipfile,sys
root=Path(__file__).resolve().parents[1]
with zipfile.ZipFile(sys.argv[1]) as z:
 def chip(n):return z.read(next(nm for nm in z.namelist() if Path(nm).name.startswith((f'136047-{n}.',f'{n}-'))))
 rom=bytearray(0x90000)
 for even,odd,offset in [(3126,3127,0x8000),(3128,4131,0x10000),(1129,1132,0x30000),(1130,1133,0x50000)]:
  a,b=chip(even),chip(odd);rom[offset:offset+len(a)*2:2]=a;rom[offset+1:offset+len(b)*2:2]=b
assert rom[0xdb8c:0xdb90]==bytes.fromhex('df8bf501')
assert rom[0xdbaa:0xdbae]==bytes.fromhex('c2154c7f')
def rgb(word):
 intensity=[0,124,132,141,152,161,169,178,193,202,210,219,230,239,247,256][word&15]
 colors=[0,3,4,5,6,7,8,9,10,11,12,13,14,14,15,15]
 return [(colors[(word>>s)&15]*intensity)>>4 for s in [12,8,4]]
p=root/'assets/skater-palettes.json';data=json.loads(p.read_text())
data['palettes']['lance']=[rgb(struct.unpack_from('<H',rom,0x13f2c+(15-pen)*2)[0]) for pen in range(16)]
data['palettes']['lester']=[rgb(struct.unpack_from('<H',rom,0x21f2c+(15-pen)*2)[0]) for pen in range(16)]
data['palettes']['barbie'][9:11]=[[240,144,0],[208,96,0]]
data['source']='Lance: exact Player2 DB8C-DBC0 palette, reversed words13F2C..13F4A; Lester: exact Player1 reversed words21F2C..21F4A; Natas: original captured palette bank3. Barbie: original Player1 with requested custom brown skin pens6..8 and orange shirt pens9..10. Names supplied by user.'
p.write_text(json.dumps(data,indent=2)+'\n')
p=root/'src/equipment-data.js';s=p.read_text();equipment=json.loads(s[s.index('{'):s.rindex('}')+1]);equipment['skaters']=data['palettes'];equipment['skaterPaletteSource']=data['source'];p.write_text('/** Original shop tables and source-backed cosmetic palettes; Barbie colours are user-requested additions. */\nwindow.Skate720.EQUIPMENT_DATA='+json.dumps(equipment,separators=(',',':'))+';\n')
print('Recovered original Player2 palette for Lance; Barbie shirt changed to orange')
