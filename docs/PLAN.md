# Waymark implementation plan

## Outcome

Deliver a small, real computer-use system: learn a workflow with an LLM, save a typed capability, replay it for another input without the model, and transfer the same live browser session to a person when blocked. Implement one application surface and cover every core requirement before adding stretch goals.

The first workflow is: search for a fictional member, open their profile, open their savings account, verify the member identity, and return the current balance and currency. The banking demo is a reproducible target; the automation system is the main deliverable.

## Current baseline

Setup is merged in PR #1. React, TypeScript, Vite, React Compiler, Tailwind, Express, Playwright, the Anthropic SDK, Zod, and tsx are installed. Prettier, project instructions, and local skills are configured. The app currently displays a minimal placeholder. No backend, discovery, replay, or handoff implementation exists yet.

## Delivery workflow

Use small PRs with Conventional Commit titles and squash merges. Use descriptive kebab-case branch names without prefixes, for example `capability-contracts` or `member-search`. After a successful merge, sync local main, remove the merged branch locally and on GitHub, and prune stale remote-tracking references. For squash merges, verify the PR is merged and its work is preserved before deleting the local branch; do not rely solely on Git ancestry.

The stages below are ordered milestones, not a requirement to make each stage one large PR. Split independently reviewable changes when useful. Record test results and known limitations in each PR. Publication and merging follow the user's authorization for the work being performed.

## 1. Contracts and execution boundaries

Suggested branch: `capability-contracts`.

- Define Zod schemas for actions, parameter references, target descriptions, checkpoints, extracted outputs, and versioned capability artifacts.
- Define separate result variants for success, expected business outcomes, and failures. Represent intervention/session state separately from terminal results.
- Define a surface adapter interface for observation, target resolution, actions, and evidence capture. Keep browser details inside the browser adapter.
- Define policy configuration and session ownership states before writing execution logic.
- Establish source boundaries: frontend under src/, target backend under server/, automation under automation/, and meaningful tests under tests/. Introduce directories only when they contain implementation.
- Add backend/automation TypeScript checks and offline test commands. Keep one npm project initially.

Acceptance: contracts reject malformed actions, unsupported artifact versions, invalid inputs, and undeclared outputs. Examples demonstrate a parameterized balance lookup without embedding a discovery member ID in the reusable action sequence.

## 2. Reproducible banking target

Suggested branches: `member-search`, then `account-details`.

- Build an Express backend with fictional fixtures and a React/Tailwind interface for search, profile, and savings account views.
- Use a modest legacy-style surface: table-based results and a frame boundary, with no test IDs. Preserve labels and keyboard access for human operators.
- Add deterministic fixture scenarios for unknown members, validation errors, denied access, slow/failed loads, and session expiry. Keep scenario setup outside the automation's observation/action interface.
- Include a restricted mock account action for policy verification; implement no real financial transactions.
- Provide repeatable fixture reset and commands to start frontend/backend together or separately.

Acceptance: a person can complete the flow. Browser tests verify identity, balance/currency, empty results, and scenario states. The automation has no direct access to fixture data or backend APIs.

## 3. Browser executor, policy, and evidence

Suggested branches: `browser-executor`, then `execution-policy`.

- Implement Playwright observation and a small action vocabulary: navigate, click, fill, select, read, and assert state.
- Resolve controls using frame scope, roles/labels/text, and explicit structural fallback descriptions. Require one valid target; fail safely on ambiguity.
- Enforce allowed origins/routes/actions before execution and handle navigation, redirects, frames, and new pages deliberately. Document the limits of browser-level enforcement.
- Add explicit action risk metadata and conservative handling of potentially irreversible operations. Do not trust model-provided risk classifications alone.
- Emit sanitized structured events with run ID, step, action, concise decision explanation, and observed outcome. Capture masked failure screenshots; do not save unrestricted traces by default.
- Keep credentials and sensitive field values out of persisted events and model observations where possible. Fail closed on evidence capture when masking cannot be assured.

Acceptance: allowed actions execute, forbidden actions stop, ambiguous targets are rejected, and evidence contains useful diagnostics without secrets. Both future discovery and replay invoke this same executor.

## 4. Deterministic replay and runtime outcomes

Suggested branches: `capability-replay`, then `replay-recovery`.

- Load and validate an artifact and invocation inputs, resolve parameter bindings, and execute steps without initializing a model client.
- Check preconditions and checkpoints, verify member identity, and validate declared outputs. Represent money with an exact decimal string or minor units rather than floating-point arithmetic.
- Detect known business outcomes such as member_not_found separately from execution failures.
- Support bounded recovery for known interstitials and transient reads/loads. Avoid blanket retries for actions that may have already changed state.
- Return a structured failure with step, expected state, observed state, and sanitized evidence when recovery is exhausted.
- Use a clearly labeled handwritten development artifact to build the executor; it is not submission evidence of discovery.

