// calc/search.js — the "Targets" search box (nickname typeahead + Enter to
// add) and the "Browse" item grid. DOM-facing counterpart of search-core.js.
import { spec } from "./factory.js"
import { Rational } from "./rational.js"
import { parseQuery, datasetEntries, mergeEntries } from "./search-core.js"
import { rankMatches } from "/board/boardcore.js"

const RESULT_LIMIT = 8

let catalogPromise = null

// Memoised: every caller (this module, calc/board.js) shares one fetch.
export async function fetchCatalog() {
    if (!catalogPromise) {
        catalogPromise = fetch("/api/catalog")
            .then(resp => resp.ok ? resp.json() : { entries: [] })
            .then(data => (data && data.entries) || [])
            .catch(() => [])
    }
    return catalogPromise
}

let entries = []
let visibleRows = []
let highlighted = -1

function datasetItemEntries() {
    let out = []
    for (let item of spec.items.values()) {
        if (item.recipes.length > 0 || item.uses.length) {
            out.push({ key: item.key, localized_name: { en: item.name } })
        }
    }
    return out
}

async function loadEntries() {
    let catalog = await fetchCatalog()
    entries = mergeEntries(catalog, datasetEntries(datasetItemEntries()))
}

function perMinuteToPerSecond(perMinute) {
    return Rational.from_float(perMinute).div(Rational.from_float(60))
}

function addTargetAtPerSecond(itemKey, rate) {
    let target = spec.addTarget(itemKey)
    target.setRate(rate)
    spec.updateSolution()
    return target
}

function closeResults() {
    let container = document.getElementById("target-search-results")
    container.innerHTML = ""
    visibleRows = []
    highlighted = -1
}

function renderResults(rows) {
    visibleRows = rows
    highlighted = rows.length ? 0 : -1
    paintResults()
}

function paintResults() {
    let container = document.getElementById("target-search-results")
    container.innerHTML = ""
    visibleRows.forEach((entry, i) => {
        let row = document.createElement("div")
        row.className = "row"
        if (i === highlighted) {
            row.setAttribute("style", "background:#e39827;color:#1f1f1f")
        }
        let slot = document.createElement("span")
        slot.className = "slot slot-sm"
        let item = spec.items.get(entry.name)
        if (item) {
            slot.appendChild(item.icon.make(20, true))
        }
        row.appendChild(slot)
        let label = document.createElement("span")
        label.className = "h"
        if (i === highlighted) {
            label.style.color = "#1f1f1f"
        }
        label.textContent = entry.label
        row.appendChild(label)
        if (entry.matchedAlias) {
            let alias = document.createElement("span")
            alias.className = "muted"
            alias.style.marginLeft = "auto"
            alias.style.fontSize = "13px"
            alias.textContent = entry.matchedAlias
            row.appendChild(alias)
        }
        row.addEventListener("mousedown", event => {
            event.preventDefault()
            pick(entry)
        })
        container.appendChild(row)
    })
}

function pick(entry) {
    let input = document.getElementById("target-search")
    let { rate } = parseQuery(input.value)
    let perDisplayUnit = rate === null ? 60 : rate
    addTargetAtPerSecond(entry.name, Rational.from_float(perDisplayUnit).div(spec.format.rateFactor))
    input.value = ""
    closeResults()
}

function onSearchInput(event) {
    let { query } = parseQuery(event.target.value)
    if (!query) {
        closeResults()
        return
    }
    renderResults(rankMatches(entries, query, null, RESULT_LIMIT))
}

function onSearchKeydown(event) {
    if (event.key === "ArrowDown") {
        if (visibleRows.length) {
            highlighted = (highlighted + 1) % visibleRows.length
            paintResults()
        }
        event.preventDefault()
    } else if (event.key === "ArrowUp") {
        if (visibleRows.length) {
            highlighted = (highlighted - 1 + visibleRows.length) % visibleRows.length
            paintResults()
        }
        event.preventDefault()
    } else if (event.key === "Enter") {
        if (highlighted >= 0) {
            pick(visibleRows[highlighted])
        } else if (visibleRows.length === 1) {
            pick(visibleRows[0])
        }
        event.preventDefault()
    } else if (event.key === "Escape") {
        closeResults()
    }
}

let activeGroup = 0

function renderBrowse() {
    let container = document.getElementById("target-browse")
    container.innerHTML = ""
    if (!spec.itemGroups || spec.itemGroups.length === 0) {
        return
    }
    if (activeGroup >= spec.itemGroups.length) {
        activeGroup = 0
    }
    let tabs = document.createElement("div")
    tabs.style.display = "flex"
    tabs.style.gap = "2px"
    tabs.style.padding = "0 0 6px"
    spec.itemGroups.forEach((group, i) => {
        let firstItem = group.find(sub => sub.length > 0)
        if (!firstItem) {
            return
        }
        let tab = document.createElement("span")
        tab.className = "tab" + (i === activeGroup ? " on" : "")
        tab.textContent = groupLabel(firstItem[0].group)
        tab.addEventListener("click", () => {
            activeGroup = i
            renderBrowse()
        })
        tabs.appendChild(tab)
    })
    container.appendChild(tabs)

    let grid = document.createElement("div")
    grid.className = "deep"
    grid.style.display = "flex"
    grid.style.flexWrap = "wrap"
    grid.style.gap = "4px"
    for (let subgroup of spec.itemGroups[activeGroup]) {
        for (let item of subgroup) {
            let slot = document.createElement("span")
            slot.className = "slot slot-lg"
            slot.appendChild(item.icon.make(34, false))
            slot.addEventListener("click", () => addTargetAtPerSecond(item.key, perMinuteToPerSecond(60)))
            grid.appendChild(slot)
        }
    }
    container.appendChild(grid)
}

// The dataset's internal group keys ("intermediate-products") have no
// separate display name; title-case the key the way the mockup's tab labels
// read ("Intermediates" is the exception -- Kirk's own key already reads
// that way once hyphens become spaces and each word is capitalized).
function groupLabel(key) {
    return key.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())
}

export function initSearch() {
    loadEntries()

    let input = document.getElementById("target-search")
    input.addEventListener("input", onSearchInput)
    input.addEventListener("keydown", onSearchKeydown)
    input.addEventListener("blur", () => setTimeout(closeResults, 150))

    // Browse only depends on spec.itemGroups (already loaded by the time
    // initSearch() runs), not on the catalog fetch above, and its own tab
    // clicks already re-render it -- it does not need to run on every solve.
    renderBrowse()
}
