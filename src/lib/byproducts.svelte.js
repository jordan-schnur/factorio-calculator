// Byproducts bar state: dismissed blocks (localStorage), and the applied fix with its Undo.
import { SvelteSet } from "svelte/reactivity"
import { on as onEvent } from "svelte/events"
import { restoreDisable } from "./byproduct-trial.js"
import { spec } from "./factory.js"
import { markOverride } from "./savesettings.js"
import { readList, writeList } from "./storage.js"

const DISMISSED_KEY = "calc.dismissedByproducts"

export const dismissed = new SvelteSet()

// Fills `dismissed` from localStorage; called at mount, not module load, so SSR never touches storage.
export function loadDismissed() {
    for (const key of readList(DISMISSED_KEY)) dismissed.add(key)
}

function saveDismissed() {
    writeList(DISMISSED_KEY, [...dismissed])
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

// Identifies one fix within a block's list, for its each block's key.
export function fixKey(fix) {
    return fix.kind + (fix.recipe?.key ?? "") + fix.enable.map(r => r.key).join(",")
}

// The last fix applied, with its Undo; raw so its `totals` stays === plan.totals.
let appliedState = $state.raw(null)

export const applied = {
    get current() {
        return appliedState
    },
}

function apply(change, text) {
    const disabled = new Set(spec.disable)
    const sendOut = new Set(spec.sendOut)
    change()
    spec.updateSolution()
    spec.setHash()
    appliedState = {
        text,
        totals: spec.lastTotals,
        undo() {
            appliedState = null
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

export function showByproducts() {
    document.getElementById("byproducts")?.scrollIntoView({ block: "nearest", behavior: "smooth" })
}

// "backs up" on a card/row whose recipe would stop (flow.js, itemtable.js): scrolls to the Byproducts bar instead of selecting/opening what it's on.
export function backsUpMarker(size) {
    const marker = document.createElement("span")
    marker.className = "bp-marker"
    marker.title = "Something it makes has nowhere to go: see the fixes above"
    marker.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 2 21h20L12 3z"></path><path d="M12 10v5"></path></svg>`
    marker.appendChild(document.createTextNode("backs up"))
    onEvent(marker, "click", event => {
        event.stopPropagation()
        event.preventDefault()
        showByproducts()
    })
    return marker
}
