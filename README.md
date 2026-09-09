# Waymark

Learn UI workflows once. Replay them reliably. Hand off when needed.

## Status

Initial project setup only. The banking demo, discovery loop, replay engine, and human handoff are not implemented yet.

## Setup

Use Node.js 22.12 or later on a supported release line, with npm.

```bash
npm ci
npx playwright install chromium
```

## Commands

```bash
npm run dev      # Start the frontend
npm run build    # Type-check and build the frontend
npm run lint     # Run ESLint
npm run preview  # Preview the production build
npm run format    # Format project source, configuration, and documentation
npm run format:check # Check formatting without modifying files
```

## Stack

- React, TypeScript, Vite, and React Compiler
- Tailwind CSS with the official Vite plugin
- Express for the future local demo backend
- Playwright for browser automation and Playwright Test for future integration tests
- Anthropic TypeScript SDK for LLM discovery
- Zod for runtime contracts
- tsx for running TypeScript backend and automation scripts

The backend and automation dependencies are installed but not wired up yet.

## Model credentials

No API key is required to run the current frontend. Future discovery runs will require a server-side `ANTHROPIC_API_KEY`. Copy `.env.example` to `.env` when configuring discovery. Environment-file loading will be wired into the runner. Never use a `VITE_` prefix for secrets: Vite exposes those variables to the browser.

## Coding skills

The official Microsoft `playwright-cli` and Anthropic `claude-api` skills were installed project-locally in `.agents/skills/`. They are developer tooling, not application dependencies, and are not installed by `npm ci`. There are no global copies of these two skills. The Playwright CLI is available locally through `npx playwright-cli`.

The Claude API skill is a local TypeScript-only adaptation of the official Anthropic skill; other language folders were removed. Shared references and the original license are retained.
