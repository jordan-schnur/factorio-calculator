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
