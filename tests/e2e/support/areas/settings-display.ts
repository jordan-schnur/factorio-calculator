import type { Locator, Page } from "@playwright/test"

// Hooks and small helpers for the settings drawer (section 7), the footer
// and scratch pad (section 10), and colour-blind mode (section 11). Kept
// separate from the shared support/selectors.ts per the brief: other units
// own the Modules section and quality pickers inside this same drawer.

export const SD = {
    settingsPanel: "#settings-panel",
    fromSave: "#settings-fromsave",

    // Display
    displayRate: "#display_rate",
    rateRadio: (unit: "s" | "m" | "h") => `#${unit}_rate`,
    rprec: "#rprec",
    cprec: "#cprec",
    decimalFormat: "#decimal_format",
    rationalFormat: "#rational_format",
    fractionBelts: "#fraction_belts",
    decimalBelts: "#decimal_belts",
    colorblindToggle: "#colorblind_toggle",
    beltHoldsToggle: "#belt_holds_toggle",

    // Machines / Recipes
    beltSelector: "#belt_selector",
    beltSummary: "#belt_selector .aside",
    beltButton: (name: string) => `#belt_selector button.slot[title="${name}"]`,
    fuelSelector: "#fuel_selector",
    fuelButton: (name: string) => `#fuel_selector button.slot[title="${name}"]`,
    mprod: "#mprod",
    planetSelector: "#planet_selector",
    planetRadio: (name: string) => `#planet_selector span.radio:has-text("${name}")`,
    recipeToggle: "#recipe_toggles .toggle.recipe",

    // Advanced
    resourceSettings: "#resource_settings",
    resourceInputFor: (alt: string) => `#resource_settings .resource:has(img[alt="${alt}"]) input`,
    titleSetting: "#title_setting",

    // Footer / scratch pad (ids already in support/selectors.ts; re-exported
    // here is unnecessary, specs import S from "../support/selectors").
} as const

// The drawer's top-level sections, in DOM (and so documented) order. "From
// your save" is present but `display:none` under the static server (no
// companion), so it's read from innerHTML, never from the visible text.
export const SECTION_ORDER = ["From your save", "Machines", "Recipes", "Modules", "Display", "Advanced"]

// calc.html nests the Advanced controls in <details>: the outer "Advanced"
// panel, then one <details> per control. Both must be opened (clicking the
// outer alone leaves inner content collapsed and so not clickable).
export async function openAdvanced(page: Page, innerLabel?: string) {
    let outer = page.getByText("Advanced", { exact: true })
    if (!(await outer.locator("..").evaluate(el => (el.closest("details") as HTMLDetailsElement)?.open))) {
        await outer.click()
    }
    if (innerLabel) {
        let inner = page.getByText(innerLabel, { exact: true })
        if (!(await inner.locator("..").evaluate(el => (el.closest("details") as HTMLDetailsElement)?.open))) {
            await inner.click()
        }
    }
}

// Number inputs here are wired to a plain `onchange`, which some automated
// `fill()`s don't reliably fire without an explicit blur afterwards (unlike
// text inputs such as #title_setting, which do). Every numeric setting in
// this drawer (rprec, cprec, mprod, resource weights) goes through this.
export async function setNumber(locator: Locator, value: string) {
    await locator.fill(value)
    await locator.blur()
}

export async function clickPlanet(page: Page, name: string, { shift = false }: { shift?: boolean } = {}) {
    await page.locator(SD.planetRadio(name)).click(shift ? { modifiers: ["Shift"] } : {})
}
