// Which recipe makes an item: the Recipe options a row's detail offers, and "use only this".
import { spec } from "./factory.js"
import { machineWord, pluralise } from "./flow-core.js"
import { zero } from "./rational.js"
import { markOverride } from "./savesettings.js"
import { relevantCandidates, isRecycling, shareOf, shareText } from "./source-core.js"

function allowedOnSelectedPlanets(recipe) {
    if (!spec.planets || spec.selectedPlanets.size === 0) return true
    for (let planet of spec.selectedPlanets) {
        if (planet.allows(recipe)) return true
    }
    return false
}

// The recipes worth offering for an item, in recipe order. Save-locked
// ("not researched") recipes are included on purpose: Jordan sometimes
// needs an older recipe than his research suggests.
export function relevantRecipes(item) {
    let byKey = new Map()
    let candidates = []
    for (let recipe of item.recipes) {
        if (recipe.isDisable()) continue
        byKey.set(recipe.key, recipe)
        candidates.push({
            key: recipe.key,
            order: recipe.order,
            recycling: isRecycling(recipe.key),
            net: recipe.isNetProducer(item),
            allowed: allowedOnSelectedPlanets(recipe),
        })
    }
    return relevantCandidates(candidates).map(c => byKey.get(c.key))
}

function lockedKeys() {
    let fetched = spec.saveState && spec.saveState.fetched
    return new Set((fetched && fetched.disabled_recipes) || [])
}

export function isTargetItem(item) {
    return spec.buildTargets.some(t => t.item === item)
}

function amountText(amount) {
    return amount.toDecimal(2)
}

// One entry per relevant recipe, with the machines each would need at the item's current total rate.
export function sourceOptions(item, totals) {
    let itemRate = (totals && totals.items.get(item)) || zero
    let producers = (totals && totals.producers.get(item)) || new Map()
    let locked = lockedKeys()
    let ignored = spec.ignore.has(item)
    let isTarget = isTargetItem(item)
    let total = itemRate.toFloat()
    let options = []
    for (let recipe of relevantRecipes(item)) {
        let contributed = producers.get(recipe) || zero
        let share = ignored ? 0 : shareOf(contributed.toFloat(), total)
        let recipeRate = itemRate.isZero() ? zero : itemRate.div(recipe.gives(item))
        let building = spec.getBuilding(recipe)
        let exact = building === null ? zero : spec.getCount(recipe, recipeRate)
        let count = Math.ceil(exact.toFloat())
        let ins = recipe.ingredients.map(ing => `${amountText(ing.amount)} ${ing.item.name.toLowerCase()}`).join(" + ")
        options.push({
            kind: "recipe",
            key: recipe.key,
            recipe,
            name: recipe.name,
            thing: building || recipe,
            inUse: share > 0,
            shareText: shareText(share),
            locked: locked.has(recipe.key),
            line: `${ins} → ${amountText(recipe.gives(item))} · ${recipe.time.toDecimal(1)} s${building ? " · " + building.name : ""}`,
            countText: building ? pluralise(count, machineWord(building)) : "",
            exactText: building ? `${exact.toDecimal(1)} exactly` : "",
        })
    }
    // A share only means something when several recipes are in use.
    if (options.filter(o => o.inUse).length < 2) {
        for (let o of options) o.shareText = ""
    }
    return {item, itemRate, ignored, isTarget, options}
}

// "Use only this": the picked recipe becomes the item's only enabled
// relevant recipe. Enable first so the item never passes through a
// producer-less state (setDisable does priority bookkeeping on that).
export function useOnly(item, recipe) {
    if (spec.ignore.has(item)) spec.toggleIgnore(item)
    if (spec.disable.has(recipe)) spec.setEnable(recipe)
    for (let other of relevantRecipes(item)) {
        if (other !== recipe && !spec.disable.has(other)) spec.setDisable(other)
    }
    markOverride("recipes")
    spec.updateSolution()
}
