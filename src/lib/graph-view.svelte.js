import { select, zoom, zoomIdentity } from "d3"
import { tick } from "svelte"
import { stackLabels } from "./flow-core.js"
import { PLAIN_LABEL_H } from "./graph-core.js"

let transform = $state.raw({ x: 0, y: 0, k: 1 })
let fits = $state(0)
let behavior = null
let host = null
let size = null
let idsKey = null
let needsFit = true
let isFitted = true

// The pan and zoom d3-zoom last set; below 0.6 the plain labels hide (calc.css #flow-nodes.small).
export const graphView = {
    get transform() { return transform },
    get small() { return transform.k < 0.6 },
    get fits() { return fits },
}

// {@attach zoomable} on #flow-container: d3-zoom pans and zooms; a gesture of the user's own (sourceEvent set) ends "fitted".
export function zoomable(node) {
    host = node
    behavior = zoom().scaleExtent([0.1, 4]).on("zoom", event => {
        if (event.sourceEvent) isFitted = false
        const { x, y, k } = event.transform
        transform = { x, y, k }
    })
    select(node).call(behavior).on("dblclick.zoom", null)
    const observer = new ResizeObserver(() => {
        if (isFitted) fitToView()
    })
    observer.observe(node)
    return () => {
        observer.disconnect()
        select(node).on(".zoom", null)
        behavior = null
        host = null
    }
}

// {@attach followZoom} on #flow-nodes and #flow-columns: they move with the canvas as an inline CSS transform.
export function followZoom(node) {
    node.style.transform = `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`
}

// Fits the whole graph in the container, never above natural size; the 40/190px margins clear the Make panel and footer.
export function fitToView() {
    if (size === null || behavior === null) return
    const width = host.clientWidth
    const height = host.clientHeight
    if (width === 0 || height === 0) return
    const k = Math.min(1, (width - 40) / size.width, (height - 190) / size.height)
    if (!isFinite(k) || k <= 0) return
    const tx = (width - size.width * k) / 2
    const ty = 96 + Math.max(0, (height - 190 - size.height * k) / 2)
    select(host).call(behavior.transform, zoomIdentity.translate(tx, ty).scale(k))
    needsFit = false
    isFitted = true
    fits++
}

// A 0ms timer, not a frame: the container may unhide on the same tick; one retry if it is still 0x0.
function fitSoon() {
    setTimeout(() => {
        fitToView()
        if (needsFit) setTimeout(fitToView, 0)
    }, 0)
}

// The graph drew `layout` (null while measuring): a new set of cards, or the first since it was shown, gets fitted.
export function placeGraph(layout, shown) {
    if (!shown) {
        size = null
        idsKey = null
        return
    }
    if (layout === null) return
    size = { width: layout.width, height: layout.height }
    const ids = layout.nodes.map(node => node.id).sort().join(",")
    if (ids !== idsKey) {
        idsKey = ids
        needsFit = true
    }
    if (needsFit) fitSoon()
}

// <svelte:window onresize>: a resize refits only while a fit is still owed.
export function refitIfNeeded() {
    if (needsFit) fitToView()
}

// {@attach restack(focus, graphView.fits)} on #flow-nodes: once the DOM shows `focus` (or a fit), labels in one column gap stack clear.
export function restack(focus, fits) {
    return node => {
        tick().then(() => {
            if (!node.isConnected || focus === null) return
            const labels = [...node.querySelectorAll(".elbl")].filter(el => focus.lit === null || focus.lit.edges.has(`${el.dataset.from}>${el.dataset.to}`))
            const ys = stackLabels(labels.map((el, id) => ({ id, x: Number(el.dataset.lx), y: Number(el.dataset.ly), h: el.offsetHeight || PLAIN_LABEL_H })), 3)
            labels.forEach((el, id) => { el.style.top = `${ys.get(id)}px` })
        })
    }
}
