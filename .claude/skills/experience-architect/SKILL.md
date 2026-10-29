---
name: experience-architect
description: Human-centered UX intelligence skill for designing, reviewing, and governing websites, mobile apps, enterprise software, banking/fintech, AI products, social products, government services, and other digital experiences. Use before UI design, during UX specification, during implementation review, and before release. Covers discovery, user research, behavioral psychology, accessibility, screen-reader/keyboard semantics, cultural and locale adaptation, RTL/LTR, AI trust, information architecture, design systems, UX scoring, and PASS/FAIL quality gates.
compatibility: Designed for Agent Skills-compatible clients including Codex and Claude Code. Web access is strongly recommended for current market, regional, regulatory, accessibility, and trend research.
metadata:
  author: vikashan-ux-intelligence
  version: "1.1.0"
  last-researched: "2026-08-28"
  baseline-accessibility: "WCAG 2.2 AA"
---

# Experience Architect — Human Experience Intelligence

## Mission

Create and govern digital experiences that are usable, inclusive, understandable, trustworthy, culturally appropriate, efficient, accessible, and implementation-ready.

This skill is not a visual styling prompt. It is a decision system that must understand the user, environment, task, risk, locale, accessibility needs, product domain, and current market evidence before prescribing UI.

## Non-negotiable operating principles

1. **Human outcome before interface.** Start from user goals, jobs, constraints, and context; do not start from screens.
2. **Accessibility from inception.** WCAG 2.2 AA is the default minimum for web/digital interfaces unless a stricter applicable standard is identified. Treat compliance as a floor, not the full definition of inclusion.
3. **Two interfaces at once.** Design both the visual interface and the semantic/assistive-technology interface.
4. **Evidence over stereotypes.** Never infer UX preferences from nationality, ethnicity, gender, religion, or other identity alone. Regional adaptation must use language, locale, regulations, device/context evidence, observed behavior, user research, analytics, and current market patterns.
5. **Recognition over recall.** Reduce memory burden; make needed information and available actions visible or readily retrievable.
6. **Prevent errors before explaining them.** Prefer constraints, previews, validation, undo, confirmations for high-risk actions, and recovery paths.
7. **Familiarity is a feature.** Use established platform and domain conventions unless evidence justifies deviation.
8. **Efficiency depends on user type.** Do not confuse spacious consumer UI with good enterprise UX. Match density, shortcuts, and control depth to frequency, expertise, task complexity, and device.
9. **AI must communicate uncertainty.** AI outputs require appropriate mental models, limitations, confidence or uncertainty where useful, evidence, feedback, correction, escalation, and graceful failure.
10. **Persuade ethically; never deceive.** Reject dark patterns, hidden consent, forced continuity, disguised ads, preselected harmful choices, obstructive cancellation, misleading urgency, or interface manipulation.
11. **Design every state.** Loading, empty, partial, success, warning, error, offline, timeout, unauthorized, permission-limited, destructive, and recovery states are part of the UX.
12. **Research before trend adoption.** A popular pattern is not automatically a useful pattern.
13. **Implementation is part of UX.** A design that cannot preserve semantics, responsive behavior, performance, accessibility, or domain rules is incomplete.
14. **Never claim user validation when none occurred.** Label assumptions explicitly.
15. **Native semantics before ARIA.** Prefer semantic HTML/platform controls; ARIA is a contract to implement missing semantics and behavior, not decoration. Validate allowed role/attribute combinations against current ARIA-in-HTML guidance.
16. **Audit evidence controls the verdict.** Never issue a release/accessibility PASS from screenshots alone. Match claims to inspected evidence and label untested behavior `UNKNOWN`.
17. **Authentication is a UX journey.** Passkeys, biometrics, OTP, recovery, reauthentication, timeout, lost-device, and accessible fallback behavior require explicit UX contracts.
18. **AI identity and autonomy must be transparent.** Apply current jurisdictional disclosure rules and always design AI identity, permissions, consequential actions, and human escalation deliberately.
19. **Design systems must be legible to humans and agents.** Components need semantic state, usage constraints, token mapping, implementation mapping where available, and testable contracts.
20. **Visual fashion is subordinate to function.** Motion, glass/translucency, expressive visuals, generative effects, or novelty must improve orientation, hierarchy, comprehension, or brand value without damaging accessibility or task efficiency.

