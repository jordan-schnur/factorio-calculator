import type { Page } from "@playwright/test"
import { PAGE } from "../calculator"
import type { PageErrors } from "../fixtures"

export const PUBLIC_HOST = "factoriocalculator.app"

// Serves the local build as https://factoriocalculator.app, the one host analytics.js reports from.
export async function openOnPublicHost(page: Page, baseURL: string, pageErrors: PageErrors, fragment = "items=") {
    pageErrors.allow(/googletagmanager/)
    let local = new URL(baseURL).origin
    await page.route(url => url.hostname === PUBLIC_HOST, async route => {
        let url = new URL(route.request().url())
        let response = await route.fetch({ url: local + url.pathname + url.search })
        await route.fulfill({ response })
    })
    await page.goto(`https://${PUBLIC_HOST}${PAGE}?bg=none#${fragment}`)
    await page.waitForLoadState("networkidle")
}

// Every gtag() call so far, as plain arrays.
export function gtagCalls(page: Page): Promise<unknown[][]> {
    return page.evaluate(() => ((window as any).dataLayer ?? []).map((args: IArguments) => Array.from(args)))
}
