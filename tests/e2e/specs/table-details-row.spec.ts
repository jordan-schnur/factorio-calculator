import { test, expect } from "../support/fixtures"
import { S } from "../support/selectors"
import { TD, groupedRows } from "../support/areas/table-details"

// Section 5's opened row: Needs/Goes to/Source, recipe picking, and the
// make-here <-> bring-in switch. One row open at a time; the row is a
// <button>, so Enter/Space open and close it like any other button.

const F60 = "items=military-science-pack:r:60&ignore=steel-plate"

test.describe("opening and closing a row", () => {
    test("opens a detail panel directly after the row, with Needs/Goes to/Source and item= in the hash", async ({ calc }) => {
        await calc.open(F60)
        let detail = await calc.openRow("copper-plate")
        await expect(calc.row("copper-plate")).toHaveClass(/\bopen\b/)
        await expect(detail.locator(".col.needs .lbl").first()).toHaveText("Needs")
        await expect(detail.locator(".col.needs")).toContainText("Copper ore")
        await expect(detail.locator(".col.goesto .lbl").first()).toHaveText("Goes to")
        await expect(detail.locator(".col.source")).toContainText("Make here")
        await expect(detail.locator(".col.source")).toContainText("Bring in from another build")
        for (let share of await detail.locator(TD.shareNum).allTextContents()) {
            expect(share).toMatch(/%$/)
        }
        for (let ratio of await detail.locator(TD.needsCol + " " + TD.ratioLine).allTextContents()) {
            expect(ratio).toContain(" per ")
        }
        for (let ratio of await detail.locator(TD.goesToCol + " " + TD.ratioLine).allTextContents()) {
            expect(ratio).toContain(" feeds ")
        }
        await calc.expectSetting("item", "copper-plate")
    })

    test("pins exact Needs/Goes to numbers for a known plan", async ({ calc }) => {
        await calc.open(F60)
        let detail = await calc.openRow("copper-plate")
        await expect(detail.locator(TD.needsCol + " " + TD.ratioLine)).toHaveText(
            "1.25 electric mining drills per electric furnace · block 5 : 4")
        await expect(detail.locator(TD.goesToCol + " " + TD.ratioLine)).toHaveText(
            "1 electric furnace feeds 3.75 assembling machines 1 · block 4 : 15")
        await expect(detail.locator(TD.goesToCol + " " + TD.shareNum)).toHaveText("100%")
    })

    test("only one row is open at a time", async ({ calc }) => {
        await calc.open(F60)
        await calc.openRow("copper-plate")
        await calc.openRow("iron-plate")
        await expect(calc.page.locator(TD.openRow)).toHaveCount(1)
        await expect(calc.row("iron-plate")).toHaveClass(/\bopen\b/)
        await expect(calc.row("copper-plate")).not.toHaveClass(/\bopen\b/)
    })

    test("clicking the open row again closes it and clears item=", async ({ calc }) => {
        await calc.open(F60)
        await calc.openRow("copper-plate")
        await calc.row("copper-plate").click()
        await expect(calc.row("copper-plate")).not.toHaveClass(/\bopen\b/)
        await expect(calc.page.locator(S.detail)).toHaveCount(0)
        await calc.expectSetting("item", null)
    })

    test("item= in the fragment opens that row on load", async ({ calc }) => {
        await calc.open(F60 + "&item=iron-plate")
        await expect(calc.row("iron-plate")).toHaveClass(/\bopen\b/)
        await expect(calc.page.locator(`${S.rowFor("iron-plate")} + ${S.detail}`)).toBeVisible()
    })

    test("a row opens and closes on Enter and on Space, like any button", async ({ calc, page }) => {
        await calc.open(F60)
        await calc.row("copper-plate").focus()
        await page.keyboard.press("Enter")
        await expect(calc.row("copper-plate")).toHaveClass(/\bopen\b/)
        // The row re-renders on every toggle (a fresh <button>), so the key
        // press needs a fresh focus too -- the old element is detached.
        await calc.row("copper-plate").focus()
        await page.keyboard.press("Space")
        await expect(calc.row("copper-plate")).not.toHaveClass(/\bopen\b/)
    })

    test("opening settings over an open row leaves it open; Escape closes only the drawer", async ({ calc, page }) => {
        await calc.open(F60)
        await calc.openRow("copper-plate")
        await calc.openSettings()
        await page.keyboard.press("Escape")
        await expect(page.locator(S.settingsDrawer)).toBeHidden()
        await expect(calc.row("copper-plate")).toHaveClass(/\bopen\b/)
        await calc.expectSetting("item", "copper-plate")
    })

    test("a Needs/Goes to rate's data-value inserts into the scratch pad", async ({ calc, page }) => {
        await calc.open(F60)
        let detail = await calc.openRow("military-science-pack")
        let num = detail.locator(".num[data-value]").first()
        let value = await num.getAttribute("data-value")
        await num.click()
        await expect(page.locator(S.scratchInput)).toHaveValue(value!)
    })
})

