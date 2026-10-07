import { test, expect } from "../support/fixtures"
import { S } from "../support/selectors"
import { zipFragment } from "../support/fragment"
import { roundTrip, watchDatasetRequests } from "../support/areas/boot-url"

// Appendix A's share-link contract (and Appendix C/D): for a spread of
// fragments, the page writes back a fragment that reopens to the identical
// plan -- a round trip through a real boot, never a hashchange.

test.describe("plain fragments round-trip, one key family at a time", () => {
    const CASES: Record<string, string> = {
        "rate=": "rate=s&items=automation-science-pack:r:1",
        "rp/cp": "rp=3&cp=2&items=chemical-science-pack:r:45",
        "vf=r": "vf=r&items=chemical-science-pack:r:45",
        "bf=d": "bf=d&items=automation-science-pack:r:1200",
        "mprod": "mprod=20&items=automation-science-pack:r:60",
        "buildings": "buildings=assembling-machine-3,steel-furnace&items=chemical-science-pack:r:60",
        "belt": "belt=express-transport-belt&items=automation-science-pack:r:600",
        "fuel": "fuel=solid-fuel&buildings=stone-furnace&items=automation-science-pack:r:600",
        "ignore": "items=chemical-science-pack:r:30&ignore=advanced-circuit,engine-unit",
        "view=graph": "items=automation-science-pack:r:60&view=graph",
        "planet": "items=quantum-processor:r:10&planet=nauvis,vulcanus",
        "disable": "items=plastic-bar:r:60&disable=advanced-oil-processing",
        "enable": "items=automation-science-pack:r:60&enable=metallic-asteroid-crushing",
        "title (encoded)": "title=50%25%20mall%20%26%20more&items=automation-science-pack:r:60",
    }

    for (let [name, fragment] of Object.entries(CASES)) {
        test(`${name} survives open → write → fresh open`, async ({ calc }) => {
            let { fragment1, fragment2, rows1, rows2 } = await roundTrip(calc, fragment)
            expect(fragment2).toEqual(fragment1)
            expect(rows2).toEqual(rows1)
            expect(rows1.length).toBeGreaterThan(0)
        })
    }
})

test("item= opens that row on load and round-trips", async ({ calc, page }) => {
    let { fragment1, fragment2 } = await roundTrip(calc, "items=automation-science-pack:r:60&item=automation-science-pack")
    expect(fragment2).toEqual(fragment1)
    await expect(page.locator(`${S.rowFor("automation-science-pack")}.open`)).toBeVisible()
    await expect(page.locator(`${S.rowFor("automation-science-pack")} + ${S.detail}`)).toBeVisible()
})

test("a long zip= link decodes to the same plan a plain link would", async ({ calc, page }) => {
    let plain = "items=military-science-pack:r:60&ignore=steel-plate&buildings=assembling-machine-3,steel-furnace&belt=express-transport-belt&fuel=solid-fuel&mprod=20&bf=d&rp=3&cp=2"
    let zipped = zipFragment(plain)
    expect(zipped.startsWith("zip=")).toBe(true)

    await calc.open(zipped)
    let fromZip = await calc.canonicalHash()
    let rowsFromZip = await calc.tableRows()
    expect(rowsFromZip.length).toBeGreaterThan(0)

    await page.goto("about:blank")
    await calc.open(plain)
    let fromPlain = await calc.canonicalHash()
    let rowsFromPlain = await calc.tableRows()

    expect(fromZip).toEqual(fromPlain)
    expect(rowsFromZip).toEqual(rowsFromPlain)
})

test("the companion's own link-builder format is accepted and round-trips", async ({ calc }) => {
    // factorio_calc.url's example, Appendix A.
    let fragment = "data=space-age-2-0-77&items=electronic-circuit:r:60,copper-cable:r:7.5&belt=express-transport-belt&buildings=assembling-machine-2,steel-furnace&dm=s3&disable=iron-plate,copper-plate"
    let { fragment1, fragment2, rows1, rows2 } = await roundTrip(calc, fragment)
    expect(fragment2).toEqual(fragment1)
    expect(rows2).toEqual(rows1)
})

