"""Draw dummy concept illustrations for a sample site (not photos of any real building).

    python3 tools/concept_art.py shared/img/azaiba-gardens

Writes SVG scenes and renders them to JPG with the installed Chromium, so the
kit's sample sites show clean, consistent art while real photos are pending.
"""
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

CHROME = "/opt/pw-browsers/chromium"
W, H = 1600, 1000


def building(sky, tone, glass, floors, cols, ground, seed):
    windows = []
    x0, x1 = 360, 1240
    top, bottom = 150, 820
    gap_y = (bottom - top) / floors
    cw = (x1 - x0) / cols
    for f in range(floors):
        for c in range(cols):
            x = x0 + c * cw + cw * 0.14
            y = top + f * gap_y + gap_y * 0.22
            windows.append(f'<rect x="{x:.0f}" y="{y:.0f}" width="{cw*0.72:.0f}" height="{gap_y*0.5:.0f}" rx="3" fill="url(#glass)"/>')
            if (f + c + seed) % 5 == 0:
                windows.append(f'<rect x="{x:.0f}" y="{y+gap_y*0.5:.0f}" width="{cw*0.72:.0f}" height="{gap_y*0.2:.0f}" fill="{tone}" opacity="0.5"/>')
    palms = ""
    for px, s in [(190, 1.0), (1330, 0.8), (1480, 1.1)]:
        palms += (f'<g transform="translate({px},{ground}) scale({s})">'
                  f'<path d="M0,0 Q-10,-120 4,-230" stroke="#4a3b2a" stroke-width="12" fill="none"/>'
                  f'<path d="M4,-230 Q-70,-270 -120,-220 Q-60,-245 4,-230 Q60,-270 120,-215 Q60,-240 4,-230 Q40,-300 0,-330 Q-20,-290 4,-230" fill="#2f5d46"/></g>')
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}">
<defs>
 <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{sky[0]}"/><stop offset="0.7" stop-color="{sky[1]}"/><stop offset="1" stop-color="{sky[2]}"/></linearGradient>
 <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e9f1f5"/><stop offset="0.5" stop-color="#8fb3c4"/><stop offset="1" stop-color="#34505f"/></linearGradient>
 <linearGradient id="wall" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="{tone}"/><stop offset="0.5" stop-color="#fbf7ef"/><stop offset="1" stop-color="{tone}"/></linearGradient>
 <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9b89a"/><stop offset="1" stop-color="#8d7a5c"/></linearGradient>
