import { test, expect } from "../support/fixtures"
import { S } from "../support/selectors"
import { CHEM, MS, modulesBar } from "../support/areas/modules"

// 12a. The table's Modules column, the #modules-bar summary, and the graph
// cards' module strips. CHEM feeds chemical-science-pack and engine-unit in
// AM3 (4 slots), sulfur in a chemical plant (3 slots), pipe in AM3 (no
// productivity on its recipe) and water from an offshore pump (0 slots).

test("the plan layer fills every slot and the Modules column header shows up", async ({ calc, page }) => {
    await calc.open(`${CHEM}&dm=p3`)
    await expect(calc.row("chemical-science-pack").locator(MS.modSlot)).toHaveCount(4)
    await expect(calc.row("sulfur").locator(MS.modSlot)).toHaveCount(3)
    let water = calc.row("water")
    await expect(water.locator(MS.modSlot)).toHaveCount(0)
    await expect(page.locator(MS.sectHeader).first()).toContainText("Modules")
})

test("a beacon badge shows ×N, and a row whose recipe refuses productivity falls back to speed", async ({ calc }) => {
    await calc.open(`${CHEM}&dm=p3&dm2=s3&db=speed-module-3:speed-module-3&dbc=8`)
    await expect(calc.row("chemical-science-pack").locator(S.rowModules)).toContainText("×8")
    let pipe = calc.row("pipe")
    await expect(pipe.locator(MS.modsNote)).toHaveText("No productivity on this recipe, so Speed 3")
    await expect(calc.row("chemical-science-pack").locator(MS.modsNote)).toHaveCount(0)
})

test("a hand-set row gets the gold edge and the Set by hand tag; other rows don't", async ({ calc }) => {
    await calc.open(`${CHEM}&modules=chemical-science-pack:speed-module-3:speed-module-3:speed-module-3:speed-module-3`)
    let chem = calc.row("chemical-science-pack")
    await expect(chem).toHaveClass(/\bhand\b/)
    await expect(chem.locator(MS.handTag)).toHaveText("Set by hand")
    await expect(calc.row("engine-unit")).not.toHaveClass(/\bhand\b/)
})

test("the modules bar sums up the plan and resets hand-set rows", async ({ calc, page }) => {
    await calc.open(`${CHEM}&dm=p3&dm2=s3&db=speed-module-3:speed-module-3&dbc=8&modules=chemical-science-pack:speed-module-3:speed-module-3:speed-module-3:speed-module-3`)
    let bar = modulesBar(page)
    await expect(bar).toContainText("Productivity 3 in every slot of every machine, Speed 3 where productivity isn't allowed")
    await expect(bar).toContainText("8 beacons of Speed 3")
    await expect(bar.locator(MS.mbHand)).toHaveText("1 row set by hand")
    await bar.locator(MS.mbReset).click()
    await calc.expectSetting("modules", null)
    await expect(calc.row("chemical-science-pack")).not.toHaveClass(/\bhand\b/)
    await expect(bar.locator(MS.mbHand)).toHaveCount(0)
})

test("the bar reads 'No modules · no beacons' with nothing set, and Change opens settings", async ({ calc, page }) => {
    await calc.open(CHEM)
    let bar = modulesBar(page)
    await expect(bar).toContainText("No modules · no beacons")
    await bar.locator(MS.mbChange).click()
    await expect(page.locator("#settings-drawer")).toBeVisible()
})

test("a graph card shows its modules, the beacon ×N and a fixed height", async ({ calc, page }) => {
    await calc.open(`${CHEM}&view=graph&dm=p3&db=speed-module-3:speed-module-3&dbc=8&modules=engine-unit:speed-module-3:speed-module-3:speed-module-3:speed-module-3`)
    let chem = calc.graphNode("chemical-science-pack")
    await expect(chem.locator(MS.modSlot)).toHaveCount(4)
    await expect(chem.locator(MS.beaconBadge)).toContainText("×8")
    await expect(chem).not.toHaveClass(/\bhand\b/)
    await expect(chem).toHaveCSS("height", "78px")
    let engine = calc.graphNode("engine-unit")
    await expect(engine).toHaveClass(/\bhand\b/)
})

test("a plan with no module slots keeps short graph cards", async ({ calc }) => {
    await calc.open("items=pipe:r:60&buildings=assembling-machine-1,stone-furnace&view=graph")
    let pipe = calc.graphNode("pipe")
    await expect(pipe.locator(".mods")).toHaveCount(0)
})

test("a speed-only edit from the graph side panel redraws the card", async ({ calc, page }) => {
    await calc.open(`${CHEM}&view=graph`)
    await calc.graphNode("chemical-science-pack").locator(".nbody").click()
    let before = await calc.graphNode("chemical-science-pack").locator(".sub.num").innerText()
    let editor = page.locator(MS.graphSideEditor)
    await editor.locator(MS.mePick("speed-module-3")).click()
    let chem = calc.graphNode("chemical-science-pack")
    await expect(chem).toHaveClass(/\bhand\b/)
    await expect(chem.locator(".sub.num")).not.toHaveText(before)
})

test("picking a settings strategy redraws the graph too", async ({ calc, page }) => {
    await calc.open(`${CHEM}&view=graph`)
    let before = await calc.graphNode("chemical-science-pack").locator(".sub.num").innerText()
    await calc.openSettings()
    await page.locator(MS.msKind("speed")).click()
    await expect(calc.graphNode("chemical-science-pack").locator(".sub.num")).not.toHaveText(before)
})

test("table, graph and settings agree on a partial modules= list", async ({ calc, page }) => {
    let fragment = `${CHEM}&dm=p3&dm2=speed-module-3&modules=engine-unit:speed-module-3:speed-module-3:null:null;null:null:0`
    await calc.open(fragment)
    let tableTitles = await calc.row("engine-unit").locator(`${MS.modSlot} img`).evaluateAll(
        els => els.map(e => (e as HTMLImageElement).title))
    expect(tableTitles).toEqual(["Speed module 3", "Speed module 3", "Empty slot", "Empty slot"])

    await calc.switchView("graph")
    let graphTitles = await calc.graphNode("engine-unit").locator(`${MS.modSlot} img`).evaluateAll(
        els => els.map(e => (e as HTMLImageElement).title))
    expect(graphTitles).toEqual(["Speed module 3", "Speed module 3", "Empty slot", "Empty slot"])

    await calc.openSettings()
    let settingsTitles = await page.locator(MS.msRow("recipe", "engine-unit")).locator(`${MS.modSlot} img`).evaluateAll(
        els => els.map(e => (e as HTMLImageElement).title))
    expect(settingsTitles).toEqual(["Speed module 3", "Speed module 3", "Empty slot", "Empty slot"])
})
