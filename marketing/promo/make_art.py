"""Procedural 'luxury' wallpapers for the promo videos (original art, no third-party images)."""
import sys
import numpy as np
from PIL import Image, ImageFilter

OUT = sys.argv[1]
rng = np.random.default_rng(7)


def noise(w, h, scale, seed):
    """Smooth value noise in [0,1] via bicubic-upscaled random grid."""
    r = np.random.default_rng(seed)
    gw, gh = max(2, int(w / scale)) + 2, max(2, int(h / scale)) + 2
    g = r.random((gh, gw)).astype(np.float32)
    im = Image.fromarray(g, 'F').resize((int(gw * scale), int(gh * scale)), Image.BICUBIC)
    return np.clip(np.asarray(im, dtype=np.float32)[:h, :w], 0, 1)


def fbm(w, h, scale, seed, octaves=5):
    a, tot, out = 1.0, 0.0, np.zeros((h, w), np.float32)
    for o in range(octaves):
        out += a * noise(w, h, scale / (2 ** o), seed + o * 31)
        tot += a
        a *= 0.5
    return out / tot


def ramp(t, stops):
    """Map t in [0,1] through colour stops [(pos, (r,g,b)), ...]."""
    t = np.clip(t, 0, 1)
    out = np.zeros(t.shape + (3,), np.float32)
    for (p0, c0), (p1, c1) in zip(stops, stops[1:]):
        m = (t >= p0) & (t <= p1)
        k = ((t - p0) / max(p1 - p0, 1e-6))[..., None]
        out = np.where(m[..., None], np.array(c0) * (1 - k) + np.array(c1) * k, out)
    return out


def save(arr, name):
    arr = np.clip(arr, 0, 255).astype(np.uint8)
    im = Image.fromarray(arr, 'RGB')
    # fine grain for a print-like finish
    g = (rng.normal(0, 2.2, arr.shape)).astype(np.float32)
    im = Image.fromarray(np.clip(arr + g, 0, 255).astype(np.uint8), 'RGB')
    im.save(f'{OUT}/{name}.jpg', quality=93)


def grid(w, h):
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    return x / w, y / h


