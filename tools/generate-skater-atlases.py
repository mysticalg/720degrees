from collections import deque
from math import cos, pi, sin
from pathlib import Path

from PIL import Image, ImageDraw


CELL = 48
TRANSPARENT = (0, 0, 0, 0)
ROLL_OUTPUT_COLS = 8
JUMP_OUTPUT_COLS = 8
DUCK_OUTPUT_COLS = 4
TRICK_OUTPUT_COLS = 6
AI_SOURCE = Path("src/assets/skater-ai-compass-source.png")
DIRECTION_LABELS = [
    "E",
    "ESE",
    "SE",
    "SSE",
    "S",
    "SSW",
    "SW",
    "WSW",
    "W",
    "WNW",
    "NW",
    "NNW",
    "N",
    "NNE",
    "NE",
    "ENE",
]
AI_SOURCE_ORDER = [12, 13, 14, 15, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]

COLORS = {
    "outline": (11, 11, 14, 255),
    "shadow": (0, 0, 0, 95),
    "cap": (226, 24, 31, 255),
    "cap_dark": (114, 18, 28, 255),
    "brim": (255, 219, 45, 255),
    "skin": (238, 185, 139, 255),
    "skin_shadow": (157, 91, 70, 255),
    "shirt": (8, 126, 53, 255),
    "shirt_dark": (3, 72, 34, 255),
    "shirt_light": (47, 171, 65, 255),
    "stripe": (246, 215, 48, 255),
    "shorts": (224, 34, 33, 255),
    "shorts_dark": (112, 18, 30, 255),
    "pants": (239, 239, 214, 255),
    "pants_shadow": (172, 188, 177, 255),
    "shoe": (235, 26, 35, 255),
    "shoe_dark": (98, 19, 29, 255),
    "shoe_lace": (255, 255, 230, 255),
    "pad": (25, 68, 195, 255),
    "pad_light": (60, 146, 255, 255),
    "pad_dark": (14, 23, 95, 255),
    "board": (227, 115, 22, 255),
    "board_light": (255, 210, 77, 255),
    "board_dark": (111, 50, 13, 255),
    "wheel": (18, 18, 20, 255),
}


def clamp(value, lo, hi):
    return max(lo, min(hi, value))


def is_key_pixel(r, g, b, a):
    if a == 0:
        return True
    magenta = r > 180 and b > 170 and g < 90
    pink_fringe = (
        (r > 125 and b > 125 and g < 120 and r - g > 35 and b - g > 35)
        or (r > 80 and b > 90 and g < 75 and abs(r - b) < 85)
    )
    deep_magenta_fringe = (
        (r > 74 and b > 74 and g < 82 and min(r, b) - g > 24)
        or (r > 58 and b > 58 and g < 44 and min(r, b) - g > 24)
        or (r > 80 and b > 58 and g < 50 and r - g > 40 and b - g > 20)
    )
    white_grid = r > 232 and g > 232 and b > 232
    return magenta or pink_fringe or deep_magenta_fringe or white_grid


def chroma_to_alpha(img):
    rgba = img.convert("RGBA")
    px = rgba.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            r, g, b, a = px[x, y]
            if is_key_pixel(r, g, b, a):
                px[x, y] = TRANSPARENT
    return rgba


def remove_ai_board_pixels(img):
    rgba = img.copy()
    px = rgba.load()
    board_pixels = set()
    for y in range(rgba.height):
        for x in range(rgba.width):
            r, g, b, a = px[x, y]
            if a == 0 or y < rgba.height * 0.42:
                continue
            orange_deck = r > 135 and 45 < g < 190 and b < 85
            yellow_nose = r > 180 and g > 135 and b < 95
            if orange_deck or yellow_nose:
                board_pixels.add((x, y))

    for x, y in board_pixels:
        px[x, y] = TRANSPARENT

    if not board_pixels:
        return rgba

    for y in range(rgba.height):
        for x in range(rgba.width):
            r, g, b, a = px[x, y]
            if a == 0 or y < rgba.height * 0.55:
                continue
            dark_outline_or_wheel = r < 70 and g < 70 and b < 70
            if not dark_outline_or_wheel:
                continue
            near_deck = any((x + dx, y + dy) in board_pixels for dy in range(-3, 4) for dx in range(-3, 4))
            if near_deck or y > rgba.height * 0.78:
                px[x, y] = TRANSPARENT
    return rgba


def looks_like_pants(r, g, b):
    return r > 122 and g > 128 and b > 112 and abs(r - g) < 70 and abs(g - b) < 78


def looks_like_shoe(r, g, b):
    return r > 112 and g < 92 and b < 92 and r - max(g, b) > 34


def looks_like_deck(r, g, b):
    orange_deck = r > 130 and 42 < g < 190 and b < 95
    yellow_nose = r > 176 and g > 126 and b < 102
    return orange_deck or yellow_nose


def looks_like_keepable_upper(r, g, b):
    green = g > 80 and r < 95 and b < 100
    yellow_stripe = r > 168 and g > 128 and b < 96
    skin = r > 136 and g > 78 and b > 48 and r > b + 28
    return green or yellow_stripe or skin


