# Galfar website plan (Tier 1 motion upgrade)

## Brief
- Concept redesign of galfar.com on the studio theme. Brief file: briefs/galfar.json
- English only. Motion: cinematic. Forms: preview only.

## Sources
- galfar.com/oman/galfar (WordPress; static HTML plus a Playwright collector for text/photo pairs), WP media library via wp-json, read 12 Oct 2026
- Raw pages, flow dumps and the media list: research/galfar/raw/. Photos as downloaded: research/galfar/media/
- Rebuild data: `python3 -I research/galfar/build/images.py` (photos, credits) then `python3 -I research/galfar/build/data.py` (writes data/galfar.json). depth-coast.jpg was made once from 2024_03_305B6932 with a darkened sky (code in session notes; credit kept in credits.json).

## Direction
- Preset: construction-engineering · Theme: studio, light mode, style minimal
- Colours: Galfar red #d40f0a on warm concrete #f3f1ec, ink #17191c · Type: Barlow Condensed + Poppins · Slider: burn
- Grammar: filmic-industrial · Signature move: a road is built stage by stage as you scroll (rock, cut, base, open, traffic)
- Feeling curve:
  1. Promo: scale (Rusayl–Bidbid, Yibal Khuff, Duqm, buildings, fleet)
  2. Rail: control (projects, capabilities, investors, careers, suppliers)
  3. Depth hero: pride (Galfar crew in front of a coastal road, clouds, headline between planes)
  4. Stats: trust · 5. Projects strip: proof · 6. Statement: history (quiet before the peak)
  7. Stages "From rock to road": the peak
  8. Energy split · 9. Capabilities grid · 10. Clients marquee · 11. People split
  12. News · 13. Locations curve slider · 14. FAQ · contact
  Peak: stages

## Sitemap (58 pages)
- index, about, contact
- capabilities (+10: three business units, QHSSE, project services, careers, ICV, suppliers, CSR, investor relations)
- sectors (+9 sector pages: marine, airports, bridges, earthworks, pipelines, power, hospitals, hotels, fabrication)
- projects (+20 project pages)
- locations (+3: Muscat head office, Nizwa Industrial Facility, Khazain integrated facilities)
- news (+8 articles, Oct 2023 to Aug 2024)

## Assets
- 56 Galfar photos (owner: Galfar) at 1600 px max, JPEG 76, plus 1 graded hero background and 1 cut-out (crew) in cut/
- Logo: 245 px PNG from galfar.com redrawn to 600 px (ask Galfar for vector)
- No company film on galfar.com, so no video slide or scrub

## Status
- [x] research [x] data [x] build [x] visual check desktop + phone [ ] QA (see report) [ ] deployed
- Open questions: `confirm` in data/galfar.json
