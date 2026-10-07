import { test, expect } from "../support/fixtures"
import { CHEM, OPEN_CHEM, QS } from "../support/areas/quality"

// Quality (calculator 1.3.0): module and beacon tiers. A module token
// carries its tier as "<shortname>@<tier>" (normal omitted); a beacon's own
// tier is the 4th field of its part, also only written when it isn't
// normal.

test.describe("module quality: counts", () => {
    test("dm=p3 vs dm=p3@legendary changes the count", async ({ calc }) => {
        await calc.open(CHEM + "&dm=p3")
        let plain = (await calc.tableRows()).find(r => r.item === "chemical-science-pack")
        expect(plain?.machines).toBe("18 ×")
        await calc.open(CHEM + "&dm=p3@legendary")
        let legendary = (await calc.tableRows()).find(r => r.item === "chemical-science-pack")
        expect(legendary?.machines).toBe("12 ×")
    })

    test("a hand-set modules= entry with legendary productivity gives 12 ×", async ({ calc }) => {
        await calc.open(CHEM + "&modules=chemical-science-pack:p3@legendary:p3@legendary:p3@legendary:p3@legendary;null:null:0")
        let row = (await calc.tableRows()).find(r => r.item === "chemical-science-pack")
        expect(row?.machines).toBe("12 ×")
    })

    test("a hand-set mm= machine entry with legendary productivity gives 12 ×", async ({ calc }) => {
        await calc.open(CHEM + "&mm=assembling-machine-3:p3@legendary:p3@legendary:p3@legendary:p3@legendary;null:null:0")
        let row = (await calc.tableRows()).find(r => r.item === "chemical-science-pack")
        expect(row?.machines).toBe("12 ×")
    })
})

test.describe("module quality: settings -> modules plan pickers", () => {
    test("dm=p3@epic badges the machine's module strip", async ({ calc }) => {
        await calc.open(CHEM + "&dm=p3@epic")
        await calc.openSettings()
        let row = calc.page.locator(QS.msMachinesRow("assembling-machine-3"))
        await expect(row.locator(".modstrip img.qbadge")).toHaveCount(4)
    })

    test("dm=p3 with no tier draws no badge on the machine's module strip", async ({ calc }) => {
        await calc.open(CHEM + "&dm=p3")
        await calc.openSettings()
        let row = calc.page.locator(QS.msMachinesRow("assembling-machine-3"))
        await expect(row.locator(".modstrip img.qbadge")).toHaveCount(0)
    })

    test("the plan's module quality picker writes dm's tier", async ({ calc }) => {
        await calc.open(CHEM + "&dm=p3")
        await calc.openSettings()
        await calc.page.locator(QS.msModuleTier).locator(QS.tierButton("legendary")).click()
        await calc.expectSetting("dm", "p3@legendary")
        let row = (await calc.tableRows()).find(r => r.item === "chemical-science-pack")
        expect(row?.machines).toBe("12 ×")
    })

    test("the plan's beacon quality picker writes dbq", async ({ calc }) => {
        await calc.open(CHEM + "&db=s3:s3&dbc=8")
        await calc.openSettings()
        await calc.page.locator(QS.msBeaconTier).locator(QS.tierButton("legendary")).click()
        await calc.expectSetting("dbq", "legendary")
    })
})

