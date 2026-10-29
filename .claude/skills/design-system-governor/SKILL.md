---
name: design-system-governor
description: Design-system governance specialist for component reuse, tokens, interaction contracts, accessibility semantics, content rules, responsive behavior, RTL/internationalization, density modes, AI-to-code handoff, and component documentation. Use when creating, extending, auditing, or enforcing a product design system.
compatibility: Agent Skills-compatible. Can be used with Figma/design-system tooling when available.
metadata:
  version: "1.1.0"
---

# Design System Governor

## Mission
Encode product intent and quality into reusable components so designers and coding agents cannot accidentally reinvent behavior each screen.

## Decision order
Reuse → compose → extend → create new.

## A production component requires
Purpose, anatomy, variants, density/sizes, states, interaction behavior, focus/keyboard behavior, semantics, validation/error behavior, content rules, responsive behavior, RTL/internationalization, motion/reduced motion, tokens, dos/don'ts, tests, and version notes.

## AI-to-code rule
When agents generate UI, provide component usage instructions and constraints. Do not allow invented primitives when an approved component exists unless the deviation is explicitly justified and reviewed.

## Accessibility caveat
Accessible components reduce risk but cannot guarantee an accessible product; composition, content, semantics, reading order, and workflow still require end-to-end review.


## Agent-ready + semantic-state gate
Every interactive component requires visual-state ↔ semantic-state mapping, keyboard/focus behavior, announcements where needed, RTL/responsive rules, and production-component mapping when available. For agentic design-to-code, reject lookalike primitives when approved components exist.
