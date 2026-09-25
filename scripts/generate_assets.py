import os
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from scipy.ndimage import gaussian_filter

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "assets", "textures")
os.makedirs(OUTPUT_DIR, exist_ok=True)

def wrap_gaussian(arr, sigma):
    """Gaussian filter with wrap mode for seamless tiling textures."""
    return gaussian_filter(arr, sigma=sigma, mode='wrap')

def generate_carpet(filename="carpet.jpg", size=1024):
    print(f"Generating {filename}...")
    rng = np.random.default_rng(101)
    y, x = np.mgrid[0:size, 0:size]

    def cloud(scale):
        field = wrap_gaussian(rng.normal(size=(size, size)), sigma=scale)
        return field / max(field.std(), 1e-6)

    broad = cloud(size / 12)
    damp = cloud(size / 24)
    mottling = cloud(size / 100)
    fibers = (np.sin(x * 0.95 + np.sin(y * 0.08)) + 0.35 * np.sin(y * 1.4)) * 5.0
    grain = rng.normal(0, 4.5, (size, size))

    # Warm, muted olive pile with visible cloudy wear and small damp patches.
    value = 134 + broad * 12 + mottling * 8 + damp * 7 + fibers + grain
    stain = np.clip((-broad - damp * 0.45 - 0.4) * 13, 0, 18)
    rgb = np.empty((size, size, 3), dtype=np.float32)
    rgb[:, :, 0] = value + 12 - stain * 0.45
    rgb[:, :, 1] = value + 2 - stain * 0.35
    rgb[:, :, 2] = value - 34 - stain * 0.15

    # A few soft, irregular darker mildew freckles.
    specks = (rng.random((size, size)) > 0.997).astype(np.float32)
    mildew = wrap_gaussian(specks, sigma=2.5) * 95
    rgb -= mildew[:, :, None] * np.array([1.0, 0.9, 0.72], dtype=np.float32)

    img = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), mode='RGB')
    img = img.filter(ImageFilter.SHARPEN)
    out_path = os.path.join(OUTPUT_DIR, filename)
    img.save(out_path, quality=95)
    print(f"Saved: {out_path} ({img.size})")

def generate_wall(filename="wall.jpg", size=1024):
    print(f"Generating {filename}...")
    rng = np.random.default_rng(303)
    y, x = np.mgrid[0:size, 0:size]

    def cloud(scale):
        field = wrap_gaussian(rng.normal(size=(size, size)), sigma=scale)
        return field / max(field.std(), 1e-6)

    broad = cloud(size / 10)
    damp = cloud(size / 28)
    paper = rng.normal(0, 3.5, (size, size))
    stripe = np.sin(x * (2 * np.pi / 72)) * 5.5
    value = 190 + broad * 10 + damp * 7 + paper + stripe * 1.25
    stain = np.clip((-broad * 0.65 - damp - 0.55) * 24, 0, 34)

    rgb = np.empty((size, size, 3), dtype=np.float32)
    rgb[:, :, 0] = value + 7 - stain * 0.55
    rgb[:, :, 1] = value + 1 - stain * 0.45
    rgb[:, :, 2] = value - 20 - stain * 0.28

    # Fine faded seams and scattered pinprick mildew keep the paper aged without harsh blotches.
    seam_x = np.minimum(x % 256, 256 - (x % 256))
    seam = np.exp(-(seam_x / 1.6) ** 2) * 13
    rgb -= seam[:, :, None]
    specks = (rng.random((size, size)) > 0.9992).astype(np.float32)
    mildew = wrap_gaussian(specks, sigma=2.0) * 100
    rgb -= mildew[:, :, None] * np.array([1.0, 0.9, 0.72], dtype=np.float32)

    img = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), mode='RGB')
    img = img.filter(ImageFilter.SHARPEN)
    out_path = os.path.join(OUTPUT_DIR, filename)
    img.save(out_path, quality=94)
    print(f"Saved: {out_path} ({img.size})")