Acceptance: the same artifact replays for two member IDs with the model key absent and returns each member's current values. Tests cover not-found, invalid input, permission denial, timeout, unexpected dialog, and checkpoint mismatch.

## 5. Genuine LLM discovery and recording

Suggested branches: `discovery-loop`, then `capability-recording`.

- Add a server-side Anthropic client with configurable model, explicit step/time/token limits, and environment loading. Verify current official SDK guidance before implementation.
- Accept a natural-language goal, target, and named typed inputs. Observe the actual UI, request a validated action, run policy checks, execute it, and observe the result.
- Treat page content as untrusted data. Provide only bounded tools; no arbitrary JavaScript, shell, or direct target-backend access.
- Preserve explicit input references while recording executed actions. Do not parameterize by replacing coincidentally matching strings afterward.
- Build the reusable artifact from verified execution records and success conditions, excluding exploratory dead ends and raw transcripts. Validate it before saving.
- Keep deterministic business-outcome and recovery rules explicit and reviewed; one successful discovery cannot establish every possible failure branch.
- Run at least one genuine model-driven session and replay its resulting artifact for a different member. Offline mocks are permitted in tests but must be labeled.

Acceptance: real discovery completes a goal without a prewritten navigation sequence, produces a reviewable artifact, and that exact artifact passes model-free replay. Save sanitized discovery and replay evidence. Live execution requires the user's server-side API key; never request the key in chat.

## 6. Human takeover and verified resume

Suggested branches: `session-handoff`, then `handoff-resume`.

- Detect stuck discovery, exhausted replay recovery, session expiry, and risky-action boundaries; produce an intervention request with goal/capability, step, reason, and sanitized current state.
- Keep a visible Playwright browser alive. Stop automation actions and explicitly transfer ownership to the person using a minimal terminal/operator interface.
- Record sanitized manual actions and navigation, including frame interactions. Never record raw credential values.
- On resume, verify session ownership and the expected recovery checkpoint. Resume from an explicit safe point or stop; never blindly increment the step counter.
- Preserve one run's context/evidence across handoff and handle cancellation, closed sessions, and rejected resumes.

Acceptance: force session expiry, manually restore access in the same browser context, and resume successfully. Verify no automated actions run during human ownership and that a wrong resume state fails safely. Exercise handoff from discovery and replay.

## 7. End-to-end evidence and checks

Suggested branch: `end-to-end-evidence`.

- Run genuine discovery, successful parameterized replay, known business outcome, bounded recovery, policy denial, and live human takeover scenarios.
- Store the saved capability and sanitized discovery/replay logs under evidence/, with a manifest identifying command, scenario, artifact version, outcome, and whether the run used a real model or a fixture.
- Add a small GitHub Actions workflow for npm ci, formatting, lint, complete TypeScript/build checks, and offline tests/browser scenarios. CI must not require model credentials.
- Keep generated failures and local raw outputs ignored; commit only deliberately reviewed demonstration evidence.

Acceptance: a clean checkout runs documented offline checks and replay without a model key. The evidence proves the implemented behavior and contains no invented success claims or sensitive values.

## 8. Report and submission readiness

Suggested branch: `submission-docs`.

- Update README.md with exact setup, configuration, discovery, replay, failure-scenario, and handoff commands. Clearly distinguish offline operation from paid discovery.
- Write REPORT.md in about 1–3 pages using the required headings: Architecture; Artifact schema; Determinism & error handling; Heterogeneity & multi-tenant; Escalation & handoff; Safety; Cuts.
- Explain how logical targets and surface adapters extend to legacy web and desktop, and how base artifacts plus tenant/version overrides could be validated and reused. Label these as design proposals, not implemented features.
- Explain targeting limitations, redaction boundaries, recovery choices, control ownership, deliberate cuts, and next steps.
- Verify the public repository from a clean checkout. A short screen recording is optional. Emailing the submission is a separate user-authorized action.

Acceptance: every assignment requirement maps to working code/evidence or an explicitly permitted design-only section. No TODO stands in for real discovery, deterministic replay, or live-session handoff.

## Deliberate exclusions

No real banking access, production authentication, database, cloud deployment, distributed queues, multi-tenant infrastructure, native desktop implementation, or full operator console. Start with one workflow; add no stretch goals until the complete core works. API keys, model choice, and optional hosting do not block offline work.