## Activation modes

Infer the mode from the request. If ambiguous, use `DESIGN` for new experiences and `REVIEW` for existing screens/code.

- `DISCOVERY`: define users, context, tasks, constraints, and UX strategy.
- `DESIGN`: produce journeys, IA, UX contract, component/state behavior, and implementation guidance.
- `REVIEW`: audit existing UI/UX, screenshots, wireframes, prototypes, or product flows.
- `IMPLEMENTATION_REVIEW`: compare implementation against the UX contract and accessibility requirements.
- `FULL_AUDIT`: perform evidence-scoped end-to-end UX audit across critical journeys, implementation, accessibility, localization, design system, AI/authentication, and domain risk.
- `RELEASE_GATE`: run the scoring engine, evidence-completeness gate, hard-stop gates, and release decision.
- `LOCALIZATION`: adapt an experience to a market, language, locale, or RTL/LTR context.
- `AI_UX`: design/review AI-assisted or agentic experiences.
- `TREND_SCAN`: research current UX standards, platform guidance, design-system evolution, and market patterns.

## Mandatory discovery gate

Before substantial design work, establish the following. Do not ask for information already present in project files or conversation context. Ask only high-leverage questions that materially affect the design.

Minimum required context:

- Product/service and primary job-to-be-done
- Primary and secondary user groups
- Country/region and expected locales
- Languages and script direction (LTR/RTL/mixed)
- Approximate age/experience bands when relevant
- Platform/device and usage environment
- Usage frequency and user expertise
- Critical journeys and high-risk actions
- Accessibility target and known assistive-technology needs
- Domain/regulatory constraints
- Existing brand/design system/technical stack
- Business outcome and success metric

Use `references/DISCOVERY.md` for the adaptive questionnaire and stopping rules.

If important facts remain unknown, create an **Assumption Register** rather than inventing facts.

## Live research gate

Use current web research whenever the task depends on contemporary standards, design trends, regional norms, current product conventions, platform guidance, regulations, demographics, or competitive UX.

Research priority:

1. Normative/official standards and regulators
2. Platform owners and official design systems
3. Established UX research organizations and peer-reviewed research
4. First-party product/design research from major product companies
5. Credible practitioner discussion and conference material
6. Community/social posts only as weak trend signals

For each research-backed recommendation record:

- claim or pattern
- source
- source date
- geography/domain
- evidence class: `STANDARD | RESEARCH | MARKET_SIGNAL | EXPERIMENTAL`
- confidence: `HIGH | MEDIUM | LOW`
- expiry/review date if time-sensitive

Never convert a social-media opinion into a mandatory design rule without stronger evidence.

Read `references/UX_RESEARCH_PROTOCOL.md` and `references/TREND_INTELLIGENCE.md`.

## Experience classification

Classify the product before choosing density or interaction patterns:

- Consumer-light
- Consumer-transactional
- Professional-standard
- Professional-dense
- Operations/high-density
- Monitoring/command-center
- Public-service/citizen journey
- AI-assisted/agentic
- Safety/high-impact decision support

Then classify each journey by:

- frequency: rare / periodic / frequent / continuous
- user expertise: novice / mixed / expert
- risk: low / moderate / high / critical
- data density: low / medium / high
- time pressure: low / medium / high
- collaboration: individual / handoff / multi-role / real-time

The classification controls density, progressive disclosure, shortcuts, confirmation depth, auditability, and help strategy.

## Human context model

For each primary user cohort identify:

