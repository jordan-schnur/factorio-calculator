import { test, expect } from "../support/fixtures"
import { savePayload, stubCompanion } from "../support/areas/companion"

// "Re-read now" in Settings → "From your save" refetches the current save directly, without Topbar's picker.

const RED60 = "items=automation-science-pack:r:60"

test("Re-read now refetches the current save and picks up a changed save", async ({ calc, page }) => {
    let stub = await stubCompanion(page, { specPayloads: [savePayload("my-base"), savePayload("autosave1")] })
    await calc.open("save=&follow=1&" + RED60)
    await expect(page.locator("#save-status")).toHaveText("my-base · 2.0.77 · just now")
    let before = stub.specRequests.length

    await calc.openSettings()
    await page.locator("#settings-fromsave").getByRole("button", { name: "Re-read now" }).click()

    await expect.poll(() => stub.specRequests.length).toBeGreaterThan(before)
    expect(stub.specRequests.at(-1)).toBe("")
    await expect(page.locator("#save-status")).toHaveText("autosave1 · 2.0.77 · just now")
})

test("Re-read now with no save followed fetches the newest save, not a stuck follow=1", async ({ calc, page }) => {
    let stub = await stubCompanion(page)
    await calc.open(RED60)
    await expect(page.locator("#save-status")).toHaveText("")

    await calc.openSettings()
    await page.locator("#settings-fromsave").getByRole("button", { name: "Re-read now" }).click()

    await expect.poll(() => stub.specRequests).toContain("")
    await calc.expectSetting("save", "")
    await expect(page.locator("#save-status")).toHaveText("my-base · 2.0.77 · just now")
})
