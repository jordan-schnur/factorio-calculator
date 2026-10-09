import { test, expect } from "../support/fixtures"
import { G } from "../support/areas/graph"
import { SD } from "../support/areas/settings-display"

// The "one belt holds" setting: hovering a graph line says how many machines fill one belt and how many it feeds.
const BELT = "items=electronic-circuit:r:900,inserter:r:300&view=graph"
const KEY = "calc.beltholds"

const text = async (el: import("@playwright/test").Locator) => (await el.textContent())!.replace(/\s+/g, " ").trim()

test("off by default: a hovered line shows only its rate and belts", async ({ calc, page }) => {
    await calc.open(BELT)
    let label = page.locator(G.labelFor("iron-plate", "electronic-circuit", "iron-plate"))
    await label.hover()
    await expect(label).toHaveClass(/\bchip\b/)
    await expect.poll(() => text(label)).toBe("1200/min|yellow1 1/3 belts")
})

test("on: a hovered line says how many machines fill one belt and how many it feeds", async ({ calc, page }) => {
    await page.addInitScript(key => localStorage.setItem(key, "1"), KEY)
    await calc.open(BELT)
    let label = page.locator(G.labelFor("iron-plate", "electronic-circuit", "iron-plate"))
    await label.hover()
    await expect.poll(() => text(label)).toBe("1200/min|yellow1 1/3 beltsyellowOne transport belt holds:up to 24 electric furnaces on iron plateenough for 15 assembling machines 1 on electronic circuit")
})

test("on: a belt that fills partway through a machine shows the exact count too", async ({ calc, page }) => {
    await page.addInitScript(key => localStorage.setItem(key, "1"), KEY)
    await calc.open(BELT)
    let label = page.locator(G.labelFor("copper-cable", "electronic-circuit", "copper-cable"))
    await label.hover()
    await expect.poll(() => text(label)).toContain("up to 7 assembling machines 1 on copper cable (7.5 fills it)enough for 5 assembling machines 1 on electronic circuit")
})

test("on: hovering a card words its lines' belt row the same way", async ({ calc, page }) => {
    await page.addInitScript(key => localStorage.setItem(key, "1"), KEY)
    await calc.open(BELT)
    await page.locator(G.nodeFor("electronic-circuit")).hover()
    let label = page.locator(G.labelFor("copper-cable", "electronic-circuit", "copper-cable"))
    await expect(label).toHaveClass(/\bchip\b/)
    await expect.poll(() => text(label)).toContain("One transport belt holds:")
    await expect.poll(() => text(label)).not.toContain("1 belt:")
})

test("the Display checkbox turns it on, remembers it and keeps it out of the link", async ({ calc, page }) => {
    await calc.open(BELT)
    let before = await calc.decodedHash()
    await calc.openSettings()
    await page.locator(SD.beltHoldsToggle).check()
    expect(await page.evaluate(key => localStorage.getItem(key), KEY)).toBe("1")
    expect(await calc.decodedHash()).toBe(before)
    await page.reload()
    await calc.ready()
    await calc.openSettings()
    await expect(page.locator(SD.beltHoldsToggle)).toBeChecked()
    await page.locator(SD.beltHoldsToggle).uncheck()
    expect(await page.evaluate(key => localStorage.getItem(key), KEY)).toBeNull()
})
