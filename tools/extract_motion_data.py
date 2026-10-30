"""Recover the original animation directory and sprite-descriptor banks."""
from pathlib import Path
import base64,json,sys,zipfile
root=Path(__file__).resolve().parents[1]
with zipfile.ZipFile(sys.argv[1]) as rom:
    def chip(number):
        return rom.read(next(n for n in rom.namelist() if n.startswith(f'136047-{number}.')))
    bank=bytearray(0x20000)
    bank[0::2]=chip(3128)
    bank[1::2]=chip(4131)
    offsets=(0x18000,0x1e000,0x16000)
    data=[base64.b64encode(bank[o:o+8192]).decode('ascii') for o in offsets]
(root/'src/motion-data.js').write_text('window.Skate720.MOTION_BANKS='+json.dumps(data)+';\n',encoding='utf-8')
