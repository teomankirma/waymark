# Browser execution primitives

`BrowserSurface` implements the existing `SurfaceAdapter` interface with Playwright. This is the first browser-executor slice: it operates one caller-owned page. The [shared PolicyExecutor](EXECUTION.md) now wraps this adapter with grants, navigation checks, ownership, and sanitized events. Discovery and replay must call that executor, never this low-level adapter directly.

## Operations

- `resolve` takes a bound target and returns an opaque handle, missing, or ambiguous. Role/name, label, and text matching are exact (with Playwright's standard text whitespace normalization). CSS fallbacks require the existing explanatory reason; frame chains use CSS selectors from outer to inner. Every frame and target must match exactly one element. There is no first-match fallback.
- `interact` clicks, fills, or selects a native option by value. Handles belong to the adapter that created them and must match the action's target. Targets are resolved again immediately before interaction; Playwright also enforces strict matching and actionability. A handle describes a logical target, not a permanent DOM node. Use checkpoints to verify identity after navigation or changes.
- `read` returns visible element text, preserving formatting and decimal cents. It does not parse money or read input values. Results over 4,096 characters are rejected. Read results are in-memory application data, not sanitized evidence; the future executor must apply its output/redaction policy before model access or persistence.
- `check` waits for visibility, exact rendered text, or an exact page URL. URL checks include query strings and fragments. A mismatch reports fixed descriptions without echoing expected values or page contents. Ambiguity remains an error, not a successful check or an arbitrary match.
- `navigate` accepts HTTP(S) URLs without embedded credentials and waits for DOM content loaded. Specific controls and checkpoints provide subsequent readiness checks.
- `observe` deliberately returns only the current origin, top-level accessible-role counts, and frame count. It excludes URL paths, queries, titles, field values, and page text. This metadata is not yet sufficient for LLM discovery; richer observation requires the next slice's reviewed redaction boundary.
- `captureEvidence` returns unavailable. No raw screenshots, snapshots, or traces are saved.

Each call validates a 1–60,000 ms budget shared across its internal operations. Read-only calls without Playwright timeout options are bounded with a timer; timing out does not cancel an underlying read. Interactions use Playwright's native timeout and are never retried by this adapter. A failed/timed-out action does not prove that no side effect happened; future recovery must check state before deciding whether another action is safe.

Errors expose fixed codes for invalid input, missing/ambiguous targets, timeouts, closed sessions, and unexpected browser state. Raw Playwright messages are discarded because they can contain DOM text, URLs, and entered values.

## Current limits

This adapter is not a security sandbox. It does not yet enforce allowed routes, redirect/frame origins, restricted actions, concurrent session ownership, popups, or dialog recovery. It neither follows new pages nor owns browser launch/shutdown. Tests use isolated fictional pages and the local banking demo. There is no public arbitrary-action CLI or model integration in this slice.

Semantic locators follow [Playwright locator guidance](https://playwright.dev/docs/locators). Frames are checked explicitly before entering their scope; final operations retain Playwright strictness.

## Verification

```bash
npm run build
npm run test:browser -- tests/browser/browser-surface.spec.ts
```

Stop local dev first; the existing test runner starts its own local Convex and preview server. These desktop/mobile Chromium tests exercise the adapter through the live member-search → profile → savings flow for two members, including frame identity and balance reads. Synthetic browser fixtures cover ambiguous/stale targets, nested/duplicate/missing frames, delayed controls and text, native select, invalid navigation/budgets, disabled controls, and closed sessions. The handwritten flow is test code, not learned capability or discovery evidence. No API key is needed.
