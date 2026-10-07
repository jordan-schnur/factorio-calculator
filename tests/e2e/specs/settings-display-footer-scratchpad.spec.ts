import { test, expect } from "../support/fixtures"
import { S } from "../support/selectors"

// Section 10: the footer (total machines/power, what's brought in, what's
// sent out) and the scratch pad.

test.describe("footer", () => {
    test("totals and brought-in for a plan with a raw input @mobile", async ({ calc }) => {
        await calc.open("items=military-science-pack:r:60&ignore=steel-plate")
        let footer = await calc.footer()
        expect(footer.totals).toMatch(/^\d+ machines · .+W$/)
        expect(footer.bring).toBe("Brought in: steel plate 15/min")
    })

    test("everything made here from raw ore, gas and water when nothing is brought in", async ({ calc }) => {
        await calc.open("items=military-science-pack:r:60")
        let footer = await calc.footer()
        expect(footer.bring).toBe("Everything is made here from raw ore, gas and water.")
    })

    test("totals scale with the plan", async ({ calc }) => {
        await calc.open("items=military-science-pack:r:60")
        let small = await calc.footer()
        await calc.open("items=military-science-pack:r:600")
        let large = await calc.footer()
        expect(small.totals).not.toBe(large.totals)
    })

    test("sent-out byproducts show in #footer-sendout", async ({ calc, page }) => {
        await calc.open("items=plastic-bar:r:600&disable=basic-oil-processing,heavy-oil-cracking,light-oil-cracking&out=heavy-oil,light-oil")
        let sendout = page.locator(S.footerSendout)
        await expect(sendout).toBeVisible()
        await expect(sendout).toContainText("Sent out:")
        await expect(sendout).toContainText("light oil")
        await expect(sendout).toContainText("heavy oil")
    })

    test("#footer-sendout is hidden with nothing sent out", async ({ calc, page }) => {
        await calc.open("items=military-science-pack:r:60")
        await expect(page.locator(S.footerSendout)).toBeHidden()
    })
})

test.describe("scratch pad", () => {
    async function openScratchpad(calc: any, page: any) {
        await calc.open("items=iron-plate:r:600")
        await page.locator(S.scratchpad + " summary").click()
    }

    test("expressions evaluate live @mobile", async ({ calc, page }) => {
        await openScratchpad(calc, page)
        await page.locator(S.scratchInput).fill("270 / 900")
        await expect(page.locator(S.scratchResult)).toHaveText("= 0.3")
    })

    test("units pass through: kW/MW, and ans inherits the previous unit", async ({ calc, page }) => {
        await openScratchpad(calc, page)
        let input = page.locator(S.scratchInput)
        let result = page.locator(S.scratchResult)

        await input.fill("20 * 90 kW")
        await expect(result).toHaveText("= 1.8 MW")
        await input.press("Enter")
        await expect(page.locator(S.scratchHistory)).toContainText("20 * 90 kW = 1.8 MW")

        await input.fill("ans / 2")
        await expect(result).toHaveText("= 900 kW")
        await input.press("Enter")
        await expect(page.locator(S.scratchHistory)).toContainText("ans / 2 = 900 kW")
    })

    test("Enter keeps the line in history and clears the input; ↑ recalls it", async ({ calc, page }) => {
        await openScratchpad(calc, page)
        let input = page.locator(S.scratchInput)
        await input.fill("600 / 30 / 2")
        await input.press("Enter")
        await expect(input).toHaveValue("")
        await expect(page.locator(S.scratchHistory)).toContainText("600 / 30 / 2 = 10")

        await input.press("ArrowUp")
        await expect(input).toHaveValue("600 / 30 / 2")
    })

    test("clear empties the history and localStorage", async ({ calc, page }) => {
        await openScratchpad(calc, page)
        let input = page.locator(S.scratchInput)
        await input.fill("2 ^ 10")
        await input.press("Enter")
        await expect(page.locator(S.scratchHistory)).not.toBeEmpty()

        await page.locator(S.scratchClear).click()
        await expect(page.locator(S.scratchHistory)).toBeEmpty()
        expect(await page.evaluate(() => localStorage.getItem("calc.scratch"))).toBe("[]")
    })

    test("history survives a reload (calc.scratch in localStorage)", async ({ calc, page }) => {
        await openScratchpad(calc, page)
        let input = page.locator(S.scratchInput)
        await input.fill("1 / 100000")
        await input.press("Enter")
        await expect(page.locator(S.scratchHistory)).toContainText("1 / 100000 = 0.00001")

        await page.reload()
        await calc.ready()
        await page.locator(S.scratchpad + " summary").click()
        await expect(page.locator(S.scratchHistory)).toContainText("1 / 100000 = 0.00001")
    })

    test("bad input shows an error instead of crashing the page", async ({ calc, page }) => {
        await openScratchpad(calc, page)
        let input = page.locator(S.scratchInput)
        let result = page.locator(S.scratchResult)

        await input.fill("foo")
        await expect(result).toHaveText("= ?")

        await input.fill("1 / 0")
        await expect(result).toHaveText("= ?")

        await input.fill("1.2.3")
        await expect(result).toHaveText("= ?")

        await input.fill("600 / (30")
        await expect(result).toHaveText("= …")

        // The page itself must stay usable: fixing the expression recovers.
        await input.fill(".5 * 2")
        await expect(result).toHaveText("= 1")
    })
})
