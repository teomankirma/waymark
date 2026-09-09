# Waymark

Learn UI workflows once. Replay them reliably. Hand off when needed.

## Status

The frontend scaffold and milestone 1 contracts are implemented. Versioned capabilities, typed inputs/outputs, action targets, checkpoints, policy configuration, session states, and an adapter interface are covered by offline tests. The banking demo, executor, discovery loop, replay engine, and human handoff behavior are not implemented yet.

See [Implementation plan](docs/PLAN.md) for the implementation sequence and acceptance criteria.

## Setup

Use Node.js 22.12 or later on a supported release line, with npm.

```bash
npm ci
npx playwright install chromium
```

## Commands

```bash
npm run dev      # Start the frontend
npm run build    # Type-check all code and build the frontend
npm run typecheck # Check frontend, automation, tests, and future server code
npm test         # Run offline contract tests; no browser or model key required
npm run lint     # Run ESLint
npm run preview  # Preview the production build
npm run format    # Format project source, configuration, and documentation
npm run format:check # Check formatting without modifying files
```

## Stack

- React, TypeScript, Vite, and React Compiler
- Tailwind CSS with the official Vite plugin; shadcn/ui for upcoming UI components
- Express for the future local demo backend
- Playwright for browser automation and Playwright Test for future integration tests
- Anthropic TypeScript SDK for LLM discovery
- Zod for runtime contracts
- tsx for running TypeScript backend and automation scripts

Zod powers the contracts. The backend, browser automation, and model dependencies are not wired into execution yet.

## Model credentials

No API key is required to run the current frontend. Future discovery runs will require a server-side `ANTHROPIC_API_KEY`. Copy `.env.example` to `.env` when configuring discovery. Environment-file loading will be wired into the runner. Never use a `VITE_` prefix for secrets: Vite exposes those variables to the browser.

## Coding skills

The official Microsoft `playwright-cli` and Anthropic `claude-api` skills were installed project-locally in `.agents/skills/`. They are developer tooling, not application dependencies, and are not installed by `npm ci`. There are no global copies of these two skills. The Playwright CLI is available locally through `npx playwright-cli`.

The Claude API skill is a local TypeScript-only adaptation of the official Anthropic skill; other language folders were removed. Shared references and the original license are retained.

## Contract development

See [Contract boundaries](docs/CONTRACTS.md) for the v1 format and validation entry points. `tests/capability.fixture.ts` contains a **handwritten development example**, not genuine discovery evidence or an executable banking demo. Tests bind two fictional member IDs to the same unchanged artifact and validate exact decimal outputs.

TypeScript strict mode is enabled for all projects; automation/tests additionally check unchecked indexed access. Server code will be checked by the same Node configuration when introduced. Runtime code stays under `automation/`, UI code under `src/`, and future target backend code under `server/`. No automation modules are imported into the frontend.

Each implementation PR uses small commits and stops for user review before the next PR. UI work will initialize shadcn/ui and compose its primitives into focused, accessible React components.
