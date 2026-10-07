# Factorio Calculator

A static production calculator (factoriocalculator.app), being migrated from vanilla JS + d3 to **Svelte 5 + Vite** on `framework/svelte`.

## Code quality tenets (MUST follow; full text in `.claude/rules/code-quality.md`)

1. **No comments over one line.**
2. **Reuse components.** Check `src/components/` first; the same markup twice is a component.
3. **An element that needs more than 3 classes should usually be a component**, likely with variants as props.

## Svelte practices (MUST follow; full text in `.claude/rules/svelte.md`)

- `$derived` for values, `$effect` only to sync with the outside world, `$state.raw` for big replaced objects.
- Keyed each blocks, callback props, no `addEventListener`, no inline styles, small components, logic in `src/lib`.

## Merging (MUST follow; full text in `.claude/rules/merging.md`)

- All tests pass on every merge: run `npm run verify` on the merged result; zero failures, and a flake counts as a failure.

## Checks and review

- `npm run check` runs ESLint, svelte-check and `scripts/check-rules.mjs` (one-line comments, <= 3 classes, <= 3 copies of any block). CI runs it.
- `scripts/rules-baseline.json` lists legacy violations; counts only go down (`npm run rules -- --update-baseline` lowers them, never raises).
- After each unit of work, run the `code-reviewer` agent (`.claude/agents/code-reviewer.md`) and fix its findings before merging.

## Layout

- `calc.html`: the page shell; `npm run build` prerenders `src/App.svelte` into it.
- `src/components/`: Svelte components. `src/lib/`: the solver and the legacy UI modules still being migrated.
- `src/styles/`: global CSS. `public/`: data, images and pages served as-is.

## Migration rules

- Svelte 5 runes only (`$state`, `$derived`, `$props`, `$effect`); no legacy `export let` or stores.
- Migrate one legacy UI module at a time: write its component, delete the module's DOM code, keep the solver untouched.
- The bridge is `src/lib/plan.svelte.js`: components read the solved plan from it, never from `registerRenderer`.
- The e2e suite is the contract: `npm test` must pass, screenshots included. Only `tests/e2e/support/` may change to follow new markup; specs stay as they are.

## Commands

- `npm run verify`: every check plus the whole e2e suite; must pass before any merge is done.
- `npm run check`: lint, svelte-check and the hard rules.
- `npm run dev`: Vite dev server. `npm run build`: production build to `dist/`. `npm test`: build, then the Playwright suite against `dist/`.
