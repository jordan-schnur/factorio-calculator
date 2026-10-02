# Factorio Companion Calculator

This directory is a fork of Kirk McDonald's Factorio Calculator.

## Upstream Source

- **Repository:** https://github.com/KirkMcDonald/kirkmcdonald.github.io
- **Forked at commit:** 349ebfb5f0fe09145169b4b47bc1771f55c1a896
- **License:** Apache-2.0 (see `LICENSE` file in this directory, kept as-is)

## What's upstream's, what's ours

The solver and data model (`solve.js`, `simplex.js`, `matrix.js`, `cycle.js`,
`totals.js`, `factory.js`'s solving core, `rational.js`, `item.js`,
`recipe.js`, `building.js`, `module.js`, `belt.js`, `fuel.js`, `planet.js`,
`group.js`, `groups.js`, `priority.js`, `sort.js`, `icon.js`, `align.js`,
and the `data/` prototype dumps) are upstream's, ported onto this repo's
own dataset (`factorio_calc.dataset`).

The page, stylesheet and every UI module -- the Factorio-GUI-styled page
shell, nickname search, staged Factory table, Inputs frame, supplied-from-
elsewhere chips, scratch pad, flow graph, per-item "Where it goes" view,
save-derived settings, and the "Add to board" button -- are Factorio
Companion's own, built to plug into one renderer registry (`render.js`).

This fork is **not kept in sync with upstream**: changes land here as this
project needs them, not as upstream changes.

The calculator is served locally by `factorio_mcp.calcserver` (and
`factorio_mcp/calcroutes.py`'s `GET /api/calc/spec` for save-derived
settings) on port 8767 during use; it is never fetched from the network.
