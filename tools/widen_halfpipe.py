"""Repeat original halfpipe artwork along its isometric coping, without repainting.
Keeps ramp-1.png untouched. Runtime halfpipe-width.js uses the same mapping.
"""
from pathlib import Path
import numpy as np
from PIL import Image
root=Path(__file__).resolve().parents[1]
source=np.array(Image.open(root/'assets/levels/ramp-1.png').convert('RGBA'))
h,w=source.shape[:2]
y,x=np.indices((h+108,w+216))
u=x*.5+y
shift=np.where(u<960,0,np.where(u>=1176,216,np.floor((u-960)/24)*24)).astype(int)
sx=x-shift;sy=y-shift//2
valid=(sx>=0)&(sx<w)&(sy>=0)&(sy<h)
result=np.empty((h+108,w+216,4),dtype=np.uint8);result[:]=source[0,0];result[valid]=source[sy[valid],sx[valid]]
Image.fromarray(result).save(root/'assets/levels/ramp-1-wide.png')
print('Original pixels repeated:216px extra coping width, no new graphics')
