"""Extract only the original scenery palette 225..227 pixels and DD10 colours.
Inputs are assembled revision-4 ROM and original decoded 8x8 pens; no redrawn art.
"""
from pathlib import Path
import argparse,json,struct
import numpy as np
from PIL import Image
root=Path(__file__).resolve().parents[1]
work=root.parents[1]/'work'
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--rom',type=Path,default=work/'main.bin',help='assembled revision-4 main ROM')
parser.add_argument('--tiles',type=Path,default=work/'tiles.bin',help='decoded 8192 original 8x8 pen tiles')
args=parser.parse_args()
rom=args.rom.read_bytes()
levels=json.loads((root/'src/level-data.js').read_text().split('ROM_DATA=')[1].rstrip(';\n'))['levels']
pens=np.frombuffer(args.tiles.read_bytes(),dtype=np.uint8).reshape(8192,8,8)
cycle=list(struct.unpack_from('<4H',rom,0x13a9a));restore=list(struct.unpack_from('<4H',rom,0x13e6c))
def rgb(w):
 intensity=[0,124,132,141,152,161,169,178,193,202,210,219,230,239,247,256][w&15]
 ladder=[0,3,4,5,6,7,8,9,10,11,12,13,14,14,15,15]
 return [(ladder[(w>>s)&15]*intensity)>>4 for s in (12,8,4)]
metadata={}
for name,info in levels.items():
 if info['kind']!='jump':continue
 runs=info['tiles'];tiles=np.repeat(np.array(runs[1::2],dtype=np.uint16),runs[::2]).reshape(info['rows'],info['columns'])
 active=np.any((pens>0)&(pens<4),axis=(1,2))
 positions=set(zip(*np.where(((tiles>>13)==6)&active[tiles&8191])));components=[]
 while positions:
  start=positions.pop();todo=[start];group=[start]
  while todo:
   y,x=todo.pop()
   for pos in [(y-1,x),(y+1,x),(y,x-1),(y,x+1)]:
    if pos in positions:positions.remove(pos);todo.append(pos);group.append(pos)
  components.append(group)
 patches=[];atlasY=0;atlasWidth=0
 for group in sorted(components,key=lambda g:min(g)):
  y0=min(y for y,x in group)*8;x0=min(x for y,x in group)*8
  h=(max(y for y,x in group)+1)*8-y0;w=(max(x for y,x in group)+1)*8-x0
  frames=[]
  for phase in range(4):
   frame=np.zeros((h,w,4),np.uint8)
   for y,x in group:
    pp=pens[int(tiles[y,x])&8191];dest=frame[y*8-y0:y*8-y0+8,x*8-x0:x*8-x0+8]
    # DD58 SOB iterates indices 3,2,1: pen zero is never changed.
    for pen in range(1,4):dest[pp==pen]=rgb(cycle[(phase+pen-1)&3])+[255]
   frames.append(Image.fromarray(frame))
  patches.append(({'x':x0,'y':y0,'w':w,'h':h,'sy':atlasY},frames));atlasY+=h;atlasWidth=max(atlasWidth,w*4)
 atlas=Image.new('RGBA',(atlasWidth,atlasY))
 for patch,frames in patches:
  for phase,frame in enumerate(frames):atlas.paste(frame,(phase*patch['w'],patch['sy']))
 atlas.save(root/f'assets/levels/{name}-target-cycle.png')
 metadata[name]=[patch for patch,frames in patches]
data={'source':'Revision-4 DD10-DD5A; ROM13A9A cycle and 13E6C restore; scenery palette 225..227; DD58 SOB excludes pen zero','cycle':cycle,'restore':restore,'patches':metadata}
(root/'src/target-palette-data.js').write_text('/** Original target palette and extracted scenery pixel regions. */\nwindow.Skate720.TARGET_PALETTE_DATA='+json.dumps(data,separators=(',',':'),default=int)+';\n')
print({name:len(p) for name,p in metadata.items()})
