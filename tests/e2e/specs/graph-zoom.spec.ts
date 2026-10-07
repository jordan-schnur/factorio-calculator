import { test, expect } from "../support/fixtures"
import { G, dragPan, firstOverlap, panByWhateverWorks, transformOf, visibleBoxes, wheelZoom } from "../support/areas/graph"

// Fit, wheel zoom and drag pan all move the same view transform (read back
// from #flow-nodes' inline style), and the graph's labels never overlap
// each other however busy the plan.

test("Fit brings every card inside the viewport", async ({ calc, page }) => {
    await calc.open("items=military-science-pack:r:60&ignore=steel-plate&view=graph")
    await wheelZoom(page, -800, 3) // zoom in and pan off-centre first, so Fit has to do real work
    await dragPan(page, 400, 300)
    await page.locator(G.fit).click()
    let container = (await page.locator(G.container).boundingBox())!
    let nodeBoxes = await visibleBoxes(page, G.node)
    expect(nodeBoxes.length).toBeGreaterThan(0)
    for (let box of nodeBoxes) {
        expect(box.left).toBeGreaterThanOrEqual(container.x - 1)
        expect(box.top).toBeGreaterThanOrEqual(container.y - 1)
        expect(box.right).toBeLessThanOrEqual(container.x + container.width + 1)
        expect(box.bottom).toBeLessThanOrEqual(container.y + container.height + 1)
    }
})

test("wheel zoom changes the scale without erroring, and hides labels below 0.6", async ({ calc, page }) => {
    await calc.open("items=military-science-pack:r:60&ignore=steel-plate&view=graph")
    let before = await transformOf(page)
    await wheelZoom(page, 100, 15) // zoom out
    let after = await transformOf(page)
    expect(after.k).toBeLessThan(before.k)
    expect(after.k).toBeLessThan(0.6)
    await expect(page.locator(G.nodesLayer)).toHaveClass(/\bsmall\b/)
})

test("dragging the canvas pans without changing scale", async ({ calc, page }) => {
    await calc.open("items=military-science-pack:r:60&ignore=steel-plate&view=graph")
    let before = await transformOf(page)
    await dragPan(page, 120, 60)
    let after = await transformOf(page)
    expect(after.k).toBeCloseTo(before.k, 5)
    expect(after.x - before.x).toBeCloseTo(120, 0)
    expect(after.y - before.y).toBeCloseTo(60, 0)
})

test("the viewport's svg group stays matched to the zoom transform", async ({ calc, page }) => {
    await calc.open("items=military-science-pack:r:60&ignore=steel-plate&view=graph")
    await dragPan(page, 50, -30)
    let t = await transformOf(page)
    let viewportTransform = await page.locator("#flow g.viewport").getAttribute("transform")
    let m = viewportTransform!.match(/translate\(([-\d.]+),([-\d.]+)\)\s*scale\(([-\d.]+)\)/)!
    expect(Number(m[1])).toBeCloseTo(t.x, 3)
    expect(Number(m[2])).toBeCloseTo(t.y, 3)
    expect(Number(m[3])).toBeCloseTo(t.k, 3)
})

test("default-state edge labels in a busy graph never overlap", async ({ calc, page }) => {
    await calc.open("items=express-transport-belt:r:100,express-underground-belt:r:75,express-splitter:r:35&view=graph")
    await wheelZoom(page, -100, 10) // zoom past the 0.6 "small" threshold so labels show
    await expect(page.locator(G.nodesLayer)).not.toHaveClass(/\bsmall\b/)
    let boxes = await visibleBoxes(page, G.label)
    expect(boxes.length).toBeGreaterThanOrEqual(20)
    expect(firstOverlap(boxes)).toBeNull()
})

test("default-state edge labels never overlap a card", async ({ calc, page }) => {
    await calc.open("items=chemical-science-pack:r:60&view=graph")
    let labelBoxes = await visibleBoxes(page, G.label)
    let nodeBoxes = await visibleBoxes(page, G.node)
    for (let label of labelBoxes) {
        for (let node of nodeBoxes) {
            let overlap = label.left < node.right && node.left < label.right && label.top < node.bottom && node.top < label.bottom
            expect(overlap).toBe(false)
        }
    }
})

test("the graph renders and is pannable by touch on a phone viewport @mobile", async ({ calc, page }) => {
    await calc.open("items=military-science-pack:r:60&ignore=steel-plate&view=graph")
    await expect(page.locator(G.node).first()).toBeVisible()
    let before = await transformOf(page)
    await panByWhateverWorks(page, 80, 50)
    let after = await transformOf(page)
    expect(after.x !== before.x || after.y !== before.y).toBe(true)
})
