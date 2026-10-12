import { on } from "svelte/events"
import { beltHoldsOn } from "./belt-holds.js"
import { graphOf, renderKey } from "./graph-core.js"
import { plan } from "./plan.svelte.js"

const HOVER_IN = 250
const HOVER_SWITCH = 250
const HOVER_OUT = 300

let hovered = $state.raw(null)
let holds = $state(null)
let timer = null
let showing = false
let memo = { totals: null, key: null, graph: null }

// What the pointer rests on, {card} or {line}; it lapses with a new solve, and a line hover with a new selection.
export const graphHover = {
    get current() {
        if (hovered === null || hovered.totals !== plan.totals) return null
        if (hovered.line && hovered.selected !== plan.spec?.whereItem) return null
        return hovered
    },
    get holds() {
        return holds ?? beltHoldsOn()
    },
}

// The redraw for these totals, rebuilt only when they or renderKey change, so selecting or hovering never relays out.
export function drawnGraph(spec, totals) {
    const key = renderKey(spec)
    if (memo.totals !== totals || memo.key !== key) memo = { totals, key, graph: graphOf(spec, totals) }
    return memo.graph
}

// Shows `next` after the hover-intent delay: 250ms for a first hover or a switch, 300ms to clear.
function intent(next) {
    clearTimeout(timer)
    const delay = next === null ? HOVER_OUT : showing ? HOVER_SWITCH : HOVER_IN
    timer = setTimeout(() => {
        timer = null
        hovered = next && { ...next, totals: plan.totals, selected: plan.spec?.whereItem }
        showing = next !== null
    }, delay)
}

// {@attach hoverOn(target, keep)}: resting on the element previews `target`; with `keep` it only holds what already shows.
export function hoverOn(target, keep = false) {
    return node => {
        const offEnter = on(node, "mouseenter", () => {
            if (!keep) intent(target)
            else if (showing) clearTimeout(timer)
        })
        const offLeave = on(node, "mouseleave", () => intent(null))
        return () => {
            offEnter()
            offLeave()
        }
    }
}

// The "Graph lines" Display setting changed: chips reword at once.
export function showBeltHolds(value) {
    holds = value
}
