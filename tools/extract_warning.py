"""Recover the original SKATE OR DIE alpha badge without executing ROM code.
Usage: python tools/extract_warning.py path/to/720.zip
"""
from pathlib import Path
import json, struct, sys, zipfile
from PIL import Image
root = Path(__file__).resolve().parents[1]
with zipfile.ZipFile(sys.argv[1]) as archive:
    def chip(number):
        return archive.read(next(n for n in archive.namelist()
            if Path(n).name.startswith((f'136047-{number}.', f'{number}-'))))
    program = bytearray(0x90000)
    for even, odd, offset in [(3126,3127,0x8000),(3128,4131,0x10000),
                              (1129,1132,0x30000),(1130,1133,0x50000)]:
        a,b=chip(even),chip(odd)
        program[offset:offset+len(a)*2:2]=a
        program[offset+1:offset+len(b)*2:2]=b
    alpha=chip(1125)
# CPU79B8 selects5F06. EAD4 maps bank1800/1C00, then decodes rows.
pointer,position,height,width=struct.unpack_from('<4H',program,0x1bf06)
assert (pointer,position,height,width)==(0x73f5,0x2130,8,15)
cursor=0x12000+pointer-0x6000
count=value=mode=0
cells=[]
for _ in range(width*height):
    if not count:
        control=program[cursor];cursor+=1
        count=control&63;assert count
        mode=control>>6
        value=(value&0xff00)|program[cursor];cursor+=1
        if mode==2:
            value=(value&255)|(program[cursor]<<8);cursor+=1
    elif mode==0:
        value=(value&0xff00)|program[cursor];cursor+=1
    elif mode==2:
        value=struct.unpack_from('<H',program,cursor)[0];cursor+=2
    elif mode==3:
        value=(value+1)&65535
    cells.append(value);count-=1
palette=json.loads((root/'assets/extraction-data.json').read_text())['palette']
# 7C5C flashes alpha colour78 using7A84's EEEE/EEEE/0000/0000.
flash=list(struct.unpack_from('<4H',program,0x13a84))
assert flash==[0xeeee,0xeeee,0,0]
# Original intensity/colour DAC ladders, also translated in original-equipment.js.
def rgb(word):
    intensities=[0,124,132,141,152,161,169,178,193,202,210,219,230,239,247,256]
    colors=[0,3,4,5,6,7,8,9,10,11,12,13,14,14,15,15]
    return tuple((colors[(word>>shift)&15]*intensities[word&15])>>4 for shift in [12,8,4])
for dim,word in [(False,flash[0]),(True,flash[2])]:
    colors=[tuple(c) for c in palette[76:80]];colors[2]=rgb(word)
    image=Image.new('RGBA',(width*8,height*8))
    for i,cell in enumerate(cells):
        code=cell&1023
        if code==0x149:continue
        for y in range(8):
            for x in range(8):
                pen=0
                for plane,offset in enumerate([0,4]):
                    bit=code*128+y*16+(x//4)*8+x%4+offset
                    pen|=((alpha[bit//8]>>(7-bit%8))&1)<<(1-plane)
                if pen:image.putpixel((i%width*8+x,i//width*8+y),(*colors[pen],255))
    image.save(root/f'assets/skate-or-die{"-dim" if dim else ""}.png')
source={'source':'CPU79B8 ->5F06; EAD4-EC1E alpha template decoder; alpha ROM1125',
        'position':[192,16],'width':width,'height':height,'cells':cells,
        'flashSource':'CPU7BBC frame>>3,7C5C ->7A84 palette78', 'flashWords':flash}
(root/'assets/skate-or-die-source.json').write_text(json.dumps(source,indent=2)+'\n')
print('Extracted original120 alpha cells and two ROM palette phases')
