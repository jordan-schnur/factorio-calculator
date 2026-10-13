import { test, expect } from "../support/fixtures"
import { TD } from "../support/areas/table-details"
import { G } from "../support/areas/graph"

// A target that other recipes also consume: its own share shows in Goes to and as a line into the What you asked for card.

const BELT = "items=electronic-circuit:r:900,inserter:r:300"
const F60 = "items=military-science-pack:r:60&ignore=steel-plate"
const GAS = "items=plastic-bar:r:60,petroleum-gas:r:600&disable=basic-oil-processing,heavy-oil-cracking,light-oil-cracking"

test("Goes to lists the target's own share after what consumes it", async ({ calc }) => {
    await calc.open(BELT)
    let goesTo = (await calc.openRow("electronic-circuit")).locator(TD.goesToCol)
    await expect(goesTo.locator(TD.drow)).toHaveText(["Inserter25%300/min", "What you asked for75%900/min"])
})

test("a multi-output row's Makes lists the target's own share of that output", async ({ calc }) => {
    await calc.open(GAS)
    let makes = (await calc.openRow("heavy-oil")).locator(TD.makesCol)
    await expect(makes.locator(TD.drow)).toHaveText(["Heavy oil545.5/min", "Light oil981.8/min", "Petroleum gas1200/min", "Plastic bar50%600/min", "What you asked for50%600/min"])
})

test("a target nothing else uses keeps its plain Goes to note", async ({ calc }) => {
    await calc.open(BELT)
    let goesTo = (await calc.openRow("inserter")).locator(TD.goesToCol)
    await expect(goesTo.locator(TD.drow)).toHaveCount(0)
    await expect(goesTo).toContainText("This is what you asked for.")
})

test("the graph runs a target that feeds others into the What you asked for card", async ({ calc, page }) => {
    await calc.open(BELT + "&view=graph")
    let asked = page.locator(G.nodeIdFor("__asked"))
    await expect(asked).toHaveClass(/\bsink\b/)
    await expect(asked).toHaveClass(/\bout\b/)
    await expect(asked).toContainText("What you asked for")
    await expect(asked).not.toContainText("backs up")
    await expect(page.locator(G.edgeFor("electronic-circuit", "__asked"))).toHaveCount(1)
    await expect(page.locator(G.edgeFor("inserter", "__asked"))).toHaveCount(0)
})

test("a plan whose targets feed nothing draws no What you asked for card", async ({ calc, page }) => {
    await calc.open(F60 + "&view=graph")
    await expect(page.locator(G.node).first()).toBeVisible()
    await expect(page.locator(G.nodeIdFor("__asked"))).toHaveCount(0)
})
