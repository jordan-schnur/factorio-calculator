import { test, expect } from "../support/fixtures"
import { S } from "../support/selectors"
import { watchDatasetRequests } from "../support/areas/boot-url"

// Section 2 of the inventory: boot, intro, title, and hash bookkeeping.

test("a fragment with a target boots straight past the intro @mobile", async ({ calc, page }) => {
    await calc.open("items=military-science-pack:r:1&ignore=steel-plate")
    await expect(calc.isIntro()).toHaveCount(0)
    await expect(page.locator(S.tableFrame)).toBeVisible()
    await expect(page.locator(S.graphFrame)).toBeHidden()
    await expect(page.locator(S.targets).locator(".target")).toHaveCount(1)
    await expect(page.locator("body")).toContainText("Kirk McDonald")
    let settings = await calc.settings()
    expect(settings.get("items")).toBe("military-science-pack:r:1")
    expect(settings.get("ignore")).toBe("steel-plate")
})

test("the tab title names what the plan makes", async ({ calc, page }) => {
    await calc.open("items=military-science-pack:r:1&ignore=steel-plate")
    await expect.poll(() => page.title()).toBe("Military science pack 1/min · Factorio Calculator")
    expect((await calc.settings()).has("title")).toBe(false)
})

test("a custom title setting overrides the tab title and round-trips", async ({ calc, page }) => {
    await calc.open("title=My%20mall&items=military-science-pack:r:1&ignore=steel-plate")
    await expect.poll(() => page.title()).toBe("My mall")
    expect((await calc.settings()).get("title")).toBe("My%20mall")
    await expect(page.locator("#title_setting")).toHaveValue("My mall")
})

test("an empty items= shows the intro with the en-dash title", async ({ calc, page }) => {
    await calc.open("items=")
    await expect(calc.isIntro()).toBeVisible()
    await expect.poll(() => page.title()).toBe("Factorio Calculator – Space Age & 2.0 Production Ratios")
    for (let sel of [S.viewSwitch, "#board-button", S.footer, S.tableFrame]) {
        await expect(page.locator(sel)).toBeHidden()
    }
})

test("an intro example chip adds its target and the other two show as suggestions", async ({ calc, page }) => {
    await calc.open("items=")
    await page.locator(`${S.exampleTarget}[data-item="automation-science-pack"]`).click()
    await expect(calc.isIntro()).toHaveCount(0)
    await expect(calc.row("automation-science-pack")).toBeVisible()
    expect((await calc.settings()).get("items")).toBe("automation-science-pack:r:60")
    let chips = await page.locator(S.exampleTarget).evaluateAll(els =>
        els.map(el => ({ item: (el as HTMLElement).dataset.item, rate: (el as HTMLElement).dataset.rate, text: el.textContent })))
    expect(chips).toEqual(expect.arrayContaining([
        { item: "automation-science-pack", rate: "60", text: "Red science 60/min" },
        { item: "military-science-pack", rate: "60", text: "Military science 60/min" },
        { item: "chemical-science-pack", rate: "30", text: "Blue science 30/min" },
    ]))
})

test("the page's own hash writes never re-fetch the dataset @mobile", async ({ calc, page }) => {
    let datasetRequests = watchDatasetRequests(page)
    await calc.open("items=military-science-pack:r:60&ignore=steel-plate")
    expect(datasetRequests).toHaveLength(1)

    // Several actions that each write a fresh hash: none of them should
    // cause the page to reload itself and re-fetch the dataset the way a
    // foreign hashchange (back/forward, a pasted link) would.
    await calc.row("military-science-pack").click()
    await calc.expectSetting("item", "military-science-pack")
    await calc.row("military-science-pack").click()
    await calc.expectSetting("item", null)
    await calc.openSettings()
    await calc.closeSettings()
    expect(datasetRequests).toHaveLength(1)
})

test("back and forward through history reload the plan they land on", async ({ calc, page }) => {
    await calc.open("items=automation-science-pack:r:60")
    await calc.openSettings()
    await calc.closeSettings()
    let datasetRequests = watchDatasetRequests(page)
    await calc.row("automation-science-pack").click()
    await calc.expectSetting("item", "automation-science-pack")
    expect(datasetRequests, "the page's own write does not reload").toHaveLength(0)

    await page.goBack()
    // Landing on a hash the page did not just write is a foreign navigation:
    // it reloads and re-fetches the dataset, same as a pasted link would.
    await expect.poll(() => datasetRequests.length).toBeGreaterThan(0)
    await calc.ready()
    expect((await calc.settings()).get("items")).toBe("automation-science-pack:r:60")

    await page.goForward()
    await calc.ready()
    expect((await calc.settings()).get("item")).toBe("automation-science-pack")
})

test("Back then Forward at once lands on the newer plan, not the one Back was still loading", async ({ calc, page }) => {
    await calc.open("items=automation-science-pack:r:60")
    await calc.row("automation-science-pack").click()
    await calc.expectSetting("item", "automation-science-pack")
    let entries = await page.evaluate(() => history.length)
    await page.goBack()
    await page.goForward()
    await expect(calc.row("automation-science-pack").locator("xpath=following-sibling::*[1]")).toHaveClass(/detail/)
    expect(await page.evaluate(() => history.length), "no history entry pushed over the forward one").toBe(entries)
})

test("removing the only target returns to the intro and offers Restore the last factory", async ({ calc, page }) => {
    await calc.open("data=space-age-2.0.77&items=military-science-pack:r:60")
    await expect(page.locator(S.restoreLast)).toBeHidden()
    await page.locator("#targets li.target .btn-red").click()
    await expect(calc.isIntro()).toBeVisible()
    await expect(page.locator(S.restoreLast)).toBeVisible()

    await page.locator(S.restoreLast).click()
    await expect(calc.isIntro()).toHaveCount(0)
    expect((await calc.settings()).get("items")).toBe("military-science-pack:r:60")
})

test("Restore the last factory stays hidden once there is nothing to restore", async ({ calc, page }) => {
    await calc.open("items=")
    await expect(page.locator(S.restoreLast)).toBeHidden()
})