def generate_ceiling(filename="ceiling.jpg", size=1024):
    print(f"Generating {filename}...")
    np.random.seed(202)

    # Drop ceiling acoustic tiles (2x2 grid in a 1024x1024 texture)
    # Acoustic tile base: aged off-white / dingy grey-yellow (200, 196, 180)
    base_color = np.array([195.0, 192.0, 178.0])

    # Base noise
    noise = np.random.normal(0, 8, (size, size, 1))

    # Acoustic worm pits (small dark crevices and dots characteristic of office tiles)
    specks = np.random.uniform(0, 1, (size, size))
    worms = (specks > 0.96).astype(np.float32)
    worms_blur = gaussian_filter(worms, sigma=0.8)[:, :, None] * 70.0

    # Aging gradient / dust near edges
    aging = wrap_gaussian(np.random.uniform(-1, 1, (size, size)), sigma=40)[:, :, None] * 15.0

    rgb = np.zeros((size, size, 3), dtype=np.float32)
    rgb += base_color + noise - worms_blur + aging

    # Grid lines: 2x2 tiles with metal T-bar runners
    # Grid lines at: x=0, 512, 1024; y=0, 512, 1024
    grid_thickness = 14
    for offset in [0, 512]:
        for i in range(-grid_thickness//2, grid_thickness//2 + 1):
            coord = (offset + i) % size
            # Dark groove and metal highlight
            shade = 110.0 if abs(i) <= 2 else (160.0 if i > 0 else 80.0)
            rgb[coord, :, :] = [shade, shade * 0.98, shade * 0.92]
            rgb[:, coord, :] = [shade, shade * 0.98, shade * 0.92]

    # Add a recessed fluorescent light fixture in the top-right tile (from x=540 to 996, y=28 to 484)
    # It has a frosted diffuser cover and bright center
    img = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), mode='RGB')
    draw = ImageDraw.Draw(img)

    # Fixture frame
    fx1, fy1, fx2, fy2 = 560, 60, 960, 460
    draw.rectangle([fx1-4, fy1-4, fx2+4, fy2+4], fill=(70, 70, 70), outline=(50, 50, 50), width=3)
    # Diffuser grill / egg-crate or milky acrylic panel
    draw.rectangle([fx1, fy1, fx2, fy2], fill=(250, 245, 215)) # Warm fluorescent glow

    # Diffuser grid lines
    for gx in range(fx1, fx2, 25):
        draw.line([gx, fy1, gx, fy2], fill=(200, 195, 170), width=1)
    for gy in range(fy1, fy2, 25):
        draw.line([fx1, gy, fx2, gy], fill=(200, 195, 170), width=1)

    # Fluorescent tube silhouettes behind the grill
    draw.line([fx1 + 100, fy1 + 20, fx1 + 100, fy2 - 20], fill=(255, 255, 240), width=16)
    draw.line([fx1 + 300, fy1 + 20, fx1 + 300, fy2 - 20], fill=(255, 255, 240), width=16)

    # Yellow-brown heat / nicotine aging stain around the lamp housing
    out_path = os.path.join(OUTPUT_DIR, filename)
    img.save(out_path, quality=95)
    print(f"Saved: {out_path} ({img.size})")

