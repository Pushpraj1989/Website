# Accessibility Engineering and Audit Matrix

## Baseline and standards policy

- Release baseline: **WCAG 2.2 Level AA** for web-oriented products unless a stricter applicable requirement exists.
- Native semantics/ARIA: use current **ARIA in HTML** conformance rules plus WAI-ARIA Authoring Practices for widget patterns.
- Evaluation methodology: use `AUDIT_PROTOCOL.md`; WCAG-EM 2 (currently draft) may inform scope/sampling but is not represented as final normative certification.
- Forward watch: WCAG 3 (Working Draft, March 2026) is research/standards-watch only and does not replace WCAG 2.2 conformance.
- Cognitive accessibility: apply COGA guidance beyond minimum conformance.

## Principle

Accessibility spans research, content, design, code, QA, procurement/design system, authentication, generated content, and user testing. An accessible component library does not make an inaccessible journey accessible.

## Semantic HTML gate

1. Prefer a native semantic element when it expresses the interaction.
2. Do not add redundant/conflicting roles or disallowed `aria-*` attributes.
3. A role is a promise: implement its expected keyboard/state/focus behavior.
4. Accessible name must express the same operation users perceive visually.
5. Programmatically expose role, state, value, relationships, errors and status.
6. Preserve logical DOM/reading/focus order.
7. Dynamic content must remain semantically coherent after updates.
8. Automated validators are evidence, not substitutes for manual keyboard/AT testing.

## Visual + semantic dual contract

| Property | Requirement |
|---|---|
| Visible label | Clear/task-oriented; persistent when needed |
| Native/semantic role | Native first; ARIA only when justified |
| Accessible name | Correct, concise, unique enough in context |
| State/value | Programmatically exposed |
| Description | Only when needed for consequence/instructions |
| Keyboard | Full operation; expected widget convention |
| Focus | Visible, logical, not obscured; restoration defined |
| Error | Text + programmatic association + recovery |
| Status | Announced without disruptive focus where appropriate |
| Target | Meets applicable target-size/drag-alternative requirements |
| Motion | Honors reduced-motion and control needs |
| Language | Correct page/passage language where applicable |

## Manual audit matrix

### Blind / screen reader
Page title; landmarks; heading hierarchy; accessible names; link/button purpose; form labels/instructions/errors; dynamic announcements; table semantics; dialogs; focus; no visual-only critical information; generated content.

### Low vision / magnification
Zoom/reflow; clipping; focus visibility; text spacing; responsive re-prioritization; hover alternatives; contrast; transparency/material effects under accessibility settings.

### Color vision / contrast
Text and non-text contrast; color not sole signal; charts/status include shape/text/pattern or equivalent.

### Motor / keyboard / alternate input
All critical operations keyboard accessible; logical order; no traps; drag alternatives; target sizing/spacing; shortcut conflicts/remapping where necessary; visible labels that support voice targeting.

### Hearing / speech
Captions/transcripts; no critical audio-only instruction; voice never the only feasible input path.

### Cognitive / learning
Plain language; predictable navigation; point-of-need instruction; recognition over recall; consistent help; error prevention; no unnecessary redundant entry; accessible authentication; enough time; interruption recovery.

### Motion / vestibular
Reduce motion; pause/stop controls; avoid unnecessary parallax/rapid movement; never use motion as sole state indicator.

### Situational
One-handed mobile; sunlight; noisy environment; slow/unstable connection; interruption; temporary injury; privacy-constrained public use where relevant.

## Complex components

For tabs, menus, comboboxes, trees, grids, dialogs, toolbars, sliders, carousels and composite widgets, consult current APG keyboard/semantic patterns. Prefer simpler native interaction when it serves the user equally well.

## Forms

Visible labels; format at point of need; autocomplete/input purpose; semantic grouping; accessible error summary for long forms; preserve valid input; avoid redundant entry; review before high-impact submit; error prevention rather than punishment.

## Authentication

Load `AUTHENTICATION_UX.md`. Do not make biometric/passkey/OTP UX inaccessible through short timeouts, blocked paste/autofill, missing fallback, inaccessible QR/cross-device flow, or poorly announced state changes.

## Data tables and grids

Use actual tables for static tabular data; use ARIA grid only when interaction requires grid behavior. Convey headers, sorting/filtering, selection, row/column counts where needed, and provide accessible alternatives/summaries for visualizations.

## Release hard stops

Any confirmed blocker in a critical journey is FAIL, including keyboard traps, critical controls without correct semantics/names/states, focus order that prevents completion, essential visual-only information, invalid ARIA that materially misrepresents a control, inaccessible authentication, or mandatory critical accessibility evidence left UNKNOWN in a release audit.
