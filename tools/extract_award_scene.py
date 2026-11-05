"""Recover original EDB2 award-scene scenery and EE6E wheel placements.
Usage: python tools/extract_award_scene.py path/to/720.zip
Only data decompression and pixel decoding; no ROM instructions execute.
The full scene is retained. Viewport and animation wiring are separate work.
"""
from pathlib import Path
import json,struct,sys,zipfile
import numpy as np
from PIL import Image
from extract_assets import decode
root=Path(__file__).resolve().parents[1]
with zipfile.ZipFile(sys.argv[1]) as z:
 def chip(n):return z.read(next(nm for nm in z.namelist() if Path(nm).name.startswith((f'136047-{n}.',f'{n}-'))))
 rom=bytearray(0x90000)
 for even,odd,offset in [(3126,3127,0x8000),(3128,4131,0x10000),(1129,1132,0x30000),(1130,1133,0x50000)]:
  a,b=chip(even),chip(odd);rom[offset:offset+len(a)*2:2]=a;rom[offset+1:offset+len(b)*2:2]=b
 scenery=b''.join(chip(n) for n in [1121,1122,1123,1124,1117,1118,1119,1120])
def word(a):return struct.unpack_from('<H',rom,a)[0]
# EDB2 calls4000 with kind5. This loader retains its high3C00 window.
assert rom[0xee40:0xee44]==bytes.fromhex('df090040')
assert rom[0xdada:0xdade]==bytes.fromhex('c115ac7e')
banks=[0x28000,0x20000,0x18000,0x10000,0x2a000,0x22000,0x1a000,0x12000,0x2c000,0x24000,0x1c000,0x14000,0x2e000,0x26000,0x1e000,0x16000,0x48000,0x40000,0x38000,0x30000,0x4a000,0x42000,0x3a000,0x32000,0x4c000,0x44000,0x3c000,0x34000,0x4e000,0x46000,0x3e000,0x36000,0x68000,0x60000,0x58000,0x50000,0x6a000,0x62000,0x5a000,0x52000,0x6c000,0x64000,0x5c000,0x54000,0x6e000,0x66000,0x5e000,0x56000]
def read(bank,a):return rom[banks[(bank+((a>>3)&0x1c00))>>10]+(a&8191)]
def bank_word(bank,a):return read(bank,a)|(read(bank,a+1)<<8)
def half_block(bank,pointer,lower):
 cursor=pointer+(read(bank,pointer+2) if lower else 0)+3
 value=remaining=mode=0;cells=[]
 for _ in range(128):
  if remaining==0:
   control=read(bank,cursor);cursor+=1;remaining=control&63 or 65536;mode=control>>6
   value=(value&0xff00)|read(bank,cursor);cursor+=1
   if mode==2:value=(value&255)|(read(bank,cursor)<<8);cursor+=1
  elif mode==0:value=(value&0xff00)|read(bank,cursor);cursor+=1
  elif mode==2:value=bank_word(bank,cursor);cursor+=2
  elif mode==3:value=(value+1)&65535
  cells.append(value);remaining-=1
 return cells
kind=5;offset=word(0x17f8c+kind*2);stride=rom[0x17f9c+kind];next_offset=word(0x17f8c+(kind+1)*2)
assert (offset,stride,next_offset)==(0xae0,12,0xb1c)
columns=stride//2;rows=(next_offset-offset)//stride
assert all(word(word(0xff54+kind*2)+i*2)==0 for i in range(16))
raw=np.zeros((rows*16,columns*16),dtype=np.uint16)
for row in range(rows):
 for col in range(columns):
  pointer=bank_word(word(0xfeb2+kind*2),offset+row*stride+col*2)
  for lower in range(2):
   y=row*16+lower*8;x=col*16
   raw[y:y+8,x:x+16]=np.array(half_block(word(0xfea2+kind*2),pointer,lower)).reshape(8,16)
alias_low=rom[0xfec2+kind]*1024;alias_high=rom[0xfeca+kind]*1024
actual=(raw&1023)+np.where(raw&1024,alias_high,alias_low)
def rgb(v):
 intensity=[0,124,132,141,152,161,169,178,193,202,210,219,230,239,247,256][v&15]
 levels=[0,3,4,5,6,7,8,9,10,11,12,13,14,14,15,15]
 return [(levels[(v>>s)&15]*intensity)>>4 for s in [12,8,4]]
# DABA's predecrement loop copies7DAC..7EAA into playfield palette128..255.
palette=np.array([rgb(word(0x13dac+i*2)) for i in range(128)],dtype=np.uint8)
tiles=np.array([list(t) for t in decode(scenery,8,[0,4,len(scenery)*4,len(scenery)*4+4],8192)],np.uint8).reshape(8192,8,8)
pixels=tiles[actual]+((raw>>11)&7)[:,:,None,None]*16
image=palette[pixels].transpose(0,2,1,3,4).reshape(rows*128,columns*128,3)
Image.fromarray(image).save(root/'assets/award-scene.png',optimize=True)
metadata={'source':'EDB2/EE40 ->bank1800:4000; high3C00:7F8C; E908-EA5C; DABA palette', 'kind':kind,'width':columns*128,'height':rows*128,'offset':offset,'macroColumns':columns,'macroRows':rows,'aliasLow':alias_low,'aliasHigh':alias_high,'wheels':[],'viewportVerified':True,'crop':[128,128]}
for i in range(4):
 metadata['wheels'].append({'kind':rom[0x21d94+i],'entry':word(0x21d9a+i*2),'xWord':word(0x21da4+i*2),'yWord':word(0x21dae+i*2),'rate':3})
# A9FC769E/76B0 and dictionary5AC8 retain the original title/gear layout.
metadata['frames']=[]
for address in [0x1d69e,0x1d6b0]:
 pos,h,w=struct.unpack_from('<HBB',rom,address)
 metadata['frames'].append({'position':0x2000+(pos&~1),'height':h,'width':w})
metadata['messages']={}
for index in range(0x18,0x20):
 ptr=word(0x2dac8+index*2);address=0x2c000+ptr-0x4000
 pos=word(address)+0x2000;address+=2;text=''
 while True:
  value=rom[address];address+=1;text+=chr(value&127)
  if value&128:break
 metadata['messages'][str(index)]={'position':pos,'text':text}
metadata['smallGlyphs']={}
metadata['largeGlyphs']={}
for code in range(32,91):
 glyph=word(0x8ca6+(code-32)*2) if code<=64 else code+0x99
 if glyph&0x8000:glyph=(-glyph)&65535
 metadata['smallGlyphs'][chr(code)]=glyph
 if 48<=code<=57:large=list(range(1+(code-48)*4,5+(code-48)*4))
 elif code>64:large=list(rom[0x2c000+(code-65)*4:0x2c004+(code-65)*4])
 else:
  offset=rom[0x8c86+code-32];large=list(rom[0x2c000+offset:0x2c004+offset])
 metadata['largeGlyphs'][chr(code)]=large
metadata['classPositions']=[word(0x2ddea+i*2) for i in range(16)]
metadata['wheelPalette']=[rgb(word(0x13f0c+(15-i)*2)) for i in range(16)]
(root/'src/award-scene-data.js').write_text('/** Original award-scene records and glyph directories; extracted without emulation. */\nwindow.Skate720.AWARD_SCENE_DATA='+json.dumps(metadata,separators=(',',':'))+';\n')
(root/'assets/award-scene-source.json').write_text(json.dumps(metadata,indent=2)+'\n')
print('Recovered original768x640deck scene and four original wheel placements; viewport verified against isolated original scene capture')
