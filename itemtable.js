// calc/itemtable.js — the item table (#item-table): one row per item in the
// current solution, grouped Build here / Bring in from another build / Mine
// or pipe in, replacing the old Ledger side panel. A row expands into a
// detail panel (calc/details.js) in place instead of opening a side card.
import { spec } from "./factory.js"
import { beltText } from "./flow-core.js"
import { registerRenderer } from "./render.js"
import { buildRows, buildingCount } from "./table.js"
import { groupForTable, RATE_LABEL } from "./table-core.js"
import { itemTooltip, renderDetail } from "./details.js"

// Re-rendered off calc:select rather than a fresh solve, so the graph
// selecting an item (or this table's own row click) can move the open row
// without re-running the solver.
let lastTotals = null

function rateText(rate) {
    return spec.format.rate(rate) + (RATE_LABEL[spec.format.rateName] || "/min")
}

// Consumer-distance from a build target: a target sits at depth 0, and
// every ingredient's depth is one more than the deepest item made from it
// (its consuming recipes' products) -- mirrors flow-core.js's rankOf, but
// over totals.consumers (item -> recipe) instead of a flow-core node graph.
function itemDepths(totals) {
    const targets = new Set(spec.buildTargets.map(t => t.item))
    const depth = new Map()
    const depthOf = item => {
        if (depth.has(item)) {
            return depth.get(item)
        }
        if (targets.has(item)) {
            depth.set(item, 0)
            return 0
        }
        depth.set(item, 0)  // cycle guard, mirrors flow-core's rankOf
        let d = 0
        const consumers = totals.consumers.get(item)
        if (consumers) {
            for (const [recipe] of consumers) {
                for (const product of recipe.products) {
                    d = Math.max(d, depthOf(product.item) + 1)
                }
            }
        }
        depth.set(item, d)
        return d
    }
    for (const item of totals.items.keys()) {
        depthOf(item)
    }
    for (const [recipe] of totals.rates) {
        if (!recipe.isReal()) {
            continue
        }
        for (const product of recipe.products) {
            depthOf(product.item)
        }
    }
    const ranks = new Map()
    for (const [item, d] of depth) {
        ranks.set(item.key, d)
    }
    return ranks
}

function badgeFor(row) {
    if (row.isTarget) return makeBadge("target", "target")
    if (!row.isReal) return makeBadge("in", "brought in")
    if (row.isResource) {
        return row.item.phase === "fluid" ? makeBadge("pipe", "piped in") : makeBadge("mine", "mined")
    }
    return null
}

function makeBadge(cls, text) {
    const badge = document.createElement("span")
    badge.className = "badge " + cls
    badge.textContent = text
    return badge
}

function itemCell(row) {
    const cell = document.createElement("span")
    cell.className = "item"
    const slot = document.createElement("span")
    slot.className = "slot sm"
    slot.appendChild(row.item.icon.make(24, true))
    cell.appendChild(slot)
    const name = document.createElement("span")
    name.className = "name"
    name.textContent = row.name
    cell.appendChild(name)
    const badge = badgeFor(row)
    if (badge) {
        cell.appendChild(badge)
    }
    return cell
}

function needCell(row, totals, rows) {
    const cell = document.createElement("span")
    cell.className = "need num"
    cell.appendChild(document.createTextNode(rateText(row.itemRate)))
    const belts = document.createElement("span")
    belts.className = "belts"
    belts.textContent = row.item.phase === "fluid" ? "pipe" : beltText(spec.getBeltCount(row.itemRate).toFloat())
    cell.appendChild(belts)
    itemTooltip(cell, totals, rows, row.item)
    return cell
}

function machinesCell(row) {
    const cell = document.createElement("span")
    cell.className = "machines num"
    if (!row.isReal) {
        return cell
    }
    const building = spec.getBuilding(row.recipe)
    if (building === null) {
        return cell
    }
    const slot = document.createElement("span")
    slot.className = "slot xs"
    slot.appendChild(building.icon.make(18, true))
    cell.appendChild(slot)
    const count = document.createElement("span")
    count.className = "cnt"
    count.textContent = buildingCount(row) + " ×"
    cell.appendChild(count)
    const muted = document.createElement("span")
    muted.className = "muted"
    muted.textContent = building.name
    cell.appendChild(muted)
    return cell
}

function toggleOpen(key, open) {
    spec.whereItem = open ? null : key
    spec.setHash()
    document.dispatchEvent(new CustomEvent("calc:select", { detail: { item: open ? null : key } }))
}

function renderRowButton(row, totals, rows) {
    const key = row.item.key
    const open = spec.whereItem === key
    const btn = document.createElement("button")
    btn.type = "button"
    btn.className = "lrow" + (open ? " open" : "") + (!row.isReal ? " dim" : "")
    btn.dataset.item = key
    btn.appendChild(itemCell(row))
    btn.appendChild(needCell(row, totals, rows))
    btn.appendChild(machinesCell(row))
    const chev = document.createElement("span")
    chev.className = "chev"
    chev.textContent = open ? "▴" : "▾"
    btn.appendChild(chev)
    btn.addEventListener("click", () => toggleOpen(key, open))
    return { btn, open }
}

function sectHeader(group) {
    const sect = document.createElement("div")
    sect.className = "sect"
    const lbl = document.createElement("span")
    lbl.className = "lbl"
    lbl.textContent = group.name
    sect.appendChild(lbl)
    const need = document.createElement("span")
    need.className = "lbl r"
    need.textContent = "Need"
    sect.appendChild(need)
    const mach = document.createElement("span")
    mach.className = "lbl"
    mach.textContent = group.machHdr
    sect.appendChild(mach)
    sect.appendChild(document.createElement("span"))
    return sect
}

function renderTable(_spec, totals) {
    lastTotals = totals
    const container = document.getElementById("item-table")
    if (!container) {
        return
    }
    container.innerHTML = ""
    if (!totals) {
        return
    }
    const rows = buildRows(totals)
    const ranks = itemDepths(totals)
    for (const group of groupForTable(rows, ranks)) {
        if (group.rows.length === 0) {
            continue
        }
        container.appendChild(sectHeader(group))
        for (const row of group.rows) {
            const { btn, open } = renderRowButton(row, totals, rows)
            container.appendChild(btn)
            if (open) {
                const detail = document.createElement("div")
                detail.className = "detail"
                renderDetail(detail, row.item, totals)
                container.appendChild(detail)
            }
        }
    }
}

export function initItemTable() {
    registerRenderer(renderTable)
    // A selection made elsewhere (the graph) must move the open row here
    // too, without a re-solve -- render off the last totals this module saw.
    document.addEventListener("calc:select", () => renderTable(spec, lastTotals))
}
