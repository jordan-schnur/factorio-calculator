import { test, expect } from "../support/fixtures"
import { S } from "../support/selectors"
import { AS } from "../support/areas/search-targets"

// The search box (#target-search) and its results dropdown
// (#target-search-results): nickname/alias resolution, the rate/machine
// grammar typed after a name, keyboard and mouse picking, and no-match.

test.describe("nickname and alias resolution", () => {
    test("a rate nickname adds that target at the typed rate per minute", async ({ calc }) => {
        await calc.open("items=")
        await calc.addBySearch("mil sci 60")
        await expect(calc.isIntro()).toHaveCount(0)
        expect((await calc.settings()).get("items")).toBe("military-science-pack:r:60")
    })

    test("a nickname with no number adds it at 60/min", async ({ calc }) => {
        await calc.open("items=")
        await calc.addBySearch("gears")
        expect((await calc.settings()).get("items")).toBe("iron-gear-wheel:r:60")
    })

    test("a two-word nickname with a rate", async ({ calc }) => {
        await calc.open("items=")
        await calc.addBySearch("blue chip 45")
        expect((await calc.settings()).get("items")).toBe("processing-unit:r:45")
    })

    test("a machine count instead of a rate", async ({ calc }) => {
        await calc.open("items=")
        await calc.addBySearch("mil sci 7 machines")
        expect((await calc.settings()).get("items")).toBe("military-science-pack:f:7")
    })

    test("short machine-count spellings: machine, mach, x, X", async ({ calc, page }) => {
        for (let [typed, key, count] of [
            ["gc 3 machine", "electronic-circuit", "3"],
            ["blue chip 7x", "processing-unit", "7"],
            ["blue chip 7 X", "processing-unit", "7"],
        ] as const) {
            await calc.open("items=")
            await calc.addBySearch(typed)
            expect((await calc.settings()).get("items")).toBe(`${key}:f:${count}`)
        }
    })

    test("a real name beats an alias it contains", async ({ calc }) => {
        await calc.open("items=")
        await calc.search("pipe")
        await expect(calc.page.locator(AS.resultRow).first()).toHaveAttribute("data-item", "pipe")
    })

    test("the shipped catalog snapshot resolves nicknames without a companion", async ({ calc }) => {
        await calc.open("items=")
        await calc.addBySearch("red science 60")
        let settings = await calc.settings()
        expect(settings.get("items")).toBe("automation-science-pack:r:60")
        expect(settings.has("save")).toBe(false)
        expect(settings.has("follow")).toBe(false)
    })
})

test.describe("results dropdown", () => {
    test("typing shows matches with an icon and label, at least one match", async ({ calc, page }) => {
        await calc.open("items=")
        await calc.search("sci")
        let rows = page.locator(AS.resultRow)
        await expect(rows.first()).toBeVisible()
        expect(await rows.count()).toBeGreaterThanOrEqual(3)
        await expect(rows.first().locator(".slot")).toBeVisible()
        await expect(rows.first().locator(".h")).not.toBeEmpty()
    })

    test("hovering a result highlights only it, and Enter picks it", async ({ calc, page }) => {
        await calc.open("items=")
        await calc.search("sci")
        let rows = page.locator(AS.resultRow)
        await expect(rows.first()).toBeVisible()
        expect(await rows.count()).toBeGreaterThanOrEqual(3)
        let third = rows.nth(2)
        await third.hover()
        await expect(page.locator(AS.resultHot)).toHaveCount(1)
        await expect(third).toHaveClass(/hot/)
        let pickedItem = await third.getAttribute("data-item")
        await page.locator(S.search).press("Enter")
        await calc.ready()
        expect((await calc.settings()).get("items")).toMatch(new RegExp(`^${pickedItem}:`))
    })

    test("ArrowDown and ArrowUp move the highlight", async ({ calc, page }) => {
        await calc.open("items=")
        await calc.search("sci")
        let rows = page.locator(AS.resultRow)
        await expect(rows.first()).toBeVisible()
        await expect(rows.first()).toHaveClass(/hot/)
        await page.locator(S.search).press("ArrowDown")
        await expect(rows.nth(0)).not.toHaveClass(/hot/)
        await expect(rows.nth(1)).toHaveClass(/hot/)
        await page.locator(S.search).press("ArrowUp")
        await expect(rows.nth(0)).toHaveClass(/hot/)
    })

    test("a mouse click on a result picks it", async ({ calc, page }) => {
        await calc.open("items=")
        await calc.search("sci")
        let rows = page.locator(AS.resultRow)
        await expect(rows.first()).toBeVisible()
        let second = rows.nth(1)
        let item = await second.getAttribute("data-item")
        await second.click()
        await calc.ready()
        expect((await calc.settings()).get("items")).toMatch(new RegExp(`^${item}:`))
    })

    test("Escape closes the dropdown without adding anything", async ({ calc, page }) => {
        await calc.open("items=")
        await calc.search("sci")
        await expect(page.locator(AS.resultRow).first()).toBeVisible()
        await page.locator(S.search).press("Escape")
        await expect(page.locator(AS.resultRow)).toHaveCount(0)
        await expect(calc.isIntro()).toBeVisible()
    })

    test("no match: no results, and Enter adds nothing", async ({ calc, page }) => {
        await calc.open("items=")
        await calc.search("zzzqqxxnotanitem")
        await expect(page.locator(AS.resultRow)).toHaveCount(0)
        await page.locator(S.search).press("Enter")
        await expect(calc.isIntro()).toBeVisible()
        expect((await calc.settings()).get("items") ?? "").toBe("")
    })

    test("there is no separate browse grid in the current markup", async ({ calc, page }) => {
        await calc.open("items=")
        await expect(page.locator("#target-browse")).toHaveCount(0)
    })
})

test.describe("mobile", () => {
    test("searching and adding a target on a phone @mobile", async ({ calc, page }) => {
        await calc.open("items=")
        await expect(calc.isIntro()).toBeVisible()
        await calc.addBySearch("mil sci 60")
        await expect(calc.isIntro()).toHaveCount(0)
        expect((await calc.settings()).get("items")).toBe("military-science-pack:r:60")
    })
})
