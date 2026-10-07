import type { Locator, Page } from "@playwright/test"
import { expect } from "../fixtures"

// Table-and-details hooks and helpers specific to this unit (item table
// groups/badges/machines column, and a row's opened detail: Needs/Goes to/
// Source, recipe and machine pickers, hover cards). calculator.ts and
// selectors.ts already carry the generic row/open/footer/settings plumbing
// every area shares; this file only adds what table-details needs on top.

export const TD = {
    sect: "#item-table .sect",
    sectLabel: "#item-table .sect .lbl",
    row: (item: string) => `#item-table .lrow[data-item="${item}"]`,
    detailFor: (item: string) => `#item-table .lrow[data-item="${item}"] + .detail`,
    openRow: "#item-table .lrow.open",

    // Scoped to an already-open `.detail` locator (calc.openRow's return),
    // so none of these repeat the ".detail" the caller is already inside.
    needsCol: ".col.needs",
    goesToCol: ".col.goesto",
    makesCol: ".col.goesto.makes",
    sourceCol: ".col.source",
    sourceSeg: ".col.source .seg.source",
    makeHereButton: ".col.source .seg.source button",
    recipeOption: ".opt[data-option]",
    recipeOptionFor: (key: string) => `.opt[data-option="${key}"]`,
    ratioLine: ".muted.ratio",
    shareNum: ".share.num",
    flowNum: ".num.flow",
    drow: ".drow",

    machineSlots: ".col.source .machines",
    machineSlot: (key: string) => `.col.source .machines button[data-machine="${key}"]`,
    machineAllButton: ".machine-all",
    machineAutoButton: ".machine-auto",
    exactLine: ".col.source .exact",

    asmSeg: "#asm-seg",
    asmButton: (key: string) => `#asm-seg button[data-building="${key}"]`,
    machineAllow: "#machine_allow",
    machineAllowSlot: (title: string) => `#machine_allow button[title="${title}"]`,
    machineAllowOff: "#machine_allow button.slot.off",

    tooltipCard: "#tooltip_container .tooltip:visible .flow-card",
    tooltipLines: "#tooltip_container .tooltip:visible .flow-card > div",
} as const

// Group label -> the ordered item keys under it, read straight off the
// table (mirrors Calculator.tableRows' own walk, trimmed to just what this
// unit's specs assert groups with).
export async function groupedRows(page: Page): Promise<Record<string, string[]>> {
    return page.locator(TD.sect).first().evaluate(() => {
        let out: Record<string, string[]> = {}
        let group = ""
        for (let el of Array.from(document.querySelectorAll("#item-table .sect, #item-table .lrow"))) {
            if (el.matches(".sect")) {
                group = (el.querySelector(".lbl")?.textContent ?? "").trim()
                out[group] = out[group] ?? []
                continue
            }
            out[group].push((el as HTMLElement).dataset.item!)
        }
        return out
    })
}

// The visible flow-card lines under a hovered rate: belts, "Made by ...",
// and (for a Need-column hover) "Goes to" plus a line per destination. Only
// the currently-shown tooltip counts -- old ones stay in the DOM hidden.
export async function hoverLines(page: Page, target: Locator): Promise<string[]> {
    await target.hover()
    await expect(page.locator(TD.tooltipCard)).toBeVisible()
    return page.locator(TD.tooltipLines).allTextContents()
}

export async function unhover(page: Page) {
    await page.mouse.move(0, 0)
    await expect(page.locator(TD.tooltipCard)).toHaveCount(0)
}