def strip_generated_lower_body(img):
    """Keep the generated upper-body style, but remove generated stance/board pixels.

    The AI sheet had nice cap/torso silhouettes but inconsistent feet and embedded
    boards.  The game needs the feet to be mechanically tied to the code-drawn
    board, so the lower stance is rebuilt with deterministic foot anchors below.
    """
    rgba = img.copy()
    px = rgba.load()
    remove = set()

    for y in range(CELL):
        for x in range(CELL):
            r, g, b, a = px[x, y]
            if a == 0 or y < 25:
                continue
            if looks_like_pants(r, g, b) or looks_like_shoe(r, g, b) or looks_like_deck(r, g, b):
                remove.add((x, y))
            elif y >= 34 and r < 86 and g < 86 and b < 86:
                remove.add((x, y))
            elif y >= 37 and not looks_like_keepable_upper(r, g, b):
                remove.add((x, y))

    if remove:
        for y in range(25, CELL):
            for x in range(CELL):
                r, g, b, a = px[x, y]
                if a == 0 or (x, y) in remove:
                    continue
                dark = r < 82 and g < 82 and b < 82
                if dark and any((x + dx, y + dy) in remove for dy in range(-3, 4) for dx in range(-3, 4)):
                    remove.add((x, y))

    for x, y in remove:
        px[x, y] = TRANSPARENT
    return rgba


def keep_largest_component(img):
    px = img.load()
    seen = set()
    components = []
    for y in range(img.height):
        for x in range(img.width):
            if (x, y) in seen or px[x, y][3] == 0:
                continue
            queue = deque([(x, y)])
            seen.add((x, y))
            pts = []
            while queue:
                cx, cy = queue.popleft()
                pts.append((cx, cy))
                for ny in (cy - 1, cy, cy + 1):
                    for nx in (cx - 1, cx, cx + 1):
                        if nx == cx and ny == cy:
                            continue
                        if nx < 0 or ny < 0 or nx >= img.width or ny >= img.height:
                            continue
                        if (nx, ny) in seen or px[nx, ny][3] == 0:
                            continue
                        seen.add((nx, ny))
                        queue.append((nx, ny))
            components.append(pts)

    if not components:
        return img

    kept_pts = max(components, key=len)
    kept = Image.new("RGBA", img.size, TRANSPARENT)
    dst = kept.load()
    for x, y in kept_pts:
        dst[x, y] = px[x, y]
    return kept


def crop_ai_cell(sheet, index):
    col = index % 4
    row = index // 4
    cell_w = sheet.width / 4
    cell_h = sheet.height / 4
    pad = 7
    return sheet.crop((
        round(col * cell_w + pad),
        round(row * cell_h + pad + 26),
        round((col + 1) * cell_w - pad),
        round((row + 1) * cell_h - pad),
    ))


