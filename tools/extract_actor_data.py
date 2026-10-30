"""Recover the original city object records and actor motion tables."""
from pathlib import Path
import zipfile,struct,json,sys
root=Path(__file__).resolve().parents[1]
with zipfile.ZipFile(sys.argv[1]) as z:
 def chip(n):return z.read(next(s for s in z.namelist() if s.startswith(f'136047-{n}.')))
 b=bytearray(0x30000)
 for left,right,offset in [(3126,3127,0x8000),(3128,4131,0x10000)]:
  a,c=chip(left),chip(right);b[offset:offset+len(a)*2:2]=a;b[offset+1:offset+len(c)*2:2]=c
 def words(a,n):return list(struct.unpack_from('<'+'H'*n,b,a))
 records=[];address=0x20696
 while words(address,1)[0]!=65535:
  kind,packed=words(address,2)
  records.append({'romAddress':address,'kind':kind,'packed':packed})
  address+=4
 data={'source':'revision4 city setup D01A-D03A, bank0400 CPU6696',
 'records':records,'actorFlags':list(b[0x2049d:0x2049d+101]),
 'speedVariants':list(b[0x205cc:0x205cc+101]),
 'motionX':words(0x24138,128),'motionY':words(0x24238,128),
 'durations':list(b[0x24000:0x240f8]),'stationaryDurations':words(0x240f8,32),
 'route24Durations':list(b[0xfd8a:0xfd8a+8])}
 (root/'assets/original-actor-data.json').write_text(json.dumps(data,indent=2)+'\n',encoding='utf-8')
