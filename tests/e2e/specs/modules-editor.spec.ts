import { test, expect } from "../support/fixtures"
import { CHEM, MS, OPEN_CHEM, chooseScope, openRowEditor, pickModule } from "../support/areas/modules"

// 12c. The row module editor (`.detail .modeditor`): slots, beacons, the
// "Use these modules for" radio (which only decides where the *next* edit
// goes), and the machine-count cells that prove the layers' effect.
const PIPE_FALLBACK = `${CHEM}&dm=p3&dm2=s3&item=pipe`
const HAND_S3 = `${CHEM}&modules=chemical-science-pack:s3:s3:s3:s3;null:null:0&item=chemical-science-pack`
const HAND_S3_BEACONS = `${CHEM}&modules=chemical-science-pack:s3:s3:s3:s3;s3:s3:8&item=chemical-science-pack`

test("opening a row from the plan shows its slots, source and machine counts", async ({ calc, page }) => {
    await calc.open(`${OPEN_CHEM}&dm=p3`)
    let editor = page.locator(MS.rowEditor)
    await expect(editor).toHaveAttribute("data-scope", "row")
    await expect(editor.locator(MS.meSlot(0))).toHaveCount(1)
    await expect(editor.locator(".me-slot")).toHaveCount(4)
    await expect(editor).toContainText("From the plan")
    await expect(editor.locator(MS.scopeRadio("row"))).toBeChecked()
    await expect(editor.locator(MS.meMachines("none"))).toHaveText("9.6 machines")
    await expect(editor.locator(MS.meMachines("plan"))).toHaveText("17.1 machines")
    await expect(editor.locator(MS.meMachines("these"))).toHaveText("17.1 machines")
    await expect(editor).toContainText("For 60/min")
    await expect(editor).toContainText("Beacons draw their own 480 kW each on top.")
})

test("beacons bring the row's own machine count down", async ({ calc, page }) => {
    await calc.open(`${OPEN_CHEM}&dm=p3&db=speed-module-3:speed-module-3&dbc=8`)
    let editor = page.locator(MS.rowEditor)
    await expect(editor.locator(MS.meMachines("these"))).toHaveText("1.5 machines")
})

test("filling the slots marks the row set by hand and recomputes its count", async ({ calc, page }) => {
    await calc.open(OPEN_CHEM)
    let row = calc.row("chemical-science-pack")
    await expect(row.locator(".cnt")).toHaveText("10 ×")
    let editor = page.locator(MS.rowEditor)
    await chooseScope(editor, "row")
    await pickModule(editor, "productivity-module-3")
    await expect(row.locator(".cnt")).toHaveText("18 ×")
    await calc.expectSetting("modules", "chemical-science-pack:p3:p3:p3:p3;null:null:0")
    await expect(page.locator(".detail")).toContainText("Set by hand")
})

test("a slot pick with a slot selected changes only that slot", async ({ calc, page }) => {
    await calc.open(`${OPEN_CHEM}&modules=chemical-science-pack:null:null:null:null`)
    let editor = page.locator(MS.rowEditor)
    await editor.locator(MS.meSlot(2)).click()
    await pickModule(editor, "speed-module-3")
    await calc.expectSetting("modules", "chemical-science-pack:null:null:s3:null;null:null:0")
})

test("Back to plan default clears a hand-set row", async ({ calc, page }) => {
    await calc.open(`${OPEN_CHEM}&modules=chemical-science-pack:s3:s3:s3:s3`)
    let editor = page.locator(MS.rowEditor)
    await editor.locator(MS.meBack).click()
    await calc.expectSetting("modules", null)
    await expect(editor).toContainText("From the plan")
})

test("the machine scope changes every row made in that machine", async ({ calc, page }) => {
    await calc.open(OPEN_CHEM)
    let editor = page.locator(MS.rowEditor)
    await chooseScope(editor, "machine")
    await pickModule(editor, "speed-module-3")
    await calc.expectSetting("mm", "assembling-machine-3:s3:s3:s3:s3;null:null:0")
    await calc.expectSetting("modules", null)
    let engineTitles = await calc.row("engine-unit").locator(".mods .modslot img").evaluateAll(
        els => els.map(e => (e as HTMLImageElement).title))
    expect(engineTitles).toEqual(["Speed module 3", "Speed module 3", "Speed module 3", "Speed module 3"])
    await expect(editor).toContainText("From Assembling machine 3 settings")
})

test("beacons refuse quality and productivity modules", async ({ calc, page }) => {
    await calc.open(OPEN_CHEM)
    let editor = page.locator(MS.rowEditor)
    await editor.locator(MS.meBeaconSlot(0)).click()
    let q3 = editor.locator(MS.mePick("quality-module-3"))
    await expect(q3).toBeDisabled()
    await expect(q3).toHaveAttribute("title", "Beacons can't hold quality modules")
    let p3 = editor.locator(MS.mePick("productivity-module-3"))
    await expect(p3).toBeDisabled()
    await expect(p3).toHaveAttribute("title", "Beacons can't hold productivity modules")
    let s3 = editor.locator(MS.mePick("speed-module-3"))
    await expect(s3).toBeEnabled()
})

