import { test, expect } from "../support/fixtures"

// Phone widths narrower than the mobile project's Pixel 7: the page never scrolls sideways.
const PLANS = ["items=military-science-pack:r:60", "items=military-science-pack:r:60&view=graph"]

for (const width of [360, 390, 412]) {
    for (const plan of PLANS) {
        test(`no sideways scroll at ${width}px: ${plan} @mobile`, async ({ calc, page }) => {
            await page.setViewportSize({ width, height: 844 })
            await calc.open(plan)
            let { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }))
            expect(scroll).toBeLessThanOrEqual(client)
        })
    }
}

test("at 390px the top bar keeps the title, view switch and Settings on one row @mobile", async ({ calc, page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await calc.open(PLANS[0])
    let title = (await page.locator("#topbar .title").boundingBox())!
    let settings = (await page.locator("#settings-open").boundingBox())!
    expect(Math.abs((settings.y + settings.height / 2) - (title.y + title.height / 2))).toBeLessThan(4)
    expect(settings.x + settings.width).toBeLessThanOrEqual(390)
})
