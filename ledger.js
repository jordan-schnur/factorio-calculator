// calc/ledger.js — the Ledger side panel: one row per item in the current
// solution (built here, mined, or brought in), replacing the old Factory
// table/Inputs frame split.
import { spec } from "./factory.js"
import { machineWord, pluralise, beltText } from "./flow-core.js"
import { registerRenderer } from "./render.js"
import { buildRows } from "./table.js"
import { RATE_LABEL } from "./table-core.js"

function rateText(rate) {
    return spec.format.rate(rate) + (RATE_LABEL[spec.format.rateName] || "/min")
}

// Groups a row belongs to only one of: target, real-and-built, supplied,
// resource -- classified in that priority order so a row that happens to
// be both a target and mined (the user targeted a raw resource directly)
// still lands in "target", not duplicated into "resource" too.
function orderRows(rows) {
    const used = new Set()
    const take = pred => {
        const picked = rows.filter(r => !used.has(r) && pred(r))
        picked.forEach(r => used.add(r))
        return picked
    }
    const targets = take(r => r.isTarget)
    const built = take(r => r.isReal && !r.isResource).sort((a, b) => b.rate - a.rate)
    const supplied = take(r => !r.isReal)
    const resources = take(r => r.isResource)
    return [...targets, ...built, ...supplied, ...resources]
}

function machinesCell(row) {
    const cell = document.createElement("span")
    cell.className = "machines num muted"
    if (!row.isReal) {
        cell.textContent = row.item.phase === "fluid" ? "pipe" : beltText(spec.getBeltCount(row.itemRate).toFloat())
        return cell
    }
    const building = spec.getBuilding(row.recipe)
    if (building === null) {
        return cell
    }
    cell.appendChild(building.icon.make(18, true))
    const count = Math.ceil(spec.getCount(row.recipe, row.recipeRate).toFloat())
    cell.appendChild(document.createTextNode(" " + pluralise(count, machineWord(building))))
    return cell
}

function toggleSupplied(item) {
    document.dispatchEvent(new CustomEvent("calc:toggle-supplied", { detail: { item: item.key } }))
}

function sourceCell(row) {
    const cell = document.createElement("span")
    cell.className = "source"
    if (row.isTarget) {
        const badge = document.createElement("span")
        badge.className = "badge target"
        badge.textContent = "target"
        cell.appendChild(badge)
        return cell
    }
    if (row.isResource) {
        const fluid = row.item.phase === "fluid"
        const badge = document.createElement("span")
        badge.className = fluid ? "badge pipe" : "badge mine"
        badge.textContent = fluid ? "piped in" : "mined"
        cell.appendChild(badge)
        return cell
    }
    const seg = document.createElement("span")
    seg.className = "seg"
    const here = document.createElement("button")
    here.textContent = "here"
    const bringIn = document.createElement("button")
    bringIn.textContent = "bring in"
    if (row.isReal) {
        here.className = "on"
    } else {
        bringIn.className = "on in"
    }
    here.addEventListener("click", event => {
        event.stopPropagation()
        if (!row.isReal) toggleSupplied(row.item)
    })
    bringIn.addEventListener("click", event => {
        event.stopPropagation()
        if (row.isReal) toggleSupplied(row.item)
    })
    seg.appendChild(here)
    seg.appendChild(bringIn)
    // Also guard the wrapper: a click on its own padding (not either
    // button) must not fall through to the row's focus-node handler.
    seg.addEventListener("click", event => event.stopPropagation())
    cell.appendChild(seg)
    return cell
}

function renderRow(row) {
    const div = document.createElement("div")
    div.className = "lrow" + (!row.isReal ? " dim" : "") + (row.item.key === spec.whereItem ? " sel" : "")
    div.dataset.item = row.item.key

    const item = document.createElement("span")
    item.className = "item"
    const slot = document.createElement("span")
    slot.className = "slot sm"
    slot.appendChild(row.item.icon.make(22, true))
    item.appendChild(slot)
    const name = document.createElement("span")
    name.className = "name"
    name.textContent = row.name
    item.appendChild(name)
    div.appendChild(item)

    const need = document.createElement("span")
    need.className = "need num"
    need.textContent = rateText(row.itemRate)
    div.appendChild(need)

    div.appendChild(sourceCell(row))
    div.appendChild(machinesCell(row))

    div.addEventListener("click", () => {
        document.dispatchEvent(new CustomEvent("calc:focus-node", { detail: { item: row.item.key } }))
    })

    return div
}

function renderLedger(spec, totals) {
    const container = document.getElementById("ledger-rows")
    if (!container) {
        return
    }
    container.innerHTML = ""
    for (const row of orderRows(buildRows(totals))) {
        container.appendChild(renderRow(row))
    }
}

// header.js owns whether #ledger is hidden; this only reports the click.
function bindClose() {
    const close = document.getElementById("ledger-close")
    if (close) {
        close.addEventListener("click", () => {
            document.dispatchEvent(new CustomEvent("calc:ledger", { detail: { open: false } }))
        })
    }
}

// Selection changes elsewhere (a flow-node click, details close) should
// highlight the matching row without a full re-render, which would lose
// scroll position.
function bindSelect() {
    document.addEventListener("calc:select", event => {
        const item = event.detail && event.detail.item
        document.querySelectorAll("#ledger-rows .lrow.sel").forEach(el => el.classList.remove("sel"))
        if (item) {
            const row = document.querySelector(`#ledger-rows .lrow[data-item="${item}"]`)
            if (row) {
                row.classList.add("sel")
            }
        }
    })
}

export function initLedger() {
    registerRenderer(renderLedger)
    bindClose()
    bindSelect()
}
