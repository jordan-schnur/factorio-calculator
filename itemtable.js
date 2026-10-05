// calc/itemtable.js — the item table (#item-table): one row per item in the
// current solution, grouped Build here / Bring in from another build / Mine
// or pipe in, replacing the old Ledger side panel. A row expands into a
// detail panel (calc/details.js) in place instead of opening a side card.
import { isMultiOutput, leftovers, outputsOf } from "./byproduct-core.js"
import { spec } from "./factory.js"
import { sprites } from "./icon.js"
import { beaconPhrase, fallbackNote, planSentence } from "./modules-core.js"
import { beaconBadge, handTag, moduleStrip } from "./modules-strip.js"
import { addQualityBadge } from "./quality-ui.js"
import { beltWords } from "./ratio-core.js"
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

// Under a multi-output row's name: every output with what this row makes
// of it, any part nothing uses marked "left over" -- one output backing up
// stops the whole machine.
function outputsLine(row, totals) {
    const line = document.createElement("span")
    line.className = "outs num"
    for (const { item, rate, leftover } of outputsOf(totals, row.recipe)) {
        const out = document.createElement("span")
        out.className = "out" + (leftover.isZero() ? "" : " left")
        out.title = item.name
        out.appendChild(item.icon.make(16, true))
        out.appendChild(document.createTextNode(rateText(rate)))
        if (!leftover.isZero()) {
            const note = document.createElement("span")
            note.className = "left-note"
            note.textContent = `${spec.format.rate(leftover)} left over`
            out.appendChild(note)
        }
        line.appendChild(out)
    }
    return line
}

