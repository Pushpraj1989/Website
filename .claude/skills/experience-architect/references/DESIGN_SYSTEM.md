# Design System Governance

## Purpose

Make quality repeatable. A design system is not only colors and components; it carries interaction, accessibility, localization, content, and engineering intent.

## Component decision order

1. Reuse an existing compliant component.
2. Compose existing primitives.
3. Extend an existing component with a documented variant.
4. Create a new component only when the use case cannot be served safely otherwise.

## Required component contract

Every production component should define:
- purpose
- anatomy
- variants
- sizes/density
- states
- interaction behavior
- focus behavior
- keyboard interactions
- accessibility semantics
- validation/error behavior
- content rules
- responsive behavior
- internationalization/RTL
- reduced-motion behavior
- tokens
- usage guidelines
- anti-patterns
- test cases
- version/change notes

## Tokens

Use semantic tokens rather than raw visual values where possible:
- color roles
- typography roles
- spacing
- sizing
- radius
- border
- elevation
- motion
- focus
- density

Support modes such as brand, dark/light, high contrast, density, and locale only where architecturally justified.

## Accessibility baked into components

A component can help enforce:
- focus styles
- semantic roles
- label association
- target size
- contrast
- disabled/read-only distinction
- error semantics
- keyboard conventions

But an accessible component library does **not** guarantee an accessible product. Context, composition, content, reading order, workflow, and implementation still require review.

## AI-era design-system rule

When coding agents consume a design system, provide machine-readable or concise textual guidance for:
- when to use the component
- when not to use it
- props/variants
- content constraints
- semantics
- accessibility requirements
- responsive behavior

Do not allow agents to invent new visual primitives merely to approximate a screenshot when approved components exist.

## Density system

Support deliberate density tiers for enterprise products:
- comfortable
- standard
- compact

Never achieve density by shrinking touch/click targets below requirements or by eliminating necessary labels/feedback.


## Visual state + semantic state contract

Every interactive production component must map visual state to semantic/runtime state. Example concerns: loading may visually show a spinner but also needs correct disabled/busy/status behavior; an expanded disclosure needs both visual treatment and programmatic state; error needs visible copy plus programmatic association.

For each component define:
```yaml
component: ""
production_component: ""
visual_states: []
semantic:
  native_element: ""
  role_if_needed: ""
  accessible_name_source: ""
  state_mapping: {}
keyboard: []
focus: {}
announcements: {}
tokens: {}
responsive: {}
rtl: {}
usage_constraints: []
anti_patterns: []
tests: []
```

## Agent readiness

Assess whether AI/coding agents can consume the design system without inventing lookalike primitives:
- meaningful component/pattern names;
- variants/properties encode intent;
- semantic tokens;
- higher-order reusable patterns where valuable;
- component descriptions and usage constraints;
- production code mapping (e.g. registry/Code Connect/MCP equivalent) when available;
- accessibility metadata;
- responsive/RTL rules;
- anti-patterns/deprecations.

This is a growing product-engineering practice, not a universal normative accessibility standard. Pilot it where agentic design-to-code is used.

## Structured-generation rule

Prefer structured/editable output preserving component identity, constraints, tokens, semantics, variants and states. A flat screenshot/mock image is insufficient as a production handoff when structured design/code context exists.


## Material and visual-effect gate

Treat glass/translucency/blur/shader/rich-motion effects as functional materials, not default decoration. Before adoption verify that the effect:
1. communicates hierarchy, navigation, focus, transition, temporariness, or brand value;
2. preserves contrast and legibility across supported backgrounds;
3. responds safely to reduced-transparency, increased-contrast, reduced-motion, or equivalent platform settings;
4. does not become the sole indicator of state;
5. does not overload dense operational content;
6. degrades gracefully where the effect is unsupported.

Current Apple guidance is a platform-specific example: Liquid Glass is intended primarily as a functional layer for controls/navigation, should be used sparingly, and can change under accessibility settings. Treat that as Apple-platform guidance, not a universal aesthetic mandate.
