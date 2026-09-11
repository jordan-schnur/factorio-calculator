// calc/source.js — the card source chooser: where an item comes from. One
// popover (#source-pop) anchored under a card lists the item's relevant
// recipes (spec: 2026-09-11-calculator-source-chooser-design.md) and, for
// non-targets, "bring it in". Also builds the same option rows for the
// details card's Made by list.
import { spec } from "./factory.js"
import { beltText, machineWord, pluralise } from "./flow-core.js"
import { zero } from "./rational.js"
import { registerRenderer } from "./render.js"
import { markOverride } from "./savesettings.js"
import { relevantCandidates, isRecycling, shareOf, shareText } from "./source-core.js"
import { RATE_LABEL } from "./table-core.js"

let openItem = null      // item key the popover shows, or null
let openAnchor = null    // the card element it is anchored to
let lastTotals = null

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
        closeSourcePopover()
        if (option.kind === "bring-in") bringIn(state.item)
        else useOnly(state.item, option.recipe)
    })
    return button
}

// The option rows for an item, as a fragment; shared by the popover and
// the details card's Made by list.
export function renderOptions(item, totals) {
    let state = sourceOptions(item, totals)
    let fragment = document.createDocumentFragment()
    for (let option of state.options) {
        fragment.appendChild(optionButton(state, option))
    }
    return fragment
}

export function isSourceOpen(itemKey) {
    return openItem === itemKey
}

function positionPopover(pop, anchor) {
    let frame = document.getElementById("flow-frame")
    let fr = frame.getBoundingClientRect()
    let cr = anchor.getBoundingClientRect()
    let width = 372 + 24
    let left = Math.max(8, Math.min(cr.left - fr.left, fr.width - width - 8))
    let top = Math.max(8, Math.min(cr.bottom - fr.top + 6, fr.height - 80))
    pop.style.left = `${Math.round(left)}px`
    pop.style.top = `${Math.round(top)}px`
}

function renderPopover() {
    let pop = document.getElementById("source-pop")
    if (!pop) return
    let item = openItem ? spec.items.get(openItem) : null
    if (!item || !openAnchor || !openAnchor.isConnected) {
        pop.hidden = true
        pop.replaceChildren()
        openItem = null
        openAnchor = null
        return
    }
    let state = sourceOptions(item, lastTotals)
    pop.replaceChildren()
    pop.dataset.item = item.key

    let head = document.createElement("div")
    head.className = "head"
    let slot = document.createElement("span")
    slot.className = "slot slot-sm"
    slot.appendChild(item.icon.make(24, true))
    head.appendChild(slot)
    let title = document.createElement("span")
    title.className = "title"
    title.textContent = item.name
    head.appendChild(title)
    let sub = document.createElement("span")
    sub.className = "muted num"
    sub.textContent = `where it comes from · ${rateText(state.itemRate)}`
    head.appendChild(sub)
    let spacer = document.createElement("span")
    spacer.className = "spacer"
    head.appendChild(spacer)
    let close = document.createElement("button")
    close.type = "button"
    close.className = "x"
    close.id = "source-pop-close"
    close.textContent = "✕"
    close.addEventListener("click", event => { event.stopPropagation(); closeSourcePopover() })
    head.appendChild(close)
    pop.appendChild(head)

    for (let option of state.options) {
        pop.appendChild(optionButton(state, option))
    }

    let foot = document.createElement("div")
    foot.className = "muted"
    foot.style.fontSize = "11px"
    foot.textContent = state.isTarget
        ? "One recipe per item. A target is always made here."
        : "One recipe per item. An item this leaves without a recipe shows up as brought in, with its own ⌄."
    pop.appendChild(foot)

    pop.hidden = false
    positionPopover(pop, openAnchor)
}

export function closeSourcePopover() {
    if (openItem === null) return
    let was = openItem
    openItem = null
    openAnchor = null
    let pop = document.getElementById("source-pop")
    if (pop) { pop.hidden = true; pop.replaceChildren() }
    document.querySelectorAll(`#flow-nodes .node[data-item="${was}"] .ways.open`).forEach(el => el.classList.remove("open"))
}

// Opens the chooser for `itemKey` under `anchor` (the card element); a
// second call for the same item closes it.
export function toggleSourcePopover(itemKey, anchor) {
    if (openItem === itemKey) { closeSourcePopover(); return }
    closeSourcePopover()
    openItem = itemKey
    openAnchor = anchor
    renderPopover()
    let pill = anchor.querySelector(".ways")
    if (pill) pill.classList.add("open")
}

function render(_spec, totals) {
    lastTotals = totals
    if (openItem !== null) {
        // The cards were just redrawn: re-anchor to the new element.
        openAnchor = document.querySelector(`#flow-nodes .node[data-item="${openItem}"]`)
        renderPopover()
        let pill = openAnchor && openAnchor.querySelector(".ways")
        if (pill) pill.classList.add("open")
    }
}

export function initSource() {
    registerRenderer(render)
    document.addEventListener("pointerdown", event => {
        if (openItem === null) return
        if (event.target.closest("#source-pop") || event.target.closest(".ways")) return
        closeSourcePopover()
    })
    document.addEventListener("keydown", event => {
        if (event.key !== "Escape" || openItem === null) return
        closeSourcePopover()
        // One Escape closes one thing: the popover consumes it so the
        // ledger drawer's own Escape handler (header.js) keeps the drawer.
        event.stopImmediatePropagation()
    })
}
