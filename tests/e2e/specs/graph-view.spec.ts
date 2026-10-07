import { test, expect } from "../support/fixtures"
import { S } from "../support/selectors"
import { G } from "../support/areas/graph"

// Switching between Table and Graph, the card set a plan draws, the sink
// cards a byproduct plan draws into, and each item's own line look.

const F60 = "items=military-science-pack:r:60&ignore=steel-plate"
const BELT = "items=electronic-circuit:r:900,inserter:r:300"
const NO_CRACKING = "items=plastic-bar:r:600&disable=basic-oil-processing,heavy-oil-cracking,light-oil-cracking"

test("clicking Graph switches the view and writes view=graph @mobile", async ({ calc, page }) => {
    await calc.open(F60)
    await calc.switchView("graph")
    await expect(page.locator(S.graphFrame)).not.toHaveAttribute("hidden", "")
    await expect(page.locator(S.tableFrame)).toHaveAttribute("hidden", "")
    await calc.expectSetting("view", "graph")
    await expect(page.locator(S.viewButton("graph"))).toHaveClass(/\bon\b/)
})

test("clicking Table switches back and drops view=graph", async ({ calc, page }) => {
    await calc.open(F60 + "&view=graph")
    await calc.switchView("table")
    await expect(page.locator(S.tableFrame)).not.toHaveAttribute("hidden", "")
    await expect(page.locator(S.graphFrame)).toHaveAttribute("hidden", "")
    await calc.expectSetting("view", null)
})

test("a view=graph link opens straight to the graph, not the table @mobile", async ({ calc, page }) => {
    await calc.open(F60 + "&view=graph")
    await expect(page.locator(S.graphFrame)).not.toHaveAttribute("hidden", "")
    await expect(page.locator(S.tableFrame)).toHaveAttribute("hidden", "")
    await expect(page.locator(G.node).first()).toBeVisible()
})

test("the card set, names, machines and rate match the table for a plan", async ({ calc, page }) => {
    await calc.open(F60)
    let tableRows = await calc.tableRows()
    await calc.switchView("graph")
    // Every table row has a graph card for the same item (keyed by
    // data-item, not data-node: a brought-in item's card id is "in:<item>").
    for (let row of tableRows) {
        let card = page.locator(G.nodeFor(row.item))
        await expect(card, `no graph card for ${row.item}`).toHaveCount(1)
        await expect(card.locator(".name")).toHaveText(row.name)
        if (row.machines !== "") {
            await expect(card.locator(".sub")).toContainText(row.machineName)
        }
    }
})

test("a busier plan's cards also match name, machine and rate", async ({ calc }) => {
    await calc.open(BELT)
    await calc.switchView("graph")
    let nodes = await calc.graphNodes()
    expect(nodes.find(n => n.node === "iron-plate")).toMatchObject({ name: "Iron plate", sub: "56 × Electric furnace", rate: "2100/min" })
    expect(nodes.find(n => n.node === "electronic-circuit")).toMatchObject({ name: "Electronic circuit", sub: "20 × Assembling machine 1", rate: "1200/min" })
    expect(nodes.find(n => n.node === "iron-ore")).toMatchObject({ name: "Iron ore", sub: "70 × Electric mining drill", rate: "2100/min" })
})

test("columns run left to right: every line's source sits left of its target", async ({ calc, page }) => {
    await calc.open(F60 + "&view=graph")
    let boxes = await page.locator(G.node).evaluateAll(els =>
        Object.fromEntries(els.map(el => [(el as HTMLElement).dataset.node, (el as HTMLElement).getBoundingClientRect().left]))
    )
    let edges = await page.locator(G.edge).evaluateAll(els => els.map(el => ({ from: (el as HTMLElement).dataset.from, to: (el as HTMLElement).dataset.to })))
    expect(edges.length).toBeGreaterThan(0)
    for (let e of edges) {
        expect(boxes[e.from!], `no card for ${e.from}`).not.toBeUndefined()
        expect(boxes[e.to!], `no card for ${e.to}`).not.toBeUndefined()
        expect(boxes[e.from!]).toBeLessThan(boxes[e.to!])
    }
})

test("each item's lines carry their own colour+dash, never reused together", async ({ calc, page }) => {
    await calc.open("items=chemical-science-pack:r:60&view=graph")
    let edges = await page.locator(G.edge).evaluateAll(els =>
        els.map(el => ({ item: (el as HTMLElement).dataset.item, color: (el as HTMLElement).style.stroke, dash: (el as HTMLElement).style.strokeDasharray }))
    )
    let byItem = new Map<string, { color: string; dash: string }>()
    for (let e of edges) if (!byItem.has(e.item!)) byItem.set(e.item!, { color: e.color, dash: e.dash })
    expect(byItem.size).toBeGreaterThan(10)
    let looks = new Set<string>()
    for (let [item, look] of byItem) {
        let key = `${look.color}|${look.dash}`
        expect(looks.has(key), `${item} reuses the exact colour+dash of another item`).toBe(false)
        looks.add(key)
    }
})

test("a balanced byproduct plan draws no sink card", async ({ calc, page }) => {
    await calc.open("items=plastic-bar:r:600&disable=basic-oil-processing&view=graph")
    await expect(page.locator(S.byproducts)).toHaveAttribute("hidden", "")
    await expect(page.locator(G.nodeIdFor("__leftover"))).toHaveCount(0)
    await expect(page.locator('[data-node="advanced-oil-processing"]')).not.toContainText("backs up")
})

test("an oil plan with cracking off sinks its leftovers into __leftover", async ({ calc, page }) => {
    await calc.open(NO_CRACKING + "&view=graph")
    let sink = page.locator(G.nodeIdFor("__leftover"))
    await expect(sink).toHaveClass(/\bsink\b/)
    await expect(sink).toHaveClass(/\bleft\b/)
    await expect(page.locator('#flow-nodes [data-to="__leftover"]').first()).toHaveCount(1)
    await expect(page.locator('[data-node="advanced-oil-processing"]')).toContainText("backs up")
})

test("sending the byproduct out swaps the sink for __sendout", async ({ calc, page }) => {
    await calc.open(NO_CRACKING + "&view=graph&out=heavy-oil,light-oil")
    await expect(page.locator(G.nodeIdFor("__leftover"))).toHaveCount(0)
    let sendOut = page.locator(G.nodeIdFor("__sendout"))
    await expect(sendOut).toContainText("Send out")
    await expect(page.locator('[data-node="advanced-oil-processing"]')).not.toContainText("backs up")
})