def liquid_gold(w, h, name):
    x, y = grid(w, h)
    warp = fbm(w, h, w / 2.5, 11) - 0.5
    img = np.zeros((h, w, 3), np.float32)
    base = ramp(y + 0.15 * warp, [(0, (8, 7, 9)), (0.6, (14, 11, 10)), (1, (22, 16, 12))])
    img += base
    glow = np.zeros((h, w), np.float32)
    aspect = h / w
    for i in range(70):
        ph = i * 0.21
        amp = 0.09 + 0.04 * np.sin(i * 0.7)
        cy = 0.30 + i * 0.0058 + amp * np.sin(x * 5.2 + ph) + 0.06 * warp
        d = np.abs(y - cy) * h
        width = 1.1 + 0.9 * (i % 5 == 0)
        glow += np.exp(-(d / width) ** 2) * (0.35 + 0.65 * np.exp(-((x - 0.55) / 0.45) ** 2))
    glow = np.clip(glow, 0, 3)
    soft = np.asarray(Image.fromarray((np.clip(glow / 3, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(w / 160)), np.float32) / 255
    gold = np.array([235, 190, 110], np.float32)
    img += glow[..., None] * gold * 0.55 + soft[..., None] * np.array([255, 170, 80]) * 0.9
    vign = 1 - 0.55 * (((x - 0.5) ** 2) * 1.6 + ((y - 0.5) ** 2) * 1.2)
    save(img * vign[..., None], name)


def marble(w, h, name):
    x, y = grid(w, h)
    q = fbm(w, h, w / 1.8, 21)
    r = fbm(w, h, w / 1.8, 41)
    t = fbm(w, h, w / 2.2, 61) + 0.9 * q + 0.6 * r
    veins = np.abs(np.sin((x * 3 + y * 2 + t * 6) * np.pi))
    fine = np.exp(-(veins / 0.025) ** 2)
    wide = np.exp(-(veins / 0.12) ** 2)
    base = ramp(fbm(w, h, w / 3, 81), [(0, (6, 6, 8)), (0.5, (16, 15, 18)), (1, (30, 27, 30))])
    img = base + fine[..., None] * np.array([230, 186, 118]) * 0.95 + wide[..., None] * np.array([120, 90, 60]) * 0.18
    vign = 1 - 0.5 * (((x - 0.5) ** 2) + ((y - 0.5) ** 2))
    save(img * vign[..., None], name)


def aurora(w, h, name):
    x, y = grid(w, h)
    sky = ramp(y, [(0, (3, 6, 18)), (0.7, (6, 14, 30)), (1, (10, 24, 40))])
    n = fbm(w, h, w / 2, 101)
    img = sky.copy()
    for k, col in enumerate([(60, 230, 170), (120, 120, 255), (230, 90, 200)]):
        cx = 0.5 + 0.28 * np.sin(y * 3.5 + k * 2.1 + n * 3)
        band = np.exp(-((x - cx) / (0.06 + 0.03 * k)) ** 2)
        fall = np.clip(1 - np.abs(y - (0.35 + 0.1 * k)) / 0.45, 0, 1) ** 1.5
        streak = 0.55 + 0.45 * noise(w, h, w / 40, 200 + k) ** 2
        streak = streak * (0.8 + 0.2 * np.sin(x * 140 + n * 20))
        img += (band * fall * streak)[..., None] * np.array(col) * (0.85 - 0.2 * k)
    stars = (rng.random((h, w)) > 0.9992).astype(np.float32) * (1 - y) * 255
    img += stars[..., None]
    ridge = 0.82 + 0.06 * fbm(w, 1, w / 6, 303)[0][None, :] + 0.03 * np.sin(x * 9)
    img = np.where((y > ridge)[..., None], np.array([3, 5, 9], np.float32), img)
    save(img, name)


def peaks(w, h, name):
    """Layered ridges at dusk with a low sun — echoes the brand mark."""
    x, y = grid(w, h)
    sky = ramp(y, [(0, (18, 14, 40)), (0.45, (120, 60, 90)), (0.62, (240, 150, 90)), (1, (250, 200, 140))])
    sun = np.exp(-(((x - 0.68) ** 2) * (w / h) ** 2 + (y - 0.5) ** 2) / 0.0012)
    halo = np.exp(-(((x - 0.68) ** 2) * (w / h) ** 2 + (y - 0.5) ** 2) / 0.03)
    img = sky + sun[..., None] * np.array([255, 235, 200]) + halo[..., None] * np.array([255, 160, 90]) * 0.35
    layers = [
        (0.56, (150, 80, 100), 0.10, 1),
        (0.63, (95, 55, 85), 0.12, 2),
        (0.71, (55, 35, 65), 0.14, 3),
        (0.80, (28, 20, 40), 0.16, 4),
        (0.90, (12, 10, 20), 0.12, 5),
    ]
    for base, col, amp, s in layers:
        line = fbm(w, 1, w / (2 + s), 400 + s, 6)[0]
        ridge = base - amp * (np.abs(line - 0.5) * 2) ** 0.8 + 0.02
        mask = (y > ridge[None, :]).astype(np.float32)
        haze = np.clip((y - ridge[None, :]) * 4, 0, 1)
        c = np.array(col, np.float32)
        img = img * (1 - mask[..., None]) + mask[..., None] * (c * (0.75 + 0.25 * (1 - haze[..., None])))
    save(img, name)


def nebula(w, h, name):
    x, y = grid(w, h)
    a = fbm(w, h, w / 1.5, 501, 6)
    b = fbm(w, h, w / 1.2, 601, 6)
    t = np.clip((a - 0.35) * 2.2, 0, 1)
    img = ramp(b, [(0, (6, 4, 18)), (0.5, (40, 20, 90)), (1, (10, 60, 120))]) * (0.3 + 0.7 * t[..., None])
    hot = np.clip((a + 0.4 * b - 0.75) * 4, 0, 1)
    img += hot[..., None] * np.array([255, 120, 190]) * 0.6
    stars = (rng.random((h, w)) > 0.9985).astype(np.float32)
    big = np.asarray(Image.fromarray((stars * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2)), np.float32)
    img += (stars * 230 + big * 3)[..., None]
    save(img, name)


def silk(w, h, name, c0, c1, seed):
    x, y = grid(w, h)
    n = fbm(w, h, w / 1.4, seed, 4)
    f = np.sin((x * 2.2 + y * 1.4 + n * 2.6) * np.pi * 2)
    shade = 0.5 + 0.5 * f
    spec = np.exp(-((f - 0.92) / 0.06) ** 2)
    img = np.array(c0) * (1 - shade[..., None]) + np.array(c1) * shade[..., None]
    img += spec[..., None] * 110
    vign = 1 - 0.6 * (((x - 0.5) ** 2) + ((y - 0.5) ** 2))
    save(img * vign[..., None], name)


L = (2560, 1440)
P = (1440, 2560)
for (w, h), suf in ((L, 'l'), (P, 'p')):
    liquid_gold(w, h, f'liquid-gold-{suf}')
    marble(w, h, f'obsidian-marble-{suf}')
    aurora(w, h, f'aurora-{suf}')
    peaks(w, h, f'dusk-peaks-{suf}')
    nebula(w, h, f'violet-nebula-{suf}')
    silk(w, h, f'rose-silk-{suf}', (40, 12, 22), (210, 120, 140), 701)
    silk(w, h, f'emerald-silk-{suf}', (4, 22, 20), (60, 170, 140), 801)
    print('done', suf, flush=True)
