import type { Page } from "@playwright/test"

// Graph-view-only selectors and helpers. Kept out of ../selectors.ts because
// that file is shared with other units working in parallel; this unit owns
// everything under #flow-container and #graph-side.

export const G = {
    container: "#flow-container",
    columns: "#flow-columns .stage",
    nodesLayer: "#flow-nodes",
    node: "#flow-nodes .node",
    nodeFor: (item: string) => `#flow-nodes .node[data-item="${item}"]`,
    nodeIdFor: (id: string) => `#flow-nodes .node[data-node="${id}"]`,
    nbody: ".nbody",
    sub: ".sub",
    edge: "#flow path.edge",
    edgeFor: (from: string, to: string) => `#flow path.edge[data-from="${from}"][data-to="${to}"]`,
    hit: "#flow path.hit",
    hitFor: (from: string, to: string, item: string) =>
        `#flow path.hit[data-from="${from}"][data-to="${to}"][data-item="${item}"]`,
    label: "#flow-nodes .elbl",
    labelFor: (from: string, to: string, item: string) =>
        `#flow-nodes .elbl[data-from="${from}"][data-to="${to}"][data-item="${item}"]`,
    labelForItem: (item: string) => `#flow-nodes .elbl[data-item="${item}"]`,
    side: "#graph-side",
    sideClose: "#details-close",
    sideOpt: "#graph-side .opt",
    fit: "#flow-fit",
} as const

export interface Box {
    left: number
    top: number
    right: number
    bottom: number
}

// Axis-aligned overlap with a tolerance (px): two boxes that merely touch at
// the edge (within `pad`) don't count as overlapping.
export function boxesOverlap(a: Box, b: Box, pad = 0.5): boolean {
    return a.left < b.right - pad && b.left < a.right - pad && a.top < b.bottom - pad && b.top < a.bottom - pad
}

// The first overlapping pair of indices, or null if every box is clear of
// every other.
export function firstOverlap(boxes: Box[], pad = 0.5): [number, number] | null {
    for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
            if (boxesOverlap(boxes[i], boxes[j], pad)) return [i, j]
        }
    }
    return null
}

// Every `selector` element that is actually painted: not `display: none`
// (the zoomed-out "small" state hides non-hot labels this way) and not
// `visibility: hidden` (the hovering state hides non-lit labels this way).
export async function visibleBoxes(page: Page, selector: string): Promise<Box[]> {
    return page.locator(selector).evaluateAll(els =>
        els
            .filter(el => {
                let cs = getComputedStyle(el)
                let r = el.getBoundingClientRect()
                return cs.display !== "none" && cs.visibility !== "hidden" && r.width > 0 && r.height > 0
            })
            .map(el => {
                let r = el.getBoundingClientRect()
                return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
            })
    )
}

// flow.js writes #flow-nodes' transform directly as inline style
// (`translate(Xpx, Ypx) scale(K)`), set by d3-zoom's handler; this reads it
// back as numbers instead of comparing opaque CSS strings.
export async function transformOf(page: Page): Promise<{ x: number; y: number; k: number }> {
    let css = await page.locator(G.nodesLayer).evaluate(el => (el as HTMLElement).style.transform)
    let m = css.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)\s*scale\(([-\d.]+)\)/)
    if (!m) return { x: 0, y: 0, k: 1 }
    return { x: Number(m[1]), y: Number(m[2]), k: Number(m[3]) }
}

// Wheel-zooms at the container's centre. Negative steps zoom in (d3-zoom's
// convention: a negative deltaY, like scrolling up, zooms in).
export async function wheelZoom(page: Page, deltaY: number, times = 1) {
    let box = (await page.locator(G.container).boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    for (let i = 0; i < times; i++) await page.mouse.wheel(0, deltaY)
}

// Drags from the container's centre by (dx, dy) with a real mouse, the way
// d3-zoom's pan gesture is driven on desktop.
export async function dragPan(page: Page, dx: number, dy: number) {
    let box = (await page.locator(G.container).boundingBox())!
    let cx = box.x + box.width / 2
    let cy = box.y + box.height / 2
    await page.mouse.move(cx, cy)
    await page.mouse.down()
    await page.mouse.move(cx + dx, cy + dy, { steps: 6 })
    await page.mouse.up()
}

// The mobile pan gesture: the page has no viewport meta tag, so on a touch
// device (hasTouch true, as the Pixel 7 project emulates) d3-zoom only
// answers to real touch events, not synthesised mouse ones (see the graph
// unit's report) -- CDP's Input.dispatchTouchEvent is the only way to drive
// that from a test. A desktop context has no touch surface at all, so there
// `dragPan`'s mouse gesture is what actually pans; `panByWhateverWorks`
// picks whichever one this context answers to.
export async function touchDragPan(page: Page, dx: number, dy: number) {
    let box = (await page.locator(G.container).boundingBox())!
    let cx = box.x + box.width / 2
    let cy = box.y + box.height / 2
    let cdp = await page.context().newCDPSession(page)
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: cx, y: cy }] })
    const steps = 5
    for (let i = 1; i <= steps; i++) {
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x: cx + (dx * i) / steps, y: cy + (dy * i) / steps }],
        })
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
}

// Tries a touch drag first (the gesture a phone actually sends); if this
// context has no touch surface to answer it (desktop), falls back to a
// mouse drag so the same test runs meaningfully in both projects.
export async function panByWhateverWorks(page: Page, dx: number, dy: number) {
    let before = await transformOf(page)
    await touchDragPan(page, dx, dy)
    let after = await transformOf(page)
    if (after.x === before.x && after.y === before.y) await dragPan(page, dx, dy)
}

export function textOf(el: Element | null): string {
    return (el?.textContent ?? "").replace(/\s+/g, " ").trim()
}
