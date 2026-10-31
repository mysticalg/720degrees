"""Extract inert landing score bytes from an assembled original main.bin."""
from pathlib import Path
import json
import sys
r=Path(sys.argv[1]).read_bytes()
fields={'backwards':(0x451c,5),'jumpSpin':(0x4521,24),'jumpTime':(0x4539,48),'specialJump':(0x4570,11),'jumpAward':(0x4584,21),'spin':(0x4599,8),'time':(0x45a1,16),'repeats':(0x45b1,16),'drop':(0x45c1,16),'award':(0x45d1,120),'resetQuota':(0x4649,11)}
d={k:list(r[0x24000+a-0x4000:0x24000+a-0x4000+n]) for k,(a,n) in fields.items()}
d['bytes']=list(r[0x2451c:0x24680])
#7E98 sets bank1=2000: CPU5F00/5F40 therefore read physical2DF00/2DF40.
d['rampTimeSpin']=list(r[0x2df00:0x2df40])
d['rampFirstUse']=list(r[0x2df40:0x2df64])
(Path(__file__).resolve().parents[1]/'src/landing-score-data.js').write_text('/** Original landing score tables from bank24000, including4649 repeat reset quotas. */\nwindow.Skate720.LANDING_SCORE_DATA='+json.dumps(d,separators=(',',':'))+';\n',encoding='utf-8')