function itemCell(row, totals) {
    const cell = document.createElement("span")
    cell.className = "item"
    const multi = row.isReal && isMultiOutput(row.recipe)
    const slot = document.createElement("span")
    slot.className = "slot sm"
    slot.appendChild((multi ? row.recipe.icon : row.item.icon).make(24, true))
    cell.appendChild(slot)
    const name = document.createElement("span")
    name.className = "name"
    name.textContent = row.name
    if (multi) {
        const words = document.createElement("span")
        words.className = "words"
        words.appendChild(name)
        words.appendChild(outputsLine(row, totals))
        cell.appendChild(words)
    } else {
        cell.appendChild(name)
    }
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
    belts.textContent = row.item.phase === "fluid" ? "pipe" : beltWords(spec.getBeltCount(row.itemRate).toFloat(), spec.format.beltFormat)
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
    addQualityBadge(slot, spec.machineTier(building), 9)
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

// The Modules column: the row's slots (24px, empty ones drawn empty), its
// beacon badge, and under them SET BY HAND or, for a row whose recipe
// takes no productivity, what the plan put in instead. Empty for a row
// brought in or made in a machine without module slots.
function modulesCell(row) {
    const cell = document.createElement("span")
    cell.className = "mods"
    if (!row.isReal) {
        return cell
    }
    const building = spec.getBuilding(row.recipe)
    if (building === null || building.moduleSlots === 0) {
        return cell
    }
    const moduleSpec = spec.getModuleSpec(row.recipe)
    const line = document.createElement("span")
    line.className = "mods-line"
    line.appendChild(moduleStrip(moduleSpec.modules, 24, moduleSpec.moduleTiers))
    const badge = beaconBadge(moduleSpec.beaconModules, moduleSpec.beaconCount, 18, true, moduleSpec.beaconModuleTiers, moduleSpec.beaconTier)
    if (badge) {
        line.appendChild(badge)
    }
    cell.appendChild(line)
    if (spec.handSet.has(row.recipe.key)) {
        cell.appendChild(handTag())
    } else {
        const note = fallbackNote(spec.resolveFor(row.recipe, building))
        if (note) {
            const muted = document.createElement("span")
            muted.className = "muted mods-note"
            muted.textContent = note
            cell.appendChild(muted)
        }
    }
    return cell
}

function isHandSet(row) {
    return row.isReal && spec.handSet.has(row.recipe.key)
}

// Opens Settings at its Modules section (calc.html's #modules-sec).
function openModuleSettings() {
    document.getElementById("settings-open")?.click()
    document.getElementById("modules-sec")?.scrollIntoView({ block: "start" })
}

// The bar over the table: the plan layer in one line, Change, and the
// rows set by hand with a way to reset them.
function modulesBar(rows) {
    const bar = document.createElement("div")
    bar.id = "modules-bar"
    const plan = spec.planLayer()
    const icon = document.createElement("span")
    icon.className = "slot sm"
    icon.appendChild(plan.defaultModule ? plan.defaultModule.icon.make(24, true) : sprites.get("slot_icon_module").icon.make(24, true))
    addQualityBadge(icon, plan.defaultModule ? plan.defaultModuleTier : "normal", 12)
    bar.appendChild(icon)
    const words = document.createElement("span")
    words.className = "mb-words"
    words.textContent = `${planSentence(plan)} · ${beaconPhrase(plan.defaultBeacon, plan.defaultBeaconCount)}`
    bar.appendChild(words)
    const change = document.createElement("button")
    change.type = "button"
    change.className = "btn btn-sm mb-change"
    change.textContent = "Change"
    change.addEventListener("click", openModuleSettings)
    bar.appendChild(change)
    const hand = rows.filter(isHandSet).map(row => row.recipe)
    if (hand.length > 0) {
        const count = document.createElement("span")
        count.className = "lbl mb-hand"
        count.textContent = `${hand.length} row${hand.length === 1 ? "" : "s"} set by hand`
        bar.appendChild(count)
        const reset = document.createElement("button")
        reset.type = "button"
        reset.className = "btn btn-sm mb-reset"
        reset.textContent = "Reset them"
        reset.addEventListener("click", () => spec.commitModules(() => hand.forEach(recipe => spec.releaseRow(recipe))))
        bar.appendChild(reset)
    }
    return bar
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
    btn.className = "lrow" + (open ? " open" : "") + (!row.isReal ? " dim" : "") + (isHandSet(row) ? " hand" : "")
    btn.dataset.item = key
    btn.appendChild(itemCell(row, totals))
    btn.appendChild(needCell(row, totals, rows))
    btn.appendChild(machinesCell(row))
    btn.appendChild(modulesCell(row))
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
    const mods = document.createElement("span")
    mods.className = "lbl"
    mods.textContent = "Modules"
    sect.appendChild(mods)
    sect.appendChild(document.createElement("span"))
    return sect
}

// The Left over section: what the solver could place nowhere (no cracking
// allowed, say). Each row names what makes it and opens that maker's row.
function leftoverSection(totals, container) {
    const list = leftovers(totals)
    if (list.length === 0) {
        return
    }
    const sect = document.createElement("div")
    sect.className = "sect leftover"
    const lbl = document.createElement("span")
    lbl.className = "lbl"
    lbl.textContent = "Left over · nothing here uses it, so it backs up"
    sect.appendChild(lbl)
    container.appendChild(sect)
    for (const { item, rate, makers } of list) {
        const btn = document.createElement("button")
        btn.type = "button"
        btn.className = "lrow leftover"
        btn.dataset.leftover = item.key
        const cell = document.createElement("span")
        cell.className = "item"
        const slot = document.createElement("span")
        slot.className = "slot sm"
        slot.appendChild(item.icon.make(24, true))
        cell.appendChild(slot)
        const name = document.createElement("span")
        name.className = "name"
        name.textContent = item.name
        cell.appendChild(name)
        cell.appendChild(makeBadge("left", "left over"))
        btn.appendChild(cell)
        const need = document.createElement("span")
        need.className = "need num"
        need.textContent = rateText(rate)
        btn.appendChild(need)
        const from = document.createElement("span")
        from.className = "machines muted"
        from.textContent = makers.length === 0 ? "" : "from " + makers.map(m => m.name.toLowerCase()).join(", ")
        btn.appendChild(from)
        btn.appendChild(document.createElement("span"))
        btn.appendChild(document.createElement("span"))
        const maker = makers[0]
        if (maker) {
            btn.addEventListener("click", () => toggleOpen(maker.products[0].item.key, false))
        }
        container.appendChild(btn)
    }
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
    container.appendChild(modulesBar(rows))
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
    leftoverSection(totals, container)
}

export function initItemTable() {
    registerRenderer(renderTable)
    // A selection made elsewhere (the graph) must move the open row here
    // too, without a re-solve -- render off the last totals this module saw.
    document.addEventListener("calc:select", () => renderTable(spec, lastTotals))
}
