import { test, expect } from "../support/fixtures"
import { S } from "../support/selectors"
import { BP, ROW, disableSet, outSet, NO_CRACKING } from "../support/areas/byproducts"

// Every fix the bar offers: applying it changes the plan (the table and the
// disable/enable fragment), shows the status strip with Undo, and Undo puts
// the exact previous fragment and table back.

test.describe("the fixes offered for advanced oil processing", () => {
    test("offers Allow, Avoid and Send out, with the cheaper one marked Fewest machines", async ({ calc, page }) => {
        await calc.open(NO_CRACKING)
        let allow = page.locator(BP.fixButton("allow"))
        let avoid = page.locator(BP.fixButton("avoid"))
        let out = page.locator(BP.fixButton("out"))
        await expect(allow).toContainText("Allow cracking")
        await expect(avoid).toContainText("Use basic oil processing")
        await expect(out).toContainText("Send them out")
        // The design never shows the badge alone: only when two or more fixes compete.
        await expect(page.locator(BP.best)).toHaveCount(1)
        await expect(allow.locator("..")).toContainText("Turns on")
        await expect(allow.locator("..")).toContainText(/\d+ machines, \d+ fewer|more/)
    })
})

test.describe("applying Allow", () => {
    test("turns cracking back on, clears the bar and shows Undo", async ({ calc, page }) => {
        await calc.open(NO_CRACKING)
        let before = await disableSet(calc)
        expect([...before].sort()).toEqual(["basic-oil-processing", "heavy-oil-cracking", "light-oil-cracking"])
        let row = calc.row("heavy-oil")
        await expect(row.locator(ROW.backsUp)).toHaveCount(1)
        await expect(row.locator(".machines .cnt")).toHaveText("10 ×")

        await page.locator(BP.fixButton("allow")).click()

        await expect(page.locator(BP.bar)).toHaveCount(0)
        await expect(page.locator(BP.doneText)).toHaveText(/^Allowed cracking\./)
        let after = await disableSet(calc)
        expect(after.has("heavy-oil-cracking")).toBe(false)
        expect(after.has("light-oil-cracking")).toBe(false)
        // The table reflects it: the row no longer backs up and runs fewer refineries.
        await expect(row.locator(ROW.backsUp)).toHaveCount(0)
        await expect(row.locator(".machines .cnt")).toHaveText("6 ×")
    })

    test("Undo restores the exact previous fragment and the bar", async ({ calc, page }) => {
        await calc.open(NO_CRACKING)
        let before = await disableSet(calc)

        await page.locator(BP.fixButton("allow")).click()
        await expect(page.locator(BP.doneText)).not.toHaveText("")

        await page.locator(BP.undo).click()

        await expect(page.locator(BP.bar)).toHaveCount(1)
        await expect(page.locator(BP.done)).toHaveCount(0)
        let after = await disableSet(calc)
        expect(after).toEqual(before)
        await expect(page.locator(BP.title)).toHaveText("Advanced oil processing will back up and stop")
    })
})

test.describe("applying Avoid", () => {
    test("switches to basic oil processing, clears the bar and shows Undo", async ({ calc, page }) => {
        await calc.open(NO_CRACKING)
        await page.locator(BP.fixButton("avoid")).click()

        await expect(page.locator(BP.bar)).toHaveCount(0)
        await expect(page.locator(BP.doneText)).toContainText("Switched petroleum gas to basic oil processing.")
        let after = await disableSet(calc)
        expect(after.has("basic-oil-processing")).toBe(false)
        expect(after.has("advanced-oil-processing")).toBe(true)
    })

    test("Undo restores the exact previous fragment and the bar", async ({ calc, page }) => {
        await calc.open(NO_CRACKING)
        let before = await disableSet(calc)

        await page.locator(BP.fixButton("avoid")).click()
        await page.locator(BP.undo).click()

        await expect(page.locator(BP.bar)).toHaveCount(1)
        let after = await disableSet(calc)
        expect(after).toEqual(before)
    })
})

test.describe("Send out", () => {
    test("marks the leftovers sent out: out= in the fragment, the footer line, and the row tag", async ({ calc, page }) => {
        await calc.open(NO_CRACKING)
        await page.locator(BP.fixButton("out")).click()

        await expect(page.locator(BP.bar)).toHaveCount(0)
        let out = await outSet(calc)
        expect(out).toEqual(new Set(["heavy-oil", "light-oil"]))
        await expect(page.locator(S.footerSendout)).toHaveText(/^Sent out: (light|heavy) oil [\d.]+\/min, (light|heavy) oil [\d.]+\/min$/)
        await expect(calc.row("heavy-oil")).toContainText("sends out 2")
    })

    test("the graph draws it into a __sendout card instead of the leftover sink", async ({ calc }) => {
        await calc.open(NO_CRACKING + "&out=heavy-oil,light-oil&view=graph")
        await expect(calc.graphNode("__leftover")).toHaveCount(0)
        let sendout = calc.graphNode("__sendout")
        await expect(sendout).toContainText("Send out")
        await expect(sendout).toContainText("To storage or another build")
    })

    test("Undo restores the exact previous fragment, the bar and removes the footer line", async ({ calc, page }) => {
        await calc.open(NO_CRACKING)
        let before = await outSet(calc)
        expect(before.size).toBe(0)

        await page.locator(BP.fixButton("out")).click()
        await expect(page.locator(S.footerSendout)).not.toHaveText("")

        await page.locator(BP.undo).click()

        await expect(page.locator(BP.bar)).toHaveCount(1)
        let after = await outSet(calc)
        expect(after).toEqual(before)
        await expect(page.locator(S.footerSendout)).toHaveText("")
    })
})
