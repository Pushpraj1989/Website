# Screen and Flow Review Protocol

## Review order

### 1. Task fit
- What task is this screen helping complete?
- Is the next action obvious?
- Is anything present that does not support the task?

### 2. Orientation and hierarchy
- Can users identify page/object/state immediately?
- Does visual emphasis match task importance?
- Is hierarchy preserved semantically through headings/landmarks?

### 3. Information architecture
- Are concepts grouped according to user mental models?
- Are frequent/critical actions visible?
- Are labels domain-appropriate and understandable?

### 4. Cognitive load
- What must be remembered?
- Are comparisons split across views unnecessarily?
- Are choices overwhelming or poorly grouped?

### 5. Interaction
- Are affordances clear?
- Are interactive states complete?
- Does feedback arrive at the right time?
- Can users undo/recover?

### 6. Accessibility
Review against `ACCESSIBILITY.md`.

### 7. Forms
- labels
- help
- defaults
- formatting
- validation timing
- error association
- preserved input
- review before high-impact submit

### 8. Responsive/adaptive
Evaluate at minimum:
- narrow mobile
- large mobile/small tablet
- tablet
- standard desktop
- large/high-density desktop when relevant

Do not merely stack every desktop region vertically. Reprioritize for the device and task.

### 9. Localization/RTL
Review using `CULTURAL_LOCALIZATION.md`.

### 10. Domain risk
- money/legal/health/public-service consequences
- destructive actions
- permissions
- identity/trust
- auditability

### 11. Visual craft
Only after task/accessibility review:
- typography
- spacing rhythm
- alignment
- color
- contrast
- iconography
- visual grouping
- density
- polish

### 12. Design-system consistency
Check token/component reuse and undocumented deviations.

## Finding format

```text
ID: UX-###
Severity: S1|S2|S3|S4
Evidence: STANDARD|RESEARCH|MARKET|INFERENCE|ASSUMPTION
Location: screen/component/journey
Problem:
User impact:
Affected cohorts:
Recommendation:
Acceptance test:
```

## Never write vague findings

Bad: "Make the dashboard cleaner."

Good: "S2 — The page presents six equally weighted primary actions, forcing users to inspect each card before identifying the daily task. Keep one primary action in the header, move four low-frequency actions into contextual secondary controls, and validate that first-time users can identify the primary task within the usability-test success criterion."


## Evidence boundary

A static-screen review may identify visual hierarchy, wording, likely IA/cognitive risks, contrast candidates, modeled component issues, and accessibility intent. It cannot verify runtime semantics, keyboard navigation, screen-reader output, focus behavior, announcements, responsive implementation, or actual ARIA correctness. Label those `UNKNOWN` unless E3/E4 evidence is inspected. For formal audits, use `AUDIT_PROTOCOL.md`.
