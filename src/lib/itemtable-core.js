import { isMultiOutput, outputsOf, stalls } from "./byproduct-core.js"
import { itemCard, rowBadge } from "./details-core.js"
import { spec } from "./factory.js"
import { sprites } from "./icon.js"
import { beaconPhrase, fallbackNote, planSentence } from "./modules-core.js"
import { beltWords } from "./ratio-core.js"
import { buildRows, buildingCount } from "./table.js"
import { groupForTable, rateText } from "./table-core.js"

// Consumer distance from a build target (a target is 0), keyed by item key; mirrors flow-core's rankOf over totals.consumers.
export function itemDepths(totals, targets) {
    const depth = new Map()
    const depthOf = item => {
        if (depth.has(item)) return depth.get(item)
        if (targets.has(item)) {
            depth.set(item, 0)
            return 0
        }
        depth.set(item, 0)
        let d = 0
        for (const [recipe] of totals.consumers.get(item) ?? []) {
            for (const product of recipe.products) d = Math.max(d, depthOf(product.item) + 1)
        }
        depth.set(item, d)
        return d
    }
    for (const item of totals.items.keys()) depthOf(item)
    for (const [recipe] of totals.rates) {
        if (recipe.isReal()) for (const product of recipe.products) depthOf(product.item)
    }
    return new Map([...depth].map(([item, d]) => [item.key, d]))
}

// The hover card on a row's Need rate: belts and makers, then every place the item goes with its machines; null at zero.
export function itemRateCard(totals, rows, item) {
    const card = itemCard(spec, totals, rows, item)
    if (card === null) return null
    const lines = card.summary.map(text => ({ text }))
    if (card.destinations.length > 0) lines.push({ text: "Goes to", class: "lbl" })
    for (const d of card.destinations) {
        lines.push({ text: d.title, class: "dest" })
        if (d.detail) lines.push({ text: d.detail, class: "muted dest-detail" })
    }
    return { heading: `${rateText(spec.format, card.total)} ${item.name}`, lines }
}

function isHandSet(row) {
    return row.isReal && spec.handSet.has(row.recipe.key)
}

function needCell(totals, rows, row) {
    const belts = row.item.phase === "fluid" ? "pipe" : beltWords(spec.getBeltCount(row.itemRate).toFloat(), spec.format.beltFormat)
    return { text: rateText(spec.format, row.itemRate), belts, card: itemRateCard(totals, rows, row.item) }
}

function machineCell(row) {
    if (!row.isReal) return null
    const building = spec.getBuilding(row.recipe)
    if (building === null) return null
    return { building, tier: spec.machineTier(building), count: `${buildingCount(row)} ×` }
}

function modsCell(row) {
    if (!row.isReal) return null
    const building = spec.getBuilding(row.recipe)
    if (building === null || building.moduleSlots === 0) return null
    const hand = spec.handSet.has(row.recipe.key)
    return { ms: spec.getModuleSpec(row.recipe), hand, note: hand ? null : fallbackNote(spec.resolveFor(row.recipe, building)) }
}

function rowModel(totals, rows, row, stalled) {
    const multi = row.isReal && isMultiOutput(row.recipe)
    const out = row.isReal ? row.recipe.products.filter(p => spec.sendOut.has(p.item.key) && totals.surplus.has(p.item)).length : 0
    return {
        itemKey: row.item.key,
        row,
        name: row.name,
        icon: multi ? row.recipe : row.item,
        tone: !row.isReal ? "dim" : isHandSet(row) ? "hand" : null,
        badge: row.isTarget ? { kind: "target", text: "target" } : rowBadge(row),
        outputs: multi ? outputsOf(totals, row.recipe).map(({ item }) => ({ item, card: itemRateCard(totals, rows, item) })) : null,
        stalled: row.isReal && stalled.has(row.recipe),
        sentOut: out > 0 ? `sends out ${out}` : null,
        need: multi ? null : needCell(totals, rows, row),
        outputCount: multi ? `${row.recipe.products.length} outputs` : null,
        machine: machineCell(row),
        mods: modsCell(row),
    }
}

function barModel(rows) {
    const layer = spec.planLayer()
    const hand = rows.filter(isHandSet).map(row => row.recipe)
    return {
        icon: layer.defaultModule || sprites.get("slot_icon_module"),
        tier: layer.defaultModule ? layer.defaultModuleTier : "normal",
        words: `${planSentence(layer)} · ${beaconPhrase(layer.defaultBeacon, layer.defaultBeaconCount)}`,
        hand,
        handText: `${hand.length} row${hand.length === 1 ? "" : "s"} set by hand`,
    }
}

// The whole table for `totals`: the modules bar, then each non-empty group with its rows.
export function tableModel(totals) {
    const rows = buildRows(totals)
    const ranks = itemDepths(totals, new Set(spec.buildTargets.map(t => t.item)))
    const stalled = new Set(stalls(totals, spec.sendOut).map(b => b.recipe).filter(Boolean))
    const groups = groupForTable(rows, ranks)
        .filter(group => group.rows.length > 0)
        .map(group => ({ name: group.name, machHdr: group.machHdr, rows: group.rows.map(row => rowModel(totals, rows, row, stalled)) }))
    return { bar: barModel(rows), groups }
}
