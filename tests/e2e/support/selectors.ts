// Every DOM hook the suite uses, in one place. The specs talk to the page
// through calculator.ts and these names, never through raw selectors, so a
// rewrite that changes the markup updates this file (and nothing else) to
// prove it still behaves the same. Keep entries to what a player can see or
// do; never reach into module internals or globals.

export const S = {
    // Top bar
    topbar: "#topbar",
    viewSwitch: "#view-seg",
    viewButton: (view: "table" | "graph") => `#view-seg button[data-view="${view}"]`,
    settingsOpen: "#settings-open",
    needsCompanion: ".needs-companion",

    // Make panel: the intro when nothing is planned, the target list after.
    makePanel: "#make-panel",
    makePanelIntro: "#make-panel.intro",
    introTitle: "#intro-title",
    search: "#target-search",
    searchResults: "#target-search-results",
    targets: "#targets",
    targetNotes: "#target-notes",
    exampleTarget: "#intro-extras .example-target",
    restoreLast: "#restore-last",
    introBg: "#intro-bg",

    // Byproducts bar
    byproducts: "#byproducts",

    // Item table
    tableFrame: "#table-frame",
    table: "#item-table",
    modulesBar: "#modules-bar",
    sectionHeader: "#item-table .sect",
    row: "#item-table .lrow[data-item]",
    rowFor: (item: string) => `#item-table .lrow[data-item="${item}"]`,
    rowName: ".item .name",
    rowBadge: ".item .badge",
    rowNeed: ".need",
    rowBelts: ".need .belts",
    rowMachineCount: ".machines .cnt",
    rowMachineName: ".machines .muted",
    rowModules: ".mods",
    detail: ".detail",

    // Graph
    graphFrame: "#graph-frame",
    graphSvg: "#flow",
    graphNode: "#flow-nodes .node[data-node]",
    graphNodeFor: (node: string) => `#flow-nodes .node[data-node="${node}"]`,
    graphNodeName: ".name",
    graphNodeSub: ".sub",
    graphNodeRate: ".rate",
    graphLine: "#flow path",
    graphFit: "#flow-fit",
    graphSide: "#graph-side",

    // Footer
    footer: "#footer",
    footerTotals: "#footer-totals",
    footerBring: "#footer-bring",
    footerSendout: "#footer-sendout",

    // Scratch pad
    scratchpad: "#scratchpad-frame",
    scratchInput: "#scratch-input",
    scratchResult: "#scratch-result",
    scratchHistory: "#scratch-history",
    scratchClear: "#scratch-clear",

    // Settings drawer
    settingsDrawer: "#settings-drawer",
    settingsClose: "#settings-close",

    // About / version
    about: "#about",
    version: ".calc-version",
    tooltip: "#tooltip_container",
} as const
