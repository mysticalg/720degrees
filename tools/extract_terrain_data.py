"""Extract numeric terrain motion tables from revision-4 720.zip (no code)."""
from pathlib import Path
import zipfile,json,struct,sys
root=Path(__file__).resolve().parents[1]
with zipfile.ZipFile(sys.argv[1]) as z:
 def chip(n):return z.read(next(s for s in z.namelist() if s.startswith(f'136047-{n}.')))
 bank=bytearray(0x20000);bank[0::2]=chip(3128);bank[1::2]=chip(4131)
 def words(address,count):return list(struct.unpack_from('<'+'H'*count,bank,0x4000+address-0x6000))
 def bytes_(address,count):return list(bank[0x4000+address-0x6000:0x4000+address-0x6000+count])
 data={'words':{},'bytes':{}}
 for address,count in [(0x6048,672),(0x6588,672),(0x6ac8,672),(0x7228,544),(0x79e8,16),(0x7c68,4)]:data['words'][str(address)]=words(address,count)
 for address,count in [(0x7008,544),(0x7668,672),(0x7908,32)]:data['bytes'][str(address)]=bytes_(address,count)
 (root/'src/terrain-data.js').write_text('window.Skate720.TERRAIN_TABLES='+json.dumps(data,separators=(',',':'))+';\n',encoding='utf-8')
