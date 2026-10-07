import { test, expect } from "../support/fixtures"
import { S } from "../support/selectors"
import {
    settledScreenshot, settle, waitIntroBgReady, openAdvanced, settingsSection,
    applyByproductFix, openScratchpad, hoverGraphLine, clickGraphNode, fitGraph, openViaRedirect,
} from "../support/areas/visual"

// A curated screenshot gate over the page's key states. Pixel screenshots
// are expensive to keep honest, so this is the ONE spec in the suite that
// uses them (every other unit pins behaviour as text/attribute assertions).
// Determinism: fonts are vendored (fixtures.ts routes them), animations and
// the caret are disabled in playwright.config.ts, every shot waits for
// fonts + every <img> to finish loading, and the mouse parks in a corner
// before each shot so no hover or tooltip from a previous action lingers.

const F60 = "items=military-science-pack:r:60&ignore=steel-plate"
const CHEM_MODULES = "items=chemical-science-pack:r:60&buildings=assembling-machine-3&nomach=cryogenic-plant&dm=p3"
const BELT = "items=electronic-circuit:r:900,inserter:r:300"
const COLORBLIND_ITEMS = "items=transport-belt:r:60,fast-splitter:r:10,express-transport-belt:r:30,fast-inserter:r:30"
const NO_CRACKING = "items=plastic-bar:r:600&disable=basic-oil-processing,heavy-oil-cracking,light-oil-cracking&item=heavy-oil"

test.describe("intro", () => {
    test("with bg=none shows the plain landing screen", async ({ calc, page }) => {
        await calc.open("", { query: "bg=none" })
        await settledScreenshot(page)
        await expect(page).toHaveScreenshot("intro-bg-none.png")
    })

    // The default style (blur) picks one of nine screenshots at random each
    // visit (intro-bg-core.js, pickShots), so the shot itself can never be
    // pinned: mask the background panel and lock down everything else
    // (title, search box, examples) around it instead.
    test("with the default blurred background once it has loaded", async ({ calc, page }) => {
        await calc.open("", { query: "" })
        await waitIntroBgReady(page)
        await settledScreenshot(page)
        await expect(page).toHaveScreenshot("intro-bg-blur.png", { mask: [page.locator(S.introBg)] })
    })

    test("on mobile @mobile", async ({ calc, page }) => {
        await calc.open("", { query: "bg=none" })
        await settledScreenshot(page)
        await expect(page).toHaveScreenshot("intro-mobile.png")
    })
})

test.describe("table", () => {
    test("a vanilla plan", async ({ calc, page }) => {
        // Vanilla 2.0.55, not the default Space Age dataset (settings.js MODIFICATIONS).
        await calc.open("data=2-0-55&items=advanced-circuit:r:60")
        await settledScreenshot(page)
        await expect(page.locator(S.tableFrame)).toHaveScreenshot("table-vanilla.png")
    })

    test("a Space Age plan", async ({ calc, page }) => {
        await calc.open(F60)
        await settledScreenshot(page)
        await expect(page.locator(S.tableFrame)).toHaveScreenshot("table-space-age.png")
    })

    test("a row opened shows its detail", async ({ calc, page }) => {
        await calc.open(F60)
        await calc.openRow("copper-plate")
        await settledScreenshot(page)
        await expect(page.locator(S.tableFrame)).toHaveScreenshot("table-row-opened.png")
    })

    test("a row with modules shows its strip", async ({ calc, page }) => {
        await calc.open(CHEM_MODULES)
        await settledScreenshot(page)
        await expect(page.locator(S.tableFrame)).toHaveScreenshot("table-row-modules.png")
    })

    test("colour-blind mode writes the colour word on the icons", async ({ calc, page }) => {
        await calc.open(COLORBLIND_ITEMS)
        let drawer = await calc.openSettings()
        await drawer.locator("#colorblind_toggle").check()
        await calc.closeSettings()
        await settledScreenshot(page)
        await expect(page.locator(S.tableFrame)).toHaveScreenshot("table-colorblind-on.png")
    })
})