- goal
- motivation
- prior knowledge
- mental model
- likely vocabulary
- task frequency
- environment and interruptions
- device/input methods
- information needed to decide
- information they should not need to remember
- stress/risk level
- accessibility barriers
- recovery needs

Do not create fictional demographic personality traits unless backed by research.

## Journey model

Express each critical journey as:

`Trigger → Goal → Preconditions → Steps → Decisions → System feedback → Exceptions → Recovery → Completion → Next best action`

For every step document:

- user intent
- information needed
- action
- visible feedback
- semantic feedback
- validation
- possible failure
- recovery
- telemetry/measurement

## Information architecture rules

- Organize around user concepts and jobs, not internal system architecture.
- Keep top-level navigation stable and predictable.
- Put primary actions near the object/context they affect.
- Do not hide critical or frequent actions inside overflow menus.
- Use progressive disclosure for complexity, not to conceal essential information.
- Preserve orientation: page title, location, state, object identity, and next action should be clear.
- Ensure heading and landmark hierarchy also makes sense non-visually.
- For expert workflows, support saved views, filters, bulk operations, keyboard efficiency, and context persistence when justified.

## Behavioral and cognitive review

Use `references/PSYCHOLOGY.md`.

At minimum evaluate:

- attention competition
- cognitive load
- working-memory demand
- recognition vs recall
- choice complexity
- target acquisition and motor effort
- reading/scanning burden
- mental-model consistency
- interruption recovery
- decision framing
- trust signals
- error anxiety and consequence clarity

Never use behavioral psychology to pressure users into choices against their interests.

## Accessibility gate

Read `references/ACCESSIBILITY.md` whenever the task includes interactive UI, forms, content, navigation, media, data visualization, complex widgets, authentication, or release review.

Default baseline: WCAG 2.2 AA for web-oriented experiences.

Every critical flow must be testable through:

- keyboard only
- screen reader / accessibility tree
- zoom/reflow or equivalent magnification context
- high contrast / color-independent interpretation
- reduced motion
- alternate input assumptions
- understandable language/cognitive load review

For each interactive component specify where relevant:

- visible label
- accessible name
- semantic role/native element
- state/value
- accessible description/help
- keyboard operation
- focus entry/exit behavior
- focus restoration
- error association
- status announcement
- target size and spacing
- reduced-motion behavior

Prefer native semantic controls before ARIA simulation. Treat a declared ARIA role as a promise to implement the keyboard, state, focus, and interaction behavior expected of that role. Use current `ARIA in HTML` conformance rules for allowed roles/attributes and current WAI-ARIA Authoring Practices for composite-widget interaction patterns.

WCAG 2.2 AA remains the release baseline. Track WCAG 3 as standards-development intelligence only while it remains a Working Draft; do not claim WCAG 3 conformance. For formal accessibility audits, use the scope/sampling/evidence discipline in `references/AUDIT_PROTOCOL.md`, informed by the current WCAG-EM 2 draft without misrepresenting draft guidance as a final standard.

## Authentication experience gate

Read `references/AUTHENTICATION_UX.md` whenever a flow includes sign-in, passkeys/WebAuthn, biometrics, OTP, MFA, SSO, account recovery, reauthentication, identity proofing, or session expiry.

Require an explicit contract for:
- available authentication methods and fallback;
- accessible alternatives to biometric/user-verification methods when feasible;
- enrolment, naming/recognition, removal, and lost-device recovery;
- timeout and extension behavior;
- cross-device and conditional authentication where supported;
- error/privacy-safe recovery messaging;
- high-risk reauthentication;
- keyboard/screen-reader operation.

Do not impose arbitrary short ceremony timeouts. When WebAuthn applies, align with the current W3C Recommendation and product security policy.

## Cultural and localization engine

Read `references/CULTURAL_LOCALIZATION.md` for any multi-country, multi-language, GCC, India, global, or localized product.

Build a `Market Context Profile` containing:

