import { test, expect } from "../support/fixtures"
import { stubCompanion } from "../support/areas/companion"

// The save-following controls in the top bar, with a stubbed companion server behind the page.

const RED60 = "items=automation-science-pack:r:60"

test("the page marks itself as companion-hosted and shows the save line", async ({ calc, page }) => {
    await stubCompanion(page)
    await calc.open(RED60)
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.companion)).toBe("yes")
    await expect(page.locator("#save-line")).toHaveText("not following a save")
    await expect(page.locator("#save-line")).toBeVisible()
    await expect(page.locator("#save-picker")).toBeHidden()
    await expect(page.locator("#save-picker option")).toHaveCount(0)
    await expect(page.locator("#save-status")).toHaveText("")
    await expect(page.locator("#page-note")).toHaveText("")
})

test("a fresh open follows the newest save", async ({ calc, page }) => {
    let stub = await stubCompanion(page)
    await calc.open("")
    await expect.poll(() => stub.specRequests).toContain("")
    await calc.expectSetting("follow", "1")
    await expect(page.locator("#save-status")).toHaveText("my-base · 2.0.77 · just now")
})

test("save=&follow=1 fills the picker, the status and the save line", async ({ calc, page }) => {
    let stub = await stubCompanion(page)
    await calc.open("save=&follow=1&" + RED60)
    await expect(page.locator("#save-picker option")).toHaveText(["newest save", "autosave1", "my-base"])
    await expect(page.locator("#save-picker option").first()).toHaveAttribute("value", "")
    await expect(page.locator("#save-picker")).toHaveValue("my-base")
    await expect(page.locator("#save-picker")).toBeVisible()
    await expect(page.locator("#save-status")).toHaveText("my-base · 2.0.77 · just now")
    await expect(page.locator("#save-status")).toBeVisible()
    await expect(page.locator("#page-note")).toHaveText("")
    await expect(page.locator("#save-line")).toHaveText(/^Reading my-base · /)
    expect(stub.specRequests[0]).toBe("")
    await calc.expectSetting("follow", "1")
})

test("picking a save in the picker follows that save", async ({ calc, page }) => {
    let stub = await stubCompanion(page)
    await calc.open("save=&follow=1&" + RED60)
    await expect(page.locator("#save-picker")).toHaveValue("my-base")
    await page.locator("#save-picker").selectOption("autosave1")
    await calc.expectSetting("save", "autosave1")
    await expect.poll(() => stub.specRequests).toContain("autosave1")
    await expect(page.locator("#save-status")).toHaveText("autosave1 · 2.0.77 · just now")
    await expect(page.locator("#save-picker")).toHaveValue("autosave1")
    await expect(page.locator("#save-line")).toHaveText(/^Reading autosave1 · /)
})

test("a failing save fetch says so in the page note", async ({ calc, page, pageErrors }) => {
    pageErrors.allow(/\/api\/calc\/spec/)
    await stubCompanion(page, { specStatus: 500 })
    await calc.open("save=&follow=1&" + RED60)
    await expect(page.locator("#page-note")).toHaveText("Save settings unavailable: 500")
    await expect(page.locator("#page-note")).toBeVisible()
    await expect(page.locator("#save-picker")).toBeHidden()
})

test("Reset all in Settings clears the overrides and refetches the save", async ({ calc, page }) => {
    let stub = await stubCompanion(page)
    await calc.open("save=&follow=1&ov=belt&" + RED60)
    await expect(page.locator("#save-status")).toHaveText("my-base · 2.0.77 · just now")
    let before = stub.specRequests.length
    await calc.openSettings()
    await page.locator("#overrides-reset-all").click()
    await calc.expectSetting("ov", null)
    await expect.poll(() => stub.specRequests.length).toBeGreaterThan(before)
})
