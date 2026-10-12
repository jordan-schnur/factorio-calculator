import type { Page } from "@playwright/test"
import { S } from "../selectors"

// Clicks the footer's Feedback link, catches the popup's request to github.com before it leaves the browser, and hands back the URL it was headed to.
export async function openFeedback(page: Page): Promise<URL> {
    let context = page.context()
    let requestUrl = new Promise<string>(resolve => {
        context.route("https://github.com/**", route => {
            resolve(route.request().url())
            return route.abort()
        })
    })
    let [popup] = await Promise.all([context.waitForEvent("page"), page.locator(S.feedbackLink).click()])
    let url = await requestUrl
    await popup.close()
    return new URL(url)
}
