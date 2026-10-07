import type { Page } from "@playwright/test"
import { Calculator } from "../calculator"

// Selectors for the Byproducts bar (#byproducts) and the markers it leaves
// on the table/graph/footer. S.byproducts, S.footerSendout and the table/
// graph/detail selectors already live in the shared selectors.ts; these are
// the ones specific to this area, kept here so a rewrite only has to update
// one file to prove it still behaves the same.
export const BP = {
    bar: ".bp-bar",
    block: ".bp-block",
    title: ".bp-title",
    line: ".bp-line",
    dismiss: ".bp-dismiss",
    fixes: ".bp-fixes",
    fix: ".bp-fix",
    fixButton: (kind: "allow" | "avoid" | "out") => `.bp-fix [data-fix="${kind}"]`,
    best: ".badge.best",
    none: ".bp-none",
    done: ".bp-done",
    doneText: ".bp-done-text",
    undo: ".bp-undo",
    hidden: ".bp-hidden",
    hiddenText: ".bp-hidden-text",
    show: ".bp-show",
} as const

// A row's small output icons (multi-output rows) and its "backs up" /
// "sends out N" markers.
export const ROW = {
    outputIcon: ".outs .out[data-output]",
    backsUp: ".bp-marker",
    source: ".seg.source",
} as const

// Oil refining with every cracking recipe switched off: advanced oil
// processing's heavy oil and light oil have nowhere to go.
export const NO_CRACKING = "items=plastic-bar:r:600&disable=basic-oil-processing,heavy-oil-cracking,light-oil-cracking"
// Only light oil is fully used (a huge light-oil target): the same recipe
// now stalls on heavy oil alone, a different item set for the same block.
export const NO_CRACKING_LIGHT_USED = "items=plastic-bar:r:600,light-oil:r:5000&disable=basic-oil-processing,heavy-oil-cracking,light-oil-cracking"
// Coal liquefaction (Space Age's other source of heavy/light oil), cracking
// off and advanced/basic oil processing off so it is the only oil recipe.
export const COAL_LIQUEFACTION = "items=plastic-bar:r:600&disable=basic-oil-processing,advanced-oil-processing,heavy-oil-cracking,light-oil-cracking&enable=coal-liquefaction"
// Yumako processing (Gleba, Space Age): nothing in the plan uses the seed.
export const YUMAKO = "items=yumako-mash:r:60"
// Uranium processing: U-235 is a tiny side product of U-238 ammo nothing uses.
export const URANIUM = "items=uranium-rounds-magazine:r:60"
// A plan with no leftovers at all.
export const BALANCED = "items=plastic-bar:r:600&disable=basic-oil-processing"

export const DISMISSED_KEY = "calc.dismissedByproducts"

export async function dismissedKeys(page: Page): Promise<string[] | null> {
    let raw = await page.evaluate(key => localStorage.getItem(key), DISMISSED_KEY)
    return raw === null ? null : JSON.parse(raw)
}

// The byproducts bar's own view of the plan's recipes, read straight from
// the fragment so a test never has to parse `.bp-fix` text to know what
// changed: the `disable=` set and whether anything is sent out (`out=`).
export async function disableSet(calc: Calculator): Promise<Set<string>> {
    let disable = (await calc.settings()).get("disable") ?? ""
    return new Set(disable ? disable.split(",") : [])
}

export async function outSet(calc: Calculator): Promise<Set<string>> {
    let out = (await calc.settings()).get("out") ?? ""
    return new Set(out ? out.split(",") : [])
}