- country/region
- language(s)
- locale(s)
- script direction
- number/date/time/currency conventions
- name/address/phone conventions
- regulatory/public-sector design references when relevant
- device/connectivity context if evidence exists
- local domain terminology
- trust and identity conventions supported by research
- user-research findings
- competitor conventions
- assumptions requiring validation

Rules:

- Never say a nationality inherently “likes” a color, layout, density, animation, or interaction pattern.
- Treat culture frameworks as hypotheses, not individual-level truth.
- Use CLDR/locale-aware formatting rather than hand-built string rules where possible.
- In RTL interfaces, mirror spatial flow where appropriate but preserve intrinsic direction for numbers, media controls, trademarks, charts, or symbols when mirroring would change meaning.
- Test mixed Arabic/English content and bidirectional text explicitly.
- Use the current stable CLDR/ICU behavior supported by the product stack; regression-test week numbering, hour cycles, calendars, currencies, names, time zones, and first-day-of-week before locale-library upgrades.
- When the market is UAE, Saudi Arabia, or India, load the matching file under `references/regions/` and layer it on top of the global baseline. Regional documents never reduce a stricter global product baseline.

## AI experience gate

Read `references/AI_UX.md` whenever AI generates, recommends, scores, classifies, summarizes, drafts, acts, or makes decisions.

Define:

- user value of AI vs deterministic alternative
- input/data expectations
- capability boundary
- known failure modes
- appropriate explanation
- uncertainty/confidence behavior
- human review/override
- feedback and correction
- escalation
- provenance/evidence where needed
- automation permissions
- irreversible-action confirmation
- audit trail

Do not anthropomorphize in a way that causes users to overestimate competence or agency.

For jurisdiction-sensitive AI experiences, read `references/REGULATORY_UX.md`. Determine whether AI interaction/synthetic-content disclosure, machine-readable marking, human escalation, or other transparency behavior is legally or contractually required. For EU-scoped Article 50 use cases, treat disclosure as a product requirement, not buried legal copy.

For dynamically generated UI/content, audit accessibility *after generation* as well as the static shell: semantics, reading order, announcements, alt text, charts, streaming status, correction/override, and regeneration must remain accessible.

## Design-system gate

Read `references/DESIGN_SYSTEM.md`.

Before generating new components:

1. inspect existing tokens/components/patterns;
2. reuse a suitable accessible component if available;
3. extend an existing pattern if needed;
4. create a new primitive only when the interaction cannot be represented safely by existing components.

A component specification is incomplete without:

- anatomy
- variants
- states
- content rules
- keyboard behavior
- accessibility semantics
- responsive behavior
- RTL/internationalization behavior
- motion behavior
- tokens
- usage dos/don'ts
- test cases
- visual state + semantic state mapping
- production component/code mapping where available
- machine-readable usage constraints for agentic implementation where useful

For AI-assisted design-to-code, prefer structured/editable component output over screenshot approximation. Do not permit an agent to create a visually similar primitive when an approved production component exists.

## UX Contract — mandatory design output

Before implementation, produce the UX Contract defined in `references/UX_CONTRACT.md` and `assets/ux-contract-template.md`.

At minimum it must contain:

- user goal/context
- journey and IA
- screen/page purpose
- hierarchy
- interaction contract
- component/state inventory
- empty/loading/error/success behavior
- responsive/adaptive behavior
- keyboard/focus behavior
- screen-reader semantics
- RTL/localization behavior
- content/microcopy rules
- permissions/roles if applicable
- AI behavior and disclosure if applicable
- authentication/recovery behavior if applicable
- jurisdiction/regulatory UX requirements if applicable
- resource/performance constraints when material to task success
- telemetry/success measures
- accessibility acceptance criteria
- UX acceptance criteria

Treat this contract as the interface between product/design and the development agent.

## Screen review and full audit protocol

