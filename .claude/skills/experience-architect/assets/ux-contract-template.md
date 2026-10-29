# UX Contract — {{feature_or_screen}}

## 1. Context
- Product:
- User cohort:
- Job-to-be-done:
- Country/region:
- Locale/language:
- Device/context:
- Frequency/expertise:
- Risk:
- Accessibility baseline:

## 2. Assumptions
| ID | Assumption | Risk if wrong | Validation |
|---|---|---|---|

## 3. Journey
**Trigger → Preconditions → Steps → Decisions → Exceptions → Recovery → Completion**

## 4. Information hierarchy
- Page title:
- Primary information:
- Secondary information:
- Primary action:
- Secondary actions:
- Navigation/context:

## 5. Components
| Component | Design-system ref | Purpose | States | Notes |
|---|---|---|---|---|

## 6. State matrix
| State | Visible behavior | Semantic behavior | User action |
|---|---|---|---|
| Loading | | | |
| Empty | | | |
| Default | | | |
| Success | | | |
| Warning | | | |
| Error | | | |
| Offline/timeout | | | |
| Permission denied | | | |

## 7. Accessibility contract
- Landmarks/headings:
- Keyboard order:
- Focus entry/exit/restoration:
- Accessible names/descriptions:
- Status announcements:
- Form error associations:
- Contrast/non-color cues:
- Zoom/reflow:
- Reduced motion:

## 8. Responsive behavior
| Region/component | Desktop | Tablet | Mobile |
|---|---|---|---|

## 9. Localization / RTL
- Formatting:
- RTL behavior:
- Mixed-script cases:
- Expansion/truncation:

## 10. AI behavior (if applicable)
- Capability:
- Limitations:
- Evidence/explanation:
- Confidence/uncertainty:
- Human control:
- Failure/recovery:

## 11. Permissions / risk
- Roles:
- Destructive actions:
- Confirmation/undo:
- Audit:

## 12. Measurement
- Task success:
- Errors:
- Abandonment:
- Efficiency:
- Qualitative feedback:

## 13. Acceptance tests
- [ ] Critical journey works with keyboard only.
- [ ] Critical journey has usable screen-reader semantics.
- [ ] All defined states implemented.
- [ ] RTL/localization checks pass where applicable.
- [ ] Responsive behavior matches contract.
- [ ] High-risk actions have prevention/recovery.


## Authentication / identity (if applicable)
Methods, fallback, enrolment, recovery, device loss, timeout/session expiry, reauthentication, accessibility.

## Regulatory / AI disclosure (if applicable)
Jurisdiction, AI identity, synthetic-content disclosure, human escalation, other visible notices.

## Verification matrix
| Requirement | Static | Prototype | DOM/code | Keyboard | Screen reader/AT | Locale/RTL | User test |
|---|---|---|---|---|---|---|---|
