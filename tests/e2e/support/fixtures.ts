import { test as base, expect } from "@playwright/test"
import { readFileSync } from "node:fs"
import { basename, join } from "node:path"
import { Calculator } from "./calculator"

const FONTS = join(__dirname, "..", "fixtures", "fonts")

// Problems the page reports that a test did not ask for. Every test fails
// on a page error or console error unless it allows it, so a rewrite that
// throws somewhere off the asserted path still turns the run red.
export class PageErrors {
    readonly seen: string[] = []
    private allowed: RegExp[] = [
        // Static hosting: the companion probe (GET /api/catalog) 404s by design.
        /\/api\/catalog/,
    ]

    allow(pattern: RegExp) {
        this.allowed.push(pattern)
    }

    record(text: string) {
        if (!this.allowed.some(p => p.test(text))) this.seen.push(text)
    }

    unexpected(): string[] {
        return this.seen.filter(text => !this.allowed.some(p => p.test(text)))
    }
}

type Fixtures = {
    calc: Calculator
    pageErrors: PageErrors
    externalRequests: string[]
}

export const test = base.extend<Fixtures>({
    externalRequests: async ({}, use) => {
        await use([])
    },

    pageErrors: async ({}, use) => {
        await use(new PageErrors())
    },

    page: async ({ page, baseURL, pageErrors, externalRequests }, use) => {
        let origin = new URL(baseURL!).origin
        // Nothing leaves the machine: the Google Fonts stylesheet and files
        // are answered from tests/e2e/fixtures/fonts (so text renders the
        // same in every run and screenshot), anything else external is
        // refused and recorded.
        await page.route(url => url.origin !== origin, async route => {
            let url = new URL(route.request().url())
            if (url.hostname === "fonts.googleapis.com") {
                return route.fulfill({ contentType: "text/css", body: readFileSync(join(FONTS, "titillium.css")) })
            }
            if (url.hostname === "fonts.gstatic.com") {
                return route.fulfill({ contentType: "font/woff2", body: readFileSync(join(FONTS, basename(url.pathname))) })
            }
            externalRequests.push(url.href)
            return route.abort("blockedbyclient")
        })
        page.on("pageerror", err => pageErrors.record(`pageerror: ${err.message}`))
        page.on("console", msg => {
            if (msg.type() === "error") {
                pageErrors.record(`console: ${msg.text()} @ ${msg.location().url}`)
            }
        })
        await use(page)
        expect(pageErrors.unexpected(), "unexpected page/console errors").toEqual([])
    },

    calc: async ({ page }, use) => {
        await use(new Calculator(page))
    },
})

export { expect }