</defs>
<rect width="{W}" height="{H}" fill="url(#sky)"/>
<circle cx="1180" cy="230" r="70" fill="#fff4da" opacity="0.85"/>
<path d="M0,{ground-120} Q300,{ground-210} 700,{ground-150} T1600,{ground-170} V{ground} H0Z" fill="#b8a98b" opacity="0.55"/>
<rect x="{x0-40}" y="{top-40}" width="{x1-x0+80}" height="{bottom-top+40}" rx="10" fill="url(#wall)"/>
<rect x="{x0-40}" y="{top-40}" width="{x1-x0+80}" height="24" fill="#f7f1e6"/>
{''.join(windows)}
<rect x="{x0-70}" y="{bottom}" width="{x1-x0+140}" height="34" fill="#e9e1d1"/>
<rect x="0" y="{ground}" width="{W}" height="{H-ground}" fill="url(#ground)"/>
{palms}
</svg>'''


def flat(kind):
    beds = {1: 1, 2: 2, 3: 3}[kind]
    tones = {1: ("#f3e6d3", "#c08a5a"), 2: ("#e7efe9", "#6f9a7e"), 3: ("#e6ebf3", "#5c7aa0")}[kind]
    sofa_w = 380 + 40 * beds
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}">
<defs>
 <linearGradient id="wall" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{tones[0]}"/><stop offset="1" stop-color="#fbf8f2"/></linearGradient>
 <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9cdb8"/><stop offset="1" stop-color="#b9a98e"/></linearGradient>
 <linearGradient id="view" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfe6f2"/><stop offset="1" stop-color="#f6e7cf"/></linearGradient>
 <linearGradient id="sofa" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{tones[1]}"/><stop offset="1" stop-color="#3e5c4a"/></linearGradient>
</defs>
<rect width="{W}" height="{H}" fill="url(#wall)"/>
<rect x="0" y="690" width="{W}" height="310" fill="url(#floor)"/>
<path d="M0,690 L{W},690" stroke="#a8977a" stroke-width="3"/>
<rect x="180" y="150" width="520" height="400" rx="8" fill="#9bbcd0"/>
<rect x="180" y="150" width="520" height="400" rx="8" fill="url(#view)" opacity="0.9"/>
{''.join(f'<rect x="{200+i*120}" y="{420-(i%3)*60}" width="90" height="{130+(i%3)*60}" fill="#c9d6dc"/>' for i in range(4))}
<rect x="170" y="140" width="540" height="420" rx="8" fill="none" stroke="#fff" stroke-width="16"/>
<rect x="440" y="150" width="8" height="400" fill="#fff"/>
<rect x="800" y="330" width="{sofa_w}" height="180" rx="60" fill="url(#sofa)"/>
<rect x="{800-30}" y="300" width="{sofa_w+60}" height="80" rx="40" fill="{tones[1]}"/>
<ellipse cx="1040" cy="770" rx="{260+30*beds}" ry="60" fill="#e9dcc4" opacity="0.8"/>
<rect x="1080" y="560" width="200" height="22" rx="6" fill="#7a5a3c"/>
<rect x="1100" y="582" width="16" height="110" fill="#7a5a3c"/><rect x="1240" y="582" width="16" height="110" fill="#7a5a3c"/>
<g transform="translate(1420,520)"><path d="M0,200 L0,30" stroke="#6b5842" stroke-width="8"/><ellipse cx="0" cy="0" rx="70" ry="110" fill="#5c8a6b"/></g>
<rect x="1360" y="700" width="200" height="40" rx="6" fill="#8c6b4a"/>
{''.join(f'<rect x="{60+i*20}" y="{300+i*0}" width="0" height="0"/>' for i in range(0))}
<rect x="{1280}" y="200" width="130" height="260" rx="10" fill="#fbfaf7" stroke="#e5ded0" stroke-width="4"/>
<line x1="1345" y1="200" x2="1345" y2="460" stroke="#e5ded0" stroke-width="3"/>
</svg>'''


SCENES = {
    "concept-building-1": building(("#f6d7b0", "#e8b98a", "#b57e5b"), "#e6d6bd", 0, 9, 7, 860, 1),
    "concept-building-2": building(("#cfe0e8", "#e9eef0", "#f6e8d6"), "#d9e3e6", 0, 12, 6, 860, 2),
    "concept-building-3": building(("#e9c9b5", "#f2d6c4", "#f7e9dc"), "#d9c4b2", 0, 7, 8, 860, 3),
    "concept-building-4": building(("#c9d9cf", "#e4eee8", "#f4f1e8"), "#c9d8cf", 0, 11, 6, 860, 4),
    "concept-building-5": building(("#d7d2e6", "#ece8f3", "#f5efe6"), "#d4cde0", 0, 10, 7, 860, 5),
    "concept-flat-1bhk": flat(1),
    "concept-flat-2bhk": flat(2),
    "concept-flat-3bhk": flat(3),
}


def main(out_dir):
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
        page = browser.new_page(viewport={"width": W, "height": H})
        for name, svg in SCENES.items():
            page.set_content(f'<html><body style="margin:0">{svg}</body></html>')
            page.screenshot(path=str(out / f"{name}.jpg"), type="jpeg", quality=88)
            print("wrote", out / f"{name}.jpg")
        browser.close()


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "shared/img/azaiba-gardens")
