import { test, expect } from "../support/fixtures"
import { S } from "../support/selectors"
import { TD } from "../support/areas/table-details"

// Section 6: Settings -> Machines (assembler tier, Available), and a row's
// own Machine picker (mach=, "every recipe this machine can make", Automatic).

const F60 = "items=military-science-pack:r:60&ignore=steel-plate"

test.describe("Settings -> Machines -> Available (nomach=)", () => {
    test("a switched-off machine shows (off) in Available and every ratio uses the fallback machine", async ({ calc }) => {
        await calc.open(F60 + "&nomach=assembling-machine-1")
        await calc.openSettings()
        let off = calc.page.locator(TD.machineAllowOff)
        await expect(off).toHaveCount(1)
        await expect(off).toHaveAttribute("title", "Assembling machine 1 (off)")
        await calc.closeSettings()
        let detail = await calc.openRow("piercing-rounds-magazine")
        await expect(detail.locator(".col.source")).not.toContainText("No available machine")
        for (let ratio of await detail.locator(TD.needsCol + " " + TD.ratioLine).allTextContents()) {
            expect(ratio).toContain("per assembling machine 2")
        }
        await calc.expectSetting("nomach", "assembling-machine-1")
    })

    test("switching off every capable machine falls back and says so", async ({ calc }) => {
        await calc.open(F60 + "&nomach=electric-furnace,steel-furnace,stone-furnace")
        let detail = await calc.openRow("iron-plate")
        await expect(detail.locator(".col.source")).toContainText("No available machine makes this")
    })

    test("clicking a machine in Available switches it off and marks the override", async ({ calc }) => {
        await calc.open(F60)
        await calc.openSettings()
        await calc.page.locator(TD.machineAllowSlot("Assembling machine 1")).click()
        await calc.expectSetting("nomach", "assembling-machine-1")
        let ov = (await calc.settings()).get("ov")!.split(",")
        expect(ov).toContain("machines")
    })
})

test.describe("a row's own Machine pick", () => {
    test("picking a machine on a row pins mach=, marks the slot selected, and updates the ratios", async ({ calc }) => {
        await calc.open(F60)
        let detail = await calc.openRow("piercing-rounds-magazine")
        await detail.locator(TD.machineSlot("assembling-machine-3")).click()
        await calc.expectSetting("mach", "piercing-rounds-magazine:assembling-machine-3")
        let sel = detail.locator(".machines button.slot.sel")
        await expect(sel).toHaveAttribute("data-machine", "assembling-machine-3")
        for (let ratio of await detail.locator(TD.needsCol + " " + TD.ratioLine).allTextContents()) {
            expect(ratio).toContain("per assembling machine 3")
        }
        await expect(detail.locator(TD.machineAutoButton)).toBeVisible()
    })

    test("'for everything in this build' pins every recipe that machine can make", async ({ calc }) => {
        await calc.open(F60)
        let detail = await calc.openRow("piercing-rounds-magazine")
        await detail.locator(TD.machineSlot("assembling-machine-3")).click()
        await detail.locator(TD.machineAllButton).click()
        let mach = (await calc.settings()).get("mach")!
        let pins = new Map(mach.split(",").map(p => p.split(":") as [string, string]))
        expect(pins.get("piercing-rounds-magazine")).toBe("assembling-machine-3")
        expect(pins.get("firearm-magazine")).toBe("assembling-machine-3")
        expect(pins.get("military-science-pack")).toBe("assembling-machine-3")
        expect(pins.get("iron-plate")).toBeUndefined()
        await expect(detail.locator(TD.machineAllButton)).toHaveCount(0)
    })

    test("a pinned machine survives a reload, and Automatic drops it", async ({ calc }) => {
        await calc.open(F60 + "&mach=piercing-rounds-magazine:assembling-machine-3")
        let detail = await calc.openRow("piercing-rounds-magazine")
        let sel = detail.locator(".machines button.slot.sel")
        await expect(sel).toHaveAttribute("data-machine", "assembling-machine-3")
        await detail.locator(TD.machineAutoButton).click()
        await calc.expectSetting("mach", null)
    })

    test("the exact machine count and power sentence", async ({ calc }) => {
        await calc.open(F60)
        let detail = await calc.openRow("copper-plate")
        await expect(detail.locator(TD.exactLine)).toHaveText("0.8 machines exactly · 150 kW")
    })
})

test.describe("the assembler tier switch (#asm-seg)", () => {
    test("shows the tiers this dataset has, the current one marked on, and writes buildings=", async ({ calc, page }) => {
        await calc.open(F60)
        await calc.openSettings()
        let seg = page.locator(TD.asmSeg)
        let tiers = await seg.locator("button[data-building]").evaluateAll(els =>
            els.map(el => ({ building: (el as HTMLElement).dataset.building, text: el.textContent, on: el.classList.contains("on") })))
        expect(tiers).toEqual([
            { building: "assembling-machine-1", text: "1", on: true },
            { building: "assembling-machine-2", text: "2", on: false },
            { building: "assembling-machine-3", text: "3", on: false },
        ])
        await page.locator(TD.asmButton("assembling-machine-3")).click()
        await calc.expectSetting("buildings", "assembling-machine-3")
        let ov = (await calc.settings()).get("ov")!.split(",")
        expect(ov).toContain("buildings")
    })

    test("a vanilla dataset (2-0-55) has the same three tiers", async ({ calc, page }) => {
        await calc.open("data=2-0-55&items=advanced-circuit:r:60")
        await calc.openSettings()
        let tiers = await page.locator(TD.asmSeg + " button[data-building]").evaluateAll(els =>
            els.map(el => (el as HTMLElement).dataset.building))
        expect(tiers).toEqual(["assembling-machine-1", "assembling-machine-2", "assembling-machine-3"])
    })
})
