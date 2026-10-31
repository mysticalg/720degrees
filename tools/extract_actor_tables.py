"""Extract read-only actor tables from the user's 720 ROM.
Usage: python tools/extract_actor_tables.py path/to/720.zip
These byte ranges are data for native routines; nothing executes ROM code.
"""
from pathlib import Path
import runpy, json, base64
root=Path(__file__).resolve().parents[1]
r=runpy.run_path(str(Path(__file__).with_name('extract_native_maps.py')))['rom']
def enc(start,size):return base64.b64encode(r[start:start+size]).decode()
data={'source':'Original actor type, object/coordinate, motion and fixed tables',
 'types':[enc(0x28000,8192),enc(0x20000,8192)],
 'contactLow':enc(0x1e000,8192),'coordinates':enc(0x2a000,8192),'objects':enc(0x22000,8192),
 'motion':enc(0x23ff8,0x408),'fixed':enc(0xfd80,0x50),'fixedBase':0xfd80}
def tb(a):return r[(0x28000+a-0x4000) if a<0x6000 else (0x20000+a-0x6000)]
def tw(a):return tb(a)|(tb(a+1)<<8)
data['trafficInitial']={}
data['cityInitial']={}
for difficulty in range(1,11):
 pointer=tw(0x6b9e+difficulty*2);records=[];all_records=[]
 while tw(pointer)!=65535:
  kind,packed=tw(pointer),tw(pointer+2)
  all_records.append({'kind':kind,'packed':packed})
  if tb(0x623f+kind)==1:records.append({'kind':kind,'packed':packed})
  pointer+=4
 data['trafficInitial'][str(difficulty)]=records
 data['cityInitial'][str(difficulty)]=all_records
data['trafficSound']=[[r[0x1a000+0x1b0b+i] for i in range(8)], [r[0x1a000+0x1b11+i] for i in range(8)]]
(root/'src/actor-table-data.js').write_text('/** Original read-only actor tables, extracted from user ROM. */\nwindow.Skate720.ACTOR_TABLE_DATA='+json.dumps(data,separators=(',',':'))+';\n',encoding='utf-8')
print('Extracted actor tables for native spawn/route routines')
