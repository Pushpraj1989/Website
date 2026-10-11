# Sector presets

Each `presets/<sector>.json` gives: page list, home section order, quick-action rail,
catalogue label and categories, tools, signature graphic ideas, assemble ideas, what to
scrape, sector questions and compliance notes. `tools/new_site.py` reads it.

| Preset | Fits | Catalogue becomes | Signature graphic | Tools |
| --- | --- | --- | --- | --- |
| healthcare | hospitals, clinics, labs | health packages | glass anatomy, organ cards | BMI, doctor directory, branch maps |
| banking | banks, finance, exchange | accounts, cards, finance | card that assembles | EMI calculator, compare |
| insurance | insurers, takaful | plans | shield / car layers of cover | compare |
| food-beverage | restaurants, cafés, bakeries, QSR | menu | burger or drink that assembles | nutrition panels, options |
| fmcg-nutrition | protein, supplements, snacks, drinks | products | tub or bar exploding into ingredients | nutrition, compare |
| retail | fashion, electronics, furniture | collections | product teardown | |
| logistics | courier, freight, ports | solutions | globe arcs, route line | tracking link |
| energy-utilities | oil & gas, LPG, power, water | products | particle sphere, cut-away cylinder | safety pages |
| construction-engineering | contractors, developers | projects | building assembling floor by floor | |
| conglomerate | holding groups | group companies | curtain reveal, company index | |
| hospitality | hotels, resorts, travel | rooms | slow ken-burns, room fly-through | |
| real-estate | developers, brokers | projects and listings | tower assembling | EMI |
| education | schools, universities | programmes | pathway lines | |
| automotive | dealers, distributors | models | exploded car | EMI, compare |
| telecom-tech | telecom, ISP, SaaS | plans | particle network | compare |
| government | ministries, authorities | service catalogue | calm motion | WCAG AA |

No exact fit? Pick the closest preset and edit `home` and labels in the data file. Sector
names in data (`catalogue.nav`, `services.nav`, `locations.nav`) change every label on the site.

## Choosing the theme

- `studio`: default. Fully data-driven sections, brand colours and fonts from `brand`.
- Signature themes (hand-built, one company each, reusable): `story` (warm health storytelling,
  glass anatomy), `clinic` (clinical white, kinetic type), `ember` (industrial fire), `cosmos`
  (space, particle sphere), `editorial` (heritage serif, curtains), `route` (night logistics,
  globe). Use one when the person wants that look; the data keys are the same.