test.describe("module quality: row editor", () => {
    test("OPEN_CHEM&dm=p3, picking legendary tier then p3 fills all four slots at legendary", async ({ calc }) => {
        await calc.open(OPEN_CHEM + "&dm=p3")
        let editor = calc.page.locator(QS.editor)
        await editor.locator(QS.meModuleTier).locator(QS.tierButton("legendary")).click()
        await editor.locator(`.me-pick[data-module="productivity-module-3"]`).click()
        await calc.expectSetting("modules", "chemical-science-pack:p3@legendary:p3@legendary:p3@legendary:p3@legendary;null:null:0")
        let row = (await calc.tableRows()).find(r => r.item === "chemical-science-pack")
        expect(row?.machines).toBe("12 ×")
        await expect(editor.locator(QS.meSlotQbadge)).toHaveCount(4)
    })

    test("picking a tier before picking a module badges the palette, picking none keeps it unbadged", async ({ calc }) => {
        await calc.open(OPEN_CHEM)
        let editor = calc.page.locator(QS.editor)
        await expect(editor.locator(QS.mePickQbadge)).toHaveCount(0)
        await editor.locator(QS.meModuleTier).locator(QS.tierButton("rare")).click()
        await expect(editor.locator(QS.mePickQbadge).first()).toBeVisible()
    })

    test("setting the tier first, then selecting a slot, then picking sets only that slot's tier", async ({ calc }) => {
        await calc.open(OPEN_CHEM + "&dm=p3")
        let editor = calc.page.locator(QS.editor)
        await editor.locator(QS.meModuleTier).locator(QS.tierButton("rare")).click()
        await editor.locator(".me-slot").nth(0).click()
        await editor.locator(`.me-pick[data-module="productivity-module-3"]`).click()
        await calc.expectSetting("modules", "chemical-science-pack:p3@rare:p3:p3:p3;null:null:0")
        let titles = await editor.locator(".me-slot").evaluateAll(els => els.map(e => e.getAttribute("title")))
        expect(titles).toEqual([
            "Slot 1: Productivity 3 (Rare)",
            "Slot 2: Productivity 3",
            "Slot 3: Productivity 3",
            "Slot 4: Productivity 3",
        ])
    })

    test("beacon tier legendary lowers machine count, keeps the 4th beacon field and notes beacon power", async ({ calc }) => {
        await calc.open(OPEN_CHEM + "&db=s3:s3&dbc=8")
        let editor = calc.page.locator(QS.editor)
        await editor.locator(QS.meBeaconTier).locator(QS.tierButton("legendary")).click()
        await calc.expectSetting("modules", "chemical-science-pack:null:null:null:null;s3:s3:8:legendary")
        let row = (await calc.tableRows()).find(r => r.item === "chemical-science-pack")
        expect(row?.machines).toBe("2 ×")
        await expect(editor.locator(QS.meNote).filter({ hasText: "Beacons draw their own" })).toBeVisible()
    })

    test("the row editor's note on quality modules is exact", async ({ calc }) => {
        await calc.open(OPEN_CHEM)
        let editor = calc.page.locator(QS.editor)
        await expect(editor.locator(QS.meNote).filter({ hasText: "Quality modules" })).toHaveText(
            "Quality modules only slow the machine here; planning for quality output isn't supported yet.")
    })

    test("a mixed-quality hand-set row disables the plan scope radio", async ({ calc }) => {
        await calc.open(OPEN_CHEM + "&modules=chemical-science-pack:p3@rare:p3:p3:p3;null:null:0")
        let editor = calc.page.locator(QS.editor)
        let planRadio = editor.locator(QS.meScope("plan"))
        await expect(planRadio).toBeDisabled()
        await editor.locator(QS.mePlus).click()
        // The plan is unavailable, so the beacon plus still goes to the row's
        // own entry: its module tiers are untouched and no `dm` appears.
        expect((await calc.settings()).get("modules")).toMatch(/^chemical-science-pack:p3@rare:p3:p3:p3;/)
        expect((await calc.settings()).get("dm")).toBeUndefined()
    })
})

test.describe("module and beacon quality: one-field inputs don't error", () => {
    test("a one-field beacon part doesn't error and fills in null slots", async ({ calc, page }) => {
        await calc.open(CHEM + "&modules=chemical-science-pack:p3;s3")
        expect((await calc.settings()).get("modules")).toBe("chemical-science-pack:p3:null:null:null;s3:null:0")
        await calc.open(CHEM + "&modules=chemical-science-pack:p3;")
        expect((await calc.settings()).get("modules")).toBe("chemical-science-pack:p3:null:null:null;null:null:0")
    })
})

test.describe("module and beacon quality: round trips", () => {
    const cases: [string, string][] = [
        ["dm", "p3@legendary"],
        ["dm2", "s3@rare"],
        ["db", "s3@epic:s3"],
        ["dbc", "8"],
        ["dbq", "legendary"],
        ["mq", "assembling-machine-3:legendary,chemical-plant:uncommon"],
        ["mm", "assembling-machine-3:p3@legendary:p3:null:s3@rare;s3:s3@uncommon:4:epic"],
        ["modules", "chemical-science-pack:p3@rare:p3:p3:p3;null:null:0"],
    ]
    for (let [key, value] of cases) {
        test(`${key}=${value} survives a load`, async ({ calc }) => {
            await calc.open(`${CHEM}&${key}=${value}`)
            expect((await calc.settings()).get(key)).toBe(value)
        })
    }

    test("a 1.2.0 link with no quality part leaves mm untouched", async ({ calc }) => {
        await calc.open(CHEM + "&dm=p3&db=s3:s3&dbc=8&mm=assembling-machine-3:s3:s3:null:p3;s3:s3:8")
        let settings = await calc.settings()
        expect(settings.get("mm")).toBe("assembling-machine-3:s3:s3:null:p3;s3:s3:8")
        expect(settings.get("mq")).toBeUndefined()
        expect(settings.get("dbq")).toBeUndefined()
        for (let token of settings.get("mm")!.split(/[:;,]/)) {
            expect(token).not.toContain("@")
        }
    })
})
