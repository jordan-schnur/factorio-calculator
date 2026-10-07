// SPDX-License-Identifier: Apache-2.0 · Copyright 2019-2021 Kirk McDonald
import { spec } from "./factory.js"

// tab events
//
// The page is one screen now (the flow graph); there is no tab strip left to
// click. These exports survive only because fragment.js still writes/reads a
// `tab=` key (for links minted before the redesign) and needs a constant tab
// name to compare against -- see fragment.js and init.js's applyPageState.

export const DEFAULT_TAB = "flow"

// Fragments written before the redesign name two of the tabs differently;
// links from the plan tool and from board cards must keep working.
const TAB_ALIASES = new Map([
    ["totals", "factory"],
    ["graph", "flow"],
])

const TABS = ["factory", "flow", "where", "settings"]

export function tabName(raw) {
    let name = TAB_ALIASES.get(raw) || raw
    return TABS.includes(name) ? name : DEFAULT_TAB
}

export let currentTab = DEFAULT_TAB

// shared events

export function toggleIgnoreHandler(event, d) {
    spec.toggleIgnore(d.item)
    spec.updateSolution()
}