def generate_smiler(filename="smiler.png", size=512):
    print(f"Generating {filename}...")
    # Smiler entity: Floating glowing sharp grin and piercing glowing eyes in pitch darkness
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    cx, cy = size // 2, size // 2

    # 1. Glowing eyes (oval, hollow, intensely bright white with cyan/yellow fringe)
    eye_y = cy - 65
    left_eye_x = cx - 90
    right_eye_x = cx + 90
    eye_w, eye_h = 36, 48

    # Draw eye glow halos
    for radius in range(55, 0, -5):
        alpha = int(120 * (1.0 - radius / 55.0))
        glow_col = (255, 255, 220, alpha)
        draw.ellipse([left_eye_x - radius, eye_y - radius, left_eye_x + radius, eye_y + radius], fill=glow_col)
        draw.ellipse([right_eye_x - radius, eye_y - radius, right_eye_x + radius, eye_y + radius], fill=glow_col)

    # Core eyes
    draw.ellipse([left_eye_x - eye_w//2, eye_y - eye_h//2, left_eye_x + eye_w//2, eye_y + eye_h//2], fill=(255, 255, 255, 255))
    draw.ellipse([right_eye_x - eye_w//2, eye_y - eye_h//2, right_eye_x + eye_w//2, eye_y + eye_h//2], fill=(255, 255, 255, 255))

    # 2. Sinister grinning mouth with needle-sharp jagged teeth
    mouth_y = cy + 45
    mouth_w = 175
    mouth_h = 75

    # Outer mouth curve polygon
    top_points = []
    bot_points = []
    steps = 40
    for i in range(steps + 1):
        t = (i / steps) * 2.0 - 1.0 # -1 to 1
        px = cx + t * mouth_w
        # Parabolic curves
        py_top = mouth_y - 20 + (t ** 2) * 35
        py_bot = mouth_y + 15 + (1.0 - t ** 2) * 50 + (t ** 2) * 35
        top_points.append((px, py_top))
        bot_points.append((px, py_bot))

    mouth_poly = top_points + bot_points[::-1]

    # Draw mouth glow
    glow_img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow_img)
    glow_draw.polygon(mouth_poly, fill=(255, 255, 210, 180))
    glow_img = glow_img.filter(ImageFilter.GaussianBlur(12))
    img.alpha_composite(glow_img)

    # Fill inner black void
    draw.polygon(mouth_poly, fill=(10, 10, 10, 240))

    # Draw jagged triangular teeth pointing up and down
    num_teeth = 18
    for i in range(num_teeth):
        t_center = (i / (num_teeth - 1)) * 2.0 - 1.0 # -1 to 1
        tx = cx + t_center * (mouth_w - 15)
        ty_top = mouth_y - 18 + (t_center ** 2) * 34
        ty_bot = mouth_y + 10 + (1.0 - t_center ** 2) * 45 + (t_center ** 2) * 30

        tooth_w = 9
        # Upper tooth pointing down
        draw.polygon([
            (tx - tooth_w, ty_top),
            (tx + tooth_w, ty_top),
            (tx, ty_top + 28 - abs(t_center)*8)
        ], fill=(255, 255, 250, 255))

        # Lower tooth pointing up
        draw.polygon([
            (tx - tooth_w + 5, ty_bot),
            (tx + tooth_w + 5, ty_bot),
            (tx + 5, ty_bot - 24 + abs(t_center)*6)
        ], fill=(255, 255, 250, 255))

    out_path = os.path.join(OUTPUT_DIR, filename)
    img.save(out_path)
    print(f"Saved: {out_path} ({img.size})")

def generate_bacteria(filename="bacteria.png", size=(512, 1024)):
    print(f"Generating {filename}...")
    w, h = size
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    cx = w // 2
    # The Bacteria / Wire entity: tall spindly distorted black mass with erratic tendrils
    np.random.seed(303)

    # Generate main body spine
    spine_points = []
    y_coords = np.linspace(150, h - 80, 25)
    for y in y_coords:
        offset = np.sin(y * 0.015) * 45 + np.random.normal(0, 12)
        spine_points.append((cx + offset, y))

    # Draw thick shadowy core
    for i in range(len(spine_points) - 1):
        p1 = spine_points[i]
        p2 = spine_points[i+1]
        width = int(45 - (i / len(spine_points)) * 15)
        draw.line([p1, p2], fill=(12, 10, 15, 230), width=width)

    # Head blob
    hx, hy = spine_points[0]
    draw.ellipse([hx - 40, hy - 60, hx + 40, hy + 20], fill=(8, 8, 12, 245))

    # Tangled wire-like limbs / tendrils
    for _ in range(35):
        # Pick random starting point along spine
        idx = np.random.randint(2, len(spine_points) - 2)
        sx, sy = spine_points[idx]

        limb_pts = [(sx, sy)]
        curr_x, curr_y = sx, sy
        limb_len = np.random.randint(6, 14)
        angle = np.random.uniform(-math.pi, math.pi)

        for _ in range(limb_len):
            angle += np.random.uniform(-0.6, 0.6)
            step = np.random.uniform(20, 45)
            curr_x += math.cos(angle) * step
            curr_y += math.sin(angle) * step
            limb_pts.append((curr_x, curr_y))

        l_width = np.random.randint(3, 10)
        draw.line(limb_pts, fill=(15, 12, 18, 220), width=l_width)

    # Apply eerie motion blur / nightmare halo
    shadow = img.filter(ImageFilter.GaussianBlur(10))
    final_img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    final_img.alpha_composite(shadow)
    final_img.alpha_composite(img)

    out_path = os.path.join(OUTPUT_DIR, filename)
    final_img.save(out_path)
    print(f"Saved: {out_path} ({final_img.size})")

def generate_almond_water(filename="almond_water.png", size=512):
    print(f"Generating {filename}...")
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    cx, cy = size // 2, size // 2
    # Can dimensions
    cw, ch = 190, 310
    x1, y1 = cx - cw // 2, cy - ch // 2
    x2, y2 = cx + cw // 2, cy + ch // 2

    # Outer glow
    glow_box = [x1 - 25, y1 - 25, x2 + 25, y2 + 25]
    draw.rounded_rectangle(glow_box, radius=40, fill=(0, 255, 200, 30))

    # Metal can body (cylindrical shading)
    can_img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    can_draw = ImageDraw.Draw(can_img)
    can_draw.rounded_rectangle([x1, y1, x2, y2], radius=32, fill=(180, 185, 190, 255))

    # Can rim highlights
    can_draw.ellipse([x1, y1, x2, y1 + 45], fill=(220, 225, 230, 255), outline=(130, 135, 140), width=3)
    can_draw.ellipse([x1, y2 - 45, x2, y2], fill=(140, 145, 150, 255), outline=(100, 105, 110), width=3)

    # Label wrap (yellowish beige retro M.E.G. survival label)
    ly1 = y1 + 55
    ly2 = y2 - 50
    can_draw.rectangle([x1 + 3, ly1, x2 - 3, ly2], fill=(235, 220, 175, 255))

    # Hazard stripes on label top and bottom
    for sx in range(x1, x2, 24):
        can_draw.polygon([(sx, ly1), (sx + 12, ly1), (sx - 4, ly1 + 18), (sx - 16, ly1 + 18)], fill=(40, 40, 40))
        can_draw.polygon([(sx, ly2 - 18), (sx + 12, ly2 - 18), (sx - 4, ly2), (sx - 16, ly2)], fill=(40, 40, 40))

    # Center badge: "ALMOND WATER" / "杏仁水"
    badge_y1 = ly1 + 32
    badge_y2 = ly2 - 32
    can_draw.rectangle([x1 + 15, badge_y1, x2 - 15, badge_y2], fill=(30, 35, 45), outline=(210, 175, 70), width=3)

    img.alpha_composite(can_img)
    draw = ImageDraw.Draw(img)

    # Text labels
    # Use default font
    font_large = ImageFont.load_default()

    draw.text((cx - 62, badge_y1 + 18), "ALMOND WATER", fill=(255, 255, 255), font=font_large)
    draw.text((cx - 40, badge_y1 + 42), "★ 杏 仁 水 ★", fill=(255, 215, 0), font=font_large)
    draw.text((cx - 50, badge_y1 + 68), "M.E.G. RATION", fill=(170, 220, 255), font=font_large)
    draw.text((cx - 48, badge_y1 + 92), "SANITY RECOVERY", fill=(120, 255, 160), font=font_large)

    # Condensation drops
    np.random.seed(404)
    for _ in range(25):
        dx = np.random.randint(x1 + 15, x2 - 15)
        dy = np.random.randint(ly1 + 5, ly2 - 5)
        rw = np.random.randint(3, 7)
        draw.ellipse([dx, dy, dx + rw, dy + rw * 2], fill=(255, 255, 255, 170))

    out_path = os.path.join(OUTPUT_DIR, filename)
    img.save(out_path)
    print(f"Saved: {out_path} ({img.size})")

def generate_exit_door(filename="exit_door.jpg", size=(512, 1024)):
    print(f"Generating {filename}...")
    w, h = size
    # Heavy industrial metal escape door
    rgb = np.zeros((h, w, 3), dtype=np.float32)
    # Dull grey-green industrial painted steel
    rgb[:] = [95.0, 108.0, 98.0]

    # Steel grain and scratch noise
    noise = np.random.normal(0, 8, (h, w, 3))
    rgb += noise

    # Rust along bottom and edges
    edge_dist = np.minimum(np.arange(w), np.arange(w)[::-1])
    rust_mask = np.exp(-edge_dist / 30.0)[None, :, None]
    rust_color = np.array([125.0, 65.0, 30.0])
    rgb = rgb * (1.0 - rust_mask * 0.7) + rust_color * (rust_mask * 0.7)

    img = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), mode='RGB')
    draw = ImageDraw.Draw(img)

    # Outer frame
    draw.rectangle([12, 12, w - 12, h - 12], outline=(40, 45, 42), width=10)

    # Glowing EXIT SIGN on top
    sign_w, sign_h = 240, 85
    sx1 = (w - sign_w) // 2
    sy1 = 70
    sx2 = sx1 + sign_w
    sy2 = sy1 + sign_h

    # Sign housing
    draw.rectangle([sx1 - 8, sy1 - 8, sx2 + 8, sy2 + 8], fill=(30, 30, 30), outline=(80, 80, 80), width=4)
    # Bright green emergency illumination
    draw.rectangle([sx1, sy1, sx2, sy2], fill=(25, 210, 95))

    # Sign Text
    font = ImageFont.load_default()
    draw.text((sx1 + 45, sy1 + 22), "E X I T", fill=(255, 255, 255), font=font)
    draw.text((sx1 + 35, sy1 + 48), "★ 安全出口 ★", fill=(240, 255, 240), font=font)

    # Door panels (inset bevels)
    p_x1, p_x2 = 45, w - 45
    # Top window / wire glass
    wy1, wy2 = 200, 420
    draw.rectangle([p_x1, wy1, p_x2, wy2], fill=(35, 42, 40), outline=(20, 22, 20), width=8)
    # Wire mesh inside window
    for wx in range(p_x1 + 10, p_x2, 20):
        draw.line([wx, wy1, wx + 40, wy2], fill=(80, 90, 85), width=2)
        draw.line([wx + 40, wy1, wx, wy2], fill=(80, 90, 85), width=2)

    # Panic push bar (emergency push bar across middle)
    bar_y = 650
    draw.rectangle([35, bar_y - 18, w - 35, bar_y + 18], fill=(180, 40, 40), outline=(70, 15, 15), width=4)
    draw.text(((w - 110) // 2, bar_y - 6), "PUSH TO ESCAPE", fill=(255, 255, 255), font=font)

    # Keycard scanner lock on the right side
    card_x1, card_y1 = w - 90, bar_y - 120
    draw.rectangle([card_x1, card_y1, card_x1 + 45, card_y1 + 70], fill=(25, 25, 30), outline=(90, 90, 100), width=3)
    # Card slot
    draw.rectangle([card_x1 + 10, card_y1 + 42, card_x1 + 35, card_y1 + 46], fill=(5, 5, 5))
    # Glowing LED indicator (red locked)
    draw.ellipse([card_x1 + 18, card_y1 + 12, card_x1 + 28, card_y1 + 22], fill=(255, 40, 40))

    # Bottom hazard kick-plate
    draw.rectangle([25, h - 140, w - 25, h - 25], fill=(45, 45, 40), outline=(20, 20, 20), width=4)
    for hx in range(25, w, 40):
        draw.polygon([(hx, h - 140), (hx + 20, h - 140), (hx - 10, h - 25), (hx - 30, h - 25)], fill=(220, 190, 40))

    out_path = os.path.join(OUTPUT_DIR, filename)
    img.save(out_path, quality=95)
    print(f"Saved: {out_path} ({img.size})")

def generate_keycard(filename="keycard.png", size=256):
    print(f"Generating {filename}...")
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    cx, cy = size // 2, size // 2
    kw, kh = 170, 110
    x1, y1 = cx - kw // 2, cy - kh // 2
    x2, y2 = cx + kw // 2, cy + kh // 2

    # Card outer glow
    draw.rounded_rectangle([x1 - 10, y1 - 10, x2 + 10, y2 + 10], radius=16, fill=(0, 200, 255, 40))
    # Card plastic body
    draw.rounded_rectangle([x1, y1, x2, y2], radius=10, fill=(240, 240, 245), outline=(120, 130, 140), width=2)
    # Magnetic stripe / top bar
    draw.rectangle([x1, y1 + 18, x2, y1 + 36], fill=(220, 50, 40))

    # Gold IC Chip
    draw.rectangle([x1 + 18, y1 + 48, x1 + 48, y1 + 78], fill=(215, 175, 60), outline=(150, 115, 30), width=2)

    font = ImageFont.load_default()
    draw.text((x1 + 60, y1 + 50), "LEVEL 0 PASS", fill=(20, 20, 20), font=font)
    draw.text((x1 + 60, y1 + 68), "ACCESS KEY", fill=(80, 80, 80), font=font)
    draw.text((x1 + 18, y1 + 88), "NO-CLIP PERMIT: #0429", fill=(100, 100, 100), font=font)

    out_path = os.path.join(OUTPUT_DIR, filename)
    img.save(out_path)
    print(f"Saved: {out_path} ({img.size})")

def generate_battery(filename="battery.png", size=256):
    print(f"Generating {filename}...")
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    cx, cy = size // 2, size // 2
    bw, bh = 80, 140
    x1, y1 = cx - bw // 2, cy - bh // 2
    x2, y2 = cx + bw // 2, cy + bh // 2

    # Glow
    draw.rounded_rectangle([x1 - 12, y1 - 12, x2 + 12, y2 + 12], radius=18, fill=(255, 230, 80, 50))
    # Battery terminal nub
    draw.rounded_rectangle([cx - 16, y1 - 14, cx + 16, y1], radius=4, fill=(210, 210, 215))
    # Copper top
    draw.rounded_rectangle([x1, y1, x2, y1 + 40], radius=8, fill=(215, 140, 50), outline=(150, 90, 30), width=2)
    # Black body
    draw.rounded_rectangle([x1, y1 + 35, x2, y2], radius=8, fill=(30, 30, 35), outline=(15, 15, 20), width=2)

    font = ImageFont.load_default()
    draw.text((cx - 16, y1 + 55), "9V", fill=(255, 215, 0), font=font)
    draw.text((cx - 28, y1 + 75), "POWER", fill=(255, 255, 255), font=font)
    draw.text((cx - 8, y1 + 95), "+", fill=(100, 255, 100), font=font)

    out_path = os.path.join(OUTPUT_DIR, filename)
    img.save(out_path)
    print(f"Saved: {out_path} ({img.size})")

if __name__ == "__main__":
    generate_wall()
    generate_carpet()
    generate_ceiling()
    generate_bacteria()
    generate_almond_water()
    generate_exit_door()
    generate_keycard()
    generate_battery()
    print("All Backrooms art assets successfully generated!")
