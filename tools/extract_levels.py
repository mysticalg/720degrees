"""Decode the original 720° city and park layouts into native browser assets.

Usage: python tools/extract_levels.py path/to/720.zip
Build dependencies: Pillow and NumPy. Neither is needed to play the game.

Reverse-engineered from the user's revision-4 ROM:
  * T-11 E82E-EAD2: two-half macroblock decompression and dynamic floor aliases.
  * T-11 bank 1A000, 4000-438A: scrolling grid directory and map dimensions.
  * FEA2/FEB2: compressed-block and map-directory banking.
  * FEC2/FECA: scenery graphics banks; 17F8C: six-map park directories.
  * ROM 18000 / 10000: surface profiles and terrain/finish flags.

This is a data decoder, not an instruction interpreter or emulator.
"""
from pathlib import Path
from functools import lru_cache
import argparse, base64, json, struct, zipfile
import numpy as np
from PIL import Image
from extract_assets import decode

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('rom', type=Path)
args = parser.parse_args()
with zipfile.ZipFile(args.rom) as archive:
    def chip(number):
        return archive.read(next(name for name in archive.namelist()
                            if name.startswith(f'136047-{number}.')))
    rom = bytearray(0x90000)
    for even, odd, offset in [(3126,3127,0x8000),(3128,4131,0x10000),
                              (1129,1132,0x30000),(1130,1133,0x50000)]:
        left, right = chip(even), chip(odd)
        rom[offset:offset+len(left)*2:2] = left
        rom[offset+1:offset+len(right)*2:2] = right
    scenery = b''.join(chip(n) for n in [1121,1122,1123,1124,1117,1118,1119,1120])
TILES = np.array([list(tile) for tile in decode(scenery,8,
        [0,4,len(scenery)*4,len(scenery)*4+4],8192)],np.uint8).reshape(8192,8,8)
PAL = np.array(json.loads((root/'assets/extraction-data.json').read_text())['palette'],np.uint8)
ATTR = np.frombuffer(rom[0x18000:0x1a000],np.int8)
FLAGS = np.frombuffer(rom[0x10000:0x12000],np.uint8)
(root/'assets/levels').mkdir(exist_ok=True)
levels = {}
playfields = {}
names = {0:'city',1:'slalom',2:'downhill',3:'ramp',4:'jump'}

# Hardware bank lines are permuted: logical consecutive banks are not adjacent
# in the ROM archive. Using a flat byte offset silently corrupts the skate areas.
BANK = [0x28000,0x20000,0x18000,0x10000,0x2a000,0x22000,0x1a000,0x12000,
        0x2c000,0x24000,0x1c000,0x14000,0x2e000,0x26000,0x1e000,0x16000,
        0x48000,0x40000,0x38000,0x30000,0x4a000,0x42000,0x3a000,0x32000,
        0x4c000,0x44000,0x3c000,0x34000,0x4e000,0x46000,0x3e000,0x36000,
        0x68000,0x60000,0x58000,0x50000,0x6a000,0x62000,0x5a000,0x52000,
        0x6c000,0x64000,0x5c000,0x54000,0x6e000,0x66000,0x5e000,0x56000]

def word(address):
    return struct.unpack_from('<H',rom,address)[0]

def read(bank_base,address):
    bank = (bank_base + ((address >> 3) & 0x1c00)) >> 10
    return rom[BANK[bank] + (address & 8191)]

def rdword(bank_base,address):
    return read(bank_base,address) | (read(bank_base,address+1) << 8)

