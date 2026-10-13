import { test, expect } from "../support/fixtures"
import { TD } from "../support/areas/table-details"
import { G } from "../support/areas/graph"

// A target that other recipes also consume: its own share shows in Goes to and as a line into the What you asked for card.

const BELT = "items=electronic-circuit:r:900,inserter:r:300"
const F60 = "items=military-science-pack:r:60&ignore=steel-plate"

test("Goes to lists the target's own share after what consumes it", async ({ calc }) => {
    await calc.open(BELT)
    let goesTo = (await calc.openRow("electronic-circuit")).locator(TD.goesToCol)
    await expect(goesTo.locator(TD.drow)).toHaveText(["Inserter25%300/min", "What you asked for75%900/min"])
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
    await expect(page.locator('#flow-nodes [data-from="electronic-circuit"][data-to="__asked"]').first()).toHaveCount(1)
    await expect(page.locator('#flow-nodes [data-from="inserter"][data-to="__asked"]')).toHaveCount(0)
})

test("a plan whose targets feed nothing draws no What you asked for card", async ({ calc, page }) => {
    await calc.open(F60 + "&view=graph")
    await expect(page.locator(G.node).first()).toBeVisible()
    await expect(page.locator(G.nodeIdFor("__asked"))).toHaveCount(0)
})