test.describe("graph", () => {
    test("plan A (single target) after Fit", async ({ calc, page }) => {
        await calc.open(F60)
        await calc.switchView("graph")
        await fitGraph(page)
        await settle(page)
        await settledScreenshot(page)
        await expect(page.locator(S.graphFrame)).toHaveScreenshot("graph-plan-a.png")
    })

    test("plan B (with module cards) after Fit", async ({ calc, page }) => {
        await calc.open(CHEM_MODULES)
        await calc.switchView("graph")
        await fitGraph(page)
        await settle(page)
        await settledScreenshot(page)
        await expect(page.locator(S.graphFrame)).toHaveScreenshot("graph-plan-b.png")
    })

    test("plan C (busy, many distinct lines) after Fit", async ({ calc, page }) => {
        await calc.open(BELT)
        await calc.switchView("graph")
        await fitGraph(page)
        await settle(page)
        await settledScreenshot(page)
        await expect(page.locator(S.graphFrame)).toHaveScreenshot("graph-plan-c.png")
    })

    test("a card clicked shows the side panel and pinned chips", async ({ calc, page }) => {
        await calc.open(BELT)
        await calc.switchView("graph")
        await fitGraph(page)
        await clickGraphNode(page, "iron-plate")
        await settledScreenshot(page)
        await expect(page.locator(S.graphFrame)).toHaveScreenshot("graph-card-clicked.png")
    })

    test("a line hovered shows its chip", async ({ calc, page }) => {
        await calc.open(BELT)
        await calc.switchView("graph")
        await fitGraph(page)
        let line = page.locator('#flow path.hit[data-from="iron-plate"][data-to="electronic-circuit"]')
        await hoverGraphLine(page, line)
        await settledScreenshot(page)
        await expect(page.locator(S.graphFrame)).toHaveScreenshot("graph-line-hovered.png")
    })
})

test.describe("settings drawer", () => {
    test("Machines section", async ({ calc, page }) => {
        await calc.open(F60)
        await calc.openSettings()
        await settledScreenshot(page)
        await expect(settingsSection(page, "Machines")).toHaveScreenshot("settings-machines.png")
    })

    test("Recipes section", async ({ calc, page }) => {
        await calc.open(F60)
        await calc.openSettings()
        await settledScreenshot(page)
        await expect(settingsSection(page, "Recipes")).toHaveScreenshot("settings-recipes.png")
    })

    test("Modules section", async ({ calc, page }) => {
        await calc.open(CHEM_MODULES)
        await calc.openSettings()
        await settledScreenshot(page)
        await expect(page.locator("#settings-modules")).toHaveScreenshot("settings-modules.png")
    })

    test("Display section", async ({ calc, page }) => {
        await calc.open(F60)
        await calc.openSettings()
        await settledScreenshot(page)
        await expect(settingsSection(page, "Display")).toHaveScreenshot("settings-display.png")
    })

    test("Advanced section open", async ({ calc, page }) => {
        await calc.open(F60)
        await calc.openSettings()
        let advanced = await openAdvanced(page)
        await settledScreenshot(page)
        await expect(advanced).toHaveScreenshot("settings-advanced-open.png")
    })
})

test("byproducts bar shows the fix's status strip once applied", async ({ calc, page }) => {
    await calc.open(NO_CRACKING)
    await applyByproductFix(page, "allow")
    await settledScreenshot(page)
    await expect(page.locator(S.byproducts)).toHaveScreenshot("byproducts-fix-applied.png")
})

test("scratch pad open with history", async ({ calc, page }) => {
    await calc.open(F60)
    let pad = await openScratchpad(page)
    for (let expr of ["270 / 900", "20 * 90 kW"]) {
        await page.locator(S.scratchInput).fill(expr)
        await page.locator(S.scratchInput).press("Enter")
    }
    await settledScreenshot(page)
    await expect(pad).toHaveScreenshot("scratchpad-history.png")
})

test("changelog.html lists releases, oldest entry pinned", async ({ page }) => {
    await page.goto("/changelog.html")
    await page.evaluate(() => document.fonts.ready)
    // The newest entry changes every release; the first public release
    // (v1.0.0) never will, so pin that one instead of the churning top.
    let firstRelease = page.locator("section").filter({ has: page.locator("#v1\\.0\\.0") })
    await firstRelease.scrollIntoViewIfNeeded()
    await settle(page)
    await expect(firstRelease).toHaveScreenshot("changelog-v1-0-0.png")
})

test("calc-redirect.html lands on the plan, keeping the fragment", async ({ calc, page }) => {
    let fragment = "items=automation-science-pack:r:60"
    await openViaRedirect(page, fragment)
    await calc.ready()
    expect(await calc.canonicalHash()).toMatchObject({ items: fragment.slice("items=".length) })
    await settledScreenshot(page)
    await expect(page).toHaveScreenshot("calc-redirect-landing.png")
})

test("table on mobile @mobile", async ({ calc, page }) => {
    await calc.open(F60)
    await settledScreenshot(page)
    await expect(page).toHaveScreenshot("table-mobile.png")
})
