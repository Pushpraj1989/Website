# AI Experience Governance

## Principle

AI UX must help users build an accurate mental model of capability, uncertainty, control, and failure. Do not optimize for the illusion of intelligence.

## AI use-case test

Before adding AI, answer:
- What user problem becomes meaningfully easier?
- Why is AI better than deterministic logic/search/filtering?
- What errors can the model make?
- What happens when it is wrong?
- Who is accountable for the final action?

If the AI adds novelty but not meaningful value, recommend the simpler approach.

## AI output contract

Where relevant, show:
- result/recommendation
- confidence or uncertainty only if calibrated and actionable
- evidence/source/provenance
- important missing evidence
- rationale at the level users need to decide
- model limitation or boundary
- accept/edit/reject/override
- feedback/report issue
- human escalation

Do not display fabricated precision such as a confidence percentage unless it represents a meaningful calibrated model output.

## Automation ladder

Classify AI capability:
1. Inform — surfaces information
2. Suggest — proposes action
3. Draft — prepares editable output
4. Assist — executes reversible scoped actions
5. Act — executes consequential actions

Control requirements increase with autonomy and consequence.

For consequential actions:
- preview what will happen
- identify affected objects/users
- ask proportionate confirmation
- provide rollback/undo when feasible
- create audit trail

## Trust calibration

Communicate capabilities and limits early enough to influence behavior.
Avoid:
- pretending the model is human
- claiming certainty it does not have
- hiding important model limitations
- implying an AI recommendation is a policy/official decision when it is not

## AI errors

Design for:
- wrong answer
- incomplete answer
- hallucinated source
- low confidence
- stale data
- unavailable tool/data source
- conflicting evidence
- refusal/unsupported request
- timeout
- model unavailable

Each state needs a useful next action.

## Human override

High-impact AI recommendations need an explicit human decision boundary unless the product's validated governance permits automation.
Store override rationale when auditability is required.

## Agentic UX

For tool-using agents expose:
- objective
- plan or action summary when useful
- permission boundary
- tools/data being accessed where material
- progress/state
- action preview for sensitive operations
- cancellation/stop
- final result
- exceptions and unresolved items

Do not drown users in chain-of-thought. Provide concise, useful action rationale and evidence instead.


## AI identity and regulatory disclosure

Always distinguish AI from human service when ambiguity could cause users to overestimate agency or accountability. For jurisdiction-dependent legal requirements, load `REGULATORY_UX.md`. EU Article 50 transparency obligations apply from 2 August 2026 to certain systems/content; verify scope before stating legal compliance.

## Generated-interface accessibility

When AI generates or rearranges UI/content, test the resulting artifact — not only the shell. Verify generated headings/landmarks, accessible names, reading order, status streaming, charts, images/alt text, focus, correction/override and regeneration. A model may generate invalid semantics even when the base component library is accessible.
