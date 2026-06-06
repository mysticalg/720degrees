from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "output" / "imagegen" / "chatgpt-environment-atlas-clean.png"
DEST = ROOT / "src" / "assets" / "generated-environment-atlas.png"


def main() -> None:
    src = Image.open(SOURCE).convert("RGBA")
    pixels = src.load()
    width, height = src.size
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            magenta_distance = abs(r - 255) + abs(g - 0) + abs(b - 255)
            if magenta_distance < 92 and r > 180 and b > 180 and g < 90:
                pixels[x, y] = (255, 0, 255, 0)
    DEST.parent.mkdir(parents=True, exist_ok=True)
    src.save(DEST)
    print(f"wrote {DEST}")


if __name__ == "__main__":
    main()
