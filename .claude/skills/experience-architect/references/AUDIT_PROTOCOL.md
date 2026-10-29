# Full UI/UX Audit Protocol

## Purpose

Provide a repeatable, evidence-bounded audit of a digital product. A proper audit evaluates journeys, screens, implementation behavior, accessibility, localization, authentication, AI behavior, design-system consistency, domain risk, and recovery — not aesthetics alone.

## Audit certification levels

### DESIGN_REVIEW
Evidence may be E1 static designs or E2 prototypes. Can assess hierarchy, IA, content, modeled interactions, accessibility intent, responsive intent, localization intent, and design-system intent. **Cannot certify production semantics, keyboard behavior, screen-reader behavior, runtime focus, performance, or actual accessibility conformance.**

### IMPLEMENTATION_REVIEW
Requires E3 rendered implementation for reviewed journeys. Inspect DOM/native accessibility tree, code/component usage, runtime states, responsive behavior, and semantics. Accessibility behavior not manually verified with AT remains `UNKNOWN` or `PARTIAL`.

### RELEASE_AUDIT
Requires E3 for every critical journey and E4 manual keyboard + representative assistive-technology verification for critical accessibility claims. Apply regional/regulatory requirements, run critical state/recovery tests, and record exclusions. E5 user evidence strengthens confidence but is not universally required.

## Evidence levels

| Level | Evidence | Permitted claims |
|---|---|---|
| E0 | Requirements/prose | strategy risks only |
| E1 | Static screen/wireframe | design review |
| E2 | Interactive prototype | modeled-flow review |
| E3 | Running product + DOM/native tree/code | implementation review |
| E4 | E3 + manual keyboard + representative AT | critical accessibility verification |
| E5 | E4 + target-user/usability/analytics evidence | validated product evidence |

Never silently upgrade evidence. If only a screenshot is available, state what cannot be verified.

## Result states

Every audit check is one of:
- `PASS` — inspected evidence supports the requirement.
- `FAIL` — inspected evidence demonstrates a defect.
- `UNKNOWN` — required evidence was not available or test not executed.
- `NOT_APPLICABLE` — requirement genuinely does not apply, with rationale.

`UNKNOWN` is not PASS. A release decision may become CONDITIONAL or FAIL when mandatory checks are UNKNOWN.

## Step 1 — Scope

Record:
- product/release/version/build;
- audit date;
- platform/browser/OS/device targets;
- countries, jurisdictions, languages, locales, RTL/LTR;
- primary user cohorts and accessibility cohorts;
- product/domain risk;
- roles/permissions;
- critical journeys;
- known design system;
- AI/authentication capabilities;
- relevant standards/regional requirements.

## Step 2 — Evidence inventory

Inventory requirements, screenshots, prototype links, running URLs/builds, DOM/code, design-system references, accessibility tree, automated reports, telemetry, user research, and test accounts. Assign one evidence level per journey; do not assign the whole product E4 if only one flow was tested with AT.

## Step 3 — Coverage model

Audit **100% of unique critical journeys**. Sampling is allowed only for repeated templates/components after establishing their equivalence. Include representative:
- happy path;
- validation failures;
- empty/no-results;
- loading/slow/timeout/offline;
- permission/read-only/unauthorized;
- destructive/irreversible action;
- save/resume/interruption where supported;
- session expiry/reauthentication;
- localization/RTL;
- narrow viewport + reflow;
- AI failure/uncertainty when applicable.

Use WCAG-EM 2 draft ideas for systematic scope and sampling when helpful, but label it draft methodology.

## Step 4 — Task and journey audit

For each critical journey evaluate:
- discoverability/entry point;
- orientation and user mental model;
- minimum necessary steps;
- decision information available at point of action;
- consistency and continuity;
- prevention of avoidable re-entry;
- feedback latency/state visibility;
- error prevention and recovery;
- completion confirmation and next action;
- interruption/resumption.

## Step 5 — Screen/cognitive/content audit

Use `SCREEN_REVIEW.md` and `PSYCHOLOGY.md`. Review hierarchy, scanning, memory burden, choice complexity, vocabulary, action priority, progressive disclosure, form instructions, error wording, trust cues, and visual density relative to expertise/frequency.

