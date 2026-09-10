# Waymark

Learn UI workflows once. Replay them reliably. Hand off when needed.

## Status

Member search and milestone 1 contracts are implemented. Versioned capabilities, typed inputs/outputs, action targets, checkpoints, policy configuration, session states, and an adapter interface are covered by offline tests. The fictional banking demo supports member search. Profiles, savings details, executor, discovery, replay, and human handoff remain to be implemented.

See [Implementation plan](docs/PLAN.md) for the implementation sequence and acceptance criteria.

## Setup

Use Node.js 22.12 or later on a supported release line, with npm.

```bash
npm ci
npx playwright install chromium
```

## Commands

```bash
npm run dev      # Start both local API and frontend
npm run dev:api  # Start API with file watching (127.0.0.1:3001)
npm run dev:web  # Start frontend (127.0.0.1:5173)
npm run start:api # Start API without file watching
npm run build    # Type-check all code and build the frontend
npm run typecheck # Check frontend, automation, tests, and server code
npm test         # Run contract and API tests; no model key required
npm run lint     # Run ESLint
npm run preview  # Preview build at 127.0.0.1:4173; API must run separately
npm run test:browser # Run browser tests after npm run build; starts API/preview
npm run format    # Format project source, configuration, and documentation
npm run format:check # Check formatting without modifying files
```

## Stack

- React, TypeScript, Vite, and React Compiler
- Tailwind CSS with the official Vite plugin; shadcn/ui components (Radix Nova) with locally bundled Geist
- Express for the local fictional banking backend
- Playwright for browser automation and Playwright Test for desktop/mobile integration tests
- Anthropic TypeScript SDK for LLM discovery
- Zod for runtime contracts
- tsx for running TypeScript backend and automation scripts

Zod validates contracts, search queries, and API responses. The model and automation executor are not wired up yet.

## Model credentials

No API key is required for the banking demo or tests. Future discovery runs will require a server-side `ANTHROPIC_API_KEY`. Copy `.env.example` to `.env` when configuring discovery. Environment-file loading will be wired into the runner. Never use a `VITE_` prefix for secrets: Vite exposes those variables to the browser.

## Coding skills

The official Microsoft `playwright-cli` and Anthropic `claude-api` skills were installed project-locally in `.agents/skills/`. They are developer tooling, not application dependencies, and are not installed by `npm ci`. There are no global copies of these two skills. The Playwright CLI is available locally through `npx playwright-cli`.

The Claude API skill is a local TypeScript-only adaptation of the official Anthropic skill; other language folders were removed. Shared references and the original license are retained.

## Contract development

See [Contract boundaries](docs/CONTRACTS.md) for the v1 format and validation entry points. `tests/capability.fixture.ts` contains a **handwritten development example**, not genuine discovery evidence or an executable banking demo. Tests bind two fictional member IDs to the same unchanged artifact and validate exact decimal outputs.

TypeScript strict mode is enabled for all projects; automation/tests additionally check unchecked indexed access. Server and shared API contracts are checked by the same Node configuration. Runtime code stays under `automation/`, UI code under `src/`, and target backend code under `server/`, and browser-safe API schemas under `shared/`. No automation modules are imported into the frontend.

Each implementation PR uses small commits and stops for user review before the next PR. The UI composes shadcn primitives into focused, accessible React components.

## Continuous integration

`.github/workflows/ci.yml` runs `npm ci`, formatting, lint, contract/API tests, the all-project type check/production build, and Chromium desktop/mobile browser tests on every pull request and push to `main`. It also supports manual dispatch after the workflow reaches the default branch. The `Quality checks` job uses Node.js 22, npm caching, read-only repository permissions, a ten-minute timeout, and cancellation of superseded runs. Actions are pinned to commit SHAs.

The current personal repository uses GitHub-hosted Ubuntu 24.04 runners. [Blacksmith requires an organization-owned repository](https://docs.blacksmith.sh/introduction/quickstart). After an explicitly authorized transfer and Blacksmith installation for that repository, change `runs-on` to `blacksmith-2vcpu-ubuntu-2404`; the check steps can stay the same. This workflow does not change repository ownership, app permissions, or branch protection. Making `Quality checks` mandatory for merging requires a separate repository rule.

## Review the member search

Run `npm run dev`, then open [the local banking demo](http://127.0.0.1:5173). Search `DEMO-001` for Avery Morgan, `DEMO-002` for Jordan Ellis, `Morgan` for two results, or `DEMO-999` for no results. Search is case-insensitive; IDs match exactly and names match partially. Blank/whitespace and overlong queries are rejected. Editing a query clears previous results, and failed searches can be submitted again. Results are read-only in this slice; profiles and account navigation come next.

The server holds three fixed fictional records in memory, with no writes or database, so every startup gives the same dataset. To review slow/error states, stop the running dev command first, then use one of:

```bash
DEMO_SCENARIO=slow npm run dev        # 1.5-second lookup delay
DEMO_SCENARIO=unavailable npm run dev # Search returns HTTP 503
npm run dev                         # Restore normal behavior after stopping
```

Scenario selection is operator configuration, not a UI control or automation API. Requests time out in the frontend after ten seconds. Both servers bind to loopback; the frontend proxies `/api` to port 3001. Keep that port when using the default Vite proxy. These scripts are for local development and preview, not production hosting.

For browser checks, stop the dev servers (the test runner owns ports 3001/4173), then run `npm run build && npm run test:browser`. The 14 checks cover desktop and mobile Chromium. Successful/empty searches use the real API; controlled loading and failure/retry tests use explicitly labeled network fixtures. Four API tests separately exercise the real normal, slow, and unavailable server scenarios. Tests do not use a model, save screenshots/traces, or add test IDs to the UI.
