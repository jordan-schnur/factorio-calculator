// Pure row-grouping and label logic for the item table -- no DOM, no
// spec/solver imports.

// Shared between table.js, details.js, footer.js, flow.js, source.js and
// itemtable.js so every rate readout abbreviates its display unit the same
// way.
export const RATE_LABEL = { s: "/s", m: "/min", h: "/h" }

// row.itemRate may be a plain number (tests) or a Rational (real rows,
// which have no usable "-" operator); normalise to a float for ordering.
function rateValue(itemRate) {
    return typeof itemRate === "number" ? itemRate : itemRate.toFloat()
}

// Groups rows for the item table (rows: [{item: {key, phase}, isTarget,
// isReal, isResource, itemRate}]). `ranks` is Map<itemKey, depth> --
// consumer-distance from a build target, as computed by the caller (see
// itemtable.js). A row belongs to exactly one group, in priority order:
// target/built beats mined even when the target itself is a raw resource.
export function groupForTable(rows, ranks) {
    const used = new Set()
    const take = pred => {
        const picked = rows.filter(r => !used.has(r) && pred(r))
        picked.forEach(r => used.add(r))
        return picked
    }
    const targets = take(r => r.isTarget)
    const built = take(r => r.isReal && !r.isResource).sort((a, b) => {
        const da = ranks.get(a.item.key) ?? 0
        const db = ranks.get(b.item.key) ?? 0
        return da - db || rateValue(b.itemRate) - rateValue(a.itemRate)
    })
    const broughtIn = take(r => !r.isReal)
    const mined = take(r => r.isResource)
    mined.sort((a, b) => (a.item.phase === "fluid") - (b.item.phase === "fluid"))
    return [
        { name: "Build here", rows: [...targets, ...built], machHdr: "Machines" },
        { name: "Bring in from another build", rows: broughtIn, machHdr: "" },
        { name: "Mine or pipe in", rows: mined, machHdr: "Drills" },
    ]
}
