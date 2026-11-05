"""Extract revision-4 alpha HUD pixels, course clocks and medal table data.
Usage: python tools/extract_course_hud.py path/to/720.zip
No emulation; outputs contain data and decoded original pixels only.
"""
from pathlib import Path
import struct,json,zipfile,sys,subprocess
from PIL import Image
root=Path(__file__).resolve().parents[1]
with zipfile.ZipFile(sys.argv[1]) as z:
    def chip(n):return z.read(next(name for name in z.namelist() if Path(name).name.startswith((f'136047-{n}.',f'{n}-'))))
    b=bytearray(0x90000)
    for even,odd,offset in [(3126,3127,0x8000),(3128,4131,0x10000),(1129,1132,0x30000),(1130,1133,0x50000)]:
        lo,hi=chip(even),chip(odd)
        b[offset:offset+len(lo)*2:2]=lo;b[offset+1:offset+len(hi)*2:2]=hi
    alpha=chip(1125)
w=lambda address:struct.unpack_from('<H',b,address)[0]
# Verify the setup path and banking before reading data.6B28 indexes the
# low window (physical1E000) while6BFE is the separate briefing duration.
assert b[0x16b28:0x16b2c]==bytes.fromhex('4e1cf455')
assert b[0x16cfE:0x16d04]==bytes.fromhex('df155802220f')
assert b[0x16706:0x1670a]==bytes.fromhex('ce15fbff')
assert b[0x165f0:0x165f6]==bytes.fromhex('c00cc00cc067')
palette=json.loads((root/'assets/extraction-data.json').read_text())['palette']
# Keep all palette banks in a small alpha atlas: x=tile column, y=bank*128+tile row.
im=Image.new('RGBA',(512,128*8))
for bank in range(8):
 for t in range(1024):
  for y in range(8):
   for x in range(8):
    pen=0
    for plane,off in enumerate([0,4]):
     bit=t*128+y*16+(x//4)*8+x%4+off;pen|=((alpha[bit//8]>>(7-bit%8))&1)<<(1-plane)
    if pen:im.putpixel((t%64*8+x,t//64*8+bank*128+y),(*palette[64+bank*4+pen],255))
im.save(root/'assets/rom-alpha.png')
#6B08-6B2C: setup seconds from physical1F5F4, park*10+class.
# The separate0F38 briefing value must not be used as the live clock.
durations={kind:[w(0x1f5f4+(selector*10+cls)*2) for cls in range(11)]
           for kind,selector in [('ramp',2),('jump',3)]}
# Board6FDA source coordinates are source64-unit positions projected relative to camera.
data={'source':'Revision4 CPU66BA-6746 start;65D6 penalty;6CFE/6D08 start delay;7A3A clocks;78BE bar;6FDA medal board',
 'duration':durations,'medalX':list(struct.unpack_from('<16h',b,0x2ddaa)), 'medalY':list(struct.unpack_from('<16h',b,0x2ddca)),
 'medalEntries':[0x5a7c+2*i for i in range(16)],'startSound':list(b[0xfe6b:0xfe70]), 'barWords':[0x800f,0xc73a,0xeefa,0xff19,w(0x2ded2)], 'lowTimeFlash':list(struct.unpack_from('<2H',b,0x13a80))}
(root/'src/course-clock-data.js').write_text('window.Skate720.COURSE_CLOCK_DATA='+json.dumps(data,separators=(',',':'))+';\n')
print(json.dumps(data))


# DD5C selects medal-threshold colours for pen1;7C3C flashes city pen2.
# Preserve the 16px two-row glyphs, rather than drawing replacement bars.
def rgb(word):
    intensity=[0,124,132,141,152,161,169,178,193,202,210,219,230,239,247,256][word&15]
    colors=[0,3,4,5,6,7,8,9,10,11,12,13,14,14,15,15]
    return tuple(colors[(word>>shift)&15]*intensity>>4 for shift in [12,8,4])
bar=Image.new('RGBA',(72,16*7))
for variant,word in enumerate(data['barWords']+[data['barWords'][4]]*2):
    colors=[(0,0,0),rgb(word),(0,0,0),tuple(palette[75])]
    if variant>=5:colors[2]=rgb(data['lowTimeFlash'][variant-5])
    for fraction in range(9):
        for row in range(2):
            code=0x96+fraction+row*9
            for y in range(8):
                for x in range(8):
                    pen=0
                    for plane,offset in enumerate([0,4]):
                        bit=code*128+y*16+(x//4)*8+x%4+offset
                        pen|=((alpha[bit//8]>>(7-bit%8))&1)<<(1-plane)
                    if pen:bar.putpixel((fraction*8+x,variant*16+row*8+y),(*colors[pen],255))
bar.save(root/'assets/rom-bar.png')

#6FDA/EDB2/DC24: the results screen loads palette group0 from7F0C,
# reversing its16 pens. Use original descriptor entries and indexed tiles.
js="""global.window={Skate720:{}};require(process.argv[1]+'/src/motion-data.js');
const B=window.Skate720.MOTION_BANKS.map(s=>Buffer.from(s,'base64'));
const R=require(process.argv[1]+'/src/original-routines.js');
const poses=Array.from({length:16},(_,i)=>{const p=B[0].readUInt16LE(0x1a7c+i*2);
return R.spriteDescriptor(a=>(a<0x6000?B[1]:B[2])[a&8191],0x4000+p,4,0,0).records});
console.log(JSON.stringify(poses));"""
poses=json.loads(subprocess.check_output(['node','-e',js,str(root)],text=True))
pal=[rgb(w(0x13f0c+(15-pen)*2)) for pen in range(16)]
indices=Image.open(root/'assets/motion-indices.png')
medals=Image.new('RGBA',(512,48))
for i,records in enumerate(poses):
    for col,record in enumerate(records):
        code=(record['code']&2047)+(record['y']&7)*2048
        height=((record['code']>>11)&7)+1
        for row in range(height):
            tile=code+row;image=Image.new('RGBA',(16,16))
            for y in range(16):
                for x in range(16):
                    pen=indices.getpixel((tile%128*16+x,tile//128*16+y))
                    if pen!=15:image.putpixel((x,y),(*pal[pen],255))
            if record['code']&0x4000:image=image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
            medals.alpha_composite(image,(i*32+col*16,row*16))
medals.save(root/'assets/rom-medals.png')

