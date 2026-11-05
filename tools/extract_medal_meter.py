"""Recover original medal-meter frames and class-dependent B/S/G positions."""
from pathlib import Path
import json,struct,zipfile,sys
from PIL import Image
root=Path(__file__).resolve().parents[1]
with zipfile.ZipFile(sys.argv[1]) as z:
 def chip(n):return z.read(next(k for k in z.namelist() if Path(k).name.startswith(f'136047-{n}.')))
 r=bytearray(0x90000)
 for a,b,base in [(3126,3127,0x8000),(3128,4131,0x10000),(1129,1132,0x30000),(1130,1133,0x50000)]:
  lo,hi=chip(a),chip(b);r[base:base+2*len(lo):2]=lo;r[base+1:base+2*len(hi):2]=hi
assert r[0x17522:0x17526]==bytes.fromhex('df09ba90')
assert r[0x17534:0x17538]==bytes.fromhex('c065a65e')
alpha=Image.open(root/'assets/rom-alpha.png').convert('RGBA')
sheet=Image.new('RGBA',(176*4,48*12));records=[]
words=[struct.unpack_from('<H',r,a)[0] for a in [0xdda8,0xdda2,0xdd96,0xdd8a]]
def rgb(v):
 intensity=[0,124,132,141,152,161,169,178,193,202,210,219,230,239,247,256][v&15]
 levels=[0,3,4,5,6,7,8,9,10,11,12,13,14,14,15,15]
 return tuple(levels[(v>>s)&15]*intensity>>4 for s in [12,8,4])
for index in range(12):
 ptr,pos,h,w=struct.unpack_from('<4H',r,0x1bea6+index*8)
 assert (pos,h,w)==(0x212a,6,22)
 address=0x12000+ptr-0x6000;count=value=mode=0;cells=[]
 for i in range(h*w):
  if not count:
   control=r[address];address+=1;count=control&63;mode=control>>6
   if not count:raise ValueError('Unexpected zero-count alpha run')
   value=(value&0xff00)|r[address];address+=1
   if mode==2:value=(value&255)|(r[address]<<8);address+=1
  elif mode==0:value=(value&0xff00)|r[address];address+=1
  elif mode==2:value=struct.unpack_from('<H',r,address)[0];address+=2
  elif mode==3:value=(value+1)&65535
  cells.append(value);count-=1
 for i,code in enumerate(cells):
  # EBC4 leaves template placeholders untouched rather than drawing glyph 149.
  if (code & 1023)==0x149:continue
  code &=1023;x=(code&63)*8;y=(code>>6)*8+2*128
  tile=alpha.crop((x,y,x+8,y+8))
  for variant,color in enumerate(map(rgb,words)):
   coloured=tile.copy()
   # Keep the frame dark, as in the reference display, rather than using the
   # shared atlas's white UI background. The dark red is an original alpha
   # palette colour; only the scoring pen changes with the medal rank.
   dark=rgb(struct.unpack_from('<H',r,0x2deda)[0])
   coloured.putdata([(*color,255) if p==(231,0,0,255)
                    else (*dark,255) if p==(231,231,231,255) else p
                    for p in tile.get_flattened_data()])
   sheet.alpha_composite(coloured,(variant*176+(i%w)*8,index*48+(i//w)*8))
 records.append({'index':index,'pointer':ptr,'position':pos,'cells':cells})
sheet.save(root/'assets/rom-medal-meter.png',optimize=True)
data={'source':'CPU7522-7538 ramp class map5E97; bank1800 descriptors5EA6+8*index; EBC4 skips149; original alpha bank2',
 'classFrames':list(r[0x2de97:0x2dea2]),'colourWords':words,'x':168,'y':16,'width':176,'height':48,'records':records}
(root/'src/medal-meter-data.js').write_text('/** Original medal-meter frames and class selector; inert data. */\nwindow.Skate720.MEDAL_METER_DATA='+json.dumps(data,separators=(',',':'))+';\n',encoding='utf-8')
print('Recovered12 original medal-meter frames and class selector')
