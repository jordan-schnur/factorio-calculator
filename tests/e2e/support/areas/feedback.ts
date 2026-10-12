import type { Page, Request } from "@playwright/test"
import { S } from "../selectors"

export const FEEDBACK_URL = "https://feedback.test/submit"

// Answers every POST to the endpoint with one canned response and hands back the requests it saw, for request.postDataJSON() assertions.
export function stubFeedback(page: Page, status: number, body: unknown): Request[] {
    let requests: Request[] = []
    page.route(FEEDBACK_URL, async route => {
        requests.push(route.request())
        await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) })
    })
    return requests
}

export function stubFeedbackNetworkError(page: Page): Request[] {
    let requests: Request[] = []
    page.route(FEEDBACK_URL, async route => {
        requests.push(route.request())
        await route.abort("failed")
    })
    return requests
}

export async function openFeedback(page: Page) {
    await page.locator(S.feedbackLink).click()
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
