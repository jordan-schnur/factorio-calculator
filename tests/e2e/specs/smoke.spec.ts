import { test, expect } from "../support/fixtures"
import { S } from "../support/selectors"

// The harness itself: boots, solves, reads a row and the fragment.

test("boots to the intro with nothing planned @mobile", async ({ calc, page }) => {
    await calc.open()
    await expect(calc.isIntro()).toBeVisible()
    await expect(page.locator(S.search)).toBeVisible()
    expect((await calc.settings()).get("data")).toBe("space-age-2-0-77")
})

test("a link opens its plan @mobile", async ({ calc }) => {
    await calc.open("items=automation-science-pack:r:60")
    await expect(calc.isIntro()).toHaveCount(0)
    let science = (await calc.tableRows()).find(r => r.item === "automation-science-pack")
    expect(science).toMatchObject({ group: "Build here", need: "60/min", machines: "10 ×", machineName: "Assembling machine 1" })
    expect((await calc.settings()).get("items")).toBe("automation-science-pack:r:60")
})

test("nothing is fetched from outside the site", async ({ calc, externalRequests }) => {
    await calc.open("items=automation-science-pack:r:60")
    await calc.switchView("graph")
    expect(externalRequests).toEqual([])
})
