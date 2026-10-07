import { test, expect } from "../support/fixtures"
import { CHEM, MS, openModulesSettings } from "../support/areas/modules"

// 12d. Engine checks rewritten through visible proxies (no window.spec):
// row machine counts, the editor's .me-machines cells, and the fragment
// the page writes back -- instead of probing internals directly.

test("the plan layer fills every slot and falls back where a recipe refuses productivity", async ({ calc }) => {
    await calc.open(`${CHEM}&dm=p3&dm2=s3`)
    let chemTitles = await calc.row("chemical-science-pack").locator(".mods .modslot img").evaluateAll(
        els => els.map(e => (e as HTMLImageElement).title))
    expect(chemTitles).toEqual(new Array(4).fill("Productivity module 3"))
    let pipeTitles = await calc.row("pipe").locator(".mods .modslot img").evaluateAll(
        els => els.map(e => (e as HTMLImageElement).title))
    expect(pipeTitles).toEqual(new Array(4).fill("Speed module 3"))
    let sulfurTitles = await calc.row("sulfur").locator(".mods .modslot img").evaluateAll(
        els => els.map(e => (e as HTMLImageElement).title))
    expect(sulfurTitles).toEqual(new Array(3).fill("Productivity module 3"))
    await expect(calc.row("chemical-science-pack")).not.toHaveClass(/\bhand\b/)
    await calc.expectSetting("modules", null)
    await calc.expectSetting("mm", null)
})

test("the machine layer wins over the plan and round-trips its own slots", async ({ calc }) => {
    let fragment = `${CHEM}&dm=p3&mm=assembling-machine-3:s3:s3:null:p3;s3:s3:8`
    await calc.open(fragment)
    let chemTitles = await calc.row("chemical-science-pack").locator(".mods .modslot img").evaluateAll(
        els => els.map(e => (e as HTMLImageElement).title))
    expect(chemTitles).toEqual(["Speed module 3", "Speed module 3", "Empty slot", "Productivity module 3"])
    let sulfurTitles = await calc.row("sulfur").locator(".mods .modslot img").evaluateAll(
        els => els.map(e => (e as HTMLImageElement).title))
    expect(sulfurTitles).toEqual(new Array(3).fill("Productivity module 3"))
    await calc.expectSetting("mm", "assembling-machine-3:s3:s3:null:p3;s3:s3:8")
})

test("a hand-set row round-trips with every slot named, even empty ones", async ({ calc }) => {
    let fragment = `${CHEM}&dm=p3&modules=chemical-science-pack:s3:null:s3:null;null:null:0`
    await calc.open(fragment)
    await calc.expectSetting("modules", "chemical-science-pack:s3:null:s3:null;null:null:0")
    await expect(calc.row("chemical-science-pack")).toHaveClass(/\bhand\b/)
})

test("a plan strategy change leaves a hand-set row alone", async ({ calc }) => {
    await calc.open(`${CHEM}&modules=chemical-science-pack:s3:s3:s3:s3`)
    let host = await openModulesSettings(calc)
    await host.locator(MS.msKind("productivity")).click()
    await calc.expectSetting("dm", "p3")
    let chemTitles = await calc.row("chemical-science-pack").locator(".mods .modslot img").evaluateAll(
        els => els.map(e => (e as HTMLImageElement).title))
    expect(chemTitles).toEqual(new Array(4).fill("Speed module 3"))
    let engineTitles = await calc.row("engine-unit").locator(".mods .modslot img").evaluateAll(
        els => els.map(e => (e as HTMLImageElement).title))
    expect(engineTitles).toEqual(new Array(4).fill("Productivity module 3"))
})

test("zero beacons with a beacon module set does not throw", async ({ calc }) => {
    await calc.open(`${CHEM}&db=speed-module-3:speed-module-3&dbc=0`)
    await expect(calc.row("chemical-science-pack")).toBeVisible()
    let titles = await calc.row("chemical-science-pack").locator(".mods .modslot img").evaluateAll(
        els => els.map(e => (e as HTMLImageElement).title))
    expect(titles.every(t => t === "Empty slot")).toBe(true)
})

test("a hand-set pipe link with modules its recipe refuses falls back to empty, not a throw", async ({ calc }) => {
    await calc.open(`${CHEM}&item=pipe&modules=pipe:p3:p3:p3:p3`)
    let editor = calc.page.locator(MS.rowEditor)
    for (let i = 0; i < 4; i++) {
        await expect(editor.locator(MS.meSlot(i))).toHaveAttribute("title", `Slot ${i + 1}: Empty`)
    }
})

test("an mm= link naming a module the machine refuses drops it instead of throwing", async ({ calc }) => {
    await calc.open(`${CHEM}&mm=pumpjack:quality-module-3:quality-module-3`)
    await calc.expectSetting("mm", "pumpjack:null:null;null:null:0")
})

test("a db= link naming a module beacons refuse drops it instead of throwing", async ({ calc }) => {
    await calc.open(`${CHEM}&db=productivity-module-3:productivity-module-3&dbc=8`)
    await calc.expectSetting("db", null)
})
