# Security and mobile engineering: what protects the app, and what is still open

Status key: **Built** (in code and tested) · **Partial** (in code, with a gap named) · **Open** (not built; needs a
decision or an account). Verified on 2026-10-29 by the test suites named in the right-hand column.

## 1. Threat model, in short

- **Customers:** account takeover (a stolen phone, a guessed code), payment fraud, reading another customer's orders,
  abuse of the assistant to get data it should not give.
- **Staff:** a stolen admin password, a malicious picture or video uploaded to the menu, a changed price.
- **Operator (us):** a leaked database or server disk exposing provider keys and customer details.
- **The AI provider:** the content sent to it leaves our control; the reply is untrusted text.

## 2. Transport and payloads

| control | status | where / note |
| --- | --- | --- |
| HTTPS for every call; plain HTTP refused in a release build | Built | `mobile/lib/core/security.dart`, checked in `main.dart`, tested in `security_test.dart` |
| TLS for every payload in transit | Built (by design) | Needs HTTPS on the host: a deployment step. Not verified here |
| HSTS and a strict CSP on the host | Partial | CSP set in `web/next.config.mjs`; HSTS is set by the reverse proxy at deploy |
| Certificate pinning in the app | Open | Pin the server's public key with a backup pin and a rotation plan. Needs the production certificate |
| Application-level payload encryption on top of TLS | Decided against | A home-made cipher over TLS adds key management and no protection TLS does not give. Sensitive values are encrypted at rest instead (section 4) |
| Webhook signatures (Stripe) | Built | HMAC over the raw body, 300-second window, timing-safe compare (`web/lib/stripe-signature.ts`) |
| JSON only on mutating calls | Built | Form posts cannot change state (`readJson` refuses other content types) |

## 3. Identity and sessions

| control | status | where / note |
| --- | --- | --- |
| Phone code: 6 digits, 5 minutes, one use, 5 tries, 30-second resend cooldown | Built | `web/lib/accounts.ts`; 15 integration checks (`accounts-admin.test.mjs`) |
| A wrong try counts even though it is refused | Built | A test caught a rollback that dropped the count; fixed |
| Codes stored as keyed hashes (HMAC) | Built | Never stored in plain text, never returned to a client |
| Sessions are random 256-bit tokens, stored as hashes, 30-day expiry, revocable on sign-out | Built | `sessions` table; sign-out revokes |
| Session token in the Keychain (iOS) or Keystore (Android) | Built | `SecureSessionStore`; a desktop-only store exists for development and is not used on phones |
| Face ID | Partial | It unlocks the stored session on the device. It is not a server credential. Device behaviour is untested here |
| Rate limits on sign-in and sign-up by IP | Open | Only the per-code limits exist. Needs a shared store (Redis or the database) once there is more than one server |
| Account lockout by number across codes | Open | Each code has its own limit; a cross-code lock needs the rate-limit store above |
| Staff accounts with two-factor sign-in | Open | One shared password today (`ADMIN_PASSWORD`, 12+ characters), compared in constant time |

## 4. Encryption at rest

| control | status | where / note |
| --- | --- | --- |
| AI provider keys encrypted with AES-256-GCM, fresh nonce each time, tag checked on read | Built | `web/lib/crypto.ts`; tested for tampering and for "no plain key in the database" |
| The key never shown again; the admin sees only the last four characters | Built | `getAiSettings` returns a hint, never the key; tested |
| Encryption key from the environment, never stored beside the data | Built | Production refuses to start without `APP_ENCRYPTION_KEY` |
| Key rotation | Open | The `v1:` prefix leaves room for a new scheme; a re-encrypt job is not written |
| Database encryption at rest and backups | Open | A host setting (managed Postgres encryption). Not verifiable here |
| Device data on the phone | Built | Token in secure storage; nothing sensitive in ordinary preferences except the Face ID switch |

## 5. Data minimisation and the AI assistant