@lru_cache(None)
def block(kind,pointer,half=0,base_override=None):
    """Decode one 16x8-tile half of a 128x128-pixel scenery macroblock.

    The run's top two bits select literal bytes, repeated bytes, literal words,
    or incrementing words. High bytes persist between byte-oriented runs. The
    header's third byte locates the lower half's independent compressed stream.
    """
    base = base_override or word(0xfea2+kind*2)
    header = [read(base,pointer+i) for i in range(3)]
    if half:
        pointer += header[2]
    cursor = pointer+3
    output = []
    value = mode = count = 0
    while len(output) < 128:
        if count == 0:
            control = read(base,cursor)
            cursor += 1
            count = control & 63 or 65536  # the board's 16-bit counter wraps
            mode = control >> 6
            value = (value & 0xff00) | read(base,cursor)
            cursor += 1
            if mode == 2:
                value = (value & 255) | (read(base,cursor) << 8)
                cursor += 1
        elif mode == 0:
            value = (value & 0xff00) | read(base,cursor)
            cursor += 1
        elif mode == 2:
            value = rdword(base,cursor)
            cursor += 2
        elif mode == 3:
            value = (value+1) & 65535
        output.append(value)
        count -= 1
    return output,header

def rle(array):
 values=array.ravel();changes=np.flatnonzero(values[1:]!=values[:-1])+1;starts=np.r_[0,changes];ends=np.r_[changes,len(values)]
 return [int(n) for pair in zip(ends-starts,values[starts]) for n in pair]
def regions(mask):
 remaining=set(map(tuple,np.argwhere(mask).tolist()));result=[]
 while remaining:
  first=remaining.pop();stack=[first];points=[first]
  while stack:
   y,x=stack.pop()
   for dy in [-1,0,1]:
    for dx in [-1,0,1]:
     q=(y+dy,x+dx)
     if q in remaining:remaining.remove(q);stack.append(q);points.append(q)
  if len(points)<5:continue
  my=sum(p[0] for p in points)/len(points);mx=sum(p[1] for p in points)/len(points)
  y,x=min(points,key=lambda p:(p[0]-my)**2+(p[1]-mx)**2)
  result.append({'x':x*8+4,'y':y*8+4,'cells':len(points)})
 return sorted(result,key=lambda p:p['y'])
