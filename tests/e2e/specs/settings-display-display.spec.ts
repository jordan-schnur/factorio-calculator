import { test, expect } from "../support/fixtures"
import { SD, setNumber } from "../support/areas/settings-display"

// Section 7: Display options -- rate unit, decimal places, decimals vs
// rationals, and belt wording. Each writes its own fragment key and a
// reopened link restores it.

test.describe("display settings", () => {
    test("rate unit changes the belt summary and writes rate= @mobile", async ({ calc, page }) => {
        await calc.open("items=iron-plate:r:600")
        await calc.openSettings()
        await expect(page.locator(SD.beltSummary)).toHaveText("Transport belt · 900/minute · 450 per lane")
        await calc.expectSetting("rate", null)

        await page.locator(SD.rateRadio("s")).check()
        await expect(page.locator(SD.beltSummary)).toHaveText("Transport belt · 15/second · 7.5 per lane")
        await calc.expectSetting("rate", "s")

        await page.locator(SD.rateRadio("h")).check()
        await calc.expectSetting("rate", "h")

        await page.locator(SD.rateRadio("m")).check()
        await calc.expectSetting("rate", null)
    })

    test("a rate=s link opens already switched to seconds", async ({ calc, page }) => {
        await calc.open("items=iron-plate:r:600&rate=s")
        await calc.openSettings()
        await expect(page.locator(SD.rateRadio("s"))).toBeChecked()
        await expect(page.locator(SD.beltSummary)).toContainText("15/second")
    })

    test("decimal places for rates and machine counts write rp=/cp= and reload restores them", async ({ calc, page }) => {
        // military-science-pack:17 gives steel-plate a non-integer rate
        // (4.3/min at the default precision 1), so rp actually changes what
        // is shown.
        await calc.open("items=military-science-pack:r:17")
        let need = () => calc.row("steel-plate").locator(".need").first().innerText()
        await expect.poll(need).toContain("4.3/min")

        await calc.openSettings()
        await setNumber(page.locator(SD.rprec), "4")
        await expect.poll(need).toContain("4.25/min")
        await calc.expectSetting("rp", "4")

        await calc.open("items=military-science-pack:r:17&rp=4")
        await expect.poll(need).toContain("4.25/min")
    })

    test("machine-count precision (cp=) writes its fragment key and a reload restores it", async ({ calc, page }) => {
        await calc.open("items=crude-oil:r:650")
        await calc.openSettings()
        await setNumber(page.locator(SD.cprec), "3")
        await calc.expectSetting("cp", "3")
        await calc.closeSettings()

        // A hash-only change isn't a full navigation: close the drawer first
        // so the fresh page (loaded from the link) opens it from scratch.
        await calc.open("items=crude-oil:r:650&cp=3")
        await calc.openSettings()
        await expect(page.locator(SD.cprec)).toHaveValue("3")
    })

    test("decimals vs rationals (vf=r) changes how rates are shown", async ({ calc, page }) => {
        await calc.open("items=military-science-pack:r:17")
        let need = () => calc.row("steel-plate").locator(".need").first().innerText()
        await expect.poll(need).toContain("4.3/min")

        await calc.openSettings()
        await page.locator(SD.rationalFormat).check()
        await expect.poll(need).toContain("4 + 1/4/min") // mixed-number rational, no decimal point
        await calc.expectSetting("vf", "r")

        await page.locator(SD.decimalFormat).check()
        await expect.poll(need).toContain("4.3/min")
        await calc.expectSetting("vf", null)
    })

    test("belt fractions vs decimals (bf=d) reads exact wording", async ({ calc, page }) => {
        await calc.open("items=electronic-circuit:r:900,inserter:r:300")
        let belts = () => calc.row("electronic-circuit").locator(".need .belts").innerText()
        await expect.poll(belts).toBe("1 1/3 belts")
        await calc.expectSetting("bf", null)

        await calc.openSettings()
        await page.locator(SD.decimalBelts).check()
        await expect.poll(belts).toBe("1.33 belts")
        await calc.expectSetting("bf", "d")

        await page.locator(SD.fractionBelts).check()
        await expect.poll(belts).toBe("1 1/3 belts")
        await calc.expectSetting("bf", null)
    })

    test("a bf=d link opens already reading decimal belts", async ({ calc, page }) => {
        await calc.open("items=electronic-circuit:r:900,inserter:r:300&bf=d")
        await expect(calc.row("electronic-circuit").locator(".need .belts")).toHaveText("1.33 belts")
        await calc.openSettings()
        await expect(page.locator(SD.decimalBelts)).toBeChecked()
    })
})
