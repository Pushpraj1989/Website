# Intake questionnaire

Ask in four rounds. Keep each question short and offer options. Skip anything already
answered; confirm it instead. With AskUserQuestion: one call per round, 4 questions max,
put the recommended option first.

## Round 1: the company

1. **Company and sector.** Company name, and which best describes it?
   Options: healthcare · banking/finance · insurance · food & beverage / café · FMCG / nutrition /
   protein · retail · logistics · energy/utilities · construction/engineering · conglomerate ·
   hospitality · real estate · education · automotive · telecom/tech · government · other.
2. **Existing website.** Do you have a current website? Share the URL (and Instagram,
   LinkedIn or other socials). We take real content and photos from it.
   Options: yes (paste URL) · no website yet · only social pages.
3. **Goal.** What is this build for?
   Options: concept to pitch to the company · full redesign to go live · new brand launch ·
   landing page for a campaign.
4. **Languages.** Options: English · English + Arabic (RTL) · Arabic first · other.

## Round 2: look and motion

5. **References.** Any websites, designs (Figma), videos or reels you like? Paste links or
   upload files. What do you like in each (motion, layout, colours, type)?
6. **Motion level.** How should it move?
   - Cinematic: WebGL slider, scroll-scrubbed product assembly, 3D/particles, page transitions (recommended)
   - Rich: scroll reveals both ways, sliders, parallax, hover effects
   - Calm: subtle fades only
   - Static: no motion (accessibility-first, government)
7. **Brand.** Logo, colours, fonts, brand book? Or should we propose a palette?
   Options: use our brand (upload) · take it from the current site · propose 2 directions.
8. **Signature graphic.** One "wow" element for the home page?
   Options: product assembles layer by layer (food, drinks, protein, cards, devices) ·
   3D object or particles · interactive map/globe · anatomy/body (health) · none.

## Round 3: content and features

9. **Products and services.** How many products/menu items/plans/services, and do you have
   prices, specs, nutrition, photos (packshots on plain background are best)?
10. **Pages.** We propose these from the sector preset (list them). Anything to add or remove?
    (For example doctor directory, careers, investor relations, franchise, catering.)
11. **Features.** Which do you need?
    booking/appointments · online ordering · store/branch locator with maps · search/directory ·
    calculators (loan EMI, BMI, compare) · tracking box · news/press · FAQ · WhatsApp/call dock ·
    offers pop-up · careers · forms to email/CRM.
12. **Photography.** Can we use the photos on your site? Do you have a photo library?
    Is free stock (CC0) acceptable where you have nothing?

## Round 4: delivery

13. **Hosting.** Where will it live? Options: your server (IP/SSH) · GitHub Pages · Netlify/Vercel ·
    send a zip.
14. **Forms.** Where should forms go? Options: email · CRM/webhook URL · not yet (preview only).
15. **Timeline and scope.** Deadline? One company or several?
16. **Verification.** Who confirms facts, prices and claims before it goes out?

## Sector questions

Add the `questions` array from `presets/<sector>.json` (for example: doctor photos and
emergency hours for hospitals, rates and fees for banks, the menu PDF and hero products
for cafés, packshots and nutrition for protein brands).

## Brief file: `briefs/<slug>.json`

```json
{
  "slug": "acme-bank",
  "name": "Acme Bank",
  "short": "Acme",
  "sector": "banking",
  "country": "Oman",
  "goal": "concept to pitch",
  "languages": ["en"],
  "website": "https://www.acmebank.example",
  "socials": ["https://instagram.com/acme"],
  "references": [{"url": "https://example.com", "like": "card that assembles on scroll"}],
  "motion": "cinematic",
  "brand": {"mode": "dark", "bg": "#0b1220", "fg": "#eef2f7", "accent": "#c9a227", "accent_ink": "#0b1220",
            "font_display": "\"Fraunces\", serif", "fonts_url": "https://fonts.googleapis.com/css2?family=Fraunces&family=Inter&display=swap"},
  "signature": "assemble: premium card",
  "promo_fx": "streak",
  "pages_add": ["investor relations"], "pages_remove": [],
  "features": ["emi", "branch locator", "news", "faq", "offers pop-up"],
  "photos": "site photos + CC0 stock",
  "hosting": "own server 203.0.113.10",
  "forms": "preview only",
  "deadline": "2026-11-01",
  "verifier": "client marketing team",
  "tagline": "", "cta": "Open an account",
  "phones": ["+968 2400 0000"], "whatsapp": "+968 9000 0000", "email": "info@acmebank.example", "address": ""
}
```
