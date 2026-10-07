import { expect, type Locator, type Page } from "@playwright/test"
import { S } from "../selectors"
import type { Calculator } from "../calculator"

// Search box + results dropdown + the target rows in #targets, and the
// example chips that add to it. Local selectors for the bits of those rows
// that selectors.ts doesn't name (no ids on a repeatable row).

export const AS = {
    resultRow: `${S.searchResults} > div.row`,
    resultHot: `${S.searchResults} > div.row.hot`,
    resultFor: (item: string) => `${S.searchResults} > div.row[data-item="${item}"]`,

    targetRow: `${S.targets} > li.target`,
    targetInput: "input.num",
    targetUnit: "select",
    targetRemove: ".btn-red",
} as const

export class SearchTargetsArea {
    constructor(readonly page: Page, readonly calc: Calculator) {}

    results(): Locator {
        return this.page.locator(AS.resultRow)
    }

    hotResult(): Locator {
        return this.page.locator(AS.resultHot)
    }

    targetRows(): Locator {
        return this.page.locator(AS.targetRow)
    }

    // A target row, found by the item name text it shows (there is no
    // data-item on the row itself -- that lives on the icon only).
    targetRowNamed(name: string): Locator {
        return this.page.locator(AS.targetRow).filter({ hasText: name })
    }

    numInput(row: Locator): Locator {
        return row.locator(AS.targetInput)
    }

    unitSelect(row: Locator): Locator {
        return row.locator(AS.targetUnit)
    }

    removeButton(row: Locator): Locator {
        return row.locator(AS.targetRemove)
    }

    async removeRow(row: Locator) {
        await this.removeButton(row).click()
    }

    // Sets a row's numeric field and commits it the way a player does:
    // type, then move focus away so the "change" handler fires.
    async setField(row: Locator, value: string) {
        let input = this.numInput(row)
        await input.fill(value)
        await input.press("Tab")
    }

    async setUnit(row: Locator, unit: string) {
        await this.unitSelect(row).selectOption(unit)
    }
}
