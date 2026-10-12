import { num } from "./modules-core.js"

// A quality badge half the icon's size, never under 8px.
export function badgeSize(size) {
    return Math.max(8, Math.round(size / 2))
}

// The filled beacon slots as {module, tier}, in slot order.
export function beaconSlots(beaconModules, tiers) {
    return beaconModules.map((module, i) => ({ module, tier: tiers[i] })).filter(slot => slot.module)
}

// A beacon count as a plain number, from a number or a Rational.
export function beaconNumber(count) {
    return num(count)
}

// {recipe, building} for every recipe in the solved plan made in a machine with module slots.
export function planRecipes(spec, totals) {
    let out = []
    if (!totals) return out
    for (let [recipe] of totals.rates) {
        if (!recipe.isReal() || recipe.isDisable()) continue
        let building = spec.getBuilding(recipe)
        if (building !== null && building.moduleSlots > 0) out.push({ recipe, building })
    }
    return out
}

// The plan's rows that fell back from productivity, for "In this plan that's: ...".
export function fellBackNames(spec, totals) {
    return planRecipes(spec, totals)
        .filter(({ recipe, building }) => !spec.handSet.has(recipe.key) && spec.resolveFor(recipe, building).fellBack === "recipe")
        .map(({ recipe }) => recipe.name)
}

// One By machine row per machine the plan uses, sorted by name.
export function machineRows(spec, totals) {
    let recipes = planRecipes(spec, totals)
    let machines = [...new Map(recipes.map(({ building }) => [building.key, building])).values()].sort((a, b) => a.name.localeCompare(b.name))
    return machines.map(machine => {
        let resolved = spec.resolveFor(null, machine)
        let count = num(resolved.beaconCount)
        let hand = recipes.filter(r => r.building === machine && spec.handSet.has(r.recipe.key)).map(r => r.recipe.name)
        return {
            machine,
            tier: spec.machineTier(machine),
            modules: [...resolved.modules],
            tiers: [...resolved.moduleTiers],
            beacons: count > 0 && resolved.beaconModules.some(m => m) ? count : 0,
            hand,
            own: spec.machineModules.has(machine.key),
        }
    })
}

// One Set by hand row per hand-set recipe in the plan, with copies of its live ModuleSpec arrays.
export function handRows(spec, totals) {
    return planRecipes(spec, totals).filter(({ recipe }) => spec.handSet.has(recipe.key)).map(({ recipe }) => {
        let ms = spec.getModuleSpec(recipe)
        return {
            recipe,
            modules: [...ms.modules],
            tiers: [...ms.moduleTiers],
            beaconModules: [...ms.beaconModules],
            beaconTiers: [...ms.beaconModuleTiers],
            beaconCount: ms.beaconCount,
            beaconTier: ms.beaconTier,
        }
    })
}
