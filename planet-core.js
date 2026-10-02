// calc/planet-core.js — the surface-condition checks behind planet.js's
// recipe filter. Pure: plain data in (the dataset's surface_conditions
// lists and crafting_machines rows), so node can test it.

// True when `properties` (Map of the planet's surface properties) satisfies
// every condition; a property the planet leaves out takes its default.
export function meets(conditions, properties, defaults) {
    for (let {property, min, max} of conditions || []) {
        let value = properties.get(property)
        if (value === undefined) {
            value = defaults.get(property)
        }
        if (min !== undefined && min !== null && !(value >= min)) {
            return false
        }
        if (max !== undefined && max !== null && !(value <= max)) {
            return false
        }
    }
    return true
}

// The crafting categories no machine can run on this planet: every machine
// listing the category has surface conditions the planet fails (the crusher
// is space-only, so crushing is blocked on every planet).
export function blockedCategories(machines, properties, defaults) {
    let open = new Set()
    let seen = new Set()
    for (let machine of machines) {
        let ok = meets(machine.surface_conditions, properties, defaults)
        for (let category of machine.crafting_categories) {
            seen.add(category)
            if (ok) {
                open.add(category)
            }
        }
    }
    let blocked = new Set()
    for (let category of seen) {
        if (!open.has(category)) {
            blocked.add(category)
        }
    }
    return blocked
}
