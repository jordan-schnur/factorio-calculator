import { test, expect } from "../support/fixtures"
import { SD } from "../support/areas/settings-display"

// Section 11: colour-blind mode. Remembered per-browser (localStorage), not
// in the link, and it labels belt-family and inserter icons with their
// colour (an extra background-image layer; calc.css's second layer is the
// word badge drawn over the sprite).
const FRAGMENT = "items=transport-belt:r:60,fast-splitter:r:10,express-transport-belt:r:30,fast-inserter:r:30"

function layerCount(page: import("@playwright/test").Page, item: string) {
    return page.locator(`[data-item="${item}"] img.icon[data-tier]`).first()
        .evaluate(el => getComputedStyle(el).backgroundImage.split(", url(").length)
}

test("off by default: html has no colorblind class, one background layer @mobile", async ({ calc, page }) => {
    await calc.open(FRAGMENT)
    await expect(page.locator("html")).not.toHaveClass(/colorblind/)
    expect(await layerCount(page, "transport-belt")).toBe(1)
})

test("turning it on adds the html class, a second icon layer, and remembers it", async ({ calc, page }) => {
    await calc.open(FRAGMENT)
    await calc.openSettings()
    await page.locator(SD.colorblindToggle).check()

    await expect(page.locator("html")).toHaveClass(/colorblind/)
    expect(await layerCount(page, "transport-belt")).toBe(2)
    expect(await page.evaluate(() => localStorage.getItem("calc.colorblind"))).toBe("1")

    let tiers = await page.locator("img.icon[data-tier]").evaluateAll(els => [...new Set(els.map(e => (e as HTMLElement).dataset.tier))])
    expect(tiers).toEqual(expect.arrayContaining(["yellow", "red", "blue"]))
})

test("turning it off removes the class, the extra layer, and the storage key", async ({ calc, page }) => {
    await calc.open(FRAGMENT)
    await calc.openSettings()
    await page.locator(SD.colorblindToggle).check()
    await page.locator(SD.colorblindToggle).uncheck()

    await expect(page.locator("html")).not.toHaveClass(/colorblind/)
    expect(await layerCount(page, "transport-belt")).toBe(1)
    expect(await page.evaluate(() => localStorage.getItem("calc.colorblind"))).toBeNull()
})

test("persists across a reload", async ({ calc, page }) => {
    await calc.open(FRAGMENT)
    await calc.openSettings()
    await page.locator(SD.colorblindToggle).check()

    await page.reload()
    await calc.ready()
    await expect(page.locator("html")).toHaveClass(/colorblind/)
    await calc.openSettings()
    await expect(page.locator(SD.colorblindToggle)).toBeChecked()
})

test("never goes into the link", async ({ calc, page }) => {
    await calc.open(FRAGMENT)
    let before = await calc.decodedHash()
    await calc.openSettings()
    await page.locator(SD.colorblindToggle).check()
    let after = await calc.decodedHash()
    expect(after).toBe(before)
    expect(after).not.toContain("colorblind")
})
