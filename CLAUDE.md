# Waymark instructions for Claude Code

@AGENTS.md

AGENTS.md is the shared source of project instructions. Update shared conventions there instead of duplicating them here.

Read the project-local `.agents/skills/claude-api/SKILL.md` before Anthropic API work and `.agents/skills/playwright-cli/SKILL.md` before using that browser CLI. These paths are explicit references; do not assume automatic skill discovery by Claude Code from the shared .agents directory.

This file does not select a Claude model or configure Waymark's runtime API key. Keep credentials server-side and follow the current task's scope.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.

<!-- convex-ai-end -->
