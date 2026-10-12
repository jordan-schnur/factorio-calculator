import type { Page } from "@playwright/test"
import { S } from "../selectors"

// Catches the popup's request to github.com before it leaves the browser, while `trigger` opens it, and hands back the URL it was headed to.
async function catchFeedbackRequest(page: Page, trigger: () => Promise<void>): Promise<URL> {
    let context = page.context()
    let requestUrl = new Promise<string>(resolve => {
        context.route("https://github.com/**", route => {
            resolve(route.request().url())
            return route.abort()
        })
    })
    let [popup] = await Promise.all([context.waitForEvent("page"), trigger()])
    let url = await requestUrl
    await popup.close()
    return new URL(url)
}

export function openFeedback(page: Page): Promise<URL> {
    return catchFeedbackRequest(page, () => page.locator(S.feedbackLink).click())
}

export function openFeedbackViaKeyboard(page: Page): Promise<URL> {
    return catchFeedbackRequest(page, async () => {
        await page.locator(S.feedbackLink).focus()
        await page.keyboard.press("Enter")
    })
}

// A deterministic xorshift32 PRNG over [A-Za-z0-9]: unlike Math.random() or a repeated string, it's both reproducible and incompressible.
export function xorshiftNoise(length: number): string {
    let x = 123456789
    let chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    let out = ""
    for (let i = 0; i < length; i++) {
        x ^= x << 13; x |= 0
        x ^= x >>> 17
        x ^= x << 5; x |= 0
        out += chars[(x >>> 0) % chars.length]
    }
    return out
}
