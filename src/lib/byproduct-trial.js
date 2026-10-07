// calc/byproduct-trial.js — findFixes' trials against the real spec, kept apart from byproduct-core.js (pure) because every function here touches spec.
import { cheapest, findFixes } from "./byproduct-core.js"
import { spec } from "./factory.js"
import { relevantRecipes } from "./source.js"
import { buildRows, countMachines } from "./table.js"

// Machines plus what the solution leaves over and brings in -- the shape findFixes needs to tell one solve's result from another's.
function summarize(totals) {
    const { machines, byBuilding } = countMachines(buildRows(totals))
    const surplus = new Map()
    for (const item of totals.surplus.keys()) surplus.set(item.key, item)
    const imports = new Set()
    for (const [recipe, rate] of totals.rates) {
        if (recipe.isReal() && recipe.isDisable() && !rate.isZero()) imports.add(recipe.products[0].item.key)
    }
    return { surplus, imports, machines, byBuilding }
}

// Puts spec.disable back to `snapshot`, enabling before disabling so no item passes through a state with no producer.
export function restoreDisable(snapshot) {
    for (const r of [...spec.disable]) if (!snapshot.has(r)) spec.setEnable(r)
    for (const r of snapshot) if (!spec.disable.has(r)) spec.setDisable(r)
}

function trial({ enable, disable }) {
    const disabled = new Set(spec.disable)
    const ignored = new Set(spec.ignore)
    const saved = [spec.targetNotes, spec.lastTableau, spec.lastMetadata, spec.lastPartial, spec.lastSolution]
    try {
        for (const r of enable) if (spec.disable.has(r)) spec.setEnable(r)
        for (const r of disable) if (!spec.disable.has(r)) spec.setDisable(r)
        return summarize(spec.solve())
    } finally {
        restoreDisable(disabled)
        for (const item of [...spec.ignore]) if (!ignored.has(item)) spec.toggleIgnore(item)
        for (const item of ignored) if (!spec.ignore.has(item)) spec.toggleIgnore(item)
        ;[spec.targetNotes, spec.lastTableau, spec.lastMetadata, spec.lastPartial, spec.lastSolution] = saved
    }
}

function consumersOf(item) {
    return item.uses.filter(r => !r.isDisable())
}

function isBlocked(recipe) {
    return Boolean(spec.planetaryBaseline && spec.planetaryBaseline.has(recipe))
}

function makesTarget(recipe) {
    return spec.buildTargets.some(t => recipe.products.some(p => p.item === t.item))
}

// Recipe keys the save hasn't researched yet.
function unresearched() {
    const fetched = spec.saveState && spec.saveState.fetched
    return new Set((fetched && fetched.disabled_recipes) || [])
}

export function computeFixes(totals, blocks) {
    const base = summarize(totals)
    const locked = unresearched()
    return blocks.map(block => {
        const fixes = findFixes(block, {
            base,
            trial,
            consumersOf,
            producersOf: relevantRecipes,
            isOff: r => spec.disable.has(r),
            isBlocked,
            makesTarget: block.recipe ? makesTarget(block.recipe) : false,
        })
        for (const fix of fixes) fix.locked = fix.enable.some(r => locked.has(r.key))
        return { fixes, base, best: cheapest(fixes) }
    })
}
