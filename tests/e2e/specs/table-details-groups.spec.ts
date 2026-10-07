import { test, expect } from "../support/fixtures"
import { S } from "../support/selectors"
import { TD, groupedRows } from "../support/areas/table-details"

// Section 5 (the item table): group order and membership, badges, the Need
// column with its belts, and the Machines column -- across a vanilla and a
// Space Age plan.

const F60 = "items=military-science-pack:r:60&ignore=steel-plate"

test.describe("table groups and badges", () => {
    test("Build here / Bring in / Mine or pipe in, in order, with their column headers", async ({ calc, page }) => {
        await calc.open(F60)
        let labels = await page.locator(S.sectionHeader + " .lbl").allTextContents()
        // One "Machines"/"Drills" header per section plus the group label itself.
        expect(labels.filter(l => ["Build here", "Bring in from another build", "Mine or pipe in"].includes(l)))
            .toEqual(["Build here", "Bring in from another build", "Mine or pipe in"])
        let groups = await groupedRows(page)
        expect(Object.keys(groups)).toEqual(["Build here", "Bring in from another build", "Mine or pipe in"])
        expect(groups["Build here"]).toContain("military-science-pack")
        expect(groups["Bring in from another build"]).toEqual(["steel-plate"])
        expect(groups["Mine or pipe in"]).toEqual(["iron-ore", "copper-ore", "coal", "stone"])

        let headers = await page.locator(S.sectionHeader).evaluateAll(els => els.map(el => el.children[2].textContent))
        expect(headers).toEqual(["Machines", "", "Drills"])
    })

    test("the target row carries a target badge and a whole-machine count", async ({ calc }) => {
        await calc.open(F60)
        let row = calc.row("military-science-pack")
        await expect(row.locator(".badge.target")).toHaveText("target")
        await expect(row.locator(S.rowMachineCount)).toHaveText(/^\d+ ×$/)
    })

    test("a brought-in row is dim and badged, a mined row is badged mined", async ({ calc }) => {
        await calc.open(F60)
        let steel = calc.row("steel-plate")
        await expect(steel).toHaveClass(/\bdim\b/)
        await expect(steel.locator(".badge.in")).toContainText(/brought in/i)
        let ore = calc.row("iron-ore")
        await expect(ore.locator(".badge.mine")).toHaveText("mined")
    })

    test("a fluid resource is badged piped in, not mined", async ({ calc }) => {
        await calc.open("items=chemical-science-pack:r:30")
        await expect(calc.row("water").locator(".badge.pipe")).toContainText(/piped in/i)
    })

    test("mined solids sort before mined fluids", async ({ page, calc }) => {
        await calc.open("items=chemical-science-pack:r:30")
        let groups = await groupedRows(page)
        expect(groups["Mine or pipe in"]).toEqual(["iron-ore", "copper-ore", "coal", "crude-oil", "water"])
    })

    test("a target that is itself a resource sits once in Build here, not Mine or pipe in", async ({ calc, page }) => {
        await calc.open("items=crude-oil:r:600")
        let groups = await groupedRows(page)
        expect(groups["Build here"]).toEqual(["crude-oil"])
        expect(groups["Mine or pipe in"] ?? []).toEqual([])
        let row = calc.row("crude-oil")
        await expect(row.locator(S.rowMachineCount)).toHaveText("1 ×")
        await expect(row).toContainText("Pumpjack")
    })

    test("every row is at least 44px tall", async ({ calc }) => {
        await calc.open(F60)
        let height = await calc.row("military-science-pack").evaluate(el => getComputedStyle(el).height)
        expect(parseFloat(height)).toBeGreaterThanOrEqual(44)
    })

    test("a vanilla plan (data=2-0-55) groups and badges the same way", async ({ calc, page }) => {
        await calc.open("data=2-0-55&items=advanced-circuit:r:60")
        let groups = await groupedRows(page)
        expect(groups["Build here"]).toContain("advanced-circuit")
        expect(groups["Mine or pipe in"]).toEqual(["iron-ore", "copper-ore", "coal", "water", "crude-oil"])
        await expect(calc.row("crude-oil").locator(".badge.pipe")).toContainText(/piped in/i)
    })

    test("a slowed-down module row's machine count is floored at 1, never 0 or negative", async ({ calc }) => {
        await calc.open("data=space-age-2.0.77&mach=plastic-bar:cryogenic-plant&dm=p3&items=plastic-bar:r:50")
        let row = calc.row("plastic-bar")
        await expect(row.locator(S.rowMachineCount)).toHaveText("1 ×")
        await expect(row).toContainText("Cryogenic plant")
    })
})

test.describe("Need and Machines columns", () => {
    test("the Need column shows a rate and a belt count", async ({ calc }) => {
        await calc.open(F60)
        let rows = await calc.tableRows()
        let ironPlate = rows.find(r => r.item === "iron-plate")!
        expect(ironPlate.need).toBe("270/min")
        expect(ironPlate.belts).toBe("3/10 belt")
    })

    test("a fluid's Need column reads 'pipe' instead of a belt count", async ({ calc }) => {
        await calc.open("items=chemical-science-pack:r:30")
        let rows = await calc.tableRows()
        expect(rows.find(r => r.item === "water")!.belts).toBe("pipe")
    })

    test("the Machines column shows the machine's count and name", async ({ calc }) => {
        await calc.open(F60)
        let rows = await calc.tableRows()
        expect(rows.find(r => r.item === "military-science-pack")).toMatchObject({
            machines: "10 ×",
            machineName: "Assembling machine 1",
        })
        expect(rows.find(r => r.item === "iron-plate")).toMatchObject({
            machines: "8 ×",
            machineName: "Electric furnace",
        })
    })

    test("a brought-in row's Machines column is empty", async ({ calc }) => {
        await calc.open(F60)
        let rows = await calc.tableRows()
        expect(rows.find(r => r.item === "steel-plate")!.machines).toBe("")
    })

    test("a multi-output row's Need column counts outputs instead of a rate", async ({ calc }) => {
        await calc.open("data=2-0-55&items=advanced-circuit:r:60")
        await expect(calc.row("heavy-oil").locator(S.rowNeed)).toHaveText("3 outputs")
    })
})
