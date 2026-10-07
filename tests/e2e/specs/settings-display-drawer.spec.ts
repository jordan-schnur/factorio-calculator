import { test, expect } from "../support/fixtures"
import { S } from "../support/selectors"
import { SD, SECTION_ORDER } from "../support/areas/settings-display"

// Section 7: the settings drawer itself -- how it opens, closes, and what
// order its sections appear in.

test.describe("settings drawer", () => {
    test("opens from the Settings button and lists its sections in order @mobile", async ({ calc }) => {
        await calc.open("items=military-science-pack:r:60&ignore=steel-plate")
        let drawer = await calc.openSettings()
        await expect(drawer).toBeVisible()

        // "From your save" is in the DOM but hidden (.needs-companion, no
        // companion under the static server), so check markup order, not
        // visible text.
        let html = await calc.page.locator(S.settingsDrawer).innerHTML()
        let positions = SECTION_ORDER.map(label => html.indexOf(`>${label}<`))
        expect(positions.every(p => p !== -1)).toBe(true)
        expect(positions).toEqual([...positions].sort((a, b) => a - b))

        await expect(calc.page.locator("#asm-seg")).toBeAttached()
    })

    test("closes via the ✕ button", async ({ calc }) => {
        await calc.open("items=military-science-pack:r:60")
        await calc.openSettings()
        await calc.closeSettings()
    })

    test("closes on Escape", async ({ calc, page }) => {
        await calc.open("items=military-science-pack:r:60")
        await calc.openSettings()
        await page.keyboard.press("Escape")
        await expect(page.locator(S.settingsDrawer)).toBeHidden()
    })

    test("closes on a click outside the panel (the drawer backdrop)", async ({ calc, page }) => {
        await calc.open("items=military-science-pack:r:60")
        await calc.openSettings()
        // Click the drawer element itself, off to its side, away from the
        // centred #settings-panel card -- that's the backdrop.
        await page.locator(S.settingsDrawer).click({ position: { x: 5, y: 5 } })
        await expect(page.locator(S.settingsDrawer)).toBeHidden()
    })

    test("Escape closes the drawer but leaves an open table row open", async ({ calc, page }) => {
        await calc.open("items=military-science-pack:r:60&ignore=steel-plate")
        await calc.openRow("copper-plate")
        await calc.openSettings()
        await page.keyboard.press("Escape")
        await expect(page.locator(S.settingsDrawer)).toBeHidden()
        await expect(calc.row("copper-plate")).toHaveClass(/open/)
        await calc.expectSetting("item", "copper-plate")
    })
})
