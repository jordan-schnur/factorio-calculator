// Byproducts bar state: dismissed blocks (localStorage), the applied fix with its Undo, and findFixes' trials.
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
        const list = JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]")
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
    for (const key of keys) on ? dismissed.add(key) : dismissed.delete(key)
    saveDismissed()
}

// Recipe plus leftover items, so a new leftover from the same recipe brings the warning back.
export function blockKey(block) {
    const items = block.items.map(({ item }) => item.key).sort().join(",")
    return `${block.recipe ? block.recipe.key : ""}:${items}`
}

export function rateText(rate) {
    return `${spec.format.rate(rate)}${RATE_LABEL[spec.format.rateName] || "/min"}`
}

// Machines in a solution: total and per building name, counted the way the footer counts them.
function summarize(totals) {
    let machines = 0
    const byBuilding = new Map()
    for (const row of buildRows(totals)) {
        if (!row.isReal) continue
        const count = buildingCount(row)
        if (count === 0) continue
        const name = spec.getBuilding(row.recipe).name
        byBuilding.set(name, (byBuilding.get(name) || 0) + count)
        machines += count
    }
    const surplus = new Map()
    for (const item of totals.surplus.keys()) surplus.set(item.key, item)
    const imports = new Set()
    for (const [recipe, rate] of totals.rates) {
        if (recipe.isReal() && recipe.isDisable() && !rate.isZero()) imports.add(recipe.products[0].item.key)
    }
    return { surplus, imports, machines, byBuilding }
}

// Puts spec.disable back to `snapshot`, enabling before disabling so no item passes through a state with no producer.
function restoreDisable(snapshot) {
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

export function unresearched() {
    const fetched = spec.saveState && spec.saveState.fetched
    return new Set((fetched && fetched.disabled_recipes) || [])
}

export function computeFixes(totals, blocks) {
    const base = summarize(totals)
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
    const disabled = new Set(spec.disable)
    const sendOut = new Set(spec.sendOut)
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
        for (const r of fix.enable) if (spec.disable.has(r)) spec.setEnable(r)
        for (const r of fix.disable) if (!spec.disable.has(r)) spec.setDisable(r)
        markOverride("recipes")
    }, text)
}

export function applySendOut(block, text) {
    apply(() => {
        for (const { item } of block.items) spec.sendOut.add(item.key)
    }, text)
}

// Svelte action: appends sprite icon and scrolls byproducts bar into view.
export function showByproducts() {
    document.getElementById("byproducts")?.scrollIntoView({ block: "nearest", behavior: "smooth" })
}
