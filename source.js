// calc/source.js — which recipe makes an item, or bring it in from another
// build. `renderOptions` builds the option-row list (spec:
// 2026-09-11-calculator-source-chooser-design.md) that details.js's Recipe
// section renders for any item with more than one relevant recipe; picking
// a row applies it directly (`useOnly`/`bringIn`), there is no popover to
// open or anchor any more -- the rows live inline in the open table row or
// graph side card that details.js already redraws.
import { spec } from "./factory.js"
import { beltText, machineWord, pluralise } from "./flow-core.js"
import { zero } from "./rational.js"
import { markOverride } from "./savesettings.js"
import { relevantCandidates, isRecycling, shareOf, shareText } from "./source-core.js"
import { RATE_LABEL } from "./table-core.js"

function rateText(rate) {
    return spec.format.rate(rate) + (RATE_LABEL[spec.format.rateName] || "/min")
}

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

// One entry per relevant recipe (+ bring in for a non-target), with the
// machine count each would need at the item's current total rate.
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
            icon: building ? building.icon : recipe.icon,
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
    if (!isTarget) {
        let belts = item.phase === "fluid" ? "pipe" : beltText(spec.getBeltCount(itemRate).toFloat())
        options.push({
            kind: "bring-in",
            key: "bring-in",
            recipe: null,
            name: "Bring it in from another build",
            icon: item.icon,
            inUse: ignored,
            shareText: "",
            locked: false,
            line: `no machines here · ${belts} arriving`,
            countText: rateText(itemRate),
            exactText: "from elsewhere",
        })
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

export function bringIn(item) {
    if (isTargetItem(item) || spec.ignore.has(item)) return
    spec.toggleIgnore(item)
    spec.updateSolution()
}

function optionButton(state, option) {
    let button = document.createElement("button")
    button.type = "button"
    button.className = "opt" + (option.inUse ? " cur" : "") + (option.kind === "bring-in" && option.inUse ? " in" : "")
    button.dataset.option = option.key

    let mark = document.createElement("span")
    mark.className = "mark"
    mark.textContent = option.inUse ? "●" : "○"
    button.appendChild(mark)

    let slot = document.createElement("span")
    slot.className = "slot slot-sm"
    slot.appendChild(option.icon.make(24, true))
    button.appendChild(slot)

    let grow = document.createElement("span")
    grow.className = "grow"
    let name = document.createElement("span")
    name.className = "oname"
    name.textContent = option.name
    grow.appendChild(name)
    if (option.locked) {
        let badge = document.createElement("span")
        badge.className = "badge locked"
        badge.textContent = "not researched"
        grow.appendChild(document.createTextNode(" "))
        grow.appendChild(badge)
    }
    let line = document.createElement("span")
    line.className = "oline muted num"
    line.textContent = option.line
    grow.appendChild(line)
    button.appendChild(grow)

    let count = document.createElement("span")
    count.className = "ocount num"
    count.appendChild(document.createTextNode(option.countText + (option.shareText ? ` · ${option.shareText}` : "")))
    let exact = document.createElement("span")
    exact.className = "muted"
    exact.textContent = option.exactText
    count.appendChild(exact)
    button.appendChild(count)

    button.addEventListener("click", event => {
        event.stopPropagation()
        if (option.kind === "bring-in") bringIn(state.item)
        else useOnly(state.item, option.recipe)
    })
    return button
}

// The option rows for an item, as a fragment; shared by the table's open
// row and the graph side card's Recipe section (both via details.js).
export function renderOptions(item, totals) {
    let state = sourceOptions(item, totals)
    let fragment = document.createDocumentFragment()
    for (let option of state.options) {
        fragment.appendChild(optionButton(state, option))
    }
    return fragment
}

// Nothing left to wire up here: renderOptions' rows already carry their own
// click handlers (useOnly/bringIn, which re-solve on their own), and there
// is no popover state to track any more. Kept so initModules' call list
// doesn't need to know that.
export function initSource() {
}
