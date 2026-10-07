import { type Locator, type Page } from "@playwright/test"

// Quality (calculator 1.3.0): machine tiers, module/beacon tiers and the
// badge they draw on an icon. Selectors and small readers for the quality
// unit's specs; everything else goes through calculator.ts / selectors.ts.

// The base plan every quality spec builds on: chemical-science-pack and
// engine-unit run in an assembling machine 3 (4 slots), sulfur in a
// chemical plant (3 slots), water from an offshore pump (0 slots), pipe
// takes no productivity. Mirrors the inventory's CHEM fragment.
export const CHEM = "items=chemical-science-pack:r:60&buildings=assembling-machine-3&nomach=cryogenic-plant"
export const OPEN_CHEM = `${CHEM}&item=chemical-science-pack`

export const QS = {
    // Table row machine cell.
    machineQbadge: ".machines img.qbadge",
    machineSlotIcon: ".machines .slot img",

    // Row detail: the "Every <machine> in this build" tier picker.
    detailMachineQuality: ".detail .machine-quality",
    detailMachineQualityNote: ".detail .machine-quality .muted",

    // Settings drawer -> Machines -> Quality.
    settingsMachineQuality: "#machine_quality",
    settingsMachineQualityRow: (machine: string) => `#machine_quality .mq-row[data-machine="${machine}"]`,

    // Any tier picker (row, drawer or editor): five buttons, data-tier.
    tierButton: (tier: string) => `button[data-tier="${tier}"]`,
    tierButtonOn: "button.on",

    // Settings -> Modules: plan module/beacon quality pickers.
    msModuleTier: "#ms-mtier",
    msBeaconTier: "#ms-btier",
    msMachinesRow: (machine: string) => `#settings-modules .ms-machines .ms-row[data-machine="${machine}"]`,
    msMachinesRowBadge: (machine: string) => `#settings-modules .ms-machines .ms-row[data-machine="${machine}"] .modstrip img.qbadge`,

    // Row/machine module editor (.detail .modeditor or the settings one).
    editor: ".modeditor",
    meModuleTier: ".me-module-tier",
    meBeaconTier: ".me-beacon-tier",
    meSlotQbadge: ".me-slot img.qbadge",
    mePickQbadge: ".me-pick img.qbadge",
    meNote: ".me-note",
    meScope: (value: "row" | "machine" | "plan") => `.me-scope input[value="${value}"]`,
    mePlus: ".me-plus",

    // Table/graph/bar badges used across the integration checks (Q15).
    tableModsQbadge: "#item-table .mods .modstrip img.qbadge",
    modulesBarQbadge: "#modules-bar img.qbadge",
    graphNodeModsQbadge: (node: string) => `#flow-nodes .node[data-node="${node}"] .mods img.qbadge`,
    graphNodeSubQbadge: (node: string) => `#flow-nodes .node[data-node="${node}"] .sub img.qbadge`,
} as const

// Clicks a tier picker button inside `scope` (a row's picker, the drawer's
// or the editor's) and waits for the click to register as "on".
export async function pickTier(scope: Locator, tier: string) {
    let button = scope.locator(QS.tierButton(tier))
    await button.click()
}

export async function footerTotals(page: Page): Promise<string> {
    return ((await page.locator("#footer-totals").textContent()) ?? "").replace(/\s+/g, " ").trim()
}