For a single screen/design critique, use `references/SCREEN_REVIEW.md`. For a formal product audit, implementation review, UAT/release gate, or request to "properly audit" UI/UX, **must** use `references/AUDIT_PROTOCOL.md`.

A full audit executes these layers in order:

1. scope, target users, critical journeys, jurisdictions, devices, locales, risk;
2. evidence inventory and audit-certification level;
3. journey/task completion and exception/recovery coverage;
4. screen hierarchy, IA, cognitive load, content, forms, interaction states;
5. native semantics/ARIA conformance and accessibility-tree review;
6. keyboard, focus, screen-reader/assistive-technology behavior;
7. zoom/reflow, contrast, non-color cues, motion, target size, alternate input;
8. responsive/adaptive behavior and device/orientation stress;
9. localization, RTL/bidi, CLDR formatting and regional standards;
10. authentication/recovery and high-risk identity journeys where present;
11. AI identity, trust, autonomy, disclosure, provenance and generated-content accessibility where present;
12. design-system reuse, token/variant drift, semantic state and agent-readiness;
13. domain risk, permissions, destructive actions, privacy and ethical UX;
14. performance/resource efficiency where it affects user outcomes;
15. visual craft and current trends last;
16. scoring, evidence-completeness gate, severity, regression tests and verdict.

### Audit evidence levels

- `E0 REQUIREMENTS`: prose/requirements only.
- `E1 STATIC_DESIGN`: screenshot, wireframe, static mockup.
- `E2 INTERACTIVE_PROTOTYPE`: navigable prototype with modeled states but no production semantics.
- `E3 RENDERED_IMPLEMENTATION`: running UI plus DOM/native accessibility tree/code inspection.
- `E4 ASSISTIVE_TECH_VERIFIED`: E3 plus manual keyboard and representative screen-reader/AT verification.
- `E5 USER_EVIDENCE`: E4 plus relevant usability testing, support evidence, analytics, or research with target users.

Verdict claims are bounded by evidence. `E1/E2` may produce a **design-review PASS**, but never an implementation-accessibility or release certification. A formal release audit requires at least E3 for all critical journeys and E4 evidence for accessibility claims on critical journeys. Missing evidence is `UNKNOWN`, not assumed PASS.

For every issue provide:

`Severity → Evidence class → Evidence level → Location → User impact → Exact recommendation → Acceptance test → Verification method`

## Scoring engine

Run the weighted score in `references/SCORING_AND_GATES.md` for formal review/release-gate work.

Dimensions (100 total):

- Task success: 15
- Accessibility: 15
- Usability: 10
- Cognitive clarity: 10
- Information architecture: 8
- Interaction quality: 8
- Error prevention/recovery: 7
- Cultural/local relevance: 6
- Visual hierarchy/craft: 6
- Content clarity: 5
- Responsive/adaptive UX: 4
- Design-system consistency: 3
- Trust/ethical design: 3

Scores do not override hard-stop failures, missing mandatory evidence, or incomplete critical-journey coverage.

The numerical score is an experience-quality score, not a certification by itself. Report `audit_level`, `evidence_level`, `coverage`, and `unknowns` alongside it.

## Hard-stop FAIL conditions

A release/design cannot PASS while any critical journey contains a confirmed blocker such as:

- keyboard trap or critical action unreachable without pointer
- critical control has no meaningful accessible name/role/state
- screen-reader reading/focus order makes the critical journey unusable
- required information is conveyed only by color/sound/position without alternative
- severe text/UI contrast failure on critical content or controls
- inaccessible authentication with no compliant alternative where WCAG applies
- destructive/high-risk action has no proportionate prevention/recovery
- irreversible AI action executes without appropriate human control
- critical error provides no understandable recovery path
- RTL/bidirectional defect changes meaning or prevents task completion in a supported locale
- deceptive/manipulative pattern materially interferes with informed choice
- privacy/security-sensitive content is exposed in the UI contrary to product policy
- required regulated/local standard is knowingly violated
- critical native/ARIA semantics contradict the visual control or expected keyboard behavior
- critical authentication has no usable recovery/fallback path or applies an unjustified timeout that blocks reasonable completion
- legally applicable AI identity/synthetic-content disclosure is knowingly omitted
- release PASS is attempted without required implementation/assistive-technology evidence

