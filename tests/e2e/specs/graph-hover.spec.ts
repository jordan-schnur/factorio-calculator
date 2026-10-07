import { test, expect } from "../support/fixtures"
import { G } from "../support/areas/graph"

// Hovering a line (its label) or a card previews what clicking it would
// show, after the hoverIntent delay, and clears again on leaving. All
// through the label (a plain rectangle) rather than the curved hit-path,
// which is unreliable to aim a synthetic mouse at; both ends of the swap are
// exercised elsewhere in graph-click.spec.ts via the click path.

const BELT = "items=electronic-circuit:r:900,inserter:r:300&view=graph"

test("hovering a line's label turns it into a chip and answers on both cards", async ({ calc, page }) => {
    await calc.open(BELT)
    let label = page.locator(G.labelFor("iron-plate", "electronic-circuit", "iron-plate"))
    await label.hover()
    await expect(label).toHaveClass(/\bchip\b/)
    await expect.poll(async () => (await label.textContent())!.replace(/\s+/g, " ").trim()).toBe("1200/min|yellow1 1/3 belts")
    await expect(page.locator(G.nodeIdFor("iron-plate"))).toHaveClass(/\banswering\b/)
    await expect(page.locator(G.nodeIdFor("iron-plate"))).toContainText("32 of 56 send this")
    await expect(page.locator(G.nodeIdFor("electronic-circuit"))).toContainText("all 20 use it")
    await expect(page.locator(G.container)).toHaveClass(/\bhovering\b/)
})

test("leaving a hovered line puts the label and cards back", async ({ calc, page }) => {
    await calc.open(BELT)
    let label = page.locator(G.labelFor("iron-plate", "electronic-circuit", "iron-plate"))
    await label.hover()
    await expect(label).toHaveClass(/\bchip\b/)
    await page.mouse.move(5, 5)
    await expect(label).not.toHaveClass(/\bchip\b/)
    await expect(page.locator(G.nodeIdFor("iron-plate"))).not.toHaveClass(/\banswering\b/)
    await expect(page.locator(G.nodeIdFor("iron-plate"))).toContainText("56 × Electric furnace")
    await expect(page.locator(G.container)).not.toHaveClass(/\bhovering\b/)
})

test("a quick pass over a line shows nothing (hover is delayed)", async ({ calc, page }) => {
    await calc.open(BELT)
    let label = page.locator(G.labelFor("iron-plate", "electronic-circuit", "iron-plate"))
    let box = (await label.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.move(5, 5)
    await expect(page.locator(G.container)).not.toHaveClass(/\bhovering\b/)
    await expect(label).not.toHaveClass(/\bchip\b/)
})

test("hovering a card lights what it's made from and goes to", async ({ calc, page }) => {
    await calc.open("items=military-science-pack:r:60&ignore=steel-plate&view=graph")
    await page.locator(G.nodeFor("piercing-rounds-magazine")).hover()
    await expect(page.locator(G.container)).toHaveClass(/\bhovering\b/)
    let lit = await page.locator(`${G.node}.lit`).evaluateAll(els => els.map(el => (el as HTMLElement).dataset.item))
    for (let item of ["piercing-rounds-magazine", "firearm-magazine", "copper-plate", "steel-plate", "military-science-pack"]) {
        expect(lit).toContain(item)
    }
    expect(lit).not.toContain("stone-brick")
    expect(lit).not.toContain("iron-ore")
    // Not .toBeVisible(): several of these edges are dead-flat horizontal
    // lines whose SVG bounding box has zero height, which Playwright's
    // visibility heuristic treats as hidden even though they're painted.
    let edges = page.locator("#flow path.edge.lit")
    expect(await edges.count()).toBeGreaterThan(0)
    let endpoints = await edges.evaluateAll(els => els.map(el => [(el as HTMLElement).dataset.from, (el as HTMLElement).dataset.to]))
    for (let [from, to] of endpoints) expect(from === "piercing-rounds-magazine" || to === "piercing-rounds-magazine").toBe(true)
})

test("leaving a hovered card clears the lit state", async ({ calc, page }) => {
    await calc.open("items=military-science-pack:r:60&ignore=steel-plate&view=graph")
    await page.locator(G.nodeFor("piercing-rounds-magazine")).hover()
    await expect(page.locator(G.container)).toHaveClass(/\bhovering\b/)
    await page.mouse.move(5, 5)
    await expect(page.locator(G.container)).not.toHaveClass(/\bhovering\b/)
    await expect(page.locator(`${G.node}.lit`)).toHaveCount(0)
})
