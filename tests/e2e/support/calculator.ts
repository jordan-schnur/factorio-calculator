import { expect, type Locator, type Page } from "@playwright/test"
import { S } from "./selectors"
import { canonical, decodeFragment, parseFragment } from "./fragment"

// The page as a player sees it. Specs go through this object, so a rewrite
// of the page only has to keep these methods answering the same way.

export const PAGE = process.env.CALC_PAGE || "/calc.html"

export interface Row {
    item: string
    group: string
    name: string
    badges: string[]
    need: string
    belts: string
    machines: string
    machineName: string
}

export interface Node {
    node: string
    name: string
    sub: string
    rate: string
}

export class Calculator {
    constructor(readonly page: Page) {}

    // Open the page on a plan. `fragment` is everything after "#" (or ""),
    // `query` everything after "?". The landing background is off by default
    // (?bg=none): it shows screenshots in a random order.
    async open(fragment = "", { query = "bg=none", wait = true }: { query?: string; wait?: boolean } = {}) {
        let url = PAGE + (query ? "?" + query : "") + (fragment ? "#" + fragment : "")
        await this.page.goto(url)
        if (wait) await this.ready()
    }

    // Settled: data loaded, solved and drawn. Either the intro shows (no
    // targets) or the table/graph has its rows, and the fragment has been
    // rewritten by the page.
    // The intro is in the static markup, so it alone doesn't prove boot;
    // network idle does (the dataset JSON has arrived and been solved).
    async ready() {
        await this.page.waitForLoadState("load")
        await this.page.waitForLoadState("networkidle")
        await expect.poll(async () => {
            let intro = await this.page.locator(S.makePanelIntro).count()
            let rows = await this.page.locator(S.row).count()
            let nodes = await this.page.locator(S.graphNode).count()
            return intro > 0 || rows > 0 || nodes > 0
        }, { message: "page never settled on the intro, a table or a graph" }).toBe(true)
        await this.page.evaluate(() => document.fonts.ready)
    }

    // --- Fragment ---------------------------------------------------------

    async hash(): Promise<string> {
        return this.page.evaluate(() => location.hash)
    }

    async settings(): Promise<Map<string, string>> {
        return parseFragment(await this.hash())
    }

    async decodedHash(): Promise<string> {
        return decodeFragment(await this.hash())
    }

    async canonicalHash(): Promise<Record<string, string>> {
        return canonical(await this.hash())
    }

    // Wait until the page has written a fragment that satisfies `check`.
    async expectSetting(key: string, value: string | null) {
        await expect.poll(async () => (await this.settings()).get(key) ?? null, { message: `fragment ${key}=` }).toBe(value)
    }

    // --- Intro & targets ---------------------------------------------------

    isIntro(): Locator {
        return this.page.locator(S.makePanelIntro)
    }

    async search(text: string) {
        let box = this.page.locator(S.search)
        await box.click()
        await box.fill(text)
    }

    async addBySearch(text: string) {
        await this.search(text)
        await this.page.locator(S.search).press("Enter")
        await this.ready()
    }

    // --- Table -------------------------------------------------------------

    rows(): Locator {
        return this.page.locator(S.row)
    }

    row(item: string): Locator {
        return this.page.locator(S.rowFor(item))
    }

    // Every row with the group it sits under ("Build here", ...), in order.
    async tableRows(): Promise<Row[]> {
        return this.page.locator(S.table).evaluate((table, S) => {
            let out: any[] = []
            let group = ""
            let text = (el: Element | null) => (el?.textContent ?? "").replace(/\s+/g, " ").trim()
            for (let el of Array.from(table.querySelectorAll(`${S.sect}, ${S.row}`))) {
                if (el.matches(S.sect)) {
                    group = text(el.querySelector(".lbl"))
                    continue
                }
                let need = el.querySelector(S.need)
                let belts = need?.querySelector(".belts")
                out.push({
                    item: (el as HTMLElement).dataset.item,
                    group,
                    name: text(el.querySelector(S.name)),
                    badges: Array.from(el.querySelectorAll(S.badge)).map(b => text(b)),
                    need: text(need).replace(text(belts), "").trim(),
                    belts: text(belts),
                    machines: text(el.querySelector(S.cnt)),
                    machineName: text(el.querySelector(S.mname)),
                })
            }
            return out
        }, { sect: S.sectionHeader.replace("#item-table ", ""), row: S.row.replace("#item-table ", ""),
             name: S.rowName, badge: S.rowBadge, need: S.rowNeed, cnt: S.rowMachineCount, mname: S.rowMachineName })
    }

    async rowItems(): Promise<string[]> {
        return (await this.tableRows()).map(r => r.item)
    }

    async openRow(item: string): Promise<Locator> {
        await this.row(item).click()
        let detail = this.page.locator(`${S.rowFor(item)} + ${S.detail}`)
        await expect(detail).toBeVisible()
        return detail
    }

    // --- Graph -------------------------------------------------------------

    async switchView(view: "table" | "graph") {
        await this.page.locator(S.viewButton(view)).click()
        if (view === "graph") {
            await expect(this.page.locator(S.graphFrame)).toBeVisible()
            await expect(this.page.locator(S.graphNode).first()).toBeVisible()
        } else {
            await expect(this.page.locator(S.tableFrame)).toBeVisible()
        }
    }

    graphNode(node: string): Locator {
        return this.page.locator(S.graphNodeFor(node))
    }

    async graphNodes(): Promise<Node[]> {
        let nodes = await this.page.locator(S.graphNode).evaluateAll((els, S) => {
            let text = (el: Element | null) => (el?.textContent ?? "").replace(/\s+/g, " ").trim()
            return els.map(el => ({
                node: (el as HTMLElement).dataset.node!,
                name: text(el.querySelector(S.name)),
                sub: text(el.querySelector(S.sub)),
                rate: text(el.querySelector(S.rate)),
            }))
        }, { name: S.graphNodeName, sub: S.graphNodeSub, rate: S.graphNodeRate })
        return nodes.sort((a, b) => a.node.localeCompare(b.node))
    }

    // --- Footer ------------------------------------------------------------

    async footer(): Promise<{ totals: string; bring: string }> {
        let text = async (sel: string) => ((await this.page.locator(sel).textContent()) ?? "").replace(/\s+/g, " ").trim()
        return { totals: await text(S.footerTotals), bring: await text(S.footerBring) }
    }

    // --- Settings ----------------------------------------------------------

    async openSettings(): Promise<Locator> {
        await this.page.locator(S.settingsOpen).click()
        let drawer = this.page.locator(S.settingsDrawer)
        await expect(drawer).toBeVisible()
        return drawer
    }

    async closeSettings() {
        await this.page.locator(S.settingsClose).click()
        await expect(this.page.locator(S.settingsDrawer)).toBeHidden()
    }
}
