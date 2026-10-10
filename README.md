# Factorio Calculator

A production-rate calculator for [Factorio](https://factorio.com/) 2.0 and
Space Age: pick what you want to make and how fast, and it works out every
machine, belt and input behind it.

**Use it:** https://factoriocalculator.app/

It is a fork of Kirk McDonald's [Factorio Calculator](https://kirkmcdonald.github.io/calc.html)
([source](https://github.com/KirkMcDonald/kirkmcdonald.github.io), Apache-2.0).
The solver and data model are his; the page around them is new:

- **Table first.** One row per item, grouped Build here / Bring in from
  another build / Mine or pipe in. Open a row for what it needs, where it
  goes, machine ratios ("1 offshore pump feeds 9.6 foundries"), the recipe
  and the machine, per row or for the whole build.
- **Graph.** The same plan as a left-to-right flow. Every item's lines have
  their own colour and dash pattern. Hover or click a card and each of its
  lines says its rate, belts ("1 1/3 belts") and how many machines on each
  end it takes ("32 of 56 send this").
- **Colour-blind mode** (Settings > Display) writes the colour on belt,
  splitter and inserter icons.
- Nickname search ("red science 60, gears, blue chip 45"), a scratch pad,
  and the whole plan in the link, so a link is the plan.

## Running it locally

It is a Svelte 5 + Vite app that builds to static files:

```text
npm ci
npm run dev        # http://localhost:5173/calc.html, with hot reload
npm run build      # the site, prerendered, in dist/
npm run preview    # serve dist/ on http://127.0.0.1:8000/calc.html
```

`src/components/` holds the Svelte components and `src/lib/` the solver
plus the UI modules still being moved to components. `public/` (data,
images, the changelog) is served as-is. The code rules are in `CLAUDE.md`.

This repo is also the calculator inside the Factorio Companion (a Claude
Desktop MCP server), whose local server adds extras the static site hides:
reading settings from your save and adding a plan to a board.

## Tests

`tests/e2e/` is a Playwright suite that pins down what the page does: the
plan it works out for a link, what every control changes, the link it
writes back and how each state looks. It drives the page only as a player
would and reads back what the page shows, so it is the check that a
rewrite (to a framework, say) still behaves the same.

```text
npm ci
npx playwright install chromium
npm test                      # build, then the whole suite against dist/
npx playwright test golden    # one spec file, by name
npm run test:update           # refresh snapshots after an intended change
npm run test:ui               # watch and debug
```

- `tests/e2e/support/` holds the only code that knows the markup:
  `selectors.ts` (core hooks), `areas/*.ts` (per-feature hooks),
  `calculator.ts` (the page object). A rewrite that changes the markup
  updates those files, and every spec should then pass unchanged.
- `specs/golden.spec.ts` holds 45 plans across every dataset. Each plan's
  table, footer, graph and written link are compared with JSON snapshots in
  `__snapshots__/golden.spec.ts/`, and each link must reopen to the same
  plan.
- `specs/visual.spec.ts` compares screenshots with the PNGs in
  `__snapshots__/visual.spec.ts/`. They are rendered on Linux Chromium with
  the vendored Titillium Web, so refresh them on the machine (or CI) that
  runs the gate.
- Every test fails on any page or console error, and nothing is fetched
  from outside the site. The Google Fonts requests are answered from
  `tests/e2e/fixtures/fonts/`.
- CI (`.github/workflows/test.yml`) runs the suite on every pull request
  and branch push. On `main`, `deploy.yml` runs it first and publishes the
  site only when it passes. To regenerate snapshots on the CI machine, run
  the Test workflow by hand with "update snapshots" ticked, then download
  the `snapshots` artifact.
- To run the suite against another build, set `CALC_BASE_URL` to its
  address and `CALC_PAGE` to the page path (default `/calc.html`).

## Licence

Apache-2.0, as upstream: see `LICENSE` and `NOTICE-factorio-companion.md`.
Factorio's item and machine icons are Wube Software's.
