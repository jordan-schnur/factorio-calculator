import { test, expect } from "../support/fixtures"
import { SD, openAdvanced, setNumber, clickPlanet } from "../support/areas/settings-display"

// Section 7: the rest of the drawer -- belt, preferred fuel, mining
// productivity, planets, recipe toggles, resource priority and the custom
// title.

test.describe("belt and fuel", () => {
    test("picking a belt changes belt counts and writes belt= @mobile", async ({ calc, page }) => {
        await calc.open("items=iron-plate:r:600")
        let belts = () => calc.row("iron-plate").locator(".need .belts").innerText()
        await expect.poll(belts).toBe("2/3 belt")

        await calc.openSettings()
        await page.locator(SD.beltButton("Express transport belt")).click()
        await expect.poll(belts).toBe("2/9 belt")
        await calc.expectSetting("belt", "express-transport-belt")

        await calc.open("items=iron-plate:r:600&belt=express-transport-belt")
        await expect.poll(belts).toBe("2/9 belt")
    })

    test("picking a preferred fuel writes fuel=", async ({ calc, page }) => {
        await calc.open("items=iron-plate:r:600")
        await calc.openSettings()
        await calc.expectSetting("fuel", null)
        await page.locator(SD.fuelButton("Rocket fuel")).click()
        await calc.expectSetting("fuel", "rocket-fuel")
        await expect(page.locator(SD.fuelButton("Rocket fuel"))).toHaveClass(/sel/)
    })
})

test.describe("mining productivity", () => {
    test("raising mprod shrinks drill counts and writes mprod=", async ({ calc, page }) => {
        await calc.open("items=iron-plate:r:600")
        let drills = () => calc.row("iron-ore").locator(".machines .cnt").innerText()
        let before = await drills()

        await calc.openSettings()
        await setNumber(page.locator(SD.mprod), "50")
        await expect.poll(drills).not.toBe(before)
        await calc.expectSetting("mprod", "50")

        await calc.open("items=iron-plate:r:600&mprod=50")
        await expect.poll(drills).not.toBe(before)
    })
})

test.describe("planets", () => {
    test("a plain click selects only that planet; shift-click adds to the selection", async ({ calc, page }) => {
        await calc.open("items=iron-plate:r:600")
        await calc.openSettings()
        let checked = () => page.locator(SD.planetSelector + " span.radio").evaluateAll(
            els => els.filter(e => e.querySelector("span.check")?.textContent === "✓")
                .map(e => e.textContent!.replace("✓", "").trim()))

        await clickPlanet(page, "Vulcanus")
        await expect.poll(checked).toEqual(["Vulcanus"])
        await calc.expectSetting("planet", "vulcanus")

        await clickPlanet(page, "Gleba", { shift: true })
        await expect.poll(checked).toEqual(["Vulcanus", "Gleba"])
        await calc.expectSetting("planet", "vulcanus,gleba")

        await clickPlanet(page, "Gleba", { shift: true })
        await expect.poll(checked).toEqual(["Vulcanus"])
    })
})

test.describe("recipe toggles", () => {
    test("toggling a recipe off and back on writes disable=/enable=", async ({ calc, page }) => {
        await calc.open("items=iron-plate:r:600")
        await calc.openSettings()
        await openAdvanced(page, "Toggle recipes")
        let first = page.locator(SD.recipeToggle).first()
        await expect(first).toHaveClass(/selected/)

        await first.click()
        await expect(first).not.toHaveClass(/selected/)
        let settings = await calc.settings()
        expect(settings.has("disable") || settings.has("enable")).toBe(true)

        await first.click()
        await expect(first).toHaveClass(/selected/)
    })
})

test.describe("resource priority", () => {
    test("changing a resource's weight writes priority=", async ({ calc, page }) => {
        await calc.open("items=iron-plate:r:600")
        await calc.openSettings()
        await openAdvanced(page, "Resource priority")
        let ironOre = page.locator(SD.resourceInputFor("Iron ore"))
        await expect(ironOre).toHaveValue("100")

        await setNumber(ironOre, "999")
        await expect.poll(async () => (await calc.settings()).get("priority") ?? "").toContain("iron-ore=999")
    })
})

test.describe("custom title", () => {
    test("setting a title writes title= and renames the tab @mobile", async ({ calc, page }) => {
        await calc.open("items=military-science-pack:r:60&ignore=steel-plate")
        await calc.openSettings()
        await openAdvanced(page)
        await page.locator(SD.titleSetting).fill("My mall")
        await expect.poll(() => page.title()).toBe("My mall")
        await calc.expectSetting("title", "My%20mall")
        await calc.closeSettings()

        // A hash-only change isn't a full navigation: close the drawer
        // first so the fresh page (loaded from the link) opens it anew.
        await calc.open("title=My%20mall&items=military-science-pack:r:60&ignore=steel-plate")
        await expect.poll(() => page.title()).toBe("My mall")
        await calc.openSettings()
        await expect(page.locator(SD.titleSetting)).toHaveValue("My mall")
    })

    test("with no title set, the tab names what the plan makes", async ({ calc, page }) => {
        await calc.open("items=military-science-pack:r:1&ignore=steel-plate")
        await expect.poll(() => page.title()).toBe("Military science pack 1/min · Factorio Calculator")
        await calc.expectSetting("title", null)
    })
})