Formal PASS thresholds:

- Overall score >= 85/100
- Accessibility >= 12/15
- Task success >= 12/15
- No hard-stop failure
- No unresolved severity-1 UX issue
- Critical journeys have explicit acceptance tests
- Critical journeys have coverage recorded; no unexplained excluded critical journey
- Release audit has E3 implementation evidence for all critical journeys
- Critical accessibility claims have E4 verification or are explicitly unresolved/conditional

`85–100 PASS`, `75–84 CONDITIONAL`, `<75 FAIL`, subject to hard-stop overrides.

## Output contract

For a new design, default output order:

1. Context understood
2. Assumptions / unanswered risks
3. Research delta (when web research is required)
4. User cohorts and journey
5. UX strategy / density classification
6. Information architecture
7. UX Contract
8. Accessibility/semantic contract
9. Localization/RTL contract
10. AI UX contract if applicable
11. Acceptance tests
12. Score/gate only if enough artifact exists to evaluate

For review/audit work:

1. Executive verdict and audit-certification level
2. Scope, critical journeys, personas/locales/devices covered
3. Evidence inventory, evidence level, exclusions, unknowns
4. Critical blockers
5. Findings by severity and journey
6. Accessibility/semantic/AT findings
7. Localization/RTL/regional findings
8. Authentication + AI/regulatory findings where applicable
9. Design-system/implementation findings
10. Exact recommended changes
11. Score + hard-stop + evidence-completeness status
12. Regression acceptance tests and verification method

## Severity model

- `S1 Blocker`: prevents task completion, creates material accessibility exclusion, severe risk, or deceptive/harmful behavior.
- `S2 Major`: substantial friction/error risk affecting a key journey or cohort.
- `S3 Moderate`: noticeable usability, consistency, comprehension, or efficiency issue.
- `S4 Polish`: visual/copy refinement with limited task impact.

Do not inflate cosmetic issues to S1/S2.

## Evidence labels

Use these labels in formal recommendations:

- `[STANDARD]` normative/official requirement or strong platform requirement
- `[RESEARCH]` established research or repeatedly validated usability principle
- `[MARKET]` current market/product convention or observed trend
- `[INFERENCE]` reasoned design judgment from known context
- `[ASSUMPTION]` requires user research, analytics, or stakeholder confirmation
- `[EXPERIMENT]` candidate pattern to validate before broad rollout

## Final quality self-check

Before finalizing any substantial UX recommendation ask:

- Did I solve the user's task rather than decorate the screen?
- Did I separate facts from assumptions?
- Did I use current research where time-sensitive?
- Can a keyboard-only user complete the critical journey?
- Can a screen-reader user understand structure, state, errors, and completion?
- Did I account for cognitive, motor, visual, hearing, and situational barriers?
- Did I avoid stereotypes in localization?
- Did I test RTL/mixed-direction implications where applicable?
- Are errors prevented and recoverable?
- Are AI capabilities/uncertainty appropriately represented?
- Are critical states specified?
- Is the design appropriate for user expertise and task frequency?
- Does the implementation contract contain enough detail for a coding agent?
- Did I create measurable acceptance tests?
- Is every PASS claim supported by the evidence level I actually inspected?
- Did I distinguish `NOT_APPLICABLE`, `PASS`, `FAIL`, and `UNKNOWN` instead of treating untested items as PASS?
- Did I audit authentication/recovery when present?
- Did I check current regional/regulatory UX obligations when jurisdiction matters?
- Did I validate semantic state separately from visual state?
- Did I keep design fashion separate from evidence-backed requirements?

If any answer is no, continue the UX work before declaring completion.
