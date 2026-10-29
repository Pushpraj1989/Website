---
name: ux-qa-gatekeeper
description: Evidence-bounded UX QA and release-audit skill for scoring screens and critical journeys, verifying usability/accessibility/localization/authentication/AI/design-system behavior, assigning S1-S4 severity, and issuing DESIGN PASS, CONDITIONAL, or RELEASE PASS/FAIL only when evidence supports the claim.
compatibility: Agent Skills-compatible. Release audit requires running implementation plus keyboard/assistive-technology evidence for critical journeys.
metadata:
  version: "1.1.0"
---

# UX QA Gatekeeper

## Mandatory rule
Never confuse visual review with release certification. Use `experience-architect/references/AUDIT_PROTOCOL.md`. Missing evidence is UNKNOWN, never PASS.

## Audit sequence
Scope → evidence inventory → critical-journey coverage → task/IA/cognition → interaction/states → semantic HTML/ARIA → keyboard/focus/AT → forms → responsive/reflow → localization/RTL → authentication → AI/regulatory → domain risk → design system/code fidelity → resource efficiency → visual craft → score/evidence gate.

## Evidence levels
E0 requirements; E1 static; E2 prototype; E3 rendered+DOM/code; E4 keyboard+representative AT; E5 user evidence. Release audit requires E3 all critical journeys + E4 critical accessibility verification.

## Score
Use master 100-point weighting. Score cannot override hard stops, S1, missing critical journey coverage, or mandatory UNKNOWN evidence.

## Verdict
- DESIGN PASS: >=85 on design evidence, no design hard-stop; runtime claims explicitly unverified.
- RELEASE PASS: >=85, task/accessibility thresholds, no S1/hard-stop, complete critical-journey coverage, mandatory E3/E4 evidence.
- CONDITIONAL: remediable noncritical gaps without hard stop.
- FAIL: score <75, hard stop/S1, critical coverage gap, or missing mandatory release evidence.

## Finding
`ID | Journey | Severity | Status | Evidence class | Evidence level | Location | Problem | Impact | Recommendation | Acceptance test | Verification method`
