import { mount, unmount } from "svelte"

let live = []
let queued = false

// Unmounts components whose node legacy code threw away; `settled` also drops ones made this task that were never attached.
function sweep(settled) {
    live = live.filter(entry => {
        let keep = entry.node.isConnected || (entry.fresh && !settled)
        if (!keep) {
            entry.host?.prepend(entry.node)
            unmount(entry.instance)
        } else if (settled) {
            entry.fresh = false
        }
        return keep
    })
}

function track(node, host, instance) {
    sweep(false)
    live.push({ node, host, instance, fresh: true })
    if (queued) return
    queued = true
    queueMicrotask(() => {
        queued = false
        sweep(true)
    })
}

// Draws Component into a spare span for a legacy DOM builder and returns its one root element, or null when it draws nothing.
export function mountNode(Component, props) {
    let host = document.createElement("span")
    let instance = mount(Component, { target: host, props })
    let node = host.firstElementChild
    if (node === null) {
        unmount(instance)
        return null
    }
    track(node, host, instance)
    return node
}

// Empties a legacy-owned container and draws Component inside it; returns the component's root element.
export function mountInto(container, Component, props) {
    container.textContent = ""
    let instance = mount(Component, { target: container, props })
    let node = container.firstElementChild
    track(node, null, instance)
    return node
}
