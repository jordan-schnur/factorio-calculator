# Factorio Calculator

A production-rate calculator for [Factorio](https://factorio.com/) 2.0 and
Space Age: pick what you want to make and how fast, and it works out every
machine, belt and input behind it.

**Use it:** https://jordanschnur.com/factorio-calculator/

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

It is all static files. Serve this folder with any HTTP server:

```text
python3 -m http.server 8000
```

then open http://localhost:8000/calc.html.

This repo is also the calculator inside the Factorio Companion (a Claude
Desktop MCP server), whose local server adds extras the static site hides:
reading settings from your save and adding a plan to a board.

## Licence

Apache-2.0, as upstream: see `LICENSE` and `NOTICE-factorio-companion.md`.
Factorio's item and machine icons are Wube Software's.
