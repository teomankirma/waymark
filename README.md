# Waymark

Learn UI workflows once. Replay them reliably. Hand off when needed.

## Status

Member search uses anonymous **local Convex** with a shadcn React interface. The directory shows members immediately and filters 250 ms after typing stops; Enter applies the query immediately. The capability contracts are implemented. Member profiles and savings details are implemented. Discovery, replay, and human takeover remain on the [implementation plan](docs/PLAN.md).

## Setup and local development

Use Node.js 22.12 or later on a supported release line, with npm.

```bash
npm ci
npm run setup:local
npm run dev
```

Open [the banking demo](http://127.0.0.1:5173). No Convex account, sign-in, cloud project, deploy key, or Anthropic key is needed. The first setup needs internet access to download Convex's local backend binary. Subsequent database state lives in the ignored `.convex/` directory, and deployment configuration in ignored `.env.local`.

The local-only wrapper refuses a non-anonymous deployment and removes inherited cloud deployment credentials from its child environment. Do not run cloud deployment/link commands for this demo. Convex normally uses ports 3210/3211; Vite uses 5173. `npm run dev` starts Convex, seeds missing fictional records, and starts Vite after initialization. Stop the command to stop both services.

## Commands

```bash
npm run setup:local   # Initialize/push anonymous local Convex, then stop
npm run dev           # Local Convex + seed + frontend
npm run dev:backend   # Local Convex + seed only
npm run dev:web       # Frontend only; requires the local backend
npm run build         # Type-check application, automation, tests, Convex; build UI
npm run typecheck     # Type checks only
npm test              # Contract tests + in-memory Convex tests
npm run lint
npm run format:check
npm run format
npm run preview       # Production UI build at port 4173; backend required
npx playwright install chromium
npm run test:browser  # After build; starts local Convex + seed + preview
```

Stop the dev servers before browser tests: the runner owns the same local Convex deployment and preview port. CI initializes its own anonymous local backend and runs the same checks, including desktop/mobile Chromium, without deployment secrets. Generated Convex bindings are committed; local database files and credentials are not.

## Visual review

Type `Mor` for Avery Morgan and Sam Morgan, `DEMO-001` for Avery, `DEMO-00` for all three demo members, or `DEMO-999` for no results. Names and IDs support contains matching, ignoring case, whitespace, punctuation, and accents: `demo`, `demo001`, `001`, `org`, and `avery morg` all work. This is partial matching, not typo correction. A bounded suffix search index provides these matches without scanning the table. Searchable ID/name text is limited to 64 normalized characters per field. Results are capped at 20 with an explicit prompt to narrow the search when more exist.

While editing, previous matches remain dimmed with inactive profile links until fresh results arrive. Clearing restores the member directory. Typing remains enabled while results load. Convex subscriptions update automatically when matching data or demo availability changes, and connection loss replaces results with a reconnect message. Choose the visible **View profile** action, then **View savings account** or the **Savings** section link. The account panel shows the same member ID and name with an exact decimal balance and explicit currency. React Router navigation preserves `?q=` through profiles and savings, so returning to the directory, browser back, and reload retain the search.

With the backend running, use a separate terminal to exercise operator-only fixtures:

```bash
npm run demo:scenario -- '{"scenario":"unavailable"}'
npm run demo:scenario -- '{"scenario":"normal"}'
npm run demo:scenario -- '{"scenario":"slow"}'
npm run demo:scenario -- '{"scenario":"denied"}'
npm run demo:scenario -- '{"scenario":"expired"}'
node scripts/convex-local.mjs run fixtures:seed '{"reset":true}'
```

The unavailable scenario persists until changed. Slow simulates a 1.5-second loading state and automatically returns to normal; run it while a search is visible. Its scheduled recovery cannot overwrite a newer scenario. These internal mutations are accessible through the local CLI, not the public browser API. Seeding is idempotent and preserves existing records and scenario state; use normal to restore availability.

The denied and expired scenarios block profile and savings reads, including direct account-panel URLs. Search remains available for these scenarios. **Restore demo session** returns an expired demo to normal on the same page; it cannot bypass denied access. These are shared training scenarios across all tabs, not real authentication or per-user sessions. The public restore mutation only clears expiry. **Close account… → Check permission** always returns a backend denial and never changes a record.

The savings panel uses a titled same-origin iframe for later frame-aware automation. It sizes to its contents; account closure requires a confirmation before checking permission. The frame is a navigation boundary, not a security boundary. Known fixture balances are `DEMO-001: 12450.75 USD`, `DEMO-002: 8320.10 USD`, and `DEMO-003: 560.00 USD`. Explicit reset restores these three demo members/accounts and normal availability; it preserves unrelated records. Ordinary startup preserves existing balances.

Browser tests cover search → profile → savings for two members, frame identity and balances, back/reload, expiry and restore, denied/unavailable/loading states, missing records, and restricted closure. They also exercise the real local Convex backend: live typing, rapid edits, clearing, empty results, validation, keyboard submit, reactive scenario recovery, and offline/reconnect behavior on desktop/mobile Chromium. Unit tests use the official `convex-test` in-memory implementation for indexed queries, validation, result limits, idempotent seeding, and scheduled recovery. No test calls an LLM or saves screenshots/traces.

## Stack and boundaries

- React, React Router, TypeScript, Vite, React Compiler, Tailwind, and shadcn/ui (Radix Nova).
- Convex functions, indexed database, subscriptions, and internal fixture mutations under `convex/`.
- Browser-safe generated API references/types connect the frontend to Convex; fixture records stay in backend modules.
- Playwright for browser tests and future automation; Zod for versioned automation contracts.
- Anthropic TypeScript SDK for future discovery; no API key needed yet.

Express and its direct type dependency are removed, along with the HTTP routes, proxy, shared REST schemas, and the old process launcher. Automation remains separate under `automation/` and must interact through the target UI, never through Convex functions or database reads.

See [Contract boundaries](docs/CONTRACTS.md). The handwritten capability fixture is a schema example, not discovery evidence; its locators will be aligned with the completed banking UI when replay is implemented.

## Project-local agent skills

Official Convex skills are installed under `.agents/skills/`, with Claude's project-local copies under `.claude/skills/` and provenance in `skills-lock.json`. Refresh with `npx convex ai-files install`. The installer also maintains the Convex guidance sections in AGENTS.md/CLAUDE.md and `convex/_generated/ai/guidelines.md`. No global skill installation is needed.

The official Microsoft Playwright CLI and TypeScript-adapted Anthropic skills remain in `.agents/skills/`. Skills are developer instructions, not runtime dependencies.

## Model credentials and CI

When live discovery is implemented, configure `ANTHROPIC_API_KEY` locally; never send it in chat or prefix it with `VITE_`. Environment loading for discovery remains future work.

CI uses GitHub-hosted Ubuntu runners, Node.js 22, pinned actions, npm caching, read-only repository permissions, bounded runtime, and cancellation of superseded runs. [Blacksmith requires an organization-owned repository](https://docs.blacksmith.sh/introduction/quickstart); the personal repo remains on GitHub-hosted runners. Making Quality checks mandatory at merge requires a separate repository rule.

Every implementation PR stops for user review. UI components use shadcn and follow React best practices.

## UX acceptance

See [UX review](docs/UX.md) for the current search/navigation acceptance criteria. Basic usability is part of each feature PR, not a deferred polish milestone.
