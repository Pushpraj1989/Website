# Authentication, Passkey, MFA, and Recovery UX

## Baseline

Authentication is a high-friction/high-risk journey. Design it to be secure **and** usable with disabilities, recovery scenarios, multiple devices, and interrupted sessions.

Current standards reference: W3C Web Authentication Level 3 Recommendation, 25 August 2026.

## Contract

For every authentication journey define:
- available methods;
- recommended/default method;
- accessible fallback;
- passkey/WebAuthn support and conditional mediation where applicable;
- enrolment and authenticator recognition/naming;
- OTP/MFA behavior;
- device change/loss;
- account recovery;
- cancellation/back navigation;
- timeout/extension;
- error messaging;
- privacy/username-enumeration considerations in messages;
- reauthentication for sensitive actions;
- audit/session behavior.

## Accessibility rules

- Do not rely on one biometric/user-verification method when an appropriate alternative can be offered. WebAuthn Level 3 accessibility guidance recommends user-verification-capable authenticators offer more than one method, e.g. fingerprint and PIN.
- Help users recognize authenticators they registered where the platform permits this.
- Avoid authentication mechanisms that require cognitive-function tests without an accessible alternative.
- Ensure OTP/paste/password-manager/passkey flows do not block assistive technology or legitimate paste/autofill.
- Keep errors actionable without leaking sensitive account existence/details.

## Timeouts

Do not invent short countdowns. WebAuthn Level 3 recommends ceremony timeouts in the 5–10 minute range with a 5-minute default, tied to enough-time accessibility principles. Product security requirements may differ; when they do, document the rationale and provide warning/extension/recovery where applicable.

## Audit hard stops

FAIL a critical authentication journey when:
- keyboard/screen-reader users cannot complete it;
- only one inaccessible verification path exists without justified necessity;
- recovery is impossible or misleading;
- focus/status/error behavior prevents completion;
- an unjustified timeout predictably prevents reasonable completion;
- critical state is communicated only visually.
