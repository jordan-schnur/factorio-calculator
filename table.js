// calc/table.js — row shape shared by the Ledger (ledger.js) and the
// Inputs frame (inputs.js): one entry per real crafting recipe in the
// current solution, plus the building-count/power helpers both frames'
// totals need to agree on. No rendering lives here any more (Task 4 of the
// graph-first plan moved it to ledger.js); table-core.js still carries the
// pure grouping/label logic tests/js/calc_table_check.mjs exercises.
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

// Shared with inputs.js: the power formatter for its Totals section, so
// both frames' totals always agree. inputs.js still imports this as
// `powerRepr` with one argument, so it is wrapped with spec.format rather
// than touching inputs.js.
export function powerRepr(x) {
    return formatPower(x, spec.format)
}
