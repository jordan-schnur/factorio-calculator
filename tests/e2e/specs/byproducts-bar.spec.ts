import { test, expect } from "../support/fixtures"
import { S } from "../support/selectors"
import { BP, ROW, NO_CRACKING, COAL_LIQUEFACTION, YUMAKO, URANIUM, BALANCED } from "../support/areas/byproducts"

// The Byproducts bar: which plans show it, one block per stalled recipe,
// and the markers it leaves on the table, detail and graph.

test.describe("which plans show the bar", () => {
    test("oil refining with cracking off stalls advanced oil processing", async ({ calc, page }) => {
        await calc.open(NO_CRACKING)
        await expect(page.locator(S.byproducts)).not.toBeHidden()
        await expect(page.locator(BP.title)).toHaveText("Advanced oil processing will back up and stop")
        await expect(page.locator(BP.line)).toContainText(/\d+ oil refineries also make/)
        await expect(page.locator(BP.line)).toContainText("light oil")
        await expect(page.locator(BP.line)).toContainText("heavy oil")
        await expect(page.locator(BP.line)).toContainText("that nothing in this plan uses.")
    })

    test("coal liquefaction (Space Age) stalls the same way as advanced oil processing", async ({ calc, page }) => {
        await calc.open(COAL_LIQUEFACTION)
        await expect(page.locator(BP.title)).toHaveText("Coal liquefaction will back up and stop")
    })

    test("yumako processing (Space Age, Gleba) stalls on its unused seed", async ({ calc, page }) => {
        await calc.open(YUMAKO)
        await expect(page.locator(BP.title)).toHaveText("Yumako processing will back up and stop")
        await expect(page.locator(BP.line)).toContainText("yumako seed")
    })

    test("uranium processing (Kovarex byproduct) stalls on uranium-235", async ({ calc, page }) => {
        await calc.open(URANIUM)
        await expect(page.locator(BP.title)).toHaveText("Uranium processing will back up and stop")
        await expect(page.locator(BP.line)).toContainText("uranium-235")
        // No fix exists for a byproduct with no consumer and no alternate recipe.
        await expect(page.locator(BP.none)).toHaveText("No recipe you could switch on uses it up, and no other recipe avoids it.")
    })

    test("no bar when the plan balances", async ({ calc, page }) => {
        await calc.open(BALANCED)
        await expect(page.locator(S.byproducts)).toBeHidden()
        await expect(page.locator(BP.title)).toHaveCount(0)
    })

    test("no bar on the empty intro", async ({ calc, page }) => {
        await calc.open()
        await expect(calc.isIntro()).toBeVisible()
        await expect(page.locator(S.byproducts)).toBeHidden()
    })
})

test.describe("one block per stalled recipe", () => {
    test("exactly one fix block for the one stalled recipe", async ({ calc, page }) => {
        await calc.open(NO_CRACKING)
        await expect(page.locator(BP.block)).toHaveCount(1)
        await expect(page.locator(BP.title)).toHaveCount(1)
    })

    test("a multi-output row shows its outputs as small icons and 'N outputs'", async ({ calc, page }) => {
        await calc.open(NO_CRACKING)
        let row = calc.row("heavy-oil")
        await expect(row).toContainText("Advanced oil processing")
        await expect(row).toContainText("3 outputs")
        await expect(row.locator(ROW.outputIcon)).toHaveCount(3)
    })

    test("the stalled row carries a 'backs up' marker that scrolls to the bar", async ({ calc, page }) => {
        await calc.open(NO_CRACKING)
        let row = calc.row("heavy-oil")
        await expect(row.locator(ROW.backsUp)).toHaveText(/backs up/)
        await row.locator(ROW.backsUp).click()
        await expect(page.locator(S.byproducts)).toBeInViewport()
    })

    test("the detail's Makes column points leftover items at the bar", async ({ calc }) => {
        await calc.open(NO_CRACKING)
        let detail = await calc.openRow("heavy-oil")
        await expect(detail).toContainText("Makes")
        await expect(detail.locator(".left-note")).toHaveCount(2)
        await expect(detail.locator(".left-note").first()).toContainText("see the fixes above")
    })

    test("there is no leftover badge or footer leftover line left over from the old design", async ({ calc, page }) => {
        await calc.open(NO_CRACKING)
        await expect(page.locator("[data-leftover]")).toHaveCount(0)
        await expect(page.locator("#footer-leftover")).toHaveCount(0)
    })
})

test.describe("the graph's leftover sink card", () => {
    test("leftovers run into a __leftover sink card and mark the stalled card", async ({ calc, page }) => {
        await calc.open(NO_CRACKING + "&view=graph")
        let sink = calc.graphNode("__leftover")
        await expect(sink).toContainText("Left over")
        await expect(sink).toContainText("Nothing here uses it")
        await expect(sink.locator(ROW.backsUp)).toHaveText(/backs up/)
        await expect(page.locator('#flow path[data-to="__leftover"]').first()).toBeVisible()
        await expect(calc.graphNode("advanced-oil-processing")).toContainText("backs up")
    })

    test("no sink card on a balanced plan in graph view", async ({ calc, page }) => {
        await calc.open(BALANCED + "&view=graph")
        await expect(calc.graphNode("__leftover")).toHaveCount(0)
        await expect(page.locator("#flow-nodes")).not.toContainText("backs up")
    })
})
