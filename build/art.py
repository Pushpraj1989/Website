"""Layered product art for the "assemble" module and catalogue thumbnails.

A product is a list of layers, bottom first. Each layer names a shape and a
colour; the generator draws an isometric stack as one SVG, one <g> per layer,
so the page can explode and re-assemble it on scroll.

    {"name": "Brioche bun", "shape": "dome", "color": "#d9973f", "h": 46, "w": 1}

Shapes: disc, dome, leaf, drip, sauce, foam, dust, ice, liquid, glass (a
container drawn over the layers inside it), card, bar, scoop, image (a cutout
PNG/WebP from the site's images, for real product photography).
"""

import math
import random

W = 400
CX = 200
R = 150
RATIO = 0.3   # ellipse ry / rx: the isometric tilt
GAP = 70      # vertical spread per layer when exploded


def _hex(c):
    c = c.lstrip("#")
    if len(c) == 3:
        c = "".join(ch * 2 for ch in c)
    return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))


def shade(c, k):
    """k > 0 lightens towards white, k < 0 darkens towards black."""
    r, g, b = _hex(c)
    if k >= 0:
        r, g, b = (round(v + (255 - v) * k) for v in (r, g, b))
    else:
        r, g, b = (round(v * (1 + k)) for v in (r, g, b))
    return f"#{r:02x}{g:02x}{b:02x}"


def _defs(uid, i, color):
    return (
        f'<linearGradient id="{uid}s{i}" x1="0" x2="1"><stop offset="0" stop-color="{shade(color, -.35)}"/>'
        f'<stop offset=".45" stop-color="{shade(color, .08)}"/><stop offset="1" stop-color="{shade(color, -.45)}"/></linearGradient>'
        f'<radialGradient id="{uid}t{i}" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="{shade(color, .35)}"/>'
        f'<stop offset="1" stop-color="{shade(color, -.05)}"/></radialGradient>'
    )


def _disc(uid, i, color, yt, yb, rx, ry):
    side = f'<path d="M{CX - rx},{yt} L{CX - rx},{yb} A{rx},{ry} 0 0 0 {CX + rx},{yb} L{CX + rx},{yt} Z" fill="url(#{uid}s{i})"/>'
    top = f'<ellipse cx="{CX}" cy="{yt}" rx="{rx}" ry="{ry}" fill="url(#{uid}t{i})"/>'
    return side + top


def _wavy(cx, cy, rx, ry, amp, waves, phase=0.0):
    pts = []
    for k in range(73):
        a = k / 72 * math.tau
        m = 1 + amp * math.sin(a * waves + phase)
        pts.append(f"{cx + math.cos(a) * rx * m:.1f},{cy + math.sin(a) * ry * m:.1f}")
    return "M" + " L".join(pts) + " Z"


