# UX Contract Specification

## Why it exists

The UX Contract is the binding handoff between product intent and implementation. It prevents coding agents from improvising interaction behavior, accessibility, states, and responsive rules.

## Required sections

### 1. Context
- product
- user cohort
- user job
- device/context
- locale
- frequency/expertise
- risk

### 2. Journey
- entry point
- preconditions
- happy path
- decisions
- exceptions
- exit/completion

### 3. Information hierarchy
- page title
- primary information
- secondary information
- primary action
- secondary actions
- navigation

### 4. Component contract
For each component:
- component/design-system reference
- purpose
- states
- content
- interaction
- data dependencies

### 5. State matrix
At minimum evaluate:
- loading
- empty
- partial
- default
- edited/dirty
- validating
- success
- warning
- error
- offline/timeout
- permission denied
- read-only
- disabled

### 6. Accessibility contract
- landmarks/headings
- accessible names
- keyboard
- focus
- announcements
- error association
- tables/grids
- contrast/non-color cues
- zoom/reflow
- reduced motion

### 7. Responsive contract
Specify what:
- persists
- moves
- collapses
- becomes a different control
- becomes sticky
- hides only if nonessential

### 8. Localization/RTL contract
- translations/terminology
- bidi behavior
- logical alignment
- formatters
- expansion tolerance

### 9. AI contract
When present:
- capability
- limitations
- confidence/uncertainty
- evidence
- human control
- feedback
- failure
- audit

### 10. Authentication and identity (when applicable)
- methods/fallback
- enrolment/recovery/lost-device
- timeout/session expiry
- reauthentication
- accessibility behavior

### 11. Regulatory/transparency (when applicable)
- jurisdiction
- disclosure/legal UX requirements
- AI identity/synthetic content
- consent/notice timing

### 12. Permissions and risk
- roles
- read/write/approve boundaries
- destructive actions
- confirmations
- audit log requirements

### 13. Measurement
- task-success event
- error events
- abandonment
- time/efficiency where relevant
- qualitative follow-up

### 14. Acceptance tests
Each requirement must be testable.

## Rule

No critical interactive screen is implementation-ready until its primary flow, failure/recovery states, keyboard/focus behavior, and semantic behavior are specified.


### 15. Verification method
For each acceptance criterion specify whether verification requires static review, prototype, DOM/code, automated accessibility tool, keyboard, screen reader/AT, localization test, performance test, or user test.
