"""Extract park-result tables without executing the original program.
Usage: python tools/extract_event_results.py path/to/720.zip-or-main.bin
"""
from pathlib import Path
import json
import struct
import sys
import zipfile

source = Path(sys.argv[1])
if zipfile.is_zipfile(source):
    with zipfile.ZipFile(source) as archive:
        def chip(number):
            return archive.read(next(n for n in archive.namelist()
                                     if Path(n).name.startswith(f'136047-{number}.')))
        program = bytearray(0x30000)
        for even, odd, offset in [(3126,3127,0x8000),(3128,4131,0x10000)]:
            low, high = chip(even), chip(odd)
            program[offset:offset+len(low)*2:2] = low
            program[offset+1:offset+len(high)*2:2] = high
else:
    program = source.read_bytes()
word = lambda address: struct.unpack_from('<H',program,address)[0]
# The actual jump table and branch establish six ramp shifts, five jump shifts.
assert [word(0x16d28+2*i) for i in range(4)] == [0,0,4,10]
assert word(0x16ba4) == word(0x16baa) == 0x1240  # MOV (R1),R0
assert word(0x16ba8) == 0x0101                  # BR6BAC
assert all(word(p)==0x0cc0 for p in [0x16ba6,0x16bac,0x16bae,0x16bb0,0x16bb2,0x16bb4])
rows=[]
for index in range(11):
    pointer = word(0x2de6c+2*index)
    address = 0x2c000+pointer-0x4000
    rows.append(list(program[address:address+3]))
data = {
    'source':'ROM2DE6C pointer table/2DE3C..2DE66 threshold bytes; fixed FE8C cash; bank16000 CPU6BA4..6BB6 scaling',
    'thresholdBytes':rows, 'cashPerClass':list(program[0xfe8c:0xfe90]),
    'shifts':{'ramp':6,'jump':5}
}
out = Path(__file__).resolve().parents[1]/'src/event-result-data.js'
out.write_text('/** Original park-result tables extracted from the user ROM. */\nwindow.Skate720.EVENT_RESULT_DATA='+json.dumps(data,separators=(',',':'))+';\n',encoding='utf-8')
print('Extracted22 class/park threshold sets; original dispatch opcodes verified')
