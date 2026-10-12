import { hideTip } from "./tooltip.svelte.js"

// {@attach iconOf(thing, size)} draws thing.icon through icon.js (with its tooltip unless suppressed) and removes it on teardown.
export function iconOf(obj, size, suppressTooltip = false) {
    return node => {
        if (!obj) return
        let img = obj.icon.make(size, suppressTooltip)
        node.prepend(img)
        return () => {
            hideTip(img)
            img.remove()
        }
    }
}

// {@attach iconOnto(thing, size)} on an <img> makes it thing's icon (no tooltip), for an icon with no wrapper of its own.
export function iconOnto(obj, size) {
    return node => {
        for (let { name, value } of obj.icon.make(size, true).attributes) node.setAttribute(name, value)
    }
}
