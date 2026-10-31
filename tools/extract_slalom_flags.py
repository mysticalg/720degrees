"""Extract original placed slalom flags using BF5E/C618 coordinate offsets.
Usage: python tools/extract_slalom_flags.py path/to/720.zip
The retained records are original dynamic placements, not a replacement layout.
"""
from pathlib import Path
import struct,json
import runpy
root=Path(__file__).resolve().parents[1]
# An assembled program avoids regenerating unrelated scenery on re-extraction.
import sys, zipfile
if zipfile.is_zipfile(sys.argv[1]):
 with zipfile.ZipFile(sys.argv[1]) as z:
  r=bytearray(0x30000)
  def chip(n):return z.read(next(x for x in z.namelist() if Path(x).name.startswith(f'136047-{n}.')))
  for even,odd,offset in [(3126,3127,0x8000),(3128,4131,0x10000)]:
   low,high=chip(even),chip(odd);r[offset:offset+len(low)*2:2]=low;r[offset+1:offset+len(high)*2:2]=high
else:r=Path(sys.argv[1]).read_bytes()
w=lambda a:struct.unpack_from('<H',r,a)[0]
tb=lambda a:r[(0x28000+a-0x4000) if a<0x6000 else (0x20000+a-0x6000)]
tw=lambda a:tb(a)|(tb(a+1)<<8)
signed=lambda n:n-65536 if n&32768 else n
out=[]
for group in json.loads((root/'assets/slalom-object-records.json').read_text(encoding='utf8')):
 actors=[]
 for a in group['records']:
  k=a['type'];loc=a['packed']&511;b=a['bitmapIndex'];x=(loc>>4)*256+(w(0x2a000+0x4ac0+b*2-0x4000)+signed(tw(0x62a4+k*2)))/64;y=((loc&15)+1)*256-(w(0x2a000+0x5580+b*2-0x4000)+signed(tw(0x636e+k*2)))/64
  actors.append({'kind':k,'packed':a['packed'],'actorX':x,'actorY':y,'pointer':tw(0x5f7c+k*2),'extraPointer':tw(0x6110+k*2),'rate':tb(0x6502+k),'columns':r[0x29c96+k],'flags':tb(0x649d+k)&1,'palette':(tb(0x6438+k)>>4)&3,'countdown':tb(0x6502+k),'dx':0,'dy':0})
 # D0C2..D0CE queues a type25 companion with the same packed placement.
 for a in list(actors):
  actors.append({**a,'kind':25,'pointer':tw(0x5f7c+25*2),'extraPointer':tw(0x6110+25*2)})
 out.append(actors)
(root/'src/slalom-data.js').write_text('/** Original slalom26..35 placements, BF5E/C618 offsets and motion directories. */\nwindow.Skate720.SLALOM_DATA='+json.dumps(out,separators=(',',':'))+';\n',encoding='utf8')
print([len(a) for a in out])
