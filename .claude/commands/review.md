---
description: Code review with the code-reviewer agent (hard rules + Svelte practices). Optional args: files, a branch or a commit range.
argument-hint: "[files | branch | range]"
---

Run the `code-reviewer` agent (`.claude/agents/code-reviewer.md`) on: $ARGUMENTS

If no arguments were given, it reviews the current branch against `main` plus uncommitted changes. Relay its verdict and findings to me as it reports them, ranked, without softening. Then ask whether to fix them; don't start fixing until I answer.
