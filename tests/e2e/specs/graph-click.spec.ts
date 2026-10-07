import { test, expect } from "../support/fixtures"
import { S } from "../support/selectors"
import { G, boxesOverlap, firstOverlap, visibleBoxes } from "../support/areas/graph"

// Clicking a card opens #graph-side with the same details the table row
// would show, pins a chip on every one of its lines, and writes item= to
// the fragment; clicking the card again (or its close button) clears it.

const F60 = "items=military-science-pack:r:60&ignore=steel-plate&view=graph"
const BELT = "items=electronic-circuit:r:900,inserter:r:300&view=graph"

test("clicking a card opens #graph-side with that item's details", async ({ calc, page }) => {
    await calc.open(F60)
    await page.locator(`${G.nodeFor("copper-plate")} ${G.nbody}`).click()
    let side = page.locator(G.side)
    await expect(side).not.toHaveAttribute("hidden", "")
    await expect(side.locator(".title")).toHaveText("Copper plate")
    await expect(side.locator(".detail")).toBeVisible()
    await calc.expectSetting("item", "copper-plate")
})

test("a multi-output card's side panel lists its recipe options", async ({ calc, page }) => {
    await calc.open("items=plastic-bar:r:60&view=graph")
    await page.locator(`${G.nodeFor("petroleum-gas")} ${G.nbody}`).click()
    let side = page.locator(G.side)
    await expect(side).toContainText("Recipe")
    expect(await page.locator(G.sideOpt).count()).toBeGreaterThanOrEqual(2)
})

test("switching to Table keeps the selection open on the matching row", async ({ calc, page }) => {
    await calc.open(F60)
    await page.locator(`${G.nodeFor("copper-plate")} ${G.nbody}`).click()
    await calc.switchView("table")
    await expect(page.locator(S.rowFor("copper-plate"))).toHaveClass(/\bopen\b/)
    await calc.expectSetting("item", "copper-plate")
})

test("clicking the same card again clears the selection", async ({ calc, page }) => {
    await calc.open(F60)
    let body = page.locator(`${G.nodeFor("copper-plate")} ${G.nbody}`)
    await body.click()
    await expect(page.locator(G.side)).not.toHaveAttribute("hidden", "")
    await body.click()
    await expect(page.locator(G.side)).toHaveAttribute("hidden", "")
    await calc.expectSetting("item", null)
})

test("the side panel's close button also clears the selection", async ({ calc, page }) => {
    await calc.open(F60)
    await page.locator(`${G.nodeFor("copper-plate")} ${G.nbody}`).click()
    await expect(page.locator(G.side)).not.toHaveAttribute("hidden", "")
    await page.locator(G.sideClose).click()
    await expect(page.locator(G.side)).toHaveAttribute("hidden", "")
    await expect(page.locator(G.nodeFor("copper-plate"))).not.toHaveClass(/\bsel\b/)
})

test("clicking a card pins a chip with a machine-ratio row on every one of its lines", async ({ calc, page }) => {
    await calc.open(BELT)
    await page.locator(`${G.nodeFor("iron-plate")} ${G.nbody}`).click()
    let pinned = page.locator(`${G.label}.pinned`)
    let pairs = await pinned.evaluateAll(els => els.map(el => [(el as HTMLElement).dataset.from, (el as HTMLElement).dataset.to]))
    expect(pairs.sort()).toEqual(
        [
            ["iron-ore", "iron-plate"],
            ["iron-plate", "electronic-circuit"],
            ["iron-plate", "inserter"],
            ["iron-plate", "iron-gear-wheel"],
        ].sort()
    )
    let ecChip = page.locator(G.labelFor("iron-plate", "electronic-circuit", "iron-plate"))
    await expect(ecChip).toContainText("32 of 56→20")
    await expect(ecChip).toContainText("1 : 0.63")
    expect(await ecChip.locator(".chip-row").count()).toBe(3) // rate+belt row, ratio row, "1 belt:" row (non-fluid)
    let oreChip = page.locator(G.labelFor("iron-ore", "iron-plate", "iron-ore"))
    await expect(oreChip).toContainText("70→56")
    await expect(oreChip).toContainText("1.25 : 1")
    await expect(page.locator(G.nodeIdFor("electronic-circuit"))).toContainText("all 20 use it")
    await expect(page.locator(G.nodeIdFor("iron-ore"))).toContainText("all 70 send this")
})

test("a fluid line's pinned chip has no \"1 belt\" row", async ({ calc, page }) => {
    await calc.open("items=chemical-science-pack:r:60&view=graph")
    await page.locator(`${G.nodeFor("water")} ${G.nbody}`).click()
    let chip = page.locator(`${G.label}.pinned[data-item="water"]`).first()
    await expect(chip).toContainText("pipe")
    expect(await chip.locator(".chip-row").count()).toBe(2) // rate+pipe row, ratio row only
})

test("pinned chips never overlap each other or any card", async ({ calc, page }) => {
    await calc.open(BELT)
    await page.locator(`${G.nodeFor("iron-plate")} ${G.nbody}`).click()
    let chipBoxes = await visibleBoxes(page, `${G.label}.pinned`)
    expect(chipBoxes.length).toBeGreaterThan(0)
    expect(firstOverlap(chipBoxes)).toBeNull()
    let nodeBoxes = await visibleBoxes(page, G.node)
    for (let chip of chipBoxes) {
        for (let node of nodeBoxes) {
            expect(boxesOverlap(chip, node)).toBe(false)
        }
    }
})