def _layer(uid, i, l, yt, yb, rx, ry, rng, images):
    shape, color = l.get("shape", "disc"), l.get("color", "#c8a27a")
    out = []
    if shape == "disc" or shape == "liquid":
        out.append(_disc(uid, i, color, yt, yb, rx, ry))
        if shape == "liquid":
            out.append(f'<ellipse cx="{CX - rx * .3}" cy="{yt - ry * .2}" rx="{rx * .35}" ry="{ry * .25}" fill="#fff" opacity=".12"/>')
    elif shape == "dome":
        out.append(f'<path d="M{CX - rx},{yb} Q{CX - rx},{yt} {CX},{yt} Q{CX + rx},{yt} {CX + rx},{yb} A{rx},{ry} 0 0 1 {CX - rx},{yb} Z" fill="url(#{uid}t{i})"/>')
        out.append(f'<path d="M{CX - rx},{yb} A{rx},{ry} 0 0 0 {CX + rx},{yb}" fill="none" stroke="{shade(color, -.3)}" stroke-width="3"/>')
        if l.get("dots"):
            for _ in range(22):
                a, d = rng.uniform(math.pi * 1.05, math.pi * 1.95), rng.uniform(.15, .85)
                x = CX + math.cos(a) * rx * d
                y = yb - (yb - yt) * (1 - d * .9) * rng.uniform(.55, 1)
                out.append(f'<ellipse cx="{x:.1f}" cy="{y:.1f}" rx="3.6" ry="2" fill="{l["dots"]}" transform="rotate({rng.uniform(-40, 40):.0f} {x:.1f} {y:.1f})"/>')
    elif shape == "leaf":
        out.append(f'<path d="{_wavy(CX, yb, rx * 1.08, ry * 1.08, .07, 9)}" fill="{shade(color, -.35)}"/>')
        out.append(f'<path d="{_wavy(CX, yt, rx * 1.1, ry * 1.1, .08, 9, .6)}" fill="url(#{uid}t{i})"/>')
    elif shape == "sauce":
        out.append(f'<path d="{_wavy(CX, yt, rx * 1.02, ry * 1.02, .05, 7)}" fill="url(#{uid}t{i})"/>')
    elif shape == "drip":
        s = 1.08
        top = f"M{CX},{yt - ry * s} L{CX + rx * s},{yt} L{CX},{yt + ry * s} L{CX - rx * s},{yt} Z"
        out.append(f'<path d="{top}" fill="url(#{uid}t{i})"/>')
        for x, y in ((CX - rx * s, yt), (CX + rx * s, yt), (CX, yt + ry * s)):
            out.append(f'<path d="M{x - 9},{y - 2} Q{x},{y + 28} {x + 9},{y - 2} Z" fill="{shade(color, -.08)}"/>')
    elif shape == "foam":
        out.append(_disc(uid, i, color, yt, yb, rx, ry))
        for k in range(14):
            a = k / 14 * math.tau
            out.append(f'<circle cx="{CX + math.cos(a) * rx * .8:.1f}" cy="{yt + math.sin(a) * ry * .8:.1f}" r="{rng.uniform(10, 18):.1f}" fill="{shade(color, .25)}" opacity=".9"/>')
        out.append(f'<ellipse cx="{CX}" cy="{yt}" rx="{rx * .55}" ry="{ry * .55}" fill="{shade(color, .4)}"/>')
    elif shape == "dust":
        for _ in range(140):
            a, d = rng.uniform(0, math.tau), math.sqrt(rng.random())
            out.append(f'<circle cx="{CX + math.cos(a) * rx * d:.1f}" cy="{yt + math.sin(a) * ry * d:.1f}" r="{rng.uniform(1, 2.6):.1f}" fill="{shade(color, rng.uniform(-.3, .2))}"/>')
    elif shape == "ice":
        for k in range(5):
            x, y, sz = CX + rng.uniform(-rx * .6, rx * .6), (yt + yb) / 2 + rng.uniform(-ry * .4, ry * .4), rng.uniform(34, 48)
            out.append(f'<rect x="{x - sz / 2:.1f}" y="{y - sz / 2:.1f}" width="{sz:.1f}" height="{sz:.1f}" rx="8" fill="#e8f6ff" fill-opacity=".55" stroke="#fff" stroke-opacity=".8" transform="rotate({rng.uniform(-25, 25):.0f} {x:.1f} {y:.1f})"/>')
    elif shape in ("card", "bar"):
        k = 1.0 if shape == "card" else 1.25
        ax, ay = rx * k, ry * (1.0 if shape == "card" else .55)
        t = yb - yt
        top = f"M{CX - ax},{yt} L{CX},{yt - ay} L{CX + ax},{yt} L{CX},{yt + ay} Z"
        left = f"M{CX - ax},{yt} L{CX},{yt + ay} L{CX},{yt + ay + t} L{CX - ax},{yt + t} Z"
        right = f"M{CX + ax},{yt} L{CX},{yt + ay} L{CX},{yt + ay + t} L{CX + ax},{yt + t} Z"
        out += [f'<path d="{left}" fill="{shade(color, -.3)}"/>', f'<path d="{right}" fill="{shade(color, -.5)}"/>', f'<path d="{top}" fill="url(#{uid}t{i})"/>']
        if l.get("chip"):
            out.append(f'<path d="M{CX - ax * .55},{yt - ay * .05} l{ax * .18},{-ay * .18} l{ax * .14},{ay * .14} l{-ax * .18},{ay * .18} Z" fill="#e9c46a" stroke="#b8902e"/>')
    elif shape == "scoop":
        r = rx * .75
        out.append(f'<circle cx="{CX}" cy="{yt + r * .2}" r="{r}" fill="url(#{uid}t{i})"/>')
        out.append(f'<ellipse cx="{CX}" cy="{yb}" rx="{rx * .8}" ry="{ry * .5}" fill="{shade(color, -.3)}" opacity=".5"/>')
    elif shape == "image" and l.get("image") in images:
        src, iw = images[l["image"]], rx * 2.1
        out.append(f'<image href="{src}" x="{CX - iw / 2}" y="{yt - ry}" width="{iw}" height="{yb - yt + ry * 2}" preserveAspectRatio="xMidYMid meet"/>')
    else:  # unknown shape: plain disc so the stack still reads
        out.append(_disc(uid, i, color, yt, yb, rx, ry))
    return "".join(out)


