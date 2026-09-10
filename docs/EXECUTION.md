# Shared policy executor

`PolicyExecutor` is the entry point for future discovery and replay. It owns a new isolated Playwright context and its browser adapter. Callers supply trusted operator policy at creation and schema-valid, fully bound steps to `execute`. Input binding, capability replay, model discovery, and verified resume are separate milestones.

## Authorization

The policy extends the existing route/action/run-limit contract with explicit grants. A grant names an approved top-level route index, exact target/frame chain, permitted operations, trusted risk classification, and a reviewed public label. There are no implicit interaction grants. Restricted grants deny execution even when the caller marks the step as a read or changes its description. Caller-declared restricted risk also stops execution. Conflicting/duplicate applicable safe grants fail closed; restricted matches take precedence. CSS is permitted for approved reads/assertions but cannot authorize interactions.

Every step checks allowed action kinds, step risk, before checkpoints, its action grant, and after checkpoints. Targets are resolved uniquely and authorization is checked again before interaction. A failed step stops the run; no action is automatically retried. Step budgets and the overall run deadline bound browser operations. Observation counts against the operation limit, preventing unbounded observation loops. Concurrent calls are rejected, not queued. Operation limits are returned without adding unlimited rejected requests to the journal.

A grant is a reviewed capability for the known application UI, not proof of what arbitrary JavaScript behind a control will do. Do not grant interactions with untrusted or ambiguously described controls. Changing the DOM behavior behind the same accessible name is outside this layer's guarantees.

## Navigation boundary

Only approved HTTP(S) origin/path pairs may load as documents. Query strings and fragments may carry UI search state but never appear in observations or events. Treat permitted routes as trusted: query parameters must not themselves authorize dangerous operations.

The context installs navigation interception before the first page load, blocks service workers, and permits GET document requests only. It fetches approved documents without following redirects and validates redirect destinations before returning them to the browser. Frames use the same route allowlist. SPA navigation is checked from frame events and again around operations. An unexpected popup, dialog, download, or disallowed document navigation permanently invalidates the run; dialogs are dismissed and extra pages/downloads are closed/cancelled.

This is a browser document/action guard, not a network sandbox. Subresources, XHR, WebSockets, and effects initiated by page JavaScript are not governed by the document route list. In-flight work can already have caused effects before failure. A blank child frame may exist while loading; controls should only be granted within reviewed frames. Additional OS/network isolation is needed for hostile websites.

Chromium may classify intercepted documents differently for local-network access. `localNetworkOrigins` is opt-in and accepts only approved loopback origins. It grants that origin Chromium's local-network permission so the local app can reach its Convex WebSocket. It does not expose a backend API tool to automation or disable browser checks globally.

## Ownership

`giveToHuman()` immediately blocks further automation, aborts native pending browser operations, waits for the active call to settle, and only then returns the same page with state `human`. Calls cannot execute under human ownership. `close()` shuts down the owned context. A failed/aborted action is not evidence that its side effects were rolled back. Read-only polling and outstanding network activity may settle separately.

There is deliberately no method to switch straight back to automation. Verified resume, manual-action recording, and an operator interface belong to the handoff milestone. Retaining references to internal Playwright objects or invoking the adapter directly would bypass this API; the future model gets bounded executor tools only.

## Observations and evidence

Observations project trusted public labels plus actual target visibility and restricted status. They do not copy DOM text, input values, URL paths/queries, titles, or page instructions. Labels must be reviewed static public text, never secrets. Visibility is not a promise that a control is enabled/actionable; Playwright checks that at interaction time. This projection is conservative; discovery will need an application-approved observation catalog rather than unrestricted snapshots.

Authorized `read` results return in memory to the caller and are not automatically persisted or placed in model observations. The future replay/output boundary must validate these values before further use.

The bounded journal contains a generated run ID, numeric operation index, action kind, and fixed outcome code. It omits caller step IDs, target descriptions, action values, URLs, and raw errors. An optional trusted local `evidenceDirectory` writes these events as JSONL with restrictive creation permissions. Evidence-write failure stops execution. The caller must choose a local directory appropriate for the run; there is no raw-trace recording. Screenshot capture still fails closed because a general trustworthy masking plan is not yet implemented; no unmasked images are saved.

## Verification

```bash
npm run build
npm run test:browser -- tests/browser/execution-policy.spec.ts
npm test
```

Stop local dev first. Browser tests use synthetic HTTP fixtures to verify denied redirects/frames without contacting forbidden endpoints, SPA changes, dialogs/popups, concurrent calls, pending-operation cancellation, limits, before checkpoints, and log redaction. The live local banking test searches, opens a profile and savings, verifies identity, reads the balance, and rejects closure through the executor. Its grants and flow are handwritten test configuration, not claimed LLM discovery evidence. All tests are offline with respect to models and require no API key.

References: [Playwright routing and service workers](https://playwright.dev/docs/api/class-browsercontext#browser-context-route), [redirect control](https://playwright.dev/docs/api/class-route#route-fetch), and [origin-scoped permissions](https://playwright.dev/docs/api/class-browsercontext#browser-context-grant-permissions).
