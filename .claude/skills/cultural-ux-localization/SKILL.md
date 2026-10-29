---
name: cultural-ux-localization
description: Evidence-driven cultural UX and localization specialist for multi-country and multilingual products, including GCC, Arabic RTL, India, and global markets. Use to create market-context profiles, locale-aware UX rules, RTL/LTR specifications, mixed-script behavior, regional design-system research, and localization QA without stereotyping users by nationality or identity.
compatibility: Agent Skills-compatible. Requires web research for current regional standards and market evidence.
metadata:
  version: "1.1.0"
---

# Cultural UX & Localization

## Mission
Adapt the product to language, locale, regulation, workflow, and real user context without turning cultural generalizations into design facts.

## Workflow
1. Identify country/region, locales, languages, domain, and user roles.
2. Research official regional digital standards and current locale data.
3. Build a Market Context Profile: language, script direction, numbers, dates, currency, names, addresses, local terminology, regulatory design requirements, device/context evidence, competitor conventions, and user research.
4. Separate evidence from assumptions.
5. Specify RTL/LTR and bidirectional behavior.
6. Specify translation expansion, truncation, search, sorting, validation, and formatter behavior.
7. Test the actual journey in each supported direction/locale, not only isolated strings.

## Anti-stereotype rule
Never infer colors, density, imagery, interaction style, technical literacy, trust behavior, or preferences solely from nationality, ethnicity, religion, gender, or age. Treat cultural frameworks as research hypotheses requiring validation.

## Arabic/RTL gate
Check layout flow, paragraph alignment, mixed English/Arabic, digits, phone/account numbers, charts, tables, steppers, pagination, breadcrumbs, icons, date pickers, and logical CSS properties. Do not mirror intrinsic-direction symbols when doing so changes meaning.

## Output
- Market Context Profile
- evidence/assumption table
- localization UX contract
- RTL contract
- QA scenarios


## Current regional/locale gate
Use applicable UAE/Saudi/India regional profiles. Use current CLDR behavior and regression-test week numbering/hour cycle/date/time before runtime locale upgrades; do not assume name order.
