// calc/table.js — builds the row shape used by the Ledger, plus the
// building-count/power helpers so every panel's totals agree.
import { isMultiOutput } from "./byproduct-core.js"
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
            // A recipe with several outputs (advanced oil processing) is
            // named for itself, not its first output: the row is the
            // refineries, and its outputs line lists all three fluids.
            name: isMultiOutput(recipe) ? recipe.name : item.name,
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

// Building count must always be a whole number: roundMachines only controls
// what a single row's own cell displays, not the actual building total.
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
