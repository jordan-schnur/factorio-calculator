import { test, expect } from "../support/fixtures"
import { S } from "../support/selectors"

// Section 3 of the inventory: Kirk McDonald's calculator links, and the
// legacy keys init.js's fixLegacySettings upgrades on the way in.

const VANILLA = "data=2-0-55&"

test("a Kirk machine-count link opens here and keeps its machine-count form @mobile", async ({ calc, page }) => {
    await calc.open(VANILLA + "items=advanced-circuit:f:1")
    await expect(page.locator(S.tableFrame)).toBeVisible()
    let settings = await calc.settings()
    expect(settings.get("data")).toBe("2-0-55")
    expect(settings.get("items")).toBe("advanced-circuit:f:1")
    await expect.poll(() => page.title()).toBe("Advanced circuit 1 machines · Factorio Calculator")
})

test("Kirk's tab=graph with no view= opens the graph, and is never written back", async ({ calc, page }) => {
    await calc.open(VANILLA + "tab=graph&items=advanced-circuit:f:1")
    await expect(page.locator(S.tableFrame)).toBeHidden()
    await expect(page.locator(S.graphFrame)).toBeVisible()
    let settings = await calc.settings()
    expect(settings.get("view")).toBe("graph")
    expect(settings.has("tab")).toBe(false)
})

test("use_3 becomes a buildings= setting, and is dropped from the hash", async ({ calc }) => {
    await calc.open(VANILLA + "use_3=1&items=advanced-circuit:r:60")
    let settings = await calc.settings()
    expect(settings.get("buildings")).toBe("assembling-machine-3")
    expect(settings.has("use_3")).toBe(false)
})

test("min=4 maps to assembling-machine-3, and takes priority over use_3", async ({ calc }) => {
    await calc.open(VANILLA + "use_3=1&min=4&items=advanced-circuit:r:60")
    let settings = await calc.settings()
    expect(settings.get("buildings")).toBe("assembling-machine-3")
    expect(settings.has("min")).toBe(false)
    expect(settings.has("use_3")).toBe(false)
})

test("min=2 passes through as-is", async ({ calc }) => {
    await calc.open(VANILLA + "min=2&items=advanced-circuit:r:60")
    expect((await calc.settings()).get("buildings")).toBe("assembling-machine-2")
})

test("furnace= appends to buildings and is removed from the hash", async ({ calc }) => {
    await calc.open(VANILLA + "use_3=1&furnace=steel-furnace&items=iron-plate:r:60")
    let settings = await calc.settings()
    expect(settings.get("buildings")).toBe("assembling-machine-3,steel-furnace")
    expect(settings.has("furnace")).toBe(false)
})

test("use_3/min/furnace are ignored once a buildings= is already set", async ({ calc, pageErrors }) => {
    await calc.open(VANILLA + "use_3=1&buildings=assembling-machine-2&items=advanced-circuit:r:60")
    let settings = await calc.settings()
    expect(settings.get("buildings")).toBe("assembling-machine-2")
    expect(settings.has("use_3")).toBe(false)
    expect(pageErrors.seen).toEqual([])
})

test("p=basic disables advanced oil processing", async ({ calc }) => {
    await calc.open(VANILLA + "p=basic&items=plastic-bar:r:60")
    let settings = await calc.settings()
    expect(settings.get("disable")).toBe("advanced-oil-processing")
    expect(settings.has("p")).toBe(false)
})

test("p=coal disables both basic and advanced oil processing", async ({ calc }) => {
    await calc.open(VANILLA + "p=coal&items=plastic-bar:r:60")
    let settings = await calc.settings()
    let disabled = (settings.get("disable") ?? "").split(",")
    expect(disabled).toEqual(expect.arrayContaining(["advanced-oil-processing", "basic-oil-processing"]))
    expect(settings.has("p")).toBe(false)
})

test("k/p are ignored once a disable= is already set", async ({ calc, pageErrors }) => {
    await calc.open(VANILLA + "k=1&p=basic&disable=iron-plate&items=advanced-circuit:r:60")
    let settings = await calc.settings()
    expect(settings.get("disable")).toBe("iron-plate")
    expect(settings.has("k")).toBe(false)
    expect(settings.has("p")).toBe(false)
    expect(pageErrors.seen).toEqual([])
})
