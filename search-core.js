// calc/search-core.js — pure helpers for the target search box: no `window`,
// `document`, `d3`, `dagre` or `pako` at import time (see the plan's "Module
// rule" in Global Constraints), so tests/js/calc_search_check.mjs can import
// this directly under plain node.

// "red science 90" -> {query: "red science", rate: 90}; "gears" -> {query: "gears", rate: null}
// A count of machines instead of a rate: "yellow science 7 machines" (or
// "7 machine", "7x") -> {query: "yellow science", rate: 7, machines: true}.
// Any start of "machines" from "ma" counts, so results don't vanish mid-word;
// a lone "m" doesn't ("60m" reads as per minute).
export function parseQuery(text) {
    const m = /^(.*?)(?:\s+(\d+(?:\.\d+)?)\s*(ma(?:c(?:h(?:i(?:n(?:es?)?)?)?)?)?|x)?)?\s*$/i.exec(text || "")
    const out = { query: (m[1] || "").trim(), rate: m[2] === undefined ? null : Number(m[2]) }
    if (m[3] !== undefined) out.machines = true
    return out
}

// items: [{key, localized_name: {en}, group}] -> catalog-shaped entries with no aliases
export function datasetEntries(items) {
    return items.map(i => ({
        name: i.key,
        label: (i.localized_name && i.localized_name.en) || i.key,
        kind: "item",
        aliases: [],
        icon: null,
    }))
}

// catalog entries win by name; fallback fills the rest; only names in
// `fallback` (producible in this dataset) are kept. Technologies are never
// targets, and many share an item's name ("quality-module-2" is both) with
// a tierless label ("Quality module"), so they would overwrite the item.
export function mergeEntries(catalog, fallback) {
    const allowed = new Map(fallback.map(e => [e.name, e]))
    const out = new Map()
    for (const e of catalog) if (e.kind !== "technology" && allowed.has(e.name)) out.set(e.name, e)
    for (const [name, e] of allowed) if (!out.has(name)) out.set(name, e)
    return [...out.values()]
}

export function beltsToRate(belts, beltRatePerSecond) {
    return belts * beltRatePerSecond
}
