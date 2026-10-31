"""Composite unchanged original city decorations onto its opaque map.

Run after extracting city.png and city-overlays.png. Combining the static
layers here avoids a large transparent-layer draw on mobile every frame.
"""
from pathlib import Path
from PIL import Image

assets = Path(__file__).resolve().parents[1] / 'assets'
base = Image.open(assets / 'levels' / 'city.png').convert('RGBA')
overlay = Image.open(assets / 'city-overlays.png').convert('RGBA')
Image.alpha_composite(base, overlay).convert('RGB').save(
    assets / 'city-background.png', optimize=True
)
