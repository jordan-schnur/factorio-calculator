// The one hover tooltip: the hovered anchor, the node it sits beside, and the component (with props) drawn there.
import { on } from "svelte/events"

let current = $state.raw(null)
let hideLegacy = () => {}

export const tip = { get current() { return current } }

export function showTip(anchor, component, props, target = anchor) {
    hideLegacy()
    current = { anchor, target, component, props }
}

export function hideTip(anchor) {
    if (current?.anchor === anchor) current = null
}

// tooltip.js registers its own hide so a legacy tooltip and this one never show together; removed with tooltip.js.
export function onTipShow(hide) {
    hideLegacy = hide
}

// {@attach tooltip(Component, props)} shows Component beside the node (or `target`) while the pointer is over it.
export function tooltip(component, props, target) {
    return node => {
        const offEnter = on(node, "mouseenter", () => showTip(node, component, props, target ?? node))
        const offLeave = on(node, "mouseleave", () => hideTip(node))
        return () => {
            offEnter()
            offLeave()
            hideTip(node)
        }
    }
}
