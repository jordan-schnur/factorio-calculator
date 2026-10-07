import { test, expect } from "../support/fixtures"
import { CHEM, MS, openModulesSettings } from "../support/areas/modules"

// 12b. Settings -> Modules: the plan layer as a strategy, By machine
// (each machine the plan uses, Change / Use plan) and Set by hand.

test("the old pickers are gone; the section explains the three layers", async ({ calc }) => {
    await calc.open(CHEM)
    let host = await openModulesSettings(calc)
    await expect(host.locator("input")).toHaveCount(0)
    for (let text of [
        "In every machine", "Tier", "Beacons", "By machine", "Set by hand",
        "No modules. No beacons.",
        "Rows win over machines, machines win over the plan. Open a row in the table to set its modules.",
    ]) {
        await expect(host).toContainText(text)
    }
})

test("picking Productivity writes the plan layer and its speed fallback", async ({ calc }) => {
    await calc.open(CHEM)
    let host = await openModulesSettings(calc)
    await host.locator(MS.msKind("productivity")).click()
    await calc.expectSetting("dm", "p3")
    await calc.expectSetting("dm2", "s3")
    await expect(host).toContainText("Productivity 3 in every slot of every machine, Speed 3 where productivity isn't allowed")
    await expect(host.locator(MS.msFellback)).toContainText("Pipe")

    await host.locator(MS.msFallback("efficiency")).click()
    await calc.expectSetting("dm2", "e3")
    await host.locator(MS.msFallback("none")).click()
    await calc.expectSetting("dm2", null)
    await calc.expectSetting("dm", "p3")

    await host.locator(MS.msKind("productivity")).click()
    await host.locator(MS.msFallback("speed")).click()
    await host.locator(MS.msTier("1")).click()
    await calc.expectSetting("dm", "pe")
    await calc.expectSetting("dm2", "se")

    await host.locator(MS.msKind("speed")).click()
    await calc.expectSetting("dm", "se")
    await calc.expectSetting("dm2", null)
})

test("picking a beacon strategy writes db/dbc", async ({ calc }) => {
    await calc.open(`${CHEM}&dm=p3&dm2=s3`)
    let host = await openModulesSettings(calc)
    await host.locator(MS.msBeacon("speed")).click()
    await calc.expectSetting("db", "s3:s3")
    await calc.expectSetting("dbc", "8")
    await expect(host).toContainText("8 beacons of Speed 3 around each one.")
})

test("the beacon count's own plus, and None dropping db/dbc together", async ({ calc }) => {
    await calc.open(`${CHEM}&dm=p3&db=speed-module-3:speed-module-3&dbc=8`)
    let host = await openModulesSettings(calc)
    await host.locator(MS.msPlus).click()
    await calc.expectSetting("dbc", "9")
    await host.locator(MS.msBeacon("none")).click()
    await calc.expectSetting("db", null)
    await calc.expectSetting("dbc", null)
})

test("a link the strategy buttons can't say shows its real modules until one is picked", async ({ calc }) => {
    await calc.open(`${CHEM}&dm=p3&dm2=efficiency-module-2`)
    let host = await openModulesSettings(calc)
    await expect(host).toContainText("From the link")
    await expect(host).toContainText("Productivity 3 in every slot of every machine, Efficiency 2 where productivity isn't allowed.")
    await calc.expectSetting("dm2", "e2") // the link's full module key is already short-named on load
    await host.locator(MS.msKind("productivity")).click()
    await calc.expectSetting("dm2", "e3")
})

test("By machine lists the plan's machines with their slot counts", async ({ calc }) => {
    await calc.open(CHEM)
    let host = await openModulesSettings(calc)
    let machines = await host.locator(MS.msRows("machine")).evaluateAll(els => els.map(e => (e as HTMLElement).dataset.machine))
    expect(machines).toEqual(expect.arrayContaining(["assembling-machine-3", "chemical-plant"]))
    expect(machines).not.toContain("offshore-pump")
    await expect(host.locator(MS.msRow("machine", "assembling-machine-3"))).toContainText("4 slots")
})

