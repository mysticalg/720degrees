"""Derive optional skate-sound material hints from the original city PNG."""
from PIL import Image
from pathlib import Path
import base64
p=Path(__file__).resolve().parents[1];im=Image.open(p/'assets/levels/city.png').convert('RGB');im=im.resize((im.width//8,im.height//8),Image.Resampling.BILINEAR);values=[]
for r,g,b in im.getdata():values.append(0 if g>r*1.35 and g>b*1.2 else 2 if (r+g+b)/3<100 else 1)
runs=[];i=0
while i<len(values):
 v=values[i];n=1
 while i+n<len(values) and values[i+n]==v and n<65535:n+=1
 runs.extend([n&255,n>>8,v]);i+=n
payload=base64.b64encode(bytes(runs)).decode();s='''/** Offline8px material hints from original city art; no runtime canvas readback. */
(() => { const bytes=Uint8Array.from(atob("PAYLOAD"), c=>c.charCodeAt(0)), cells=new Uint8Array(WIDTH*HEIGHT);let p=0;for(let i=0;i<bytes.length;i+=3){const n=bytes[i]|bytes[i+1]<<8;cells.fill(bytes[i+2],p,p+n);p+=n;}window.Skate720.CITY_MATERIAL={width:WIDTH,height:HEIGHT,cells};})();
'''.replace('PAYLOAD',payload).replace('WIDTH',str(im.width)).replace('HEIGHT',str(im.height));(p/'src/material-data.js').write_text(s);print('Material source bytes:',len(s))
