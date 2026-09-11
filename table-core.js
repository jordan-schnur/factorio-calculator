// Pure row-grouping and label logic for the Factory table -- no DOM, no
// spec/solver imports, so it can run under plain node (see
// tests/js/calc_table_check.mjs).
//
// rows: [{key, name, isReal, isResource, category, isTarget, rate}] with rate a number (per second)
export const SECTIONS = ["Target", "Intermediates", "Smelting", "Mining", "Supplied from elsewhere"]

// Shared between table.js, details.js and bringin.js so every rate readout
// abbreviates its display unit the same way.
export const RATE_LABEL = { s: "/s", m: "/min", h: "/h" }

export function sectionOf(row) {
    if (!row.isReal) return "Supplied from elsewhere"
    if (row.isTarget) return "Target"
    if (row.isResource) return "Mining"
    if (row.category === "smelting") return "Smelting"
    return "Intermediates"
}

export function groupRows(rows) {
    const out = SECTIONS.map(name => ({ name, rows: [] }))
    for (const r of rows) out.find(s => s.name === sectionOf(r)).rows.push(r)
    for (const s of out) s.rows.sort((a, b) => b.rate - a.rate || a.name.localeCompare(b.name))
    return out.filter(s => s.rows.length)
}

export function laneNote(belts) {   // belts: number of full belts
    if (belts <= 0.5) return "one lane is enough"
    if (belts <= 1) return "one belt"
    return `${Math.ceil(belts)} belts`
}

export function machineSummary(counts) {  // counts: [{building: "assembling-machine-2", count: 7}, ...] -> "16 assemblers, 8 furnaces, 30 drills"
    const total = {}
    for (const c of counts) { const k = c.building.includes("furnace") ? "furnaces" : c.building.includes("drill") ? "drills" : c.building.includes("assembling") ? "assemblers" : c.building; total[k] = (total[k] || 0) + c.count }
    return Object.entries(total).map(([k, n]) => `${n} ${k}`).join(", ")
}
