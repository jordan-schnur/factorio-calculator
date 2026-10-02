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
// say why. `chosen`, a machine picked for this one recipe by hand, wins
// over all of that (even over `excluded`) as long as it can make it.
export function pickBuilding(buildings, selected, category, excluded, chosen) {
    if (chosen && chosen.categories.has(category) && buildings.includes(chosen)) {
        return { building: chosen, fallback: false }
    }
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

// The machines in `buildings` that can make a recipe of `category`, in
// `buildings`' order.
export function capableBuildings(buildings, category) {
    return buildings.filter(b => b.categories.has(category))
}

// "Use this machine for everything in this build": the recipes among
// `recipes` (the plan's) that `building` can make.
export function recipesFor(building, recipes) {
    return recipes.filter(r => r.category !== null && r.category !== undefined && building.categories.has(r.category))
}

// The `mach=` fragment value <-> Map(recipe key -> machine key).
export function parseRecipeMachines(text) {
    let out = new Map()
    for (let pair of (text || "").split(",")) {
        let i = pair.lastIndexOf(":")
        if (i > 0 && i < pair.length - 1) {
            out.set(pair.slice(0, i), pair.slice(i + 1))
        }
    }
    return out
}

export function formatRecipeMachines(map) {
    return [...map.keys()].sort().map(k => `${k}:${map.get(k)}`).join(",")
}
