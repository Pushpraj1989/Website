# Cultural Intelligence, Localization, and RTL

## Goal

Adapt experiences to local language, conventions, regulation, and observed context without reducing people to stereotypes.

## Market Context Profile

```yaml
market:
  country_or_region: ""
  primary_locales: []
  languages: []
  script_direction: "LTR|RTL|MIXED"
  regulatory_design_references: []
  public_design_systems: []
  date_time_conventions: ""
  number_currency_conventions: ""
  name_address_phone_conventions: ""
  first_day_of_week: ""
  week_numbering: ""
  hour_cycle: ""
  timezone_display: ""
  measurement_system: ""
  collation: ""
  local_domain_terms: []
  device_connectivity_evidence: []
  trust_identity_evidence: []
  accessibility_context: []
  competitor_patterns: []
  user_research_findings: []
  assumptions: []
```

## Evidence rules

Strong evidence:
- official locale standards/data
- current government standards
- actual target-user research
- analytics from the target market
- support/search behavior
- observed competitor conventions

Weak evidence:
- nationality stereotypes
- generic "culture color meaning" charts
- unsourced claims about preferences
- a single designer's opinion

## Locale behavior

Use locale-aware libraries/data for:
- dates
- time
- calendars where applicable
- currencies
- decimal/group separators
- plural rules
- units
- names
- sorting/collation

Prefer Unicode CLDR-derived behavior rather than manually encoded assumptions.

## Arabic / RTL rules

- Reverse spatial layout when the interaction's directional meaning follows reading direction.
- Keep paragraphs aligned to their language.
- Test mixed Arabic/English strings, IDs, account numbers, phone numbers, URLs, and codes.
- Do not reverse the order of digits within a number.
- Do not automatically mirror icons whose meaning is intrinsic rather than directional.
- Verify charts, timelines, steppers, breadcrumbs, tables, carousels, date pickers, pagination, and directional icons separately.
- Allocate for Arabic expansion/shape and font metrics; do not assume English dimensions.
- Use logical CSS properties (`start/end`) where possible.

## Regional reference examples

When applicable, research current versions rather than assuming these remain unchanged:
- UAE Design System
- Saudi Digital Government Authority accessibility/design guidance
- India GIGW
- national accessibility legislation/standards

## Localization QA

Test:
- pseudo-localization
- long strings
- mixed scripts
- RTL
- truncation
- date/currency examples
- error messages
- search behavior
- sorting
- input validation
- PDF/export/email if part of the journey

## Cultural research questions

Ask/research:
- Which language is used for the task in real life?
- Are domain terms commonly Arabic, English, bilingual, or transliterated?
- Which identity/trust signals are actually expected in this domain?
- Are users switching languages mid-workflow?
- Does the process itself differ by market, not merely the strings?
- Which assumptions require in-market testing?


## Current CLDR baseline and upgrade watch

Research pass 2026-08-28: CLDR 48.2 was released 2026-03-17 and CLDR JSON 48.2.1 on 2026-07-08 for TZDB 2026c compatibility. CLDR 49 advance warnings include planned H24 deprecation behavior and a default week-numbering change. Before any CLDR/ICU/runtime upgrade, regression-test reports, week-of-year, calendars, first day of week, hour cycle, date ranges and time zones.

Never manually construct personal display names assuming `First + Last`; use locale-aware person-name behavior when supported and collect/display names according to actual product/legal needs.

## Regional profiles

Load the applicable current profile from `regions/UAE.md`, `regions/SAUDI_ARABIA.md`, `regions/INDIA.md`, or research/create a new evidence-backed regional profile. Region rules layer on top of global accessibility/UX baselines; they do not justify stereotypes or weaken stricter requirements.
