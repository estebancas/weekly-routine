# AGENTS.md

Shared rules for any AI coding agent working in this repository (Claude Code, Codex, Cursor, or otherwise). `CLAUDE.md` holds the full architecture/commands reference — read that too; despite the name, its content applies regardless of which agent is reading it.

## Rules

- **Ship unit tests with every feature or bug fix.** Any change to `src/` that adds behavior or fixes a bug must come with corresponding tests in `tests/unit/` (or `tests/integration/` when the change is a cross-module flow best verified end to end). Follow the existing Vitest conventions in `CLAUDE.md`'s Tests section, and keep the 90% coverage gate (`npm test`) green.
- **Branch naming.** See `CONTRIBUTING.md`.
