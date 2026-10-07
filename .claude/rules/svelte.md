# Svelte 5 practices (MUST follow)

Drawn from the official [Svelte best practices](https://svelte.dev/docs/svelte/best-practices) plus what this migration has learned. `npm run check` enforces what a linter can; the `code-reviewer` agent checks the rest.

## Reactivity

- Runes only: `$state`, `$derived`, `$props`, `$bindable`, `$effect`. No `export let`, `$:`, stores, `createEventDispatcher`, `on:`, `<slot>`, `<svelte:self>`.
- A value computed from other values is `$derived` (or `$derived.by` for multi-statement logic). Never compute in an `$effect` and assign it to `$state`.
- `$effect` is an escape hatch for syncing with the outside world (legacy d3 code, timers). It must not set state that drives its own inputs. Prefer `{@attach}` for DOM work.
- Use `$state.raw` for big objects that get replaced rather than mutated (the spec, solver totals, fetched data). Deep `$state` proxies break `===` identity between the same object reached by two paths; this has already hidden the "Fewest machines" badge once.
- Read the solved plan through `src/lib/plan.svelte.js` (`plan.spec`, `plan.totals`); call `refresh()` after changing the spec without a solve. Never `registerRenderer` from a component.
- `$state` only for values that drive the UI; plain `let` for everything else.

## Components

- Props via `$props()` destructuring with defaults. Communicate upward with callback props (`onpick`, `onsettings`), `$bindable` only for true two-way values.
- Content goes through snippets and `{@render children?.()}`.
- Keyed `{#each}` with a stable identity (an id or the object itself), never the index.
- Global listeners use `<svelte:window>` / `<svelte:document>` or `on()` from `svelte/events`, never `addEventListener`.
- Keep components small: script <= 150 lines, template <= 120, style <= 60 (lint-enforced). Past that, split it.
- Logic that doesn't touch the DOM lives in `src/lib/*-core.js` or a `.svelte.js` module as pure functions; components stay thin.
- Shared concerns get one helper, used everywhere: game icons via `iconOf` (`src/lib/icon-attach.js`), and the same goes for storage access, adding targets and formatting rates. Before writing a helper, grep for an existing one.

## Markup and styling

- Classes via `class={[...]}` arrays and objects; reserve `class:` directives for one-off toggles in existing markup.
- No `style="..."` attributes: use a scoped `<style>` class, or `style:prop={value}` for a dynamic value. Style child components through CSS custom properties, not `:global`.
- Every `<button>` has an explicit `type`.
- Fix accessibility warnings rather than silencing them; a `svelte-ignore` needs a reason the element can't be fixed (e.g. legacy-owned markup).

## SSR and hydration

- The page is prerendered in Node (`scripts/prerender.mjs`), so no `window`, `document` or `localStorage` at module top level or during render. Touch them in event handlers, `$effect` or attachments.
- With `plan.spec === null` a component renders exactly what the page shows before boot.
- Module-level `$state` is fine here (one prerender per build, one app per page); use context if that ever changes.

## Legacy interplay

- A component never removes or rewrites nodes that legacy modules own; legacy code never touches nodes a component owns.
- Don't give an element a `class={...}` expression if legacy code toggles classes on it.
- Migrating a module means deleting its DOM code, not wrapping it.
