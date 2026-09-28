/*Copyright 2019-2021 Kirk McDonald

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.*/
import { spec } from "./factory.js"
import { Rational } from "./rational.js"
import { setTitle } from "./settings.js"
import { setColorblind } from "./colorblind.js"

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

// setting events

export function changeTitle(event) {
    setTitle(event.target.value)
    spec.setHash()
}

export function changeRatePrecision(event) {
    spec.format.ratePrecision = Number(event.target.value)
    spec.display()
}

export function changeCountPrecision(event) {
    spec.format.countPrecision = Number(event.target.value)
    spec.display()
}

export function changeFormat(event) {
    spec.format.displayFormat = event.target.value
    spec.display()
}

export function changeBeltFormat(event) {
    spec.format.beltFormat = event.target.value
    spec.setHash()
}

export function changeColorblind(event) {
    setColorblind(event.target.checked)
}

export function changeMprod(event) {
    spec.miningProd = Rational.from_string(event.target.value).div(Rational.from_float(100))
    spec.updateSolution()
}
