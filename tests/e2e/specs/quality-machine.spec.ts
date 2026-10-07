import { test, expect } from "../support/fixtures"
import { CHEM, OPEN_CHEM, QS } from "../support/areas/quality"

// Quality (calculator 1.3.0): machine tiers. `mq=<machine>:<tier>,...` sets
// a crafting machine's speed everywhere it is used; the per-row and
// drawer pickers write the same key.

test.describe("machine quality: counts and power", () => {
    const cases: [string, string][] = [
        ["", "10 ×"],
        ["&mq=assembling-machine-3:rare", "6 ×"],
        ["&mq=assembling-machine-3:legendary", "4 ×"],
        ["&dm=p3", "18 ×"],
        ["&dm=p3@legendary", "12 ×"],
        ["&dm=p3@legendary&mq=assembling-machine-3:legendary", "5 ×"],
        ["&dm=p3&mq=assembling-machine-3:legendary", "7 ×"],
    ]
    for (let [suffix, expected] of cases) {
        test(`CHEM${suffix} shows ${expected}`, async ({ calc }) => {
            await calc.open(CHEM + suffix)
            let row = (await calc.tableRows()).find(r => r.item === "chemical-science-pack")
            expect(row?.machines).toBe(expected)
        })
    }

    test("a higher machine tier lowers the footer's machine count and power", async ({ calc, page }) => {
        await calc.open(CHEM)
        let base = (await calc.footer()).totals
        await calc.open(CHEM + "&mq=assembling-machine-3:legendary")
        let footerTotals = page.locator("#footer-totals")
        await expect.poll(async () => ((await footerTotals.textContent()) ?? "").replace(/\s+/g, " ").trim())
            .not.toBe(base)
        let legendary = (await calc.footer()).totals
        let baseMachines = parseInt(base)
        let legendaryMachines = parseInt(legendary)
        expect(legendaryMachines).toBeLessThan(baseMachines)
        let basePower = parseFloat(base.split("·")[1])
        let legendaryPower = parseFloat(legendary.split("·")[1])
        expect(legendaryPower).toBeLessThan(basePower)
    })
})

test.describe("machine quality: unknown tiers and machines", () => {
    test("bad machines and tiers in mq are dropped, dm@shiny falls back to normal", async ({ calc }) => {
        await calc.open(CHEM + "&dm=p3@shiny&mq=assembling-machine-3:bogus,nope:legendary,electric-mining-drill:rare")
        let row = (await calc.tableRows()).find(r => r.item === "chemical-science-pack")
        expect(row?.machines).toBe("18 ×")
        let settings = await calc.settings()
        expect(settings.get("dm")).toBe("p3")
        expect(settings.get("mq")).toBeUndefined()
    })
})

test.describe("machine quality: burner fuel", () => {
    test("a stone furnace's coal consumption speeds up with its tier", async ({ calc }) => {
        await calc.open("items=iron-plate:r:60&buildings=stone-furnace")
        let base = (await calc.tableRows()).find(r => r.item === "coal")
        await calc.open("items=iron-plate:r:60&buildings=stone-furnace&mq=stone-furnace:legendary")
        let legendary = (await calc.tableRows()).find(r => r.item === "coal")
        expect(base?.need).not.toBe(legendary?.need)
    })
})