def render(kind,variant,offset,width,rows):
 raw=np.zeros((rows*16,width*16),np.uint16);bank1=np.zeros_like(raw);blocktypes=np.zeros((rows*2,width),np.uint8)
 for y in range(rows):
  for x in range(width):
   ptr=rdword(word(0xfeb2+kind*2),offset+(y*width+x)*2)
   if kind==0:
    ix=y*width+x;alt=rom[0x15f16+ix//8]&(1<<(ix%8));base=0x6000 if alt else 0x4000
   else:base=0xa000 if (ptr&1 and kind!=3) else word(0xfea2+kind*2)
   for half in range(2):
    vals,header=block(kind,ptr,half,base);yy=y*16+half*8;xx=x*16
    raw[yy:yy+8,xx:xx+16]=np.array(vals).reshape(8,16)
    blocktypes[y*2+half,x]=header[half]&127
    bank1[yy:yy+8,xx:xx+16]=((header[half]&127)>>3)*1024 if kind==0 else rom[0xfeca+kind]*1024
 # Dynamic aliases are substituted exactly as in ROM routine E9E8; choose a
 # stable noise phase instead of the original frame-dependent random seed.
 dynamic=[word(word(0xff54+kind*2)+i*2) for i in range(16)];codes=raw&2047
 yy,xx=np.indices(raw.shape);noise=(xx*3+yy*5+(xx^yy))&7
 for i in range(16):
  if dynamic[i]:raw[codes==i]=(raw[codes==i]&0xf800)|(dynamic[i]+noise[codes==i])
 actual=(raw&1023)+np.where(raw&1024,bank1,rom[0xfec2+kind]*1024)
 if np.max(actual)>=8192:raise ValueError('Invalid graphics bank')
 packed=actual|(((raw>>11)&7)<<13)
 rgb=PAL[TILES[actual]+(128+((raw>>11)&7)*16)[:,:,None,None]].transpose(0,2,1,3,4).reshape(rows*128,width*128,3)
 name=names[kind]+('-'+str(variant+1) if kind else '')
 # Preserve CPU-visible flags and alias banks separately from visual tiles.
 # The PNG/packed visual layout cannot reconstruct raw bit4000 for probes.
 playfields[name]={'columns':width*16,'rows':rows*16,
  'raw':rle(raw),'aliasHigh':rle(bank1),'aliasLow':int(rom[0xfec2+kind])*1024}
 Image.fromarray(rgb).save(root/f'assets/levels/{name}.png',optimize=True)
 walk=(FLAGS[actual]!=19)&(FLAGS[actual]!=18)
 if kind==3:walk&=(actual!=7168)
 path=[]
 if kind not in [0,3]:
  # This is a navigation hint derived from the recovered surface, not new road geometry.
  for y in range(0,walk.shape[0],2):
   xs=np.flatnonzero(walk[y])
   if len(xs)>5:path.append({'x':int(np.median(xs)*8+4),'y':y*8+4,'width':int((xs[-1]-xs[0]+1)*8)})
 if path:
  start=path[min(7,len(path)-1)];finish=path[max(0,len(path)-6)]
 else:start={'x':640,'y':720};finish=None
 if kind not in [0,3]:
  finishes=regions(FLAGS[actual]==10)
  if not finishes:raise ValueError(f'No original finish region in {name}')
  finish=finishes[-1]
 levels[name]={'name':name,'kind':names[kind],'variant':variant,'width':width*128,'height':rows*128,
  'columns':width*16,'rows':rows*16,'tiles':rle(packed),'start':start,'finish':finish,'path':path,
  'launches':regions(FLAGS[actual]==16) if kind==4 else [],'targets':regions(FLAGS[actual]==15) if kind==4 else [],
  'rom':{'mapOffset':hex(offset),'mapBank':hex(word(0xfeb2+kind*2)),'macroColumns':width,'macroRows':rows}}
 if kind==3:
  # Inspectable floor geometry: rows with the half-pipe's original flat floor pen.
  floor=np.isin(ATTR[actual],[7,15])&(actual!=7168)
  ys,xs=np.where(floor);levels[name]['pipe']={'x':int(np.median(xs)*8),'y':int(np.median(ys)*8),'across':175,'along':95}
  levels[name]['start']={'x':676,'y':637} # flat centre of the recovered half-pipe
 print(name,levels[name]['width'],levels[name]['height'],'start',levels[name]['start'],'finish',finish)
render(0,0,0x180,48,24)
for kind in range(1,5):
 table=word(0x17f8c+kind*2)-0x6000+0x16000
 for variant in range(1 if kind==3 else 6):
  offset=word(table+variant*2);width=rom[table+12+variant]//2
  if kind==3:rows=9
  else:
   if variant<5:nextoff=word(table+(variant+1)*2)
   elif kind<4:nextoff=word(word(0x17f8c+(kind+1)*2)-0x6000+0x16000)
   else:nextoff=0x6aa6 # row 80 is the final blank guard; row 81 starts the next data section
   rows=(nextoff-offset)//(width*2)
  render(kind,variant,offset,width,rows)
data={'levels':levels,'profileTable':base64.b64encode(rom[0x18000:0x1a000]).decode(),'flagTable':base64.b64encode(rom[0x10000:0x12000]).decode(),
 'classVariants':[0,0,1,1,2,2,3,3,4,4,5],
 'source':{'layoutDecoder':'T11 fixed ROM E82E-EAD2, bank 1A000 4000-438A','graphicsBanks':'fixed ROM FEC2/FECA','courseDirectory':'ROM 17F8C','collisionTables':'ROM 18000 and 10000'}}
(root/'src/level-data.js').write_text('/** Generated from the user-supplied ROM by tools/extract_levels.py. */\nwindow.Skate720.ROM_DATA='+json.dumps(data,separators=(',',':'))+';\n')
(root/'assets/levels/provenance.json').write_text(json.dumps({k:{a:v for a,v in info.items() if a not in ['tiles','path']} for k,info in levels.items()},indent=2))
(root/'src/playfield-data.js').write_text('/** Original CPU-visible map words and alias banks; inert data only. */\nwindow.Skate720.PLAYFIELD_DATA='+json.dumps(playfields,separators=(',',':'))+';\n',encoding='utf-8')
print('exported',len(levels),'real layouts and CPU playfields')
