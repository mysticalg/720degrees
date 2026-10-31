"""Extract all original bee-form directories for the native descriptor adapter.
Usage: python tools/extract_bee_sequences.py path/to/720.zip
"""
from pathlib import Path
import json,re,struct,sys,zipfile
root=Path(__file__).resolve().parents[1]
with zipfile.ZipFile(sys.argv[1]) as archive:
    def chip(number):
        return archive.read(next(n for n in archive.namelist()
            if Path(n).name.startswith((f'136047-{number}.',f'{number}-'))))
    low,high=chip(3128),chip(4131)
    fixedLow,fixedHigh=chip(3126),chip(3127)
program=bytearray(0x30000)
program[0x8000:0x8000+len(fixedLow)*2:2]=fixedLow
program[0x8001:0x8000+len(fixedHigh)*2:2]=fixedHigh
program[0x10000:0x10000+len(low)*2:2]=low
program[0x10001:0x10000+len(high)*2:2]=high
word=lambda a:struct.unpack_from('<H',program,0x28000+a-0x4000)[0]
forms=[]
for mode in range(7):
    directions=[]
    for direction in range(8):
        pointer=word(0x5238+(mode*8+direction)*2) if mode<5 else word(0x527e+mode*2)
        sequence=[]
        while not word(pointer)&0x8000:
            sequence.append(pointer);pointer+=2
            assert len(sequence)<16
        directions.append(sequence)
    forms.append(directions)
p=root/'src/original-effects.js';text=p.read_text(encoding='utf-8')
text,n=re.subn(r'const beeAnimations = \[.*?\];',
    'const beeAnimations = '+json.dumps(forms,separators=(',',':'))+';',text,flags=re.S)
assert n==1
p.write_text(text,encoding='utf-8')
(root/'assets/bee-source.json').write_text(json.dumps({'source':'E196-E1D8 directories5238/527E, E08C/FE18 appearance cycle','forms':forms,'appearanceCycle':list(program[0xfe18:0xfe1e])},indent=2)+'\n')
print('Extracted7 original swarm forms,8 directions each')
