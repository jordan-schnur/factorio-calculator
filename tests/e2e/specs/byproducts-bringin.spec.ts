import { test, expect } from "../support/fixtures"
import { S } from "../support/selectors"
import { BP, ROW, URANIUM } from "../support/areas/byproducts"

// "Bring in from another build" on a multi-output row: 1.4.0 fixed it to
// bring in what the plan actually uses (uranium-238), not the row's keyed
// product (uranium-235, which nothing uses and would just flip back).

test("bringing in uranium-235's row brings in uranium-238 instead", async ({ calc, page }) => {
    await calc.open(URANIUM)
    let detail = await calc.openRow("uranium-235")
    let source = detail.locator(ROW.source)
    await expect(source.locator("button").first()).toHaveClass(/\bon\b/)
    await expect(source.locator("button").nth(1)).toHaveText("Bring in from another build")

    await source.locator("button").nth(1).click()
    await calc.ready()

    let rows = await calc.tableRows()
    let u238 = rows.find(r => r.item === "uranium-238")
    let u235 = rows.find(r => r.item === "uranium-235")
    expect(u238?.group).toBe("Bring in from another build")
    expect(u235).toBeUndefined()
    await calc.expectSetting("ignore", "uranium-238")

    // The bar no longer has anything to say about uranium processing.
    await expect(page.locator(BP.title)).toHaveCount(0)
})
