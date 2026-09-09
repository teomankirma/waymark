# Capability contracts, v1

This milestone defines the data shared by future discovery and replay. It does not run a browser or model. `tests/capability.fixture.ts` is a handwritten development contract for a savings lookup; its locators are illustrative until the banking target exists.

## Validation boundary

Parse external artifacts with `capabilitySchema.parse(unknown)` from `automation/contracts/capability.ts` before calling typed helpers. A capability has schema version 1, its own positive revision, an ID, description, provenance, input/output declarations, preconditions, ordered steps, success checkpoints, and known business outcomes. Unknown properties and unsupported versions fail validation. Provenance is a label, not proof of genuine discovery.

`parseInvocation(artifact, unknown)` requires exactly the declared input fields. `parseOutputs(artifact, unknown)` requires exactly the declared output fields. `parseResult(artifact, unknown)` also checks declared business outcomes and step IDs. The lower-level `resultSchema` validates shape only; it cannot validate against a particular capability.

V1 fields are required strings: bounded text, exact signed decimal strings, or three uppercase currency letters. Currency validation checks format, not membership in an ISO currency table. Decimal strings do not accept exponents, grouping separators, or leading zeros; no numeric coercion or rounding occurs. Optional, nested, and non-string fields are deliberately outside v1.

Values distinguish `{ "kind": "literal", "value": "Savings" }` from `{ "kind": "input", "name": "memberId" }`. Input references work in fill/select values, semantic target names/text, and expected checkpoint text. The schema rejects undeclared references. `resolveValue` resolves one reference from validated invocation inputs without mutating the artifact; recursive action binding belongs to replay.

## Actions and targets

The action vocabulary is navigate, click, fill, select, read, and assert. Targets describe a frame chain (outer to inner), semantic role/name, label, exact text, or an explicit CSS fallback with a reason. Future semantic matching must be exact, and every target must resolve uniquely. No arbitrary JavaScript action exists. Navigation accepts HTTP(S) URLs without embedded credentials; acceptance is not policy authorization.

Each step has a unique ID, advisory risk, timeout, and before/after checkpoints. Checkpoints require visibility, exact text, or an exact URL. Reads declare an output name; each declared output must have exactly one writer. Whole-run preconditions and success checkpoints are required. These checks prove structural consistency, not that a workflow will succeed against a live application.

Known business outcomes contain a unique code and checkpoints interpreted together. Later execution will evaluate these at step observation boundaries before declaring an execution failure. Terminal results separate success, business outcomes, and failures; failures carry the step (or null before execution), code, expected state, observed state, and evidence references.

## Execution boundaries

`SurfaceAdapter<Handle>` in `automation/contracts/surface.ts` isolates observation, unique target resolution, navigation, interaction, reading, checkpoint verification, and evidence capture. The handle type is private to each adapter, so the contract imports no Playwright types. Its bound types exclude unresolved input references. Calls carry a timeout; implementations must enforce it.

Only the future shared executor may use the adapter. Both discovery and replay must go through that executor's policy and ownership checks. Schema parsing alone does not enforce this architecture or prevent browser redirects, cross-origin frames, network requests, or side effects.

Policy configuration declares exact canonical origin/path pairs, allowed action kinds, bounded run limits, and mandatory human intervention for restricted actions. Paths do not contain query strings or fragments; query/redirect/frame policy semantics must be settled with the executor. Step risk is advisory and must never override independent policy classification.

Sessions separate automating, awaiting a human, human control, verifying resume, and closed states. Each state admits one owner or none. Intervention requests include a step, reason, summary, and expected resume checkpoint. These are valid state shapes, not an implemented transition machine or concurrency lock.

Observations and diagnostics must be sanitized before crossing model or persistence boundaries. Evidence contains references only. A schema cannot verify redaction: the adapter must refuse capture if masking cannot be assured. The future executor must sanitize even unexpected error messages before storing failure results.

## Verification

`npm test` uses Node's test runner through the installed tsx runtime. Tests cover JSON round trips, two member inputs with unchanged actions, malformed actions/URLs, unknown versions/fields, undeclared references, duplicate IDs/outcomes/output writes, invalid inputs, exact decimal outputs, result validation, policy bounds, and ownership shapes. They use no API credentials, network, or browser. `npm run build` includes the strict Node automation/test project as well as the frontend.
