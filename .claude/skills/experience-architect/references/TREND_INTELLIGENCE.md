# UX Trend Intelligence and Continuous Refresh

## Purpose

Keep the skill current without letting novelty overwrite established human factors or accessibility requirements.

## Weekly scan protocol

Search for changes since the previous scan across:
1. W3C/WAI WCAG, ARIA/APG, cognitive accessibility
2. Apple HIG/accessibility/localization
3. Android/Material accessibility and platform guidance
4. Microsoft Inclusive Design
5. Adobe Spectrum and other mature design systems
6. Figma design-system/AI workflow research
7. Google PAIR / human-centered AI guidance
8. Unicode CLDR releases
9. UAE, Saudi, India, and other target-market digital standards
10. UX research organizations
11. major product interaction changes
12. high-signal practitioner/community discussion

## Trend ledger

Record:

```yaml
id: TREND-YYYY-NNN
pattern: ""
first_observed: ""
last_checked: ""
source: ""
region: "global"
domain: "general"
evidence: "STANDARD|RESEARCH|MARKET_SIGNAL|EXPERIMENTAL"
trajectory: "EMERGING|GROWING|ESTABLISHED|DECLINING|DISPUTED"
user_problem: ""
benefit: ""
risk: ""
accessibility_impact: ""
recommended_action: "ADOPT|PILOT|WATCH|REJECT"
confidence: "HIGH|MEDIUM|LOW"
```

## Adoption gate

`ADOPT` only if:
- it addresses a real user/task need;
- no standard/accessibility conflict exists;
- benefits exceed introduced complexity;
- the pattern is validated sufficiently for the product risk level.

Use `PILOT` for promising but unproven patterns.
Use `WATCH` for aesthetics or market movement without demonstrated UX value.
Use `REJECT` for deceptive, inaccessible, cognitively harmful, or context-inappropriate patterns.

## Skill update process

The trend scan should produce a **delta report**, not silently rewrite core rules.

Classify each proposed change:
- `CORE_STANDARD_UPDATE`
- `REGIONAL_UPDATE`
- `PLATFORM_UPDATE`
- `NEW_PATTERN`
- `DEPRECATION`
- `SOURCE_REFRESH`

For each change state:
- files affected
- rationale
- source evidence
- compatibility risk
- whether human approval is required

Core requirements should be version-controlled.

## 2026 standards watch

As of 2026-08-28 track:
- WCAG 2.2 AA = current release baseline; WCAG 3 remains Working Draft/WATCH.
- WCAG-EM 2 remains draft methodology/PILOT.
- ARIA in HTML Recommendation dated 2026-08-11 = ADOPT for semantic implementation conformance.
- WebAuthn Level 3 Recommendation dated 2026-08-25 = ADOPT for applicable authentication UX.
- CLDR 48.2/48.2.1 current; CLDR 49 advance warnings = PREPARE/WATCH.
- EU AI Act Article 50 transparency obligations apply from 2026-08-02 for applicable use cases = REGIONAL/REGULATORY ADOPT.
- W3C Web Sustainability impact-ratings work = draft/PILOT.

## Design-fashion firewall

Expressive motion, glass/translucency, deliberately imperfect aesthetics, shaders, generative visuals and similar trends remain `MARKET_SIGNAL`/`EXPERIMENTAL` unless evidence shows task value. Accessibility, comprehension and efficiency take priority.

## 2026 signal baseline

Current signals as of the pack's research date include:
- design systems increasingly acting as machine-readable context for AI-assisted implementation;
- design/development roles converging around shared canvases and AI workflows;
- accessibility being pushed earlier into systems/components and handoff;
- human craft/judgment remaining critical despite increased AI generation;
- increasing importance of AI mental models, calibrated trust, and graceful failure.

These are context signals, not permanent rules. Re-evaluate them weekly.
