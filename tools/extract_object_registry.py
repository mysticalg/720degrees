"""Extract original object-directory and allocation flag data (no instructions).
Usage: python tools/extract_object_registry.py path/to/720.zip
"""
from pathlib import Path
import runpy,json,base64
root=Path(__file__).resolve().parents[1]
m=runpy.run_path(str(Path(__file__).with_name('extract_native_maps.py')));r=m['rom']
def encoded(a,n):return base64.b64encode(r[a:a+n]).decode()
data={'source':'CE24/BE10/BE7C registry tables, bank1000/1400/0400',
 'directories':encoded(0x23a00,0x600),'traits':encoded(0x2a000,0xac0),'typeFlags':encoded(0x20438,202)}
(root/'src/object-registry-data.js').write_text('/** Inert original object registry tables. */\nwindow.Skate720.OBJECT_REGISTRY_DATA='+json.dumps(data,separators=(',',':'))+';\n',encoding='utf-8')
print('Extracted original registry directory, cell traits and type flags')
