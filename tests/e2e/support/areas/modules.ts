// Selectors and helpers for the modules area: the table/graph strips, the
// Settings -> Modules drawer, and the row/machine module editor. Kept out of
// the shared support/selectors.ts per the harness rules; import from here.
import { expect, type Locator, type Page } from "@playwright/test"
import type { Calculator } from "../calculator"

export const MS = {
    // Table & graph strips (itemtable.js, flow.js, modules-strip.js)
    modulesBar: "#modules-bar",
    // Relative to a locator already scoped to #modules-bar (modulesBar()).
    mbChange: ".mb-change",
    mbHand: ".mb-hand",
    mbReset: ".mb-reset",
    rowMods: (item: string) => `#item-table .lrow[data-item="${item}"] .mods`,
    modSlot: ".modslot",
    modSlotEmpty: ".modslot.empty",
    beaconBadge: ".beaconbadge",
    handTag: ".tag.hand",
    modsNote: ".mods-note",
    sectHeader: "#item-table .sect",

    graphCardMods: (node: string) => `#flow-nodes .node[data-node="${node}"] .mods`,

    // Settings -> Modules (modules-settings.js)
    settingsModules: "#settings-modules",
    msKind: (value: string) => `#ms-kind button[data-value="${value}"]`,
    msFallback: (value: string) => `#ms-fallback button[data-value="${value}"]`,
    msTier: (value: string) => `#ms-tier button[data-value="${value}"]`,
    msBeacon: (value: string) => `#ms-beacon button[data-value="${value}"]`,
    // Relative to a locator already scoped to #settings-modules.
    msPlus: ".ms-plus",
    msMinus: ".ms-minus",
    msCount: ".ms-count",
    msSummary: ".ms-summary",
    msFellback: ".ms-fellback",
    msReal: ".ms-real",
    msRow: (attr: "recipe" | "machine", key: string) => `.ms-row[data-${attr}="${key}"]`,
    msRows: (attr: "recipe" | "machine") => `.ms-row[data-${attr}]`,
    msChange: ".ms-change",
    msUsePlan: ".ms-useplan",
    msReset: ".ms-reset",
    msResetAll: "#modules-reset-all",
    msHand: ".ms-hand",
    modulesResetAll: "#modules-reset-all",

    // Row/machine module editor (modules-editor.js)
    editor: ".modeditor",
    rowEditor: ".detail .modeditor",
    graphSideEditor: "#graph-side .modeditor",
    // Relative to a locator already scoped to .modeditor.
    scopeRadio: (value: "row" | "machine" | "plan") => `input[type=radio][value="${value}"]`,
    meSlot: (i: number) => `.me-slot[data-slot="${i}"]`,
    meBeaconSlot: (i: number) => `.me-bslot[data-beacon="${i}"]`,
    mePick: (module: string | null) => `.me-pick[data-module="${module ?? "null"}"]`,
    mePlus: ".me-plus",
    meMinus: ".me-minus",
    meBack: ".me-back",
    meCount: ".me-count",
    meCell: (cell: "none" | "plan" | "these") => `.me-cell[data-cell="${cell}"]`,
    meMachines: (cell: "none" | "plan" | "these") => `.me-cell[data-cell="${cell}"] .me-machines`,
    meModuleTier: (tier: string) => `.me-module-tier button[data-tier="${tier}"]`,
    meBeaconTier: (tier: string) => `.me-beacon-tier button[data-tier="${tier}"]`,
    meNote: ".me-note",
    meFloor: ".me-floor",
    meScope: ".me-scope",
    meScopeNote: ".me-scope-note",
    meSource: ".me-source",
} as const

// A plan that feeds chemical-science-pack (4-slot AM3, takes productivity),
// engine-unit (its own AM3 ingredient, 4 slots), sulfur (3-slot chemical
// plant), pipe (AM3, no productivity on its recipe) and water (an offshore
// pump, no module slots). Base fragment every spec in this area builds on.
export const CHEM = "items=chemical-science-pack:r:60&buildings=assembling-machine-3&nomach=cryogenic-plant"
export const OPEN_CHEM = `${CHEM}&item=chemical-science-pack`

export function modulesBar(page: Page): Locator {
    return page.locator(MS.modulesBar)
}

export async function openModulesSettings(calc: Calculator): Promise<Locator> {
    await calc.openSettings()
    return calc.page.locator(MS.settingsModules)
}

// Opens a row's detail band and returns its module editor root
// (div.modeditor[data-scope="row"]).
export async function openRowEditor(calc: Calculator, item: string): Promise<Locator> {
    let detail = await calc.openRow(item)
    let editor = detail.locator(MS.editor)
    await expect(editor).toBeVisible()
    return editor
}

// Picks the "Use these modules for" radio inside an editor. Flipping it
// alone never writes to the fragment -- only the edit that follows does.
export async function chooseScope(editor: Locator, value: "row" | "machine" | "plan") {
    await editor.locator(MS.scopeRadio(value)).check()
}

export async function pickModule(editor: Locator, module: string | null) {
    await editor.locator(MS.mePick(module)).click()
}
