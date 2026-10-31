"""Extract inert landing score bytes from an assembled original main.bin."""
from pathlib import Path
import json
import sys
r=Path(sys.argv[1]).read_bytes()
fields={'backwards':(0x451c,5),'jumpSpin':(0x4521,24),'jumpTime':(0x4539,48),'specialJump':(0x4570,11),'jumpAward':(0x4584,21),'spin':(0x4599,8),'time':(0x45a1,16),'repeats':(0x45b1,16),'drop':(0x45c1,16),'award':(0x45d1,120)}
d={k:list(r[0x24000+a-0x4000:0x24000+a-0x4000+n]) for k,(a,n) in fields.items()}
d['bytes']=list(r[0x2451c:0x24680])
(Path(__file__).resolve().parents[1]/'src/landing-score-data.js').write_text('/** Original landing score bytes, ROM2451C..24648 (CPU451C..4648). */\nwindow.Skate720.LANDING_SCORE_DATA='+json.dumps(d,separators=(',',':'))+';\n')