test.describe("machine quality: per-row picker", () => {
    test("CHEM's row picker starts on normal with no mq in the hash", async ({ calc }) => {
        await calc.open(OPEN_CHEM)
        let detail = calc.page.locator(QS.detailMachineQuality)
        await expect(detail.locator(QS.tierButtonOn)).toHaveAttribute("data-tier", "normal")
        expect((await calc.settings()).get("mq")).toBeUndefined()
    })

    test("picking a tier on the row sets mq, the count and marks ov quality", async ({ calc }) => {
        await calc.open(OPEN_CHEM)
        let detail = calc.page.locator(QS.detailMachineQuality)
        await detail.locator(QS.tierButton("legendary")).click()
        await calc.expectSetting("mq", "assembling-machine-3:legendary")
        let row = (await calc.tableRows()).find(r => r.item === "chemical-science-pack")
        expect(row?.machines).toBe("4 ×")
        expect((await calc.settings()).get("ov")?.split(",")).toContain("quality")
    })

    test("a row's quality picker shows epic from the link and badges the machine", async ({ calc }) => {
        await calc.open(CHEM + "&mq=assembling-machine-3:epic")
        await calc.openRow("chemical-science-pack")
        let pickerOn = calc.page.locator(QS.detailMachineQuality).locator(QS.tierButtonOn)
        await expect(pickerOn).toHaveAttribute("data-tier", "epic")
        let badge = calc.row("chemical-science-pack").locator(QS.machineQbadge)
        await expect(badge).toHaveAttribute("title", "Epic")
    })

    test("the same link badges the machine's graph card too", async ({ calc }) => {
        await calc.open(CHEM + "&mq=assembling-machine-3:epic&view=graph")
        let badge = calc.graphNode("chemical-science-pack").locator(".sub img.qbadge")
        await expect(badge).toHaveAttribute("title", "Epic")
    })

    test("normal tier is never badged, in the table or the graph", async ({ calc }) => {
        await calc.open(CHEM)
        await expect(calc.row("chemical-science-pack").locator(QS.machineQbadge)).toHaveCount(0)
        await calc.switchView("graph")
        await expect(calc.graphNode("chemical-science-pack").locator("img.qbadge")).toHaveCount(0)
    })

    test("aria-pressed tracks the chosen tier on the row picker", async ({ calc }) => {
        await calc.open(OPEN_CHEM)
        let detail = calc.page.locator(QS.detailMachineQuality)
        let normal = detail.locator(QS.tierButton("normal"))
        let rare = detail.locator(QS.tierButton("rare"))
        await expect(normal).toHaveAttribute("aria-pressed", "true")
        await expect(rare).toHaveAttribute("aria-pressed", "false")
        await rare.click()
        await expect(rare).toHaveAttribute("aria-pressed", "true")
        await expect(normal).toHaveAttribute("aria-pressed", "false")
    })

    test("the row note names the machine this picker applies to", async ({ calc }) => {
        await calc.open(OPEN_CHEM)
        await expect(calc.page.locator(QS.detailMachineQualityNote)).toHaveText("Every assembling machine 3 in this build")
    })
})

test.describe("machine quality: settings drawer", () => {
    test("the drawer's picker starts on normal for a plan machine", async ({ calc }) => {
        await calc.open(CHEM)
        await calc.openSettings()
        let row = calc.page.locator(QS.settingsMachineQualityRow("assembling-machine-3"))
        await expect(row.locator(QS.tierButtonOn)).toHaveAttribute("data-tier", "normal")
    })

    test("picking rare from the drawer sets mq and the row's picker", async ({ calc }) => {
        await calc.open(OPEN_CHEM)
        await calc.openSettings()
        let row = calc.page.locator(QS.settingsMachineQualityRow("assembling-machine-3"))
        await row.locator(QS.tierButton("rare")).click()
        await calc.expectSetting("mq", "assembling-machine-3:rare")
        let detail = calc.page.locator(QS.detailMachineQuality)
        await expect(detail.locator(QS.tierButtonOn)).toHaveAttribute("data-tier", "rare")
    })
})

test.describe("machine quality: round trip", () => {
    test("mq round-trips with two machines", async ({ calc }) => {
        await calc.open(CHEM + "&mq=assembling-machine-3:legendary,chemical-plant:uncommon")
        expect((await calc.settings()).get("mq")).toBe("assembling-machine-3:legendary,chemical-plant:uncommon")
    })

    test("a 1.2.0 link with no quality keys writes none back", async ({ calc }) => {
        await calc.open(CHEM + "&dm=p3&db=s3:s3&dbc=8&mm=assembling-machine-3:s3:s3:null:p3;s3:s3:8")
        let settings = await calc.settings()
        expect(settings.get("mq")).toBeUndefined()
        expect(settings.get("dbq")).toBeUndefined()
        expect(settings.get("dm")).toBe("p3")
        expect(settings.get("mm")).toBe("assembling-machine-3:s3:s3:null:p3;s3:s3:8")
    })
})

test.describe("machine quality: badge size", () => {
    test("the table's machine qbadge is small, positive and narrower than half the machine icon", async ({ calc }) => {
        await calc.open(CHEM + "&mq=assembling-machine-3:rare")
        let badge = calc.row("chemical-science-pack").locator(QS.machineQbadge)
        let icon = calc.row("chemical-science-pack").locator(QS.machineSlotIcon).first()
        let badgeBox = await badge.boundingBox()
        let iconBox = await icon.boundingBox()
        expect(badgeBox).not.toBeNull()
        expect(iconBox).not.toBeNull()
        expect(badgeBox!.width).toBeGreaterThan(0)
        expect(badgeBox!.height).toBeGreaterThan(0)
        expect(badgeBox!.width).toBeLessThanOrEqual(12)
        expect(badgeBox!.height).toBeLessThanOrEqual(12)
        expect(badgeBox!.width).toBeLessThan(iconBox!.width / 2)
    })
})
