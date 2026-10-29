# UX Research and Evidence Protocol

## Evidence hierarchy

### Tier 1 — normative / official
Examples: W3C/WAI, regulators, government digital-service standards, Apple HIG, Android/Material platform guidance, Unicode CLDR.
Use for requirements, platform conventions, locale behavior, and accessibility baselines.

### Tier 2 — established research
Examples: peer-reviewed HCI research, Nielsen Norman Group research, recognized accessibility research, academic literature.
Use for cognitive, behavioral, usability, and interaction principles.

### Tier 3 — first-party product/design research
Examples: Figma, Adobe Spectrum, Microsoft Inclusive Design, Google PAIR.
Use for design-system practice, inclusive design methods, AI UX, and product-development patterns.

### Tier 4 — market evidence
Current high-adoption products, app-store patterns, competitor behavior, current public design systems.
Use to understand expectations and competitive conventions, not to prove usability.

### Tier 5 — practitioner/community signal
LinkedIn posts, conference talks, community essays, design galleries.
Use only to identify emerging ideas to investigate.

## Research query matrix

When current research is required, search across:
- accessibility standard updates
- platform HIG/design-system updates
- locale/CLDR updates
- country/regional digital design guidance
- domain-specific product patterns
- direct competitors
- leading adjacent products
- current AI interaction research when AI is present
- usability/accessibility practitioner discussions

## Evidence record

For every material external finding record:

```yaml
finding: ""
source_title: ""
source_url: ""
source_owner: ""
published_or_updated: ""
retrieved: ""
region: "global"
domain: "general"
evidence_class: "STANDARD|RESEARCH|MARKET_SIGNAL|EXPERIMENTAL"
confidence: "HIGH|MEDIUM|LOW"
implication: ""
requires_validation: true
```

## User research rule

Desk research cannot replace observing actual target users.

Where stakes justify it, recommend:
- contextual inquiry
- interviews for goals/past experience
- usability testing for observed behavior
- diary studies for longitudinal use
- analytics/funnel analysis for behavior at scale
- accessibility testing with disabled participants
- localization testing with native-language users

## Anti-confirmation-bias rule

Search for evidence that could disprove the proposed design, not only evidence that supports it.

## Trend adoption test

Before adopting a trend answer:
1. What user problem does it solve?
2. Which cohort benefits?
3. What new accessibility/cognitive cost appears?
4. Is it a stable convention or novelty?
5. Does it improve task success, efficiency, comprehension, or trust?
6. Can it be A/B or usability tested safely?

If there is no meaningful user benefit, treat it as visual experimentation rather than UX improvement.