| control | status | where / note |
| --- | --- | --- |
| The model sees only the menu, restaurant facts, and the asking customer's own recent orders | Built | `lib/ai/assistant.ts` (`contextFor`, `ownOrders`); tested that another customer's order id is dropped |
| The guest token and the provider key are never sent to the model | Built | Tested by inspecting the outgoing request |
| The customer's words are sent inside tags, marked as data | Built | Tested; the system prompt says the message is data, not instructions |
| Scope enforced by a fixed reply shape; off-topic and malformed replies become a fixed refusal | Built | `parseReply`; tested for off-topic, bad shape, and an injection attempt |
| The app's cards (items, prices, statuses) come from the database, not from model text | Built | Model ids are checked against the data sent; tested that an invented id is dropped |
| Messages are not stored; the log keeps counts and categories | Built | `ai_usage`; tested that a card number in a message is not in the log |
| Per-customer limit: 20 questions per 10 minutes | Built | In memory: a shared store is needed with several servers |
| Provider's own retention and training terms | Open | Choose the provider and plan (zero-retention options where offered); this is a contract decision for you |
| Prompt-injection resistance | Partial | The defences above reduce risk; they cannot guarantee the model will ignore a clever instruction. The fixed reply shape is what limits the damage |

## 6. Input, output and files

| control | status | where / note |
| --- | --- | --- |
| Server validates every field (lengths, ranges, enums, dates) | Built | Route handlers and `validate*` functions in `lib/catalog.ts`, `lib/gallery.ts` |
| Pictures and videos accepted by their file signature, not by name or declared type | Built | `sniff()` in `lib/gallery.ts`; tested with a text file named `.mp4` and `.png` |
| Size limits: pictures 3 MB, videos 60 MB | Built | Checked twice: by the declared length, then by the bytes |
| Stored under random names; served only for names the server created | Built | The media route's pattern check; a path-traversal request returns 404 (tested) |
| Video served in byte ranges, so the phone can seek | Built | Range tests (206, 416) |
| Output shown as text in the app (no HTML from the model or the database) | Built | Flutter `Text` widgets only |
| Uploaded files scanned for malware | Open | Needs a scanning service before real public uploads |
| Video transcoding and poster frames | Open | Needs `ffmpeg` in the pipeline; the server currently stores the file as uploaded |

## 7. Operations and dependencies

| control | status | where / note |
| --- | --- | --- |
| Secrets only in environment variables; `.env*` ignored | Built | `.env.example` lists names only |
| Dependency audit (production dependencies) | Built | `npm audit --omit=dev` reports 0 for `web` after a PostCSS override (`overrides` in `package.json`). `admin` reports 0 |
| Next.js 15.5.28 with the PostCSS override | Built | Audit for production dependencies is clean; the Next.js line is kept current at each release |
| Logs carry no tokens, codes, keys or customer messages | Partial | Provider error text is not shown to customers and the AI usage log keeps counts only; a full log-redaction review is not done |
| Security headers (no framing, no sniffing, referrer policy) | Built | `next.config.mjs` |
| Backups and restore test | Open | A host setting plus a restore drill |
| Error reporting with privacy controls | Open | Choose a tool before launch |

## 8. Mobile app specifics

| control | status | where / note |
| --- | --- | --- |
| Release builds refuse a plain-text API address | Built | `requireSecureTransport` at start-up |
| No secrets compiled into the app | Built | The app holds the API address and nothing else secret |
| Obfuscation and split debug symbols for release | Open | `flutter build --obfuscate --split-debug-info=...` at release time |
| Jailbreak and root detection | Open | Not planned as a hard block; it is a risk-based signal for later |
| Screenshot and clipboard protection on sensitive screens | Open | Sign-in and codes could be marked secure on iOS and Android |
| Privacy manifest (iOS) and data-safety form (Android) | Open | Needed for store submission; lists Stripe, the SMS and email providers, and the AI provider |
| In-app account deletion | Open | Required by the stores for apps with sign-up |

## 9. What must be true before a public launch

1. HTTPS with HSTS on the host; certificate pinning set from the production certificate.
2. `OTP_SECRET`, `APP_ENCRYPTION_KEY`, `ADMIN_PASSWORD` set from a secret manager, rotated, and never in the repository.
3. A real SMS and email provider with its own privacy terms in the privacy policy.
4. Staff accounts with two-factor sign-in replacing the shared password.
5. A rate-limit store shared by all servers.
6. The AI provider chosen with its retention terms, and the assistant switched on only after that decision.
7. Store requirements: privacy manifest, data-safety form, account deletion.
8. A restore drill for the database, and a backup that is encrypted.