test.describe("make here vs bring in from another build", () => {
    test("bringing a row in moves it to Bring in, writes ignore=, and its own inputs vanish from the table", async ({ calc, page }) => {
        await calc.open(F60)
        let detail = await calc.openRow("copper-plate")
        await detail.getByRole("button", { name: "Bring in from another build" }).click()
        await expect(calc.row("copper-plate")).toHaveClass(/\bdim\b/)
        let groups = await groupedRows(page)
        expect(groups["Build here"]).not.toContain("copper-plate")
        expect(groups["Bring in from another build"]).toContain("copper-plate")
        expect(groups["Build here"]).not.toContain("copper-ore")
        expect(await page.locator(S.rowFor("copper-ore")).count()).toBe(0)
        await calc.expectSetting("ignore", "steel-plate,copper-plate")
        let footer = await calc.footer()
        expect(footer.bring.toLowerCase()).toContain("copper plate")
    })

    test("Make here brings a brought-in row back", async ({ calc, page }) => {
        await calc.open("items=military-science-pack:r:60&ignore=steel-plate,copper-plate")
        let detail = await calc.openRow("copper-plate")
        await detail.getByRole("button", { name: "Make here", exact: true }).click()
        await expect(calc.row("copper-plate")).not.toHaveClass(/\bdim\b/)
        let groups = await groupedRows(page)
        expect(groups["Build here"]).toContain("copper-plate")
        expect(groups["Bring in from another build"]).not.toContain("copper-plate")
        await calc.expectSetting("ignore", "steel-plate")
    })
})

test.describe("picking another recipe on a row", () => {
    test("petroleum gas (2 real recipes in use) shows a Recipe list with a current option", async ({ calc }) => {
        await calc.open("items=plastic-bar:r:60")
        let detail = await calc.openRow("petroleum-gas")
        await expect(detail.locator(".lbl", { hasText: "Recipe" })).toBeVisible()
        expect(await detail.locator(TD.recipeOption).count()).toBeGreaterThanOrEqual(2)
        expect(await detail.locator(TD.recipeOption + ".cur").count()).toBeGreaterThanOrEqual(1)
    })

    test("a single-recipe item (electronic circuit) has no Recipe section", async ({ calc }) => {
        await calc.open("items=electronic-circuit:r:60")
        let detail = await calc.openRow("electronic-circuit")
        await expect(detail).not.toContainText("Recipe")
        expect(await detail.locator(TD.recipeOption).count()).toBe(0)
    })

    test("picking casting iron gear wheel changes the table and the fragment", async ({ calc, page }) => {
        await calc.open("items=iron-gear-wheel:r:60&planet=vulcanus")
        let detail = await calc.openRow("iron-gear-wheel")
        // The plan starts on the casting recipe (foundry, molten iron); switch
        // to the crafted one and the ingredients change from molten metal to plate.
        await expect(detail.locator(TD.recipeOptionFor("casting-iron-gear-wheel"))).toHaveClass(/\bcur\b/)
        expect(await page.locator(S.row).count()).toBe(4)
        await detail.locator(TD.recipeOptionFor("iron-gear-wheel")).click()
        await expect(detail.locator(TD.recipeOptionFor("iron-gear-wheel"))).toHaveClass(/\bcur\b/)
        await expect(calc.row("iron-plate")).toBeVisible()
        await calc.expectSetting("disable", "casting-iron-gear-wheel")
    })
})