test("Change opens the machine editor; Use plan drops the mm= entry", async ({ calc }) => {
    await calc.open(`${CHEM}&mm=assembling-machine-3:s3:s3:s3:s3;null:null:0`)
    let host = await openModulesSettings(calc)
    await host.locator(MS.msRow("machine", "assembling-machine-3")).locator(MS.msChange).click()
    let editor = host.locator(MS.editor)
    await expect(editor).toHaveAttribute("data-scope", "machine")
    await host.locator(MS.msUsePlan).click()
    await calc.expectSetting("mm", null)
})

test("set-by-hand rows list under their machine and reset individually or all at once", async ({ calc }) => {
    await calc.open(`${CHEM}&modules=chemical-science-pack:speed-module-3:speed-module-3:speed-module-3:speed-module-3,engine-unit:speed-module-3:speed-module-3:speed-module-3:speed-module-3`)
    let host = await openModulesSettings(calc)
    let recipes = (await host.locator(MS.msRows("recipe")).evaluateAll(els => els.map(e => (e as HTMLElement).dataset.recipe))).sort()
    expect(recipes).toEqual(["chemical-science-pack", "engine-unit"])
    await expect(host.locator(MS.msRow("machine", "assembling-machine-3"))).toContainText("2 recipes set by hand")

    await host.locator(MS.msRow("recipe", "chemical-science-pack")).locator(MS.msReset).click()
    await calc.expectSetting("modules", "engine-unit:s3:s3:s3:s3;null:null:0")
    await host.locator(MS.msResetAll).click()
    await calc.expectSetting("modules", null)
})

test("a plan strategy change leaves a hand-set row's own entry alone", async ({ calc }) => {
    await calc.open(`${CHEM}&modules=chemical-science-pack:speed-module-3:speed-module-3:speed-module-3:speed-module-3;null:null:0`)
    let host = await openModulesSettings(calc)
    await host.locator(MS.msKind("productivity")).click()
    await calc.expectSetting("dm", "p3")
    await calc.expectSetting("modules", "chemical-science-pack:s3:s3:s3:s3;null:null:0")
})

test("Settings' machine editor changes every row of that machine at once", async ({ calc, page }) => {
    await calc.open(CHEM)
    let host = await openModulesSettings(calc)
    await host.locator(MS.msRow("machine", "assembling-machine-3")).locator(MS.msChange).click()
    let editor = host.locator(MS.editor)
    await editor.locator(MS.mePick("speed-module-3")).click()
    await calc.expectSetting("mm", "assembling-machine-3:s3:s3:s3:s3;null:null:0")
    await expect(host.locator(MS.editor)).toHaveAttribute("data-scope", "machine")
    await expect(host.locator(MS.msUsePlan)).toBeVisible()
    await calc.closeSettings()
    let chemTitles = await calc.row("chemical-science-pack").locator(".mods .modslot img").evaluateAll(
        els => els.map(e => (e as HTMLImageElement).title))
    let engineTitles = await calc.row("engine-unit").locator(".mods .modslot img").evaluateAll(
        els => els.map(e => (e as HTMLImageElement).title))
    expect(chemTitles).toEqual(["Speed module 3", "Speed module 3", "Speed module 3", "Speed module 3"])
    expect(engineTitles).toEqual(["Speed module 3", "Speed module 3", "Speed module 3", "Speed module 3"])
})

test("a row set in its own editor survives a reload as a hand-set row", async ({ calc, page }) => {
    await calc.open(`${CHEM}&item=chemical-science-pack`)
    let editor = page.locator(MS.rowEditor)
    await editor.locator(MS.scopeRadio("row")).check()
    await editor.locator(MS.meSlot(0)).click()
    await editor.locator(MS.mePick("productivity-module-3")).click()
    await calc.expectSetting("modules", "chemical-science-pack:p3:null:null:null;null:null:0")

    let hash = await calc.hash()
    await calc.open(hash.slice(1))
    await expect(calc.row("chemical-science-pack")).toHaveClass(/\bhand\b/)
    await expect(page.locator(MS.modulesBar).locator(MS.mbHand)).toHaveText("1 row set by hand")
})
