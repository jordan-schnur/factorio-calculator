import { test, expect } from "../support/fixtures"
import { S } from "../support/selectors"
import { BP, dismissedKeys, URANIUM, NO_CRACKING, NO_CRACKING_LIGHT_USED } from "../support/areas/byproducts"

// Dismissing a block: it folds into a hidden line, the dismissal is kept
// in this browser's localStorage, survives a reload, and a changed set of
// leftovers from the same recipe brings the block back.

test("dismissing folds the block into a hidden line and remembers it in localStorage", async ({ calc, page }) => {
    await calc.open(URANIUM)
    await expect(page.locator(BP.block)).toHaveCount(1)

    await page.locator(BP.dismiss).click()

    await expect(page.locator(BP.block)).toHaveCount(0)
    await expect(page.locator(S.byproducts)).not.toBeHidden() // the strip itself still shows
    await expect(page.locator(BP.hiddenText)).toHaveText(/^A byproduct warning is hidden: Uranium processing\./)
    expect(await dismissedKeys(page)).toEqual(["uranium-processing:uranium-235"])
})

test("stays dismissed across a reload", async ({ calc, page }) => {
    await calc.open(URANIUM)
    await page.locator(BP.dismiss).click()
    await expect(page.locator(BP.hiddenText)).not.toHaveText("")

    await page.reload()
    await calc.ready()

    await expect(page.locator(BP.block)).toHaveCount(0)
    await expect(page.locator(BP.hiddenText)).toHaveText(/^A byproduct warning is hidden: Uranium processing\./)
    expect(await dismissedKeys(page)).toEqual(["uranium-processing:uranium-235"])
})

test("the show-again control brings the block back and clears the storage key", async ({ calc, page }) => {
    await calc.open(URANIUM)
    await page.locator(BP.dismiss).click()

    await page.locator(BP.show).click()

    await expect(page.locator(BP.block)).toHaveCount(1)
    await expect(page.locator(BP.title)).toHaveText("Uranium processing will back up and stop")
    await expect(page.locator(BP.hidden)).toHaveCount(0)
    expect(await dismissedKeys(page)).toBeNull()
})

test("a changed set of leftovers from the same recipe brings the warning back", async ({ calc, page }) => {
    await calc.open(NO_CRACKING)
    await page.locator(BP.dismiss).click()
    expect(await dismissedKeys(page)).toEqual(["advanced-oil-processing:heavy-oil,light-oil"])
    await expect(page.locator(BP.block)).toHaveCount(0)

    // Same recipe, but now only heavy oil is left over: a different blockKey.
    await calc.open(NO_CRACKING_LIGHT_USED)

    await expect(page.locator(BP.block)).toHaveCount(1)
    await expect(page.locator(BP.hidden)).toHaveCount(0)
    await expect(page.locator(BP.line)).toContainText("heavy oil")
    await expect(page.locator(BP.line)).not.toContainText("light oil")
})
