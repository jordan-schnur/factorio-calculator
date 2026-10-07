// calc/byproducts.js - the Byproducts bar's state: dismissed blocks (kept in
// this browser's localStorage), the applied fix with its Undo, and the trial
// machinery byproduct-core.js's findFixes needs to prove one. Byproducts.svelte
// and its subcomponents render it.
import { SvelteSet } from "svelte/reactivity"
import { cheapest, findFixes } from "./byproduct-core.js"
import { spec } from "./factory.js"
import { markOverride } from "./savesettings.js"
import { relevantRecipes } from "./source.js"
import { RATE_LABEL } from "./table-core.js"
import { buildingCount, buildRows } from "./table.js"

const DISMISSED_KEY = "calc.dismissedByproducts"

function loadDismissed() {
    try {
        let list = JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]")
        return new SvelteSet(Array.isArray(list) ? list : [])
    } catch (e) {
        return new SvelteSet()
    }
}

export const dismissed = loadDismissed()

function saveDismissed() {
    try {
        if (dismissed.size > 0) {
            localStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissed]))
        } else {
            localStorage.removeItem(DISMISSED_KEY)
        }
    } catch (e) {
        // Storage blocked: the dismissal lasts until the page reloads.
    }
}

export function setDismissed(keys, on) {
    for (let key of keys) on ? dismissed.add(key) : dismissed.delete(key)
    saveDismissed()
}

// The recipe and the items it leaves over: a new leftover from the same
// recipe brings the warning back.
export function blockKey(block) {
    let items = block.items.map(({ item }) => item.key).sort().join(",")
    return `${block.recipe ? block.recipe.key : ""}:${items}`
}

export function rateText(rate) {
    return `${spec.format.rate(rate)}${RATE_LABEL[spec.format.rateName] || "/min"}`
}

// Machines in a solution: total and per building name, counted the way the footer counts them.
function summarize(totals) {
    let machines = 0
    let byBuilding = new Map()
    for (let row of buildRows(totals)) {
        if (!row.isReal) continue
        let count = buildingCount(row)
        if (count === 0) continue
        let name = spec.getBuilding(row.recipe).name
        byBuilding.set(name, (byBuilding.get(name) || 0) + count)
        machines += count
    }
    let surplus = new Map()
    for (let item of totals.surplus.keys()) surplus.set(item.key, item)
    let imports = new Set()
    for (let [recipe, rate] of totals.rates) {
        if (recipe.isReal() && recipe.isDisable() && !rate.isZero()) imports.add(recipe.products[0].item.key)
    }
    return { surplus, imports, machines, byBuilding }
}

// Puts spec.disable back to `snapshot`, enabling before disabling so no item passes through a state with no producer.
function restoreDisable(snapshot) {
    for (let r of [...spec.disable]) if (!snapshot.has(r)) spec.setEnable(r)
    for (let r of snapshot) if (!spec.disable.has(r)) spec.setDisable(r)
}

function trial({ enable, disable }) {
    let disabled = new Set(spec.disable)
    let ignored = new Set(spec.ignore)
    let saved = [spec.targetNotes, spec.lastTableau, spec.lastMetadata, spec.lastPartial, spec.lastSolution]
    try {
        for (let r of enable) if (spec.disable.has(r)) spec.setEnable(r)
        for (let r of disable) if (!spec.disable.has(r)) spec.setDisable(r)
        return summarize(spec.solve())
    } finally {
        restoreDisable(disabled)
        for (let item of [...spec.ignore]) if (!ignored.has(item)) spec.toggleIgnore(item)
        for (let item of ignored) if (!spec.ignore.has(item)) spec.toggleIgnore(item)
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

export function unresearched() {
    let fetched = spec.saveState && spec.saveState.fetched
    return new Set((fetched && fetched.disabled_recipes) || [])
}

export function computeFixes(totals, blocks) {
    let base = summarize(totals)
    return blocks.map(block => {
        let fixes = findFixes(block, {
            base,
            trial,
            consumersOf,
            producersOf: relevantRecipes,
            isOff: r => spec.disable.has(r),
            isBlocked,
            makesTarget: block.recipe ? makesTarget(block.recipe) : false,
        })
        return { fixes, base, best: cheapest(fixes) }
    })
}

// The last fix applied, with its Undo; raw so its `totals` stays === plan.totals.
let appliedState = $state.raw(null)

export const applied = {
    get current() {
        return appliedState
    },
    set current(value) {
        appliedState = value
    },
}

function apply(change, text) {
    let disabled = new Set(spec.disable)
    let sendOut = new Set(spec.sendOut)
    change()
    spec.updateSolution()
    spec.setHash()
    applied.current = {
        text,
        totals: spec.lastTotals,
        undo() {
            applied.current = null
            restoreDisable(disabled)
            spec.sendOut = sendOut
            spec.updateSolution()
            spec.setHash()
        },
    }
}

export function applyRecipes(fix, text) {
    apply(() => {
        for (let r of fix.enable) if (spec.disable.has(r)) spec.setEnable(r)
        for (let r of fix.disable) if (!spec.disable.has(r)) spec.setDisable(r)
        markOverride("recipes")
    }, text)
}

export function applySendOut(block, text) {
    apply(() => {
        for (let { item } of block.items) spec.sendOut.add(item.key)
    }, text)
}

// A Svelte action: appends the sprite icon.make() builds, tooltip and all, to `node`.
export function icon(node, [iconObj, size]) {
    node.appendChild(iconObj.make(size, true))
}

// Scrolls the bar into view: the "backs up" markers on table rows and graph cards call this.
export function showByproducts() {
    document.getElementById("byproducts")?.scrollIntoView({ block: "nearest", behavior: "smooth" })
}