## Step 6 — Accessibility implementation audit

Use `ACCESSIBILITY.md`. At E3/E4 inspect:
- native semantic element first;
- ARIA role/attribute legality under current ARIA in HTML;
- accessible name/description;
- role/state/value;
- landmarks/headings;
- keyboard reachability and expected widget keyboard model;
- visible focus, focus order, focus restoration;
- status/live announcements;
- labels/errors/instructions;
- tables/grids;
- zoom/reflow/text spacing;
- color independence/contrast;
- target size/drag alternatives;
- reduced motion;
- captions/audio alternatives;
- accessible authentication;
- generated/dynamic content.

Automated tooling can discover defects but **cannot replace manual keyboard, focus, screen-reader and cognitive review**.

## Step 7 — Assistive-technology verification

Select representative combinations based on supported platforms. At minimum for a web release, manually verify critical journeys with keyboard-only and at least one screen reader on a supported desktop platform; include mobile screen reader when mobile web/app is material. Add JAWS/NVDA/VoiceOver/TalkBack coverage when contractual, regulatory, platform, or audience context warrants it. Record exact OS/browser/AT versions.

## Step 8 — Responsive and resilience audit

Test supported breakpoints/devices, orientation where relevant, zoom/reflow, long strings, slow connection/loading, content expansion, touch/keyboard inputs, and state persistence. Do not merely inspect a desktop screenshot at narrower width.

## Step 9 — Localization/RTL audit

Use `CULTURAL_LOCALIZATION.md` plus applicable `regions/*.md`. Verify translation quality, bidi, names, numbers, currencies, dates, week behavior, sorting/collation, address/phone formats, truncation, local terms, layout direction, charts/timelines, PDFs/emails/exports, and product/process differences by jurisdiction.

## Step 10 — Authentication and identity audit

Use `AUTHENTICATION_UX.md`. Audit enrolment, sign-in, passkey/MFA/OTP flows, fallback, recovery, device loss, timeout, error messaging, privacy leakage, reauthentication, cancellation, and accessibility.

## Step 11 — AI UX and regulatory audit

Use `AI_UX.md` and `REGULATORY_UX.md`. Evaluate AI identity/disclosure, capability boundaries, provenance, uncertainty, human override, permission boundary, consequential actions, failure/recovery, generated-content accessibility, and applicable jurisdiction rules.

## Step 12 — Design-system and code-fidelity audit

Use `DESIGN_SYSTEM.md`. Check component reuse, token drift, undocumented variants, semantic state vs visual state, responsive/RTL contracts, accessibility metadata, production-component mapping, and whether coding/design agents invented primitives unnecessarily.

## Step 13 — Resource efficiency

Use `RESOURCE_EFFICIENCY.md`. Treat performance as UX when it affects response, loading, battery, bandwidth, accessibility, or task continuity. Do not fail a release solely on experimental sustainability guidance unless a product/regulatory requirement makes it mandatory.

## Step 14 — Trend/craft review

Only after functional gates, evaluate visual polish and current product-design trends. Label trend recommendations `MARKET_SIGNAL` or `EXPERIMENTAL`; they cannot override standards or user-task evidence.

## Step 15 — Findings and severity

Finding schema:
```text
ID:
Journey:
Location:
Severity: S1|S2|S3|S4
Status: FAIL|UNKNOWN
Evidence class: STANDARD|RESEARCH|MARKET|INFERENCE|ASSUMPTION|EXPERIMENT
Evidence level: E0|E1|E2|E3|E4|E5
Standard/reference:
Problem:
User impact:
Affected cohorts:
Recommendation:
Acceptance test:
Verification method:
Owner (if known):
```

## Step 16 — Audit verdict

Return:
1. audit level and evidence ceiling;
2. score;
3. hard stops;
4. S1/S2 counts;
5. critical-journey coverage;
6. mandatory UNKNOWN count;
7. PASS / CONDITIONAL / FAIL;
8. top remediation sequence;
9. regression plan.

A product may have an 89/100 experience score and still FAIL release if a critical screen-reader path is broken or mandatory evidence is missing.