test("pipe's palette refuses productivity for this row", async ({ calc, page }) => {
    await calc.open(`${CHEM}&item=pipe`)
    let editor = page.locator(MS.rowEditor)
    let p3 = editor.locator(MS.mePick("productivity-module-3"))
    await expect(p3).toBeDisabled()
    await expect(p3).toHaveAttribute("title", "Pipe can't take productivity")
})

test("mixed modules can't be the plan default", async ({ calc, page }) => {
    await calc.open(`${OPEN_CHEM}&modules=chemical-science-pack:s3:p3:s3:p3`)
    let editor = page.locator(MS.rowEditor)
    let plan = editor.locator(MS.scopeRadio("plan"))
    await expect(plan).toBeDisabled()
    await expect(plan.locator("xpath=..")).toHaveAttribute("title", "Mixed modules can't be a plan default")
    await expect(editor.locator(MS.scopeRadio("row"))).toBeChecked()
})

test("a beacon plus on a row fallen back from the plan keeps the plan layer, not mm", async ({ calc, page }) => {
    await calc.open(PIPE_FALLBACK)
    let editor = page.locator(MS.rowEditor)
    await editor.locator(MS.mePlus).click()
    await calc.expectSetting("dm", "p3")
    await calc.expectSetting("dm2", "s3")
    await calc.expectSetting("mm", null)
})

test("a beacon pick on a fallen-back row also keeps the plan module", async ({ calc, page }) => {
    await calc.open(`${PIPE_FALLBACK}&db=speed-module-3:speed-module-3&dbc=8`)
    let editor = page.locator(MS.rowEditor)
    await editor.locator(MS.meBeaconSlot(0)).click()
    await pickModule(editor, "efficiency-module-3")
    await calc.expectSetting("dm", "p3")
    await calc.expectSetting("dm2", "s3")
})

test("choosing the machine or plan radio alone never writes anything", async ({ calc, page }) => {
    await calc.open(PIPE_FALLBACK)
    let editor = page.locator(MS.rowEditor)
    await chooseScope(editor, "machine")
    await calc.expectSetting("dm", "p3")
    await calc.expectSetting("mm", null)
    await calc.expectSetting("modules", null)
})

test("the machine scope shows the row's real fallback, not a raw entry", async ({ calc, page }) => {
    await calc.open(`${CHEM}&mm=assembling-machine-3:p3:p3:p3:p3&item=pipe`)
    let editor = page.locator(MS.rowEditor)
    await expect(editor.locator(MS.scopeRadio("machine"))).toBeChecked()
    for (let i = 0; i < 4; i++) {
        await expect(editor.locator(MS.meSlot(i))).toHaveAttribute("title", `Slot ${i + 1}: Empty`)
    }
    await expect(editor).toContainText("Productivity+0%")
    await expect(editor.locator(MS.meMachines("these"))).toHaveText("0.4 machines")
})

test("choosing just pipe's row does not hand-set the machine's productivity", async ({ calc, page }) => {
    await calc.open(`${CHEM}&mm=assembling-machine-3:p3:p3:p3:p3&item=pipe`)
    let editor = page.locator(MS.rowEditor)
    await chooseScope(editor, "row")
    await calc.expectSetting("modules", null)
    await calc.expectSetting("mm", "assembling-machine-3:p3:p3:p3:p3;null:null:0")
})

test("every-row scope on a fallen-back row shows the real fallback", async ({ calc, page }) => {
    await calc.open(PIPE_FALLBACK)
    let editor = page.locator(MS.rowEditor)
    await chooseScope(editor, "plan")
    for (let i = 0; i < 4; i++) {
        await expect(editor.locator(MS.meSlot(i))).toHaveAttribute("title", "Slot " + (i + 1) + ": Speed 3")
    }
})

test("every-row scope with a machine override: the row keeps the machine's setting", async ({ calc, page }) => {
    await calc.open(`${CHEM}&mm=assembling-machine-3:s3:s3:s3:s3&item=chemical-science-pack`)
    let editor = page.locator(MS.rowEditor)
    await chooseScope(editor, "plan")
    await expect(editor.locator(MS.meMachines("these"))).toHaveText("3.2 machines")
    await expect(editor).toContainText("has its own setting, so this row keeps it")
    await expect(editor).toContainText("Assembling machine 3")
    await pickModule(editor, "productivity-module-3")
    await calc.expectSetting("dm", "p3")
    await calc.expectSetting("mm", "assembling-machine-3:s3:s3:s3:s3;null:null:0")
})

