"""Extract only the original city population selection tables for native JS.
Usage: python tools/extract_population.py path/to/720.zip
"""
from pathlib import Path
import runpy,json
root=Path(__file__).resolve().parents[1]
m=runpy.run_path(str(Path(__file__).with_name('extract_native_maps.py')))
r,w=m['rom'],m['w']
def byte(a):return r[0x20000+a-0x6000]
def word(a):return byte(a)|(byte(a+1)<<8)
data={'source':'D2D6-D30C/D35E-D47A original city population data','words':{},'bytes':{},'fixed':{}}
def keep_word(a):data['words'][a]=word(a);return word(a)
def keep_byte(a):data['bytes'][a]=byte(a)
for difficulty in range(1,11):
 counts=keep_word(0x68d0+difficulty*2);kinds=keep_word(0x6862+difficulty*2)
 for i in range(9):keep_byte(counts+i)
 for i in range(10):keep_byte(kinds+i)
for group in range(1,20):
 mask=r[0xfd95+group];data['fixed'][0xfd95+group]=mask
 table=keep_word(0x6948+group*2)
 if table:
  for i in range(mask+1):keep_word(table+i*2)
 if group>10:keep_byte(0x6935+group)
(root/'src/population-data.js').write_text('/** Original population selection tables; inert ROM data only. */\nwindow.Skate720.POPULATION_DATA='+json.dumps(data,separators=(',',':'))+';\n',encoding='utf-8')
print('Extracted',len(data['words']),'population words and',len(data['bytes']),'type/count bytes')
