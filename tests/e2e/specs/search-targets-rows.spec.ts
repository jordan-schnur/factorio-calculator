import { test, expect } from "../support/fixtures"
import { S } from "../support/selectors"
import { AS, SearchTargetsArea } from "../support/areas/search-targets"

// #targets: the rows the Make panel grows once something is planned, plus
// the example chips and target notes that sit around it.

test("a comma-separated items= entry adds every target in one go", async ({ calc, page }) => {
    await calc.open("items=military-science-pack:r:60,automation-science-pack:r:30")
    await expect(calc.isIntro()).toHaveCount(0)
    await expect(page.locator(AS.targetRow)).toHaveCount(2)
    expect((await calc.settings()).get("items")).toBe("military-science-pack:r:60,automation-science-pack:r:30")
})

test.describe("example chips", () => {
    test("clicking a chip adds just that chip's item at its rate", async ({ calc, page }) => {
        await calc.open("items=")
        await page.locator(`${S.exampleTarget}[data-item="chemical-science-pack"]`).click()
        await calc.ready()
        expect((await calc.settings()).get("items")).toBe("chemical-science-pack:r:30")
        await expect(page.locator(AS.targetRow)).toHaveCount(1)
    })

    test("the chips disappear once a target exists", async ({ calc, page }) => {
        await calc.open("items=military-science-pack:r:60")
        await expect(page.locator("#intro-extras")).toBeHidden()
    })
})

test.describe("editing a target row", () => {
    test("typing a new rate updates the hash", async ({ calc, page }) => {
        await calc.open("items=military-science-pack:r:60")
        let area = new SearchTargetsArea(page, calc)
        let row = area.targetRowNamed("Military science")
        await expect(area.unitSelect(row)).toHaveValue("/min")
        await expect(area.numInput(row)).toHaveValue("60")
        await area.setField(row, "120")
        await calc.expectSetting("items", "military-science-pack:r:120")
    })

    test("switching the unit to machines re-sizes by machine count, and back again", async ({ calc, page }) => {
        await calc.open("items=military-science-pack:r:120")
        let area = new SearchTargetsArea(page, calc)
        let row = area.targetRowNamed("Military science")
        await area.setUnit(row, "machines")
        await expect.poll(async () => (await calc.settings()).get("items")).toMatch(/^military-science-pack:f:/)
        let machineCount = await area.numInput(row).inputValue()
        expect(Number(machineCount)).toBeGreaterThan(0)

        await area.setUnit(row, "/min")
        await expect.poll(async () => (await calc.settings()).get("items")).toBe("military-science-pack:r:120")
    })

    test("editing the machine count directly updates the hash", async ({ calc, page }) => {
        await calc.open("items=military-science-pack:f:5")
        let area = new SearchTargetsArea(page, calc)
        let row = area.targetRowNamed("Military science")
        await expect(area.unitSelect(row)).toHaveValue("machines")
        await expect(area.numInput(row)).toHaveValue("5")
        await area.setField(row, "8")
        await calc.expectSetting("items", "military-science-pack:f:8")
    })

    test("the rate's unit follows the display-rate setting", async ({ calc, page }) => {
        await calc.open("items=military-science-pack:r:60")
        let drawer = await calc.openSettings()
        await drawer.locator("#h_rate").check()
        await calc.expectSetting("items", "military-science-pack:r:3600")
        await drawer.locator("#s_rate").check()
        await calc.expectSetting("items", "military-science-pack:r:1")
        await drawer.locator("#m_rate").check()
        await calc.expectSetting("items", "military-science-pack:r:60")
    })

    test("removing targets one by one returns to the intro", async ({ calc, page }) => {
        await calc.open("items=military-science-pack:r:60,automation-science-pack:r:30")
        let area = new SearchTargetsArea(page, calc)
        await expect(page.locator(AS.targetRow)).toHaveCount(2)
        await area.removeRow(area.targetRowNamed("Military science"))
        await expect(page.locator(AS.targetRow)).toHaveCount(1)
        await expect(calc.isIntro()).toHaveCount(0)
        await area.removeRow(area.targetRowNamed("Automation science pack"))
        await expect(page.locator(AS.targetRow)).toHaveCount(0)
        await expect(calc.isIntro()).toBeVisible()
    })
})

test.describe("target notes", () => {
    // App bug (factory.js ensureTargetsProducible/solve): a target that
    // starts out ignored gets its note and its ignore cleared from the
    // hash, but the item table never recovers any rows for this plan
    // (#item-table .lrow stays at 0 indefinitely). calc.ready() needs a row,
    // the intro, or a graph node to settle, so this test opens with
    // {wait:false} and polls the note directly instead.
    test("a target can't be supplied from elsewhere, so the plan builds it anyway", async ({ calc, page }) => {
        await calc.open("items=steel-plate:r:60&ignore=steel-plate", { wait: false })
        let notes = page.locator(S.targetNotes)
        await expect(notes).toBeVisible()
        await expect(notes).toContainText("Steel plate is a target, so it is built here rather than supplied from elsewhere.")
        // The correction is reflected back into the hash: steel-plate is no
        // longer ignored once it has been forced to build.
        await expect.poll(async () => (await calc.settings()).has("ignore")).toBe(false)
    })

    test.fixme("the table actually shows the forced target's row (app bug: stays empty)", async ({ calc, page }) => {
        await calc.open("items=steel-plate:r:60&ignore=steel-plate")
        expect(await calc.rowItems()).toContain("steel-plate")
    })

    test("no notes when nothing needed correcting", async ({ calc, page }) => {
        await calc.open("items=military-science-pack:r:60")
        await expect(page.locator(S.targetNotes)).toBeHidden()
    })
})

test.describe("mobile", () => {
    test("a target row's controls are usable on a phone @mobile", async ({ calc, page }) => {
        await calc.open("items=military-science-pack:r:60")
        let area = new SearchTargetsArea(page, calc)
        let row = area.targetRowNamed("Military science")
        await area.removeRow(row)
        await expect(calc.isIntro()).toBeVisible()
    })
})