test("every-row scope shows the row's real beacons too", async ({ calc, page }) => {
    await calc.open(`${CHEM}&mm=assembling-machine-3:s3:s3:s3:s3;s3:s3:8&item=chemical-science-pack`)
    let editor = page.locator(MS.rowEditor)
    await chooseScope(editor, "plan")
    for (let i = 0; i < 4; i++) {
        await expect(editor.locator(MS.meSlot(i))).toHaveAttribute("title", "Slot " + (i + 1) + ": Speed 3")
    }
    await expect(editor.locator(MS.meBeaconSlot(0))).toHaveAttribute("title", "Beacon slot 1: Speed 3")
    await expect(editor.locator(MS.meBeaconSlot(1))).toHaveAttribute("title", "Beacon slot 2: Speed 3")
    await expect(editor.locator(MS.meCount)).toHaveText("8")
    await expect(editor.locator(MS.meMachines("these"))).toHaveText("1.3 machines")
})

test("a hand-set row's display ignores whatever scope radio is picked", async ({ calc, page }) => {
    await calc.open(`${CHEM}&dm=p3&modules=chemical-science-pack:s3:s3:s3:s3;null:null:0&item=chemical-science-pack`)
    let editor = page.locator(MS.rowEditor)
    await chooseScope(editor, "machine")
    await chooseScope(editor, "plan")
    await expect(editor.locator(MS.meMachines("these"))).toHaveText("3.2 machines")
    await expect(editor).toContainText("is set by hand")
    await expect(editor).toContainText("An edit here goes to the plan and this row follows it from then on.")
})

test("an every-row pick on a hand-set row releases it to the machine's own setting", async ({ calc, page }) => {
    await calc.open(`${CHEM}&mm=assembling-machine-3:s3:s3:s3:s3;null:null:0&modules=chemical-science-pack:p3:p3:p3:p3;null:null:0&item=chemical-science-pack`)
    let editor = page.locator(MS.rowEditor)
    await chooseScope(editor, "plan")
    await expect(editor).toContainText("Assembling machine 3 has its own setting, so this row will follow that.")
    await pickModule(editor, "efficiency-module-3")
    await calc.expectSetting("dm", "e3")
    await calc.expectSetting("modules", null)
    await calc.expectSetting("mm", "assembling-machine-3:s3:s3:s3:s3;null:null:0")
    for (let i = 0; i < 4; i++) {
        await expect(editor.locator(MS.meSlot(i))).toHaveAttribute("title", `Slot ${i + 1}: Speed 3`)
    }
})

test("the machine-scope palette ignores this row's own recipe", async ({ calc, page }) => {
    await calc.open(`${CHEM}&item=pipe`)
    let editor = page.locator(MS.rowEditor)
    await chooseScope(editor, "machine")
    let p3 = editor.locator(MS.mePick("productivity-module-3"))
    await expect(p3).toBeEnabled()
    await expect(p3).toHaveAttribute("title", "Productivity 3")
})

test("the machine-scope beacon plus from empty picks a default module", async ({ calc, page }) => {
    await calc.open(OPEN_CHEM)
    let editor = page.locator(MS.rowEditor)
    await chooseScope(editor, "machine")
    await editor.locator(MS.mePlus).click()
    await calc.expectSetting("mm", "assembling-machine-3:null:null:null:null;s3:s3:1")
})

test("reopening a row re-seeds its scope radio from where its modules come from", async ({ calc, page }) => {
    await calc.open(`${CHEM}&mm=assembling-machine-3:p3:p3:p3:p3&item=pipe`)
    let editor = page.locator(MS.rowEditor)
    await chooseScope(editor, "row")
    await calc.row("pipe").click() // close
    await calc.row("pipe").click() // reopen
    editor = page.locator(MS.rowEditor)
    await expect(editor.locator(MS.scopeRadio("machine"))).toBeChecked()
})

test("a machine-scope slot edit on a hand-set row starts from the row's own modules", async ({ calc, page }) => {
    await calc.open(HAND_S3)
    let editor = page.locator(MS.rowEditor)
    await chooseScope(editor, "machine")
    await editor.locator(MS.meSlot(0)).click()
    await pickModule(editor, "efficiency-module-3")
    await calc.expectSetting("mm", "assembling-machine-3:e3:s3:s3:s3;null:null:0")
    await calc.expectSetting("modules", null)
    await expect(editor.locator(MS.meSlot(0))).toHaveAttribute("title", "Slot 1: Efficiency 3")
    for (let i = 1; i < 4; i++) {
        await expect(editor.locator(MS.meSlot(i))).toHaveAttribute("title", `Slot ${i + 1}: Speed 3`)
    }
    await expect(editor).toContainText("From Assembling machine 3 settings")
})

