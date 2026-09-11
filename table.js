// calc/table.js — builds the row shape used by the Ledger, plus the
// building-count/power helpers so every panel's totals agree.
import { spec } from "./factory.js"
import { formatPower } from "./power.js"
import { zero } from "./rational.js"

// A recipe row's raw material: totals.rates carries the real crafting
// recipes alongside two kinds of pseudo-recipe that are not factory rows --
// the solver's "output"/"surplus" sinks (isReal() false) and the "D-"
// DisabledRecipe standing in for an ignored/unproducible item (isDisable()
// true, isReal() true despite the name -- it is the item being *supplied*,
// not a sink).
export function buildRows(totals) {
    const targets = new Set(spec.buildTargets.map(t => t.item))
    const rows = []
    for (const [recipe, recipeRate] of totals.rates) {
        if (!recipe.isReal()) {
            continue
        }
        const item = recipe.products[0].item
        const itemRate = totals.items.get(item) || zero
        const supplied = recipe.isDisable ? recipe.isDisable() : false
        rows.push({
            key: recipe.key,
            name: item.name,
            isReal: !supplied,
            isResource: recipe.isResource(),
            category: recipe.category,
            isTarget: recipe.products.some(p => targets.has(p.item)),
            rate: itemRate.toFloat(),
            recipe,
            item,
            recipeRate,
            itemRate,
        })
    }
    return rows
}

// The building total in #factory-totals/#inputs must always agree, and
// neither can be a fraction of a building: roundMachines only controls what
// a single row's own cell displays, not what the two totals add up.
export function buildingCount(row) {
    if (!row.isReal) {
        return 0
    }
    const building = spec.getBuilding(row.recipe)
    if (building === null) {
        return 0
    }
    return Math.ceil(spec.getCount(row.recipe, row.recipeRate).toFloat())
}

// Wraps formatPower with the current spec so every caller's power total
// uses the same display precision.
export function powerRepr(x) {
    return formatPower(x, spec.format)
}
