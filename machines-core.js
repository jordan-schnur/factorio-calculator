// calc/machines-core.js — which machines the page may plan with. Pure: no
// DOM, no spec. The save's `machines` payload (factorio_mcp.planning's
// machine_availability) sets the default; the Machines settings row lets
// the user switch any machine on or off by hand.

// Machine keys to exclude for the selected planets: everything not both
// researched and built on at least one of them. A planet with nothing
// built yet falls back to "researched".
export function excludedMachines(machines, planets) {
    let researched = new Set(machines.researched)
    let built = new Set()
    for (let planet of planets) {
        for (let key of (machines.built || {})[planet] || []) {
            built.add(key)
        }
    }
    let allowed = built.size > 0 ? new Set([...researched].filter(k => built.has(k))) : researched
    return machines.all.filter(k => !allowed.has(k)).sort()
}

// BuildingGroup's pick for a recipe of `category`: the first capable machine
// (in `buildings`' ascending order) that is the selected one or better, else
// the best capable one below it -- upstream's rule -- skipping `excluded`
// keys. When no allowed machine can make it at all, the upstream pick is
// kept and `fallback` is true, so the plan still solves and the page can
// say why.
export function pickBuilding(buildings, selected, category, excluded) {
    let allowed = choose(buildings, selected, category, excluded)
    if (allowed !== null || excluded.size === 0) {
        return { building: allowed, fallback: false }
    }
    let any = choose(buildings, selected, category, new Set())
    return { building: any, fallback: any !== null }
}

function choose(buildings, selected, category, excluded) {
    let b = null
    for (let building of buildings) {
        if (!building.categories.has(category) || excluded.has(building.key)) {
            continue
        }
        b = building
        if (building === selected || selected.less(building)) {
            return building
        }
    }
    return b
}