test("a machine-scope beacon plus on a hand-set row starts from the row's own beacons", async ({ calc, page }) => {
    await calc.open(HAND_S3_BEACONS)
    let editor = page.locator(MS.rowEditor)
    await chooseScope(editor, "machine")
    await editor.locator(MS.mePlus).click()
    await calc.expectSetting("mm", "assembling-machine-3:s3:s3:s3:s3;s3:s3:9")
    await calc.expectSetting("modules", null)
})

test("a selected slot greys out the plan option", async ({ calc, page }) => {
    await calc.open(HAND_S3)
    let editor = page.locator(MS.rowEditor)
    await editor.locator(MS.meSlot(0)).click()
    let plan = editor.locator(MS.scopeRadio("plan"))
    await expect(plan).toBeDisabled()
    await expect(plan).not.toBeChecked()
    await expect(plan.locator("xpath=..")).toHaveAttribute("title", "Mixed modules can't be a plan default")
})

test("a plan-scope beacon plus on a hand-set row starts from the row's own beacons", async ({ calc, page }) => {
    await calc.open(HAND_S3_BEACONS)
    let editor = page.locator(MS.rowEditor)
    await chooseScope(editor, "plan")
    await editor.locator(MS.mePlus).click()
    await calc.expectSetting("dm", "s3")
    await calc.expectSetting("db", "s3:s3")
    await calc.expectSetting("dbc", "9")
    await calc.expectSetting("modules", null)
})

test("a plan-scope beacon plus keeps a one-sided or mixed beacon pair", async ({ calc, page }) => {
    await calc.open(`${OPEN_CHEM}&db=null:speed-module-3&dbc=4`)
    let editor = page.locator(MS.rowEditor)
    await chooseScope(editor, "plan")
    await editor.locator(MS.mePlus).click()
    await calc.expectSetting("db", "null:s3")
    await calc.expectSetting("dbc", "5")

    await calc.open(`${OPEN_CHEM}&db=speed-module-3:efficiency-module-3&dbc=4`)
    editor = page.locator(MS.rowEditor)
    await chooseScope(editor, "plan")
    await editor.locator(MS.mePlus).click()
    await calc.expectSetting("db", "s3:e3")
    await calc.expectSetting("dbc", "5")
})

test("a row-scope beacon plus from empty fills both beacon slots", async ({ calc, page }) => {
    await calc.open(`${CHEM}&item=pipe`)
    let editor = page.locator(MS.rowEditor)
    await chooseScope(editor, "row")
    await editor.locator(MS.mePlus).click()
    await calc.expectSetting("modules", "pipe:null:null:null:null;s3:s3:1")
})

test("the selected plan option is never the one greyed out", async ({ calc, page }) => {
    await calc.open(`${OPEN_CHEM}&db=null:speed-module-3&dbc=4`)
    let editor = page.locator(MS.rowEditor)
    await chooseScope(editor, "plan")
    let plan = editor.locator(MS.scopeRadio("plan"))
    await expect(plan).toBeEnabled()
    await expect(plan).toBeChecked()
})

test("a plan pick on a hand-set row releases it to the plan", async ({ calc, page }) => {
    await calc.open(HAND_S3)
    let editor = page.locator(MS.rowEditor)
    await chooseScope(editor, "plan")
    await pickModule(editor, "efficiency-module-3")
    await calc.expectSetting("dm", "e3")
    await calc.expectSetting("modules", null)
    await calc.expectSetting("mm", null)
    await calc.expectSetting("db", null)
    for (let i = 0; i < 4; i++) {
        await expect(editor.locator(MS.meSlot(i))).toHaveAttribute("title", `Slot ${i + 1}: Efficiency 3`)
    }
})

test("a beacon module into an empty count brings eight beacons", async ({ calc, page }) => {
    await calc.open(HAND_S3)
    let editor = page.locator(MS.rowEditor)
    await editor.locator(MS.meBeaconSlot(0)).click()
    await pickModule(editor, "speed-module-3")
    await calc.expectSetting("modules", "chemical-science-pack:s3:s3:s3:s3;s3:null:8")
})

test("a bad beacon count in a link reads as zero and the editor still renders", async ({ calc, page }) => {
    for (let suffix of [
        "&mm=assembling-machine-3:s3:s3:s3:s3;s3:s3:abc",
        "&mm=assembling-machine-3:s3:s3:s3:s3;s3:s3:-3",
        "&db=speed-module-3:speed-module-3&dbc=xyz",
        "&db=speed-module-3:speed-module-3&dbc=50",
        "&modules=chemical-science-pack:s3:s3:s3:s3;s3:s3:17",
    ]) {
        await calc.open(`${OPEN_CHEM}${suffix}`)
        let editor = page.locator(MS.rowEditor)
        await expect(editor).toBeVisible()
        await expect(editor.locator(MS.meCount).first()).toHaveText("0")
    }
})
