import { test, expect } from "../support/fixtures"
import { gtagCalls, openOnPublicHost } from "../support/areas/analytics"

// The public host's consent banner and footer link, served from the local build under factoriocalculator.app.

const QUESTION = "Can this site count your visit with Google Analytics? It sets cookies; your plans stay in your browser."

test.describe("from a European clock", () => {
    test.use({ timezoneId: "Europe/Berlin" })

    test("asks first; Allow stores the answer, updates consent and hides the banner", async ({ page, baseURL, pageErrors, externalRequests }) => {
        await openOnPublicHost(page, baseURL!, pageErrors)
        let banner = page.locator("#consent-banner")
        await expect(banner).toBeVisible()
        await expect(banner).toHaveClass("frame")
        await expect(banner).toHaveAttribute("role", "dialog")
        await expect(banner).toHaveAttribute("aria-label", "Analytics consent")
        await expect(banner.locator("span")).toHaveText(QUESTION)
        await expect(banner.locator("button.btn")).toHaveText(["Allow", "No thanks"])
        await expect(page.locator("#analytics-settings")).toBeVisible()
        expect(externalRequests.some(url => url.startsWith("https://www.googletagmanager.com/gtag/js?id=G-J67TQSQFYV"))).toBe(true)
        await banner.locator('button[data-choice="granted"]').click()
        await expect(banner).toBeHidden()
        expect(await page.evaluate(() => localStorage.getItem("calc.analytics"))).toBe("granted")
        expect(await gtagCalls(page)).toContainEqual(["consent", "update", { analytics_storage: "granted" }])
    })

    test("No thanks is remembered, and Analytics settings reopens the banner", async ({ page, baseURL, pageErrors }) => {
        await openOnPublicHost(page, baseURL!, pageErrors)
        await page.locator('#consent-banner button[data-choice="denied"]').click()
        await expect(page.locator("#consent-banner")).toBeHidden()
        await page.goto("about:blank")
        await openOnPublicHost(page, baseURL!, pageErrors)
        await expect(page.locator("#consent-banner")).toHaveCount(0)
        expect(await gtagCalls(page)).toContainEqual(["consent", "update", { analytics_storage: "denied" }])
        await page.locator("#analytics-settings").click()
        await expect(page.locator("#consent-banner")).toBeVisible()
    })
})

test.describe("from a clock outside Europe", () => {
    test.use({ timezoneId: "America/New_York" })

    test("never asks, but still offers Analytics settings", async ({ page, baseURL, pageErrors }) => {
        await openOnPublicHost(page, baseURL!, pageErrors)
        await expect(page.locator("#analytics-settings")).toBeVisible()
        await expect(page.locator("#consent-banner")).toHaveCount(0)
        expect(await page.locator("script[src*='googletagmanager']").count()).toBe(1)
    })
})
