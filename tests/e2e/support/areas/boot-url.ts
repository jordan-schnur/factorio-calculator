import type { Page } from "@playwright/test"
import { canonical } from "../fragment"
import type { Calculator } from "../calculator"

// Boot/intro/title/hash bookkeeping, Kirk compatibility, static-mode
// companion controls, analytics, and the full fragment contract (Appendix
// A/C/D of the inventory). Shared by tests/e2e/specs/boot-url*.spec.ts.

// --- Share-link round trip --------------------------------------------------

export interface RoundTrip {
    hash1: string
    hash2: string
    fragment1: Record<string, string>
    fragment2: Record<string, string>
    rows1: Awaited<ReturnType<Calculator["tableRows"]>>
    rows2: Awaited<ReturnType<Calculator["tableRows"]>>
}

// Opens `fragment`, reads back the hash the page writes for it, then opens
// that written hash on a fresh page (never a hashchange) and reads it again.
// A player who reloads or re-pastes the link the page gave them must land on
// the identical plan.
export async function roundTrip(calc: Calculator, fragment: string, query?: string): Promise<RoundTrip> {
    let opts = query !== undefined ? { query } : undefined
    await calc.open(fragment, opts)
    let hash1 = await calc.hash()
    let rows1 = await calc.tableRows()
    await calc.page.goto("about:blank")
    await calc.open(hash1.slice(1), opts)
    let hash2 = await calc.hash()
    let rows2 = await calc.tableRows()
    return { hash1, hash2, fragment1: canonical(hash1), fragment2: canonical(hash2), rows1, rows2 }
}

// --- Static-mode companion controls -----------------------------------------

// Every ".needs-companion" element on the page, with its computed display.
// On a static host (no /api/catalog) every one of them must compute to
// "none", wherever it lives (topbar, intro, settings drawer).
export async function needsCompanionDisplays(page: Page): Promise<{ id: string; display: string }[]> {
    return page.locator(".needs-companion").evaluateAll(els =>
        els.map(el => ({ id: (el as HTMLElement).id || el.className, display: getComputedStyle(el).display })))
}

// --- Dataset requests --------------------------------------------------------

// Watches which `data/*.json` dataset files the page fetches, keyed by the
// JSON filename (Appendix D), so a `data=` key can be proved to load the
// right dataset without touching d3 or settings.js internals. Excludes
// data/catalog.json, the search box's own fixed lookup table.
export function watchDatasetRequests(page: Page): string[] {
    let files: string[] = []
    page.on("request", request => {
        let match = request.url().match(/\/data\/([^/?]+\.json)$/)
        if (match && match[1] !== "catalog.json") files.push(match[1])
    })
    return files
}