test.describe("?bg= builds (or skips) the intro background", () => {
    const CASES: [style: string, selector: string, count: number][] = [
        ["none", "#intro-bg", 0],
        ["blur", "#intro-bg.bg-blur .wall .shot", 1],
        ["sharp", "#intro-bg.bg-sharp .wall .shot", 1],
        ["drift", "#intro-bg.bg-drift .wall .shot", 1],
        ["collage", "#intro-bg.bg-collage .wall .shot", 16],
        ["slideshow", "#intro-bg.bg-slideshow .wall .shot", 9],
    ]

    for (let [style, selector, count] of CASES) {
        test(`bg=${style}`, async ({ calc, page }) => {
            await calc.open("items=", { query: `bg=${style}` })
            await expect(page.locator(selector)).toHaveCount(count)
        })
    }

    test("an unknown ?bg= value falls back to blur", async ({ calc, page }) => {
        await calc.open("items=", { query: "bg=bogus" })
        await expect(page.locator("#intro-bg.bg-blur")).toHaveCount(1)
    })

    test("the background goes away once a plan exists", async ({ calc, page }) => {
        await calc.open("items=", { query: "bg=collage" })
        await expect(page.locator("#intro-bg")).toHaveCount(1)
        await page.locator(`${S.exampleTarget}[data-item="automation-science-pack"]`).click()
        await expect(calc.isIntro()).toHaveCount(0)
        await expect(page.locator("#intro-bg")).toHaveCSS("display", "none")
    })
})

test.describe("data= loads every dataset, upgrades old aliases, and falls back", () => {
    const CASES: [label: string, key: string, written: string, file: string][] = [
        ["current key", "2-0-55", "2-0-55", "vanilla-2.0.55.json"],
        ["current key", "1-1-110", "1-1-110", "vanilla-1.1.110.json"],
        ["current key", "1-1-110x", "1-1-110x", "vanilla-1.1.110-expensive.json"],
        ["current key", "space-age-2-0-77", "space-age-2-0-77", "space-age-2.0.77.json"],
        ["current key", "space-age-2-0-55", "space-age-2-0-55", "space-age-2.0.55.json"],
        ["old alias", "2-0-6", "2-0-55", "vanilla-2.0.55.json"],
        ["old alias", "2-0-7", "2-0-55", "vanilla-2.0.55.json"],
        ["old alias", "2-0-10", "2-0-55", "vanilla-2.0.55.json"],
        ["old alias", "1-1-19", "1-1-110", "vanilla-1.1.110.json"],
        ["old alias", "1-1-19x", "1-1-110x", "vanilla-1.1.110-expensive.json"],
        ["old alias", "space-age-2-0-10", "space-age-2-0-55", "space-age-2.0.55.json"],
        ["old alias", "space-age-2-0-11", "space-age-2-0-55", "space-age-2.0.55.json"],
        ["unknown key falls back", "space-age-2.0.77", "space-age-2-0-77", "space-age-2.0.77.json"],
        ["unknown key falls back", "nonsense-dataset", "space-age-2-0-77", "space-age-2.0.77.json"],
    ]

    for (let [label, key, written, file] of CASES) {
        test(`${label}: data=${key} → data=${written}, fetches ${file}`, async ({ calc, page }) => {
            let datasetRequests = watchDatasetRequests(page)
            await calc.open(`data=${key}&items=`)
            expect((await calc.settings()).get("data")).toBe(written)
            expect(datasetRequests).toEqual([file])
        })
    }

    test("no data= at all defaults to space-age-2-0-77", async ({ calc, page }) => {
        let datasetRequests = watchDatasetRequests(page)
        await calc.open("items=")
        expect((await calc.settings()).get("data")).toBe("space-age-2-0-77")
        expect(datasetRequests).toEqual(["space-age-2.0.77.json"])
    })
})
