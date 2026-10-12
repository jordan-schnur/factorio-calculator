// The one hover tooltip: the hovered anchor, the node it sits beside, and the component (with props) drawn there.
import { on } from "svelte/events"

let current = $state.raw(null)

export const tip = { get current() { return current } }

export function showTip(anchor, component, props, target = anchor) {
    current = { anchor, target, component, props }
}

export function hideTip(anchor) {
    if (current?.anchor === anchor) current = null
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
