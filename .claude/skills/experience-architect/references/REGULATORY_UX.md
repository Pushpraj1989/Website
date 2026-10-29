# Regulatory and Transparency UX

## Purpose

Translate applicable regulatory requirements into visible, testable product behavior. This file is a UX governance aid, not legal advice. Always verify current law/regulator guidance for the product jurisdiction.

## Jurisdiction gate

Before applying a rule, establish:
- user location/market;
- provider/deployer location where material;
- regulated domain;
- product role;
- AI role and content type;
- public-sector/private-sector context;
- contractual accessibility requirements.

## AI transparency — EU

As of 2 August 2026, Article 50 transparency obligations of the EU AI Act apply to certain interactive/generative AI systems and synthetic/manipulated content. For applicable use cases, the UX must surface required AI interaction/content disclosure at the point and time users need it; do not bury it only in legal terms. Machine-readable marking may be a technical requirement in addition to visible UX.

Audit:
- explicit AI identity when required;
- disclosure timing and prominence;
- synthetic/deepfake/public-interest-content disclosure where applicable;
- machine-readable marking responsibility;
- emotion-recognition/biometric-categorisation notices where applicable;
- human escalation/complaint path where required by product governance.

## Rule

Never generalize one jurisdiction's legal obligation globally as law. Separate:
`LEGAL_REQUIRED` / `PLATFORM_REQUIRED` / `ETHICAL_RECOMMENDATION` / `PRODUCT_POLICY`.
