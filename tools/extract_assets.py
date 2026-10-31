"""Build PNG assets from the user's 720 ROM. No game or CPU emulation here.

Atari stores two pixels in each byte and splits the four colour bitplanes
between two ROM banks. The board's inverted motion-object ROMs also swap
32 KiB halves. These details are essential: reading the bytes as packed RGB
produces scrambled images.
"""
from pathlib import Path
import argparse, json, zipfile
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]

def decode(data, size, planes, count):
    """Decode MAME's documented System II bit layout into palette indices."""
    result = []
    for tile in range(count):
        pixels = []
        for y in range(size):
            for x in range(size):
                value = 0
                for plane, offset in enumerate(planes):
                    bit = tile * size * size * 2 + y * size * 2 + (x // 4) * 8 + x % 4 + offset
                    value |= ((data[bit // 8] >> (7 - bit % 8)) & 1) << (len(planes) - 1 - plane)
                pixels.append(value)
        result.append(bytes(pixels))
    return result

def build(rom_path):
    reference = json.loads((ROOT / 'assets/extraction-data.json').read_text())
    palette = reference['palette']
    with zipfile.ZipFile(rom_path) as rom:
        def chip(number):
            name = next(n for n in rom.namelist() if n.startswith(f'136047-{number}.'))
            return rom.read(name)
        motion = bytearray(0x100000)
        for index in range(16):
            number = 1109 + index if index < 8 else 1101 + index - 8
            raw = chip(number)
            offset = (index // 4) * 0x40000 + (index % 4) * 0x8000
            motion[offset:offset + 0x8000] = raw[0x8000:]
            motion[offset + 0x20000:offset + 0x28000] = raw[:0x8000]
        motion = bytes(value ^ 255 for value in motion)
        sprites = decode(motion, 16, [0, 4, len(motion) * 4, len(motion) * 4 + 4], 8192)
        scenery = b''.join(chip(n) for n in [1121,1122,1123,1124,1117,1118,1119,1120])
        tiles = decode(scenery, 8, [0, 4, len(scenery) * 4, len(scenery) * 4 + 4], 8192)

    def sprite(code, height, bank):
        image = Image.new('RGBA', (16, height * 16))
        for row in range(height):
            tile = Image.new('RGBA', (16, 16))
            tile.putdata([(*palette[bank * 16 + pen], 255) if pen != 15 else (0,0,0,0)
                          for pen in sprites[code + row]])
            image.paste(tile, (0, row * 16))
        return image

    # A raw original tile atlas supports translated descriptor playback.
    for bank in (0,1,2,3):
        atlas = Image.new('RGBA',(2048,1024))
        for code in range(8192):
            tile=sprite(code,1,bank)
            atlas.paste(tile,((code%128)*16,(code//128)*16))
        name='motion-tiles' if bank==0 else f'motion-tiles-{bank}'
        atlas.save(ROOT / f'assets/{name}.png')

    # Keep each object's independently positioned columns. Several poses have
    # different column heights; assuming a fixed 2x4 layout breaks the arms.
    poses = Image.new('RGBA', (16 * 48, 80))
    for index, columns in enumerate(reference['poses']):
        first_top = None
        for col, words in enumerate(columns):
            a, b, c, d = words
            height = ((b >> 11) & 7) + 1
            top = (-(a >> 6) - height * 16) & 511
            first_top = top if first_top is None else first_top
            delta = ((top - first_top + 256) % 512) - 256
            part = sprite((b & 2047) + (a & 7) * 2048, height, (d >> 12) & 3)
            if b & 0x4000:
                part = part.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
            poses.paste(part, (index * 48 + col * 16 + 8, 8 + delta), part)
    poses.save(ROOT / 'assets/skater.png')

    # Board and shadow records share the skater's captured pose and anchor.
    # These are ROM motion objects, including the upper tile-bank bits.
    for name, key in [('board', 'boardPoses'), ('shadow', 'shadowPoses')]:
        atlas = Image.new('RGBA', (16 * 48, 80))
        for index, packed in enumerate(reference[key]):
            a, b, _, _ = reference['poses'][index][0]
            origin = (-(a >> 6) - (((b >> 11) & 7) + 1) * 16) & 511
            for col in range(2):
                a, b, c, d = packed[col*4:col*4+4]
                if not b: continue
                height = ((b >> 11) & 7) + 1
                top = (-(a >> 6) - height * 16) & 511
                delta = ((top - origin + 256) % 512) - 256
                part = sprite((b & 2047) + (a & 7)*2048, height, (d >> 12) & 3)
                if b & 0x4000: part = part.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
                atlas.paste(part, (index*48+8+col*16, 8+delta), part)
        atlas.save(ROOT / f'assets/{name}.png')
    cyclist = Image.new('RGBA', (48, 80))
    for col, (a,b,c,d) in enumerate(reference['cyclist']):
        height = ((b >> 11) & 7) + 1
        top = (-(a >> 6) - height*16) & 511
        part = sprite((b & 2047)+(a & 7)*2048,height,(d >> 12)&3)
        if b & 0x4000: part = part.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        cyclist.paste(part,(col*16,top-147+8),part)
    cyclist.save(ROOT / 'assets/cyclist.png')
    # Legacy captured range576A includes landing burst/points/fade, not bees.
    landing_effects = Image.new('RGBA',(16*48,48))
    for frame, desc in enumerate(reference['landingEffectDescriptors']):
        for col in range(2):
            word = desc[3+col*2] | desc[4+col*2]<<8
            height = ((word>>11)&7)+1
            part = sprite((word&2047)+(desc[1]&7)*2048,height,0)
            if word & 0x4000: part=part.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
            landing_effects.paste(part,(frame*48+8+col*16,48-height*16),part)
    landing_effects.save(ROOT / 'assets/landing-effects.png')

    # The original central speaker is six adjacent motion objects.
    speaker = Image.new('RGBA', (96, 112))
    for col, words in enumerate(reference['speaker']):
        a, b, c, d = words
        height = ((b >> 11) & 7) + 1
        top = (-(a >> 6) - height * 16) & 511
        part = sprite((b & 2047) + (a & 7) * 2048, height, (d >> 12) & 3)
        if b & 0x4000: part = part.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        speaker.paste(part, (col * 16, top - 80), part)
    speaker.save(ROOT / 'assets/speakers.png')

    # Reconstruct the recovered playfield, including its actual bank selector.
    words = reference['playfield']
    city = Image.new('RGB', (1024,512))
    for index, word in enumerate(words):
        code = (word & 1023) + (4096 if word & 1024 else 0)
        bank = 128 + ((word >> 11) & 7) * 16
        tile = Image.new('RGB', (8,8))
        tile.putdata([tuple(palette[bank + pen]) for pen in tiles[code]])
        city.paste(tile, ((index % 128) * 8, (index // 128) * 8))
    # The tilemap is a scrolling cache. Its unpopulated columns aren't scenery.
    floor = city.crop((80,16,144,48))
    floor.save(ROOT / 'assets/pavement.png')
    ramp = Image.new('RGB',(208,112))
    for y in range(112):
        for x in range(208): ramp.putpixel((x,y),city.getpixel(((x+640)%1024,(y-48)%512)))
    ramp.save(ROOT / 'assets/ramp.png')
    # Signs are actual playfield tiles, not text painted over replacement art.
    for name, box in {'slalom':(0,76,208,184),'jump':(800,76,1024,184),
                      'ramp-sign':(56,352,248,464),'downhill':(776,352,976,464)}.items():
        city.crop(box).save(ROOT / f'assets/{name}.png')
    print('Built original ROM skater, scenery, signs and speaker assets.')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('rom', type=Path)
    build(parser.parse_args().rom)

