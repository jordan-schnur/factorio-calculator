import { test, expect } from "../support/fixtures"
import { CHEM, QS } from "../support/areas/quality"

// Quality (calculator 1.3.0): the badge drawn on an icon for anything
// above normal tier, in every place the page shows machines or modules.

test.describe("quality badges across the table, bar and graph", () => {
    test("a machine and module quality link badges the table row, the bar and the graph", async ({ calc }) => {
        await calc.open(CHEM + "&dm=p3@epic&mq=assembling-machine-3:legendary")
        let modsCount = await calc.page.locator(QS.tableModsQbadge).count()
        expect(modsCount).toBeGreaterThanOrEqual(4)
        await expect(calc.page.locator(QS.modulesBarQbadge)).toHaveCount(1)
        let machineBadges = await calc.page.locator(`#item-table ${QS.machineQbadge}`).count()
        expect(machineBadges).toBeGreaterThanOrEqual(1)

        await calc.switchView("graph")
        let graphModsCount = await calc.page.locator(QS.graphNodeModsQbadge("chemical-science-pack")).count()
        expect(graphModsCount).toBeGreaterThanOrEqual(4)
    })

    test("normal tier never draws a badge anywhere", async ({ calc }) => {
        await calc.open(CHEM)
        await expect(calc.page.locator(QS.tableModsQbadge)).toHaveCount(0)
        await expect(calc.page.locator(QS.modulesBarQbadge)).toHaveCount(0)
        await expect(calc.page.locator("#item-table .machines img.qbadge")).toHaveCount(0)
    })

    test("a module quality badge's alt and title name its tier", async ({ calc }) => {
        await calc.open(CHEM + "&mq=assembling-machine-3:epic")
        let badge = calc.row("chemical-science-pack").locator(QS.machineQbadge)
        await expect(badge).toHaveAttribute("alt", "Epic")
        await expect(badge).toHaveAttribute("title", "Epic")
        await expect(badge).toHaveAttribute("data-tier", "epic")
    })
})

test.describe("tier picker aria", () => {
    test("every tier button exposes aria-pressed and only the chosen one is true", async ({ calc }) => {
        await calc.open(CHEM + "&mq=assembling-machine-3:rare")
        await calc.openSettings()
        let row = calc.page.locator(QS.settingsMachineQualityRow("assembling-machine-3"))
        let buttons = row.locator("button[data-tier]")
        await expect(buttons).toHaveCount(5)
        let pressed = await buttons.evaluateAll(els => els.map(e => [e.dataset.tier, e.getAttribute("aria-pressed")]))
        expect(pressed.filter(([, p]) => p === "true")).toEqual([["rare", "true"]])
    })
})
