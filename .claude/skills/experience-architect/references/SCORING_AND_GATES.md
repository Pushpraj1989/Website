# UX Scoring Engine and Evidence-Bounded PASS/FAIL Gates

## Weighted experience score

| Dimension | Weight |
|---|---:|
| Task success | 15 |
| Accessibility | 15 |
| Usability | 10 |
| Cognitive clarity | 10 |
| Information architecture | 8 |
| Interaction quality | 8 |
| Error prevention/recovery | 7 |
| Cultural/local relevance | 6 |
| Visual hierarchy/craft | 6 |
| Content clarity | 5 |
| Responsive/adaptive UX | 4 |
| Design-system consistency | 3 |
| Trust/ethical design | 3 |
| Total | 100 |

Authentication, AI regulatory transparency, resource efficiency and semantic conformance are audited as cross-cutting requirements/hard gates rather than rewarded as extra aesthetic points.

## Rating

0 absent/broken; 1 severe; 2 major; 3 acceptable with material improvement; 4 strong; 5 excellent/evidence-backed. Weighted points = `weight × rating / 5`. Do not assign 5 without direct evidence.

## Evidence gate

Report:
- `audit_level`: DESIGN_REVIEW | IMPLEMENTATION_REVIEW | RELEASE_AUDIT
- `evidence_level`: E0..E5 per journey
- `critical_journey_coverage_percent`
- `mandatory_unknowns`
- `excluded_scope` with rationale

A score without these fields is incomplete for formal audit work.

### Evidence ceilings
- E0/E1: cannot issue implementation/release PASS.
- E2: may issue design/prototype PASS only.
- E3: implementation PASS possible; critical accessibility claims remain limited unless manually verified.
- E4: release accessibility verification possible for tested critical journeys.
- E5: adds validated user evidence/confidence.

## Verdict

### Design review
`PASS`: >=85, task >=12/15, accessibility intent >=12/15, no design hard-stop/S1. State clearly that runtime accessibility is unverified.

### Release audit
`PASS`: >=85, task >=12/15, accessibility >=12/15, no hard-stop/S1, 100% unique critical-journey coverage, E3 implementation evidence for all critical journeys, E4 evidence for critical accessibility verification, and zero mandatory UNKNOWN items.

`CONDITIONAL`: 75–84 without hard-stop, or >=85 with explicit noncritical evidence gaps/remediation that do not invalidate critical journeys.

`FAIL`: <75, any hard-stop, any S1, incomplete critical-journey coverage, or mandatory release evidence missing for a critical requirement.

## Hard stops

- critical keyboard/screen-reader journey unusable;
- critical action lacks correct discernible semantics/name/state;
- invalid native/ARIA semantics materially misrepresents a critical control;
- essential information only through color/sound/position;
- critical focus trap/order/restoration failure;
- inaccessible authentication/recovery with no usable alternative;
- high-impact irreversible action without proportionate prevention/control;
- legally applicable AI disclosure knowingly omitted;
- irreversible AI action without appropriate human control;
- critical error with no recovery;
- supported-locale RTL/bidi defect changes meaning or blocks task;
- deceptive pattern interferes with informed choice;
- known applicable required regional/accessibility standard violation;
- attempt to certify release from static-design evidence.

## Confidence

High = directly inspected appropriate evidence; Medium = partial or sampled evidence; Low = inference/missing runtime evidence. High score + low confidence is never release certification.
