import { type Locator, type Page, expect } from "@playwright/test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { S } from "../selectors"
import { PAGE } from "../calculator"

// Helpers for the pixel-screenshot gate only. Nothing here is a behaviour
// assertion; it exists to make a screenshot land on the same pixels every
// run. Keep assertions themselves in the spec, next to the screenshot they
// guard.

// A corner with nothing interactive, so a leftover hover state from a
// previous action never bleeds into the next shot, and no tooltip is left
// open pointing at a now-stale target.
export async function settle(page: Page) {
    await page.mouse.move(2, 2)
    // tooltip.js never removes a tooltip's node on hide(), only sets
    // style.display: none (reapTooltips only prunes ones whose reference
    // left the DOM) — so #tooltip_container is never "empty" once any
    // tooltip has shown. Check for a visible one instead. changelog.html
    // has no #tooltip_container at all, hence the `?.`.
    await expect.poll(() => page.evaluate(() =>
        Array.from(document.getElementById("tooltip_container")?.children ?? [])
            .every(el => (el as HTMLElement).style.display === "none"),
    )).toBe(true)
}

// `document.fonts.ready` covers text; it does not cover the <img> icons
// (every icon is a 1x1 transparent gif sized by CSS over a sprite-sheet
// background-image — see icon.js) or the sprite sheet itself. `ready()`
// already waits for networkidle, which covers the sprite sheet fetch, but
// a screenshot taken right after a click can still race a decode, so wait
// for every <img> to report complete too.
export async function waitForImages(page: Page) {
    await page.evaluate(() => document.fonts.ready)
    await expect.poll(() =>
        page.evaluate(() => Array.from(document.images).every(img => img.complete)),
    ).toBe(true)
}

export async function settledScreenshot(page: Page) {
    await waitForImages(page)
    await settle(page)
}

// The landing background fades its tiles in once the first one has loaded
// (intro-bg.js adds "ready" to #intro-bg only then); shooting before that
// would pin a half-loaded gradient.
export async function waitIntroBgReady(page: Page) {
    await expect(page.locator(S.introBg)).toHaveClass(/ready/)
}

export async function openAdvanced(page: Page) {
    let advanced = page.locator("#settings-drawer details.adv")
    // Its own summary, not one of the nested <details> ("Toggle recipes",
    // "Resource priority") inside it.
    await advanced.locator(":scope > summary").click()
    await expect(advanced).toHaveJSProperty("open", true)
    return advanced
}

// Machines/Recipes are bare `.sec` + `.deep` siblings (no id); Modules and
// Display have ids. One lookup either way, kept here so the spec can just
// name the section.
export function settingsSection(page: Page, label: "Machines" | "Recipes" | "Display"): Locator {
    if (label === "Display") return page.locator(S.settingsDrawer).locator("#settings-display")
    return page.locator(S.settingsDrawer).locator(`.sec:text-is("${label}") + .deep`)
}

// Clicking a byproducts fix button swaps the whole bar for a status strip
// (byproducts.js statusMarkup); wait for that swap, not just the click.
export async function applyByproductFix(page: Page, fix: "allow" | "avoid" | "out") {
    await page.locator(`#byproducts [data-fix="${fix}"]`).click()
    await expect(page.locator("#byproducts .bp-done")).toBeVisible()
}

export async function openScratchpad(page: Page): Promise<Locator> {
    let frame = page.locator(S.scratchpad)
    await frame.locator("summary").click()
    await expect(frame).toHaveJSProperty("open", true)
    return frame
}

// Hovering a graph line only shows its chip after flow.js's HOVER_IN delay
// (250ms); the generous `toBeVisible` timeout below is the bound the brief
// asks for around that intentional delay, not a fixed sleep.
export async function hoverGraphLine(page: Page, line: Locator) {
    // The busy graph's invisible "hit" paths (fatter hover targets layered
    // over the drawn lines, flow.js) overlap each other along their curve,
    // so a real mouse move can land on a neighbour's hit path instead of
    // this one's. flow.js binds the listener with d3's `.on("mouseenter")`,
    // so dispatching the DOM event directly is exactly what it listens
    // for — the same technique the page's own oracle test suite uses for
    // every hover test (inventory.md: "synthetic mouseenter/mouseleave").
    await line.dispatchEvent("mouseenter")
    // The chip itself is a `div.elbl.chip` laid over the line, not the path.
    await expect(page.locator("#flow-nodes .elbl.chip").first()).toBeVisible({ timeout: 2000 })
}

export async function clickGraphNode(page: Page, item: string) {
    await page.locator(`${S.graphNodeFor(item)} .nbody`).click()
    await expect(page.locator(S.graphSide)).toBeVisible()
}

export async function fitGraph(page: Page) {
    await page.locator(S.graphFit).click()
}

// calc-redirect.html is only ever reached through its published name,
// "calc.html", once the deploy workflow renames calc.html to index.html and
// calc-redirect.html to calc.html (.github/workflows/deploy.yml). Locally
// there is no index.html at "/", so faithfully exercising the redirect
// means serving calc.html's own bytes at "/" — the same substitution the
// workflow performs — rather than testing a 404 the real site never shows.
export async function openViaRedirect(page: Page, fragment: string) {
    let calcHtml = readFileSync(join(__dirname, "..", "..", "..", "..", "calc.html"))
    await page.route(url => url.pathname === "/", route =>
        route.fulfill({ contentType: "text/html", body: calcHtml }))
    await page.goto(`${PAGE.replace("/calc.html", "/calc-redirect.html")}#${fragment}`)
}