def normalize_ai_cell(src, target_h=41, target_w=43):
    img = keep_largest_component(remove_ai_board_pixels(chroma_to_alpha(src)))
    bbox = img.getbbox()
    if not bbox:
        return Image.new("RGBA", (CELL, CELL), TRANSPARENT)

    sprite = img.crop(bbox)
    scale = min(target_w / sprite.width, target_h / sprite.height)
    out_w = max(1, round(sprite.width * scale))
    out_h = max(1, round(sprite.height * scale))
    sprite = sprite.resize((out_w, out_h), Image.Resampling.NEAREST)

    out = Image.new("RGBA", (CELL, CELL), TRANSPARENT)
    out.alpha_composite(sprite, ((CELL - out_w) // 2, 43 - out_h))
    return strip_generated_lower_body(out)


def shift_cell(cell, dx=0, dy=0):
    out = Image.new("RGBA", (CELL, CELL), TRANSPARENT)
    out.alpha_composite(cell, (dx, dy))
    return out


def squash_cell(cell, scale_y=0.86, dy=5):
    scaled_h = max(1, round(CELL * scale_y))
    scaled = cell.resize((CELL, scaled_h), Image.Resampling.NEAREST)
    out = Image.new("RGBA", (CELL, CELL), TRANSPARENT)
    out.alpha_composite(scaled, (0, dy))
    return out


def load_ai_direction_cells():
    sheet = Image.open(AI_SOURCE).convert("RGBA")
    cells = [None] * 16
    for source_index, row_index in enumerate(AI_SOURCE_ORDER):
        cells[row_index] = normalize_ai_cell(crop_ai_cell(sheet, source_index))
    return cells


def build_ai_roll(cells):
    atlas = Image.new("RGBA", (CELL * ROLL_OUTPUT_COLS, CELL * 16), TRANSPARENT)
    frame_offsets = [(0, 0), (0, -1), (1, -1), (0, 0), (0, 0), (0, 1), (-1, 1), (0, 0)]
    for row, base in enumerate(cells):
        for col, (dx, dy) in enumerate(frame_offsets):
            cell = shift_cell(base, dx, dy)
            draw_ai_stance(cell, row, col, dx, dy, airborne=False)
            atlas.alpha_composite(cell, (col * CELL, row * CELL))
    return atlas


def build_ai_jump(cells):
    atlas = Image.new("RGBA", (CELL * JUMP_OUTPUT_COLS, CELL * 16), TRANSPARENT)
    frame_offsets = [(0, 2), (0, 0), (0, -2), (1, -3), (0, -4), (-1, -3), (0, -1), (0, 1)]
    for row, base in enumerate(cells):
        for col, (dx, dy) in enumerate(frame_offsets):
            cell = shift_cell(base, dx, dy)
            draw_ai_stance(cell, row, col, dx, dy, airborne=True)
            atlas.alpha_composite(cell, (col * CELL, row * CELL))
    return atlas


def build_ai_duck(cells):
    atlas = Image.new("RGBA", (CELL * DUCK_OUTPUT_COLS, CELL * 16), TRANSPARENT)
    frame_offsets = [(0, 3), (0, 4), (1, 3), (0, 4)]
    for row, base in enumerate(cells):
        for col, (dx, dy) in enumerate(frame_offsets):
            cell = squash_cell(shift_cell(base, dx, dy), 0.84, 6)
            draw_ai_stance(cell, row, col, dx, dy, pose="duck")
            atlas.alpha_composite(cell, (col * CELL, row * CELL))
    return atlas


def build_ai_trick(cells):
    atlas = Image.new("RGBA", (CELL * TRICK_OUTPUT_COLS, CELL * 16), TRANSPARENT)
    poses = ["grind", "handplant", "rock", "air", "spin_a", "spin_b"]
    for row, base in enumerate(cells):
        for col, pose in enumerate(poses):
            if pose == "handplant":
                atlas.alpha_composite(draw_ai_handplant_cell(row), (col * CELL, row * CELL))
                continue
            dy = -2 if pose.startswith("air") or pose.startswith("spin") else 1
            cell = shift_cell(base, 0, dy)
            draw_ai_stance(cell, row, col, 0, dy, airborne=pose.startswith("air") or pose.startswith("spin"), pose=pose)
            draw_trick_accent(cell, row, pose)
            atlas.alpha_composite(cell, (col * CELL, row * CELL))
    return atlas


def direction_vector(row):
    angle = row * pi * 2 / 16
    return cos(angle), sin(angle)


def board_vector(ux, uy):
    return ux, uy * 0.48


def perp_vector(ux, uy):
    bx, by = board_vector(ux, uy)
    length = max(0.001, (bx * bx + by * by) ** 0.5)
    bx /= length
    by /= length
    return -by, bx


def point(x, y):
    return round(x), round(y)


def line(draw, a, b, color, width=1, outline=True):
    if outline and width > 0:
        draw.line([point(*a), point(*b)], fill=COLORS["outline"], width=width + 2)
    draw.line([point(*a), point(*b)], fill=color, width=width)


def rect(draw, cx, cy, w, h, color, outline=False):
    box = [round(cx - w / 2), round(cy - h / 2), round(cx + w / 2), round(cy + h / 2)]
    if outline:
        draw.rectangle([box[0] - 1, box[1] - 1, box[2] + 1, box[3] + 1], fill=COLORS["outline"])
    draw.rectangle(box, fill=color)


def ellipse(draw, cx, cy, rx, ry, color, outline=True):
    box = [round(cx - rx), round(cy - ry), round(cx + rx), round(cy + ry)]
    if outline:
        draw.ellipse([box[0] - 1, box[1] - 1, box[2] + 1, box[3] + 1], fill=COLORS["outline"])
    draw.ellipse(box, fill=color)


def polygon(draw, pts, color, outline=True):
    pts = [point(x, y) for x, y in pts]
    if outline:
        expanded = pts + []
        draw.line(expanded + [expanded[0]], fill=COLORS["outline"], width=3)
    draw.polygon(pts, fill=color)


def thick_segment(draw, a, b, thickness, color, outline=True):
    ax, ay = a
    bx, by = b
    dx = bx - ax
    dy = by - ay
    length = max(0.001, (dx * dx + dy * dy) ** 0.5)
    nx = -dy / length
    ny = dx / length
    half = thickness / 2
    pts = [
        (ax + nx * half, ay + ny * half),
        (bx + nx * half, by + ny * half),
        (bx - nx * half, by - ny * half),
        (ax - nx * half, ay - ny * half),
    ]
    polygon(draw, pts, color, outline)


def draw_pad(draw, x, y, w=4.8, h=3.8):
    rect(draw, x, y, w, h, COLORS["pad_dark"], outline=True)
    rect(draw, x + 0.3, y - 0.2, max(2.0, w - 2.0), max(1.4, h - 1.8), COLORS["pad_light"], outline=False)


def draw_shorts(draw, right_hip, left_hip, front_knee, back_knee):
    front_short = ((right_hip[0] + front_knee[0]) * 0.54, (right_hip[1] + front_knee[1]) * 0.54 - 0.2)
    back_short = ((left_hip[0] + back_knee[0]) * 0.54, (left_hip[1] + back_knee[1]) * 0.54 - 0.1)
    thick_segment(draw, right_hip, front_short, 6.3, COLORS["shorts"], outline=True)
    thick_segment(draw, left_hip, back_short, 6.0, COLORS["shorts_dark"], outline=True)
    line(draw, (right_hip[0] - 1.5, right_hip[1] + 0.5), (front_short[0] + 1.2, front_short[1] + 0.6), COLORS["shoe_lace"], width=1, outline=False)
    line(draw, (left_hip[0] + 1.4, left_hip[1] + 0.5), (back_short[0] - 1.2, back_short[1] + 0.8), COLORS["shoe_lace"], width=1, outline=False)


def draw_ai_stance(img, row, frame, body_dx=0, body_dy=0, airborne=False, pose="roll"):
    draw = ImageDraw.Draw(img)
    ux, uy = direction_vector(row)
    right_x, right_y = -uy, ux
    phase = frame * pi * 2 / (JUMP_OUTPUT_COLS if airborne else ROLL_OUTPUT_COLS)
    stride = sin(phase) * (0.7 if not airborne else 0.35)
    tuck = [1.6, 0.8, -0.4, -1.0, -1.2, -0.8, 0.2, 1.0][frame] if airborne else 0
    crouch = 2.8 if pose == "duck" else 1.8 if pose in ("grind", "rock") else 0
    if pose == "handplant":
        crouch = 3.8
    if pose.startswith("spin"):
        tuck -= 1.4

    board_cx = 24
    board_cy = 39.3 + (tuck * 0.35 if airborne else 0)
    hip_cx = 24 + body_dx * 0.9 - ux * 0.7
    hip_cy = 30.7 + body_dy * 0.65 + max(0, tuck) * 0.6 + crouch

    right_hip = (hip_cx + right_x * 3.2, hip_cy + right_y * 0.8)
    left_hip = (hip_cx - right_x * 3.2, hip_cy - right_y * 0.8)

    # Goofy stance by request: right/front foot on the board nose, left/back foot
    # on the tail.  These points stay ordered along the board axis for every row.
    front_foot = (
        board_cx + ux * (7.4 + stride) + right_x * (0.7 if pose != "duck" else 0.2),
        board_cy + uy * (7.4 + stride) + right_y * (0.7 if pose != "duck" else 0.2) - 1.0 + crouch * 0.25,
    )
    back_foot = (
        board_cx - ux * (6.8 - stride * 0.55) - right_x * (0.7 if pose != "duck" else 0.2),
        board_cy - uy * (6.8 - stride * 0.55) - right_y * (0.7 if pose != "duck" else 0.2) - 1.0 + crouch * 0.25,
    )
    if pose == "grind":
        front_foot = (front_foot[0] + right_x * 1.2, front_foot[1] + right_y * 1.2)
        back_foot = (back_foot[0] + right_x * 1.0, back_foot[1] + right_y * 1.0)
    if pose == "rock":
        front_foot = (front_foot[0] + ux * 1.2, front_foot[1] + uy * 1.2 - 0.5)
        back_foot = (back_foot[0] - ux * 1.4, back_foot[1] - uy * 1.4 + 0.6)
    if airborne:
        front_foot = (front_foot[0] - right_x * 0.45, front_foot[1] - 0.9)
        back_foot = (back_foot[0] + right_x * 0.45, back_foot[1] - 0.5)

    front_knee = (
        (right_hip[0] + front_foot[0]) * 0.53 + right_x * 1.1,
        (right_hip[1] + front_foot[1]) * 0.53 + 1.8 + max(0, tuck) * 0.35,
    )
    back_knee = (
        (left_hip[0] + back_foot[0]) * 0.53 - right_x * 1.0,
        (left_hip[1] + back_foot[1]) * 0.53 + 1.8 + max(0, tuck) * 0.35,
    )

    thick_segment(draw, left_hip, back_knee, 4.9, COLORS["pants_shadow"], outline=True)
    thick_segment(draw, back_knee, back_foot, 4.3, COLORS["pants_shadow"], outline=True)
    thick_segment(draw, right_hip, front_knee, 5.1, COLORS["pants"], outline=True)
    thick_segment(draw, front_knee, front_foot, 4.5, COLORS["pants"], outline=True)
    line(draw, right_hip, front_knee, (255, 255, 238, 255), width=1, outline=False)
    line(draw, left_hip, back_knee, (203, 213, 199, 255), width=1, outline=False)
    draw_shorts(draw, right_hip, left_hip, front_knee, back_knee)
    draw_pad(draw, front_knee[0] + right_x * 0.7, front_knee[1] - 0.2, 4.8 if pose != "duck" else 4.2, 3.5)
    draw_pad(draw, back_knee[0] - right_x * 0.7, back_knee[1] + 0.1, 4.6 if pose != "duck" else 4.0, 3.4)
    draw_pad(draw, hip_cx + right_x * 8.2 + ux * 1.4, hip_cy - 8.0 + right_y * 0.9, 4.0, 3.1)
    draw_pad(draw, hip_cx - right_x * 7.6 - ux * 0.9, hip_cy - 7.3 - right_y * 0.7, 3.7, 3.0)

    shoe_len = 5.4 if pose == "duck" else 5.9 if not airborne else 5.5
    back_a = (back_foot[0] - ux * shoe_len * 0.54, back_foot[1] - uy * shoe_len * 0.54)
    back_b = (back_foot[0] + ux * shoe_len * 0.46, back_foot[1] + uy * shoe_len * 0.46)
    front_a = (front_foot[0] - ux * shoe_len * 0.46, front_foot[1] - uy * shoe_len * 0.46)
    front_b = (front_foot[0] + ux * shoe_len * 0.58, front_foot[1] + uy * shoe_len * 0.58)
    thick_segment(draw, back_a, back_b, 4.2, COLORS["shoe_dark"], outline=True)
    thick_segment(draw, back_a, back_b, 2.7, COLORS["shoe"], outline=False)
    thick_segment(draw, front_a, front_b, 4.4, COLORS["shoe_dark"], outline=True)
    thick_segment(draw, front_a, front_b, 2.9, COLORS["shoe"], outline=False)
    line(draw, (back_foot[0] - right_x * 1.8, back_foot[1] - right_y * 1.8), (back_foot[0] + right_x * 1.8, back_foot[1] + right_y * 1.8), COLORS["shoe_lace"], width=1, outline=False)
    line(draw, (front_foot[0] - right_x * 1.9, front_foot[1] - right_y * 1.9), (front_foot[0] + right_x * 1.9, front_foot[1] + right_y * 1.9), COLORS["shoe_lace"], width=1, outline=False)


def draw_trick_accent(img, row, pose):
    draw = ImageDraw.Draw(img)
    ux, uy = direction_vector(row)
    right_x, right_y = -uy, ux
    if pose == "handplant":
        shoulder = (24 + right_x * 5.2, 28 + right_y * 1.8)
        hand = (24 + right_x * 12.2, 39 + right_y * 2.0)
        thick_segment(draw, shoulder, hand, 4.2, COLORS["skin"], outline=True)
        rect(draw, hand[0], hand[1], 4, 4, COLORS["skin"], outline=False)
    elif pose == "grind":
        line(draw, (12, 42), (36, 42), COLORS["board_light"], width=2, outline=False)
    elif pose == "rock":
        nose = (24 + ux * 13.0, 39 + uy * 13.0)
        rect(draw, nose[0], nose[1], 5, 4, COLORS["brim"], outline=False)
    elif pose.startswith("spin"):
        line(draw, (15, 28), (33, 20 if pose == "spin_a" else 34), COLORS["brim"], width=2, outline=False)


def draw_ai_handplant_cell(row):
    img = Image.new("RGBA", (CELL, CELL), TRANSPARENT)
    draw = ImageDraw.Draw(img)
    ux, uy = direction_vector(row)
    bx, by = board_vector(ux, uy)
    px, py = perp_vector(ux, uy)

    hand = (24 - px * 7.0, 42.0)
    shoulder = (24 - px * 2.8, 34.2)
    other_shoulder = (24 + px * 5.0, 34.8)
    head = (24 + px * 1.0 - ux * 1.4, 38.0)
    hip = (24 + ux * 1.0, 28.4)
    front_foot = (24 + bx * 8.6 + px * 1.2, 24.0 + by * 8.6)
    back_foot = (24 - bx * 7.8 - px * 1.0, 24.5 - by * 7.8)
    front_knee = ((hip[0] + front_foot[0]) * 0.55 + px * 2.2, (hip[1] + front_foot[1]) * 0.55 + 1.2)
    back_knee = ((hip[0] + back_foot[0]) * 0.55 - px * 2.0, (hip[1] + back_foot[1]) * 0.55 + 1.6)

    ellipse(draw, 24, 43, 10, 2.5, COLORS["shadow"], outline=False)
    thick_segment(draw, shoulder, hand, 4.8, COLORS["skin"], outline=True)
    rect(draw, hand[0], hand[1], 5, 5, COLORS["skin"], outline=False)
    draw_pad(draw, shoulder[0] - px * 0.5, shoulder[1] + 2.5, 4.4, 3.3)
    thick_segment(draw, other_shoulder, (other_shoulder[0] + px * 8.0 - ux * 2.0, other_shoulder[1] + 1.2), 4.2, COLORS["skin_shadow"], outline=True)
    thick_segment(draw, shoulder, hip, 10.0, COLORS["shirt"], outline=True)
    line(draw, (shoulder[0] + px * 1.5, shoulder[1] - 1.5), (hip[0] + px * 1.8, hip[1] + 1.2), COLORS["stripe"], width=3, outline=False)
    ellipse(draw, head[0], head[1], 4.8, 5.0, COLORS["skin"], outline=True)
    rect(draw, head[0] + ux * 1.0, head[1] - 4.2, 8, 4, COLORS["cap"], outline=True)
    rect(draw, head[0] + ux * 5.0, head[1] - 3.1 + uy * 0.8, 5, 3, COLORS["brim"], outline=False)

    thick_segment(draw, hip, back_knee, 4.8, COLORS["pants_shadow"], outline=True)
    thick_segment(draw, back_knee, back_foot, 4.2, COLORS["pants_shadow"], outline=True)
    thick_segment(draw, hip, front_knee, 5.0, COLORS["pants"], outline=True)
    thick_segment(draw, front_knee, front_foot, 4.4, COLORS["pants"], outline=True)
    draw_shorts(draw, hip, hip, front_knee, back_knee)
    draw_pad(draw, front_knee[0], front_knee[1], 4.7, 3.5)
    draw_pad(draw, back_knee[0], back_knee[1], 4.5, 3.4)
    thick_segment(draw, (back_foot[0] - bx * 3.0, back_foot[1] - by * 3.0), (back_foot[0] + bx * 3.0, back_foot[1] + by * 3.0), 4.3, COLORS["shoe_dark"], outline=True)
    thick_segment(draw, (back_foot[0] - bx * 2.4, back_foot[1] - by * 2.4), (back_foot[0] + bx * 2.7, back_foot[1] + by * 2.7), 2.8, COLORS["shoe"], outline=False)
    thick_segment(draw, (front_foot[0] - bx * 2.7, front_foot[1] - by * 2.7), (front_foot[0] + bx * 3.2, front_foot[1] + by * 3.2), 4.5, COLORS["shoe_dark"], outline=True)
    thick_segment(draw, (front_foot[0] - bx * 2.2, front_foot[1] - by * 2.2), (front_foot[0] + bx * 2.9, front_foot[1] + by * 2.9), 3.0, COLORS["shoe"], outline=False)
    line(draw, (back_foot[0] - px * 1.8, back_foot[1] - py * 1.8), (back_foot[0] + px * 1.8, back_foot[1] + py * 1.8), COLORS["shoe_lace"], width=1, outline=False)
    line(draw, (front_foot[0] - px * 1.9, front_foot[1] - py * 1.9), (front_foot[0] + px * 1.9, front_foot[1] + py * 1.9), COLORS["shoe_lace"], width=1, outline=False)
    return img


def draw_board(draw, cx, cy, ux, uy, length=24):
    bx, by = board_vector(ux, uy)
    nose = (cx + bx * length * 0.5, cy + by * length * 0.5)
    tail = (cx - bx * length * 0.5, cy - by * length * 0.5)
    line(draw, tail, nose, COLORS["outline"], width=7, outline=False)
    line(draw, tail, nose, COLORS["board_dark"], width=5, outline=False)
    line(draw, tail, nose, COLORS["board"], width=4, outline=False)
    line(draw, (cx + bx * 1.0, cy + by * 1.0), nose, COLORS["board_light"], width=2, outline=False)
    rect(draw, tail[0], tail[1] + 2, 5, 3, COLORS["wheel"], outline=False)
    rect(draw, nose[0], nose[1] + 2, 5, 3, COLORS["wheel"], outline=False)
    rect(draw, nose[0] + bx * 1.8, nose[1] + by * 1.8, 4, 3, COLORS["brim"], outline=False)


def draw_cap_and_head(draw, hx, hy, ux, uy):
    back_view = uy < -0.45
    if back_view:
        ellipse(draw, hx, hy + 2.2, 4.8, 5.2, COLORS["cap_dark"], outline=True)
        rect(draw, hx, hy - 2.8, 9, 5, COLORS["cap"], outline=True)
    else:
        ellipse(draw, hx, hy + 2.2, 4.8, 5.2, COLORS["skin"], outline=True)
        if abs(ux) > 0.2:
            rect(draw, hx + ux * 3.9, hy + 2.0, 2, 4, COLORS["skin_shadow"], outline=False)
        else:
            rect(draw, hx, hy + 1.7, 3, 2, COLORS["skin_shadow"], outline=False)
    rect(draw, hx, hy - 3.1, 9, 5, COLORS["cap"], outline=True)
    rect(draw, hx + ux * 4.6, hy - 2.1 + uy * 1.1, 6, 3, COLORS["brim"], outline=False)


def draw_torso(draw, cx, cy, ux, uy):
    px, py = perp_vector(ux, uy)
    top = (cx + ux * 1.8, cy - 8)
    bottom = (cx - ux * 1.0, cy + 9)
    top_w = 6.8 if abs(uy) < 0.45 else 7.8
    bottom_w = 8.2 if abs(uy) < 0.45 else 9.0
    pts = [
        (top[0] - px * top_w, top[1] - py * 2.5),
        (top[0] + px * top_w, top[1] + py * 2.5),
        (bottom[0] + px * bottom_w, bottom[1] + py * 2.0),
        (bottom[0] - px * bottom_w, bottom[1] - py * 2.0),
    ]
    polygon(draw, pts, COLORS["shirt"], outline=True)
    line(draw, (top[0] - px * 4.8, top[1] + 1), (bottom[0] - px * 5.6, bottom[1] - 1), COLORS["shirt_dark"], width=2, outline=False)
    if uy > -0.25:
        stripe_w = 4 if abs(ux) < 0.5 else 3
        line(draw, (cx + ux * 1.8, cy - 6), (cx - ux * 0.7, cy + 8), COLORS["stripe"], width=stripe_w, outline=False)
        line(draw, (cx + ux * 1.8 - px * 2, cy - 6), (cx - ux * 0.7 - px * 2, cy + 7), COLORS["shirt_light"], width=2, outline=False)
    else:
        line(draw, (cx - px * 3.8, cy - 5), (cx - px * 3, cy + 8), COLORS["shirt_dark"], width=3, outline=False)
        line(draw, (cx + px * 3.5, cy - 5), (cx + px * 2.8, cy + 7), COLORS["shirt_light"], width=1, outline=False)


def draw_limbs(draw, cx, cy, board_cx, board_cy, ux, uy, phase, crouch=0, airborne=False):
    bx, by = board_vector(ux, uy)
    px, py = perp_vector(ux, uy)
    stride = sin(phase) * (2.8 if not airborne else 1.7)
    hip_y = cy + 8 + crouch
    left_hip = (cx - px * 4.5, hip_y - py * 1.2)
    right_hip = (cx + px * 4.5, hip_y + py * 1.2)
    front_foot = (board_cx + bx * (6.2 + stride), board_cy + by * (6.2 + stride) - 2)
    back_foot = (board_cx - bx * (6.6 - stride), board_cy - by * (6.6 - stride) - 2)
    front_knee = ((left_hip[0] + front_foot[0]) * 0.52 + px * 1.7, (left_hip[1] + front_foot[1]) * 0.52 + 2.2)
    back_knee = ((right_hip[0] + back_foot[0]) * 0.52 - px * 1.7, (right_hip[1] + back_foot[1]) * 0.52 + 2.2)

    thick_segment(draw, right_hip, back_knee, 5.8, COLORS["pants_shadow"], outline=True)
    thick_segment(draw, back_knee, back_foot, 5.2, COLORS["pants_shadow"], outline=True)
    thick_segment(draw, left_hip, front_knee, 6.0, COLORS["pants"], outline=True)
    thick_segment(draw, front_knee, front_foot, 5.4, COLORS["pants"], outline=True)
    line(draw, left_hip, front_knee, (255, 255, 238, 255), width=1, outline=False)
    line(draw, right_hip, back_knee, (207, 216, 202, 255), width=1, outline=False)
    rect(draw, front_foot[0] + bx * 1.0, front_foot[1], 7, 4, COLORS["shoe_dark"], outline=True)
    rect(draw, front_foot[0] + bx * 1.8, front_foot[1] - 1, 7, 3, COLORS["shoe"], outline=False)
    rect(draw, back_foot[0] - bx * 0.6, back_foot[1], 7, 4, COLORS["shoe_dark"], outline=True)
    rect(draw, back_foot[0] - bx * 1.2, back_foot[1] - 1, 7, 3, COLORS["shoe"], outline=False)

    shoulder_y = cy - 3 + crouch * 0.3
    swing = sin(phase + pi / 2) * 3.4
    lead_shoulder = (cx + px * 6.2, shoulder_y + py * 1.2)
    trail_shoulder = (cx - px * 6.2, shoulder_y - py * 1.2)
    lead_hand = (cx + ux * 10 + px * swing, shoulder_y + uy * 3.6 + py * swing)
    trail_hand = (cx - ux * 6.8 - px * swing, shoulder_y - uy * 1.2 - py * swing)
    thick_segment(draw, trail_shoulder, trail_hand, 4.2, COLORS["skin_shadow"], outline=True)
    thick_segment(draw, lead_shoulder, lead_hand, 4.4, COLORS["skin"], outline=True)
    rect(draw, lead_hand[0], lead_hand[1], 4, 4, COLORS["skin"], outline=False)


def draw_roll_cell(row, frame):
    img = Image.new("RGBA", (CELL, CELL), TRANSPARENT)
    draw = ImageDraw.Draw(img)
    ux, uy = direction_vector(row)
    phase = frame * pi * 2 / ROLL_OUTPUT_COLS
    bob = -1 if frame in (1, 2, 5, 6) else 0
    board_cx = 24
    board_cy = 39 + bob * 0.2
    body_cx = 24 + ux * 1.6
    body_cy = 24 + bob
    ellipse(draw, 24, 43, 13, 3, COLORS["shadow"], outline=False)
    draw_board(draw, board_cx, board_cy, ux, uy, 25)
    draw_limbs(draw, body_cx, body_cy, board_cx, board_cy, ux, uy, phase)
    draw_torso(draw, body_cx, body_cy, ux, uy)
    draw_cap_and_head(draw, body_cx + ux * 3, body_cy - 13 + uy * 1.5, ux, uy)
    return img


def draw_jump_cell(row, frame):
    img = Image.new("RGBA", (CELL, CELL), TRANSPARENT)
    draw = ImageDraw.Draw(img)
    ux, uy = direction_vector(row)
    lifts = [0, -2, -5, -7, -7, -6, -3, 0]
    crouches = [4, 3, 1, 0, 0, 1, 2, 4]
    spin_twist = [0, 0.15, 0.35, 0.55, 0.8, 1.05, 0.65, 0.2][frame]
    lift = lifts[frame]
    phase = frame * pi / 3 + spin_twist
    board_cx = 24 + ux * spin_twist * 1.4
    board_cy = 39 + lift
    body_cx = 24 + ux * 2.2
    body_cy = 23 + lift
    ellipse(draw, 24, 43, 11, 3, COLORS["shadow"], outline=False)
    draw_board(draw, board_cx, board_cy, ux, uy, 25 + (2 if frame in (3, 4, 5) else 0))
    draw_limbs(draw, body_cx, body_cy, board_cx, board_cy, ux, uy, phase, crouches[frame], airborne=True)
    draw_torso(draw, body_cx, body_cy, ux, uy)
    draw_cap_and_head(draw, body_cx + ux * 3, body_cy - 13 + uy * 1.5, ux, uy)
    return img


def draw_bail_cell(frame):
    img = Image.new("RGBA", (CELL, CELL), TRANSPARENT)
    draw = ImageDraw.Draw(img)
    ellipse(draw, 24, 43, 14, 3, COLORS["shadow"], outline=False)
    if frame == 0:
        line(draw, (11, 36), (31, 40), COLORS["board"], width=3)
        line(draw, (18, 29), (33, 35), COLORS["shirt"], width=7)
        line(draw, (21, 28), (13, 38), COLORS["pants"], width=4)
        line(draw, (27, 31), (38, 40), COLORS["pants"], width=4)
        draw_cap_and_head(draw, 17, 25, -1, 0.2)
    elif frame == 1:
        line(draw, (10, 39), (35, 37), COLORS["board"], width=3)
        line(draw, (14, 30), (34, 31), COLORS["shirt"], width=7)
        line(draw, (18, 32), (10, 40), COLORS["pants"], width=4)
        line(draw, (29, 32), (41, 39), COLORS["pants"], width=4)
        draw_cap_and_head(draw, 36, 29, 1, 0.2)
    else:
        line(draw, (12, 40), (36, 35), COLORS["board"], width=3)
        line(draw, (17, 35), (34, 28), COLORS["shirt"], width=7)
        line(draw, (19, 36), (8, 39), COLORS["pants"], width=4)
        line(draw, (30, 31), (41, 33), COLORS["pants"], width=4)
        draw_cap_and_head(draw, 35, 25, 1, -0.1)
    return img


def build_roll():
    atlas = Image.new("RGBA", (CELL * ROLL_OUTPUT_COLS, CELL * 16), TRANSPARENT)
    for row in range(16):
        for col in range(ROLL_OUTPUT_COLS):
            atlas.alpha_composite(draw_roll_cell(row, col), (col * CELL, row * CELL))
    return atlas


def build_jump():
    atlas = Image.new("RGBA", (CELL * JUMP_OUTPUT_COLS, CELL * 16), TRANSPARENT)
    for row in range(16):
        for col in range(JUMP_OUTPUT_COLS):
            atlas.alpha_composite(draw_jump_cell(row, col), (col * CELL, row * CELL))
    return atlas


def build_duck():
    atlas = Image.new("RGBA", (CELL * DUCK_OUTPUT_COLS, CELL * 16), TRANSPARENT)
    for row in range(16):
        for col in range(DUCK_OUTPUT_COLS):
            atlas.alpha_composite(draw_roll_cell(row, col), (col * CELL, row * CELL))
    return atlas


def build_trick():
    atlas = Image.new("RGBA", (CELL * TRICK_OUTPUT_COLS, CELL * 16), TRANSPARENT)
    for row in range(16):
        for col in range(TRICK_OUTPUT_COLS):
            cell = draw_ai_handplant_cell(row) if col == 1 else draw_jump_cell(row, min(col, JUMP_OUTPUT_COLS - 1))
            atlas.alpha_composite(cell, (col * CELL, row * CELL))
    return atlas


def build_bail():
    atlas = Image.new("RGBA", (CELL * 3, CELL), TRANSPARENT)
    for col in range(3):
        atlas.alpha_composite(draw_bail_cell(col), (col * CELL, 0))
    return atlas


def main():
    out_dir = Path("src/assets")
    out_dir.mkdir(parents=True, exist_ok=True)
    if AI_SOURCE.exists():
        ai_cells = load_ai_direction_cells()
        build_ai_roll(ai_cells).save(out_dir / "skater-roll-atlas.png")
        build_ai_jump(ai_cells).save(out_dir / "skater-jump-atlas.png")
        build_ai_duck(ai_cells).save(out_dir / "skater-duck-atlas.png")
        build_ai_trick(ai_cells).save(out_dir / "skater-trick-atlas.png")
    else:
        build_roll().save(out_dir / "skater-roll-atlas.png")
        build_jump().save(out_dir / "skater-jump-atlas.png")
        build_duck().save(out_dir / "skater-duck-atlas.png")
        build_trick().save(out_dir / "skater-trick-atlas.png")
    build_bail().save(out_dir / "skater-bail-atlas.png")
    print("wrote compass-correct skater atlases")


if __name__ == "__main__":
    main()