def _glass(uid, color, y_top, y_bot, rx_top, rx_bot):
    ryt, ryb = rx_top * RATIO, rx_bot * RATIO
    body = (f"M{CX - rx_top},{y_top} L{CX - rx_bot},{y_bot} A{rx_bot},{ryb} 0 0 0 {CX + rx_bot},{y_bot} "
            f"L{CX + rx_top},{y_top}")
    return (f'<path d="{body} A{rx_top},{ryt} 0 0 0 {CX - rx_top},{y_top} Z" fill="{color}" fill-opacity=".10" stroke="#ffffff" stroke-opacity=".55" stroke-width="3"/>'
            f'<ellipse cx="{CX}" cy="{y_top}" rx="{rx_top}" ry="{ryt}" fill="none" stroke="#ffffff" stroke-opacity=".7" stroke-width="3"/>'
            f'<path d="M{CX - rx_top * .78},{y_top + 30} L{CX - rx_bot * .74},{y_bot - 20}" stroke="#ffffff" stroke-opacity=".35" stroke-width="10" stroke-linecap="round"/>')


def stack(uid, layers, images=None, explode=True):
    """Return (svg_inner, viewbox_height, layer_count) for a bottom-first list of layers."""
    images = images or {}
    rng = random.Random(uid)
    body = [l for l in layers if l.get("shape") != "glass"]
    glass = next((l for l in layers if l.get("shape") == "glass"), None)
    n = len(body)
    maxry = R * RATIO
    total = sum(l.get("h", 20) for l in body)
    spread = (n - 1) * GAP if explode else 0
    H = round(total + maxry * 2 + 70 + spread + (40 if glass else 0))
    y = H - maxry - 30 - spread / 2
    defs, groups = [], []
    y_bottom = y
    for i, l in enumerate(body):
        rx = R * l.get("w", 1)
        ry = rx * RATIO
        t = l.get("h", 20)
        yb, yt = y, y - t
        defs.append(_defs(uid, i, l.get("color", "#c8a27a")))
        groups.append(f'<g class="as-layer" data-i="{i}">{_layer(uid, i, l, round(yt, 1), round(yb, 1), round(rx, 1), round(ry, 1), rng, images)}</g>')
        y = yt + l.get("overlap", 0)
    if glass:
        top = y - glass.get("h", 30)
        groups.append(f'<g class="as-layer as-glass" data-i="{n}">{_glass(uid, glass.get("color", "#ffffff"), round(top), round(y_bottom + 4), R * glass.get("w", 1.08), R * glass.get("wb", .86))}</g>')
    svg = "<defs>" + "".join(defs) + "</defs>" + "".join(groups)
    return svg, H, n + (1 if glass else 0)
