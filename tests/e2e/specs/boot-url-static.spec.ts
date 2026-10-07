import { test, expect } from "../support/fixtures"
import { S } from "../support/selectors"
import { needsCompanionDisplays } from "../support/areas/boot-url"

// Section 14 (companion vs. static) and 15 (analytics off the public host)
// of the inventory. The suite always runs against the static server, so
// every test here is the static side of the contract.

test("the page marks itself as having no companion", async ({ calc, page }) => {
    await calc.open("items=")
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.companion)).toBe("no")
    await expect(page.locator("#page-note")).toHaveText("")
})

test("every companion-only control computes to display:none", async ({ calc, page }) => {
    await calc.open("items=")
    await calc.openSettings()
    let displays = await needsCompanionDisplays(page)
    expect(displays.length).toBeGreaterThan(0)
    for (let { id, display } of displays) {
        expect(display, `#${id} should be display:none without a companion`).toBe("none")
    }
})

test("typing a nickname and rate never adds save= or follow=", async ({ calc }) => {
    await calc.open("items=")
    await calc.addBySearch("red science 60")
    let settings = await calc.settings()
    expect(settings.get("items")).toMatch(/^automation-science-pack/)
    expect(settings.has("save")).toBe(false)
    expect(settings.has("follow")).toBe(false)
})

test("#data_set is disabled: the dataset only ever changes via the fragment", async ({ calc, page }) => {
    await calc.open("items=")
    await calc.openSettings()
    await expect(page.locator("#data_set")).toBeDisabled()
})

test("no googletagmanager request or script, no consent banner, analytics-settings hidden", async ({ calc, page }) => {
    let gtmRequested: string[] = []
    page.on("request", request => {
        if (request.url().includes("googletagmanager")) gtmRequested.push(request.url())
    })
    await calc.open("items=automation-science-pack:r:60")
    expect(gtmRequested).toEqual([])
    expect(await page.locator("script[src*='googletagmanager']").count()).toBe(0)
    await expect(page.locator("#consent-banner")).toHaveCount(0)
    await expect(page.locator("#analytics-settings")).toBeHidden()
})
