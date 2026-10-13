// The graph view's pure side: model, card faces, line chips and what focus and hover show; reads the spec, never the page.
import { isMultiOutput, outputsOf, stalls } from "./byproduct-core.js"
import { ASKED_FOR, linkMachines, realConsumers } from "./details-core.js"
import { buildFlowModel, cardHeight, dashArray, hoverSet, itemStyles, layered, lineStyle, rankNodes } from "./flow-core.js"
import { beltHoldsRow, beltWords, lineEnd, lineRatio, perBelt } from "./ratio-core.js"
import { Rational, zero } from "./rational.js"
import { rateText } from "./table-core.js"

export const LEFT_OVER = "__leftover"
export const SEND_OUT = "__sendout"
export const ASKED = "__asked"
const SINK_CARDS = new Map([
    [LEFT_OVER, { name: "Left over", sub: "Nothing here uses it" }],
    [SEND_OUT, { name: "Send out", sub: "To storage or another build" }],
    [ASKED, { name: ASKED_FOR, sub: "Your target rate" }],
])
export const NODE_WIDTH = 210
export const BASE_COL_GAP = 96
export const CHIP_MARGIN = 32
export const CHIP_FRAME = 20
export const PLAIN_LABEL_H = 18

// What a redraw depends on besides the totals: rate and belt wording, the belt, and module edits that keep the totals.
export function renderKey(spec) {
    return `${spec.format.rateName}:${spec.format.ratePrecision}:${spec.belt.key}:${spec.format.beltFormat}:${spec.modulesVersion}`
}

function itemKeyFor(spec, node) {
    if (node.kind === "input") return node.id.slice("in:".length)
    let recipe = spec.recipes.get(node.id)
    return recipe ? recipe.products[0].item.key : null
}

// A card's rate: its recipe's share of the item, or for a brought-in card the item's whole demand.
function nodeRate(spec, totals, node, itemKey) {
    if (itemKey === null) return zero
    if (node.kind === "input") {
        let item = spec.items.get(itemKey)
        return (item && totals.items.get(item)) || zero
    }
    let recipe = spec.recipes.get(node.id)
    if (!recipe) return zero
    let producerMap = totals.producers.get(recipe.products[0].item)
    return (producerMap && producerMap.get(recipe)) || zero
}

function sinkRecipe(key) {
    return { key, name: SINK_CARDS.get(key).name, isReal: true, isDisable: false, isResource: false, isTarget: false, sink: true, count: 0, machine: null }
}

// The flow-core model of a solve: solver sentinels skipped, a D- stand-in folded into an input card, leftovers and the asked-for share of a target other cards use run into sink cards.
export function buildModel(spec, totals) {
    let targetRecipes = new Set()
    for (let [recipe] of totals.rates) {
        if (spec.buildTargets.some(t => recipe.products.some(p => p.item === t.item))) targetRecipes.add(recipe.key)
    }
    let recipes = [...totals.rates].map(([recipe, rate]) => {
        let isReal = recipe.isReal()
        return {
            key: recipe.key,
            name: recipe.name,
            isReal,
            isDisable: isReal ? recipe.isDisable() : false,
            isResource: isReal ? recipe.isResource() : false,
            isTarget: targetRecipes.has(recipe.key),
            count: isReal ? Math.ceil(spec.getCount(recipe, rate).toFloat()) : 0,
            machine: isReal ? spec.getBuilding(recipe) : null,
        }
    })
    let sinkKey = item => spec.sendOut.has(item.key) ? SEND_OUT : LEFT_OVER
    for (let item of totals.surplus.keys()) {
        let key = sinkKey(item)
        if (!recipes.some(r => r.key === key)) {
            recipes.push(sinkRecipe(key))
        }
    }
    let isSurplus = to => to.key === undefined && to.name === "surplus"
    let isAsked = (to, item) => to.key === undefined && to.name === "output" && realConsumers(totals, item).length > 0
    let links = totals.proportionate
        .filter(({ item, from, to }) => (from === null || from.key !== undefined) && (to.key !== undefined || isSurplus(to) || isAsked(to, item)))
        .map(({ item, from, to, rate }) => ({
            item: item.key,
            itemName: item.name,
            from: from === null ? null : from.key,
            to: isSurplus(to) ? sinkKey(item) : to.key ?? ASKED,
            rate: rate.toFloat(),
            rateExact: rate,
            belts: item.phase === "solid" ? spec.getBeltCount(rate).toFloat() : 0,
        }))
    if (links.some(l => l.to === ASKED)) recipes.push(sinkRecipe(ASKED))
    let model = buildFlowModel({ recipes, links })
    for (let node of model.nodes) {
        node.itemKey = itemKeyFor(spec, node)
        node.rate = nodeRate(spec, totals, node, node.itemKey)
    }
    return model
}

// The recipes the Byproducts bar has a block for: their cards say "backs up".
export function stalledRecipes(spec, totals) {
    return new Set(stalls(totals, spec.sendOut).map(b => b.recipe).filter(Boolean))
}

// Stage columns, every card one height (module strip or not), every column gap `colGap` wide.
export function layoutModel(model, colGap) {
    return layered(model, { nodeWidth: NODE_WIDTH, nodeHeight: cardHeight(model.nodes), ranks: rankNodes(model).rank, colGap })
}

export function edgeKey(edge) {
    return `${edge.source}>${edge.target}|${edge.item}`
}

// A line's exact rate; a merged line that lost it falls back to its float, as the label always has.
export function edgeRate(edge) {
    return edge.rateExact ?? Rational.from_float(edge.rate)
}

export function stageLabel(rank, lastRank) {
    if (rank === 0) return "BRING IN"
    if (rank === lastRank) return "TARGET"
    return `STAGE ${lastRank - rank}`
}

// Each line's colour and dash, one look per item, keyed by edgeKey.
export function edgeLooks(edges) {
    let styles = itemStyles(edges)
    return new Map(edges.map(edge => [edgeKey(edge), lineStyle(styles.get(edge.item) ?? 0)]))
}

// A drawn line's inline paint: its item's colour, and dashes scaled to its width.
export function edgePaint(look, width) {
    return { stroke: look.color, "stroke-dasharray": dashArray(look.dash, width), "stroke-linecap": look.dash ? "round" : null }
}

// The machines at each end of a line, or null when its item or receiving recipe is gone.
export function lineMachines(spec, totals, edge) {
    let item = spec.items.get(edge.item)
    let to = spec.recipes.get(edge.target) || null
    if (!item || !to || !totals) return null
    let rate = edgeRate(edge)
    let from = edge.source.startsWith("in:") ? null : spec.recipes.get(edge.source) || null
    return { item, rate, from, to, ...linkMachines(spec, totals, item, from, to, rate) }
}

// "32 of 56 send this", out of the whole machines the card shows so both numbers agree.
export function machineWords(machines, verb) {
    return lineEnd(machines.count, Math.ceil(machines.total - 1e-9), verb)
}

// The belts a line fills, or null for a fluid or a line with no machine at either end.
export function lineBelts(spec, line) {
    if (line.item.phase === "fluid" || (!line.supplier && !line.consumer)) return null
    let belts = spec.getBeltCount(line.rate).toFloat()
    return belts > 0 ? belts : null
}

// The machines at each end one full belt of the line covers (5 foundries -> 180 assemblers), or null.
export function beltRow(spec, line) {
    let belts = lineBelts(spec, line)
    let belt = belts === null ? null : perBelt(line.supplier ? line.supplier.count : null, line.consumer ? line.consumer.count : null, belts)
    return belt && { fromRecipe: line.from, toRecipe: line.to, ...belt }
}

// A line with machines at both ends: how many feed how many, the focused end (`root`, "from" or "to") as 1.
export function bothEnds(spec, line, root) {
    let whole = m => ({ count: m.count, total: Math.ceil(m.total - 1e-9) })
    return { fromRecipe: line.from, toRecipe: line.to, ...lineRatio(whole(line.supplier), whole(line.consumer), root), belt: beltRow(spec, line) }
}

// The machine row of a line with machines at one end only: that end's share.
function oneEnd(spec, line, outgoing) {
    return { recipe: outgoing ? line.from : line.to, words: machineWords(outgoing ? line.supplier : line.consumer, outgoing ? "send" : "use"), belt: beltRow(spec, line) }
}

function perBeltRow(spec, belt) {
    let end = (recipe, count) => count === null ? null : { building: spec.getBuilding(recipe), count }
    return { kind: "belt", belt: spec.belt, from: end(belt.fromRecipe, belt.from), to: end(belt.toRecipe, belt.to) }
}

// A chip's rows as data for LineChip.svelte: rate and belts, the machines row, then the one-belt row or the "holds" rows.
export function chipRows(spec, item, rate, machines = null, holds = []) {
    let fluid = item.phase === "fluid"
    let rows = [{ kind: "rate", item, rate: rateText(spec.format, rate), via: fluid ? spec.items.get("pipe") ?? null : spec.belt, amount: fluid ? "pipe" : beltWords(spec.getBeltCount(rate).toFloat(), spec.format.beltFormat) }]
    if (machines !== null) {
        rows.push(machines.ratio
            ? { kind: "ratio", from: spec.getBuilding(machines.fromRecipe), fromCount: machines.from, to: spec.getBuilding(machines.toRecipe), toCount: machines.to, ratio: machines.ratio }
            : { kind: "words", building: spec.getBuilding(machines.recipe), words: machines.words })
        if (holds.length === 0 && machines.belt) rows.push(perBeltRow(spec, machines.belt))
    }
    return [...rows, ...holds]
}

// With "Graph lines" on: "One transport belt holds:", then the most machines at each end one belt serves.
export function holdsRows(spec, line, on) {
    let belts = on && line ? lineBelts(spec, line) : null
    if (belts === null) return []
    let end = (recipe, machines, lead, note) => {
        let building = spec.getBuilding(recipe)
        return { kind: "holds", building, ...beltHoldsRow(lead, building.name, recipe.name, machines.count / belts, note) }
    }
    let rows = [{ kind: "holdsHead", belt: spec.belt, words: `One ${spec.belt.name.toLowerCase()} holds:` }]
    if (line.supplier) rows.push(end(line.from, line.supplier, "up to", "fills it"))
    if (line.consumer) rows.push(end(line.to, line.consumer, "enough for", "uses it all"))
    return rows
}

function answer(spec, recipe, machines, verb) {
    return { building: spec.getBuilding(recipe), words: machineWords(machines, verb) }
}

// What focus (the selected item's cards plus a hovered card) and a hovered line show: chips by edgeKey, answers by card, lit and hot sets.
export function graphFocus(spec, totals, layout, { selected, hover, holds }) {
    let chips = new Map()
    let answers = new Map()
    let hot = new Set(layout.nodes.filter(n => selected !== null && n.itemKey === selected).map(n => n.id))
    let focused = new Set(hot)
    if (hover?.card) focused.add(hover.card)
    for (let edge of layout.edges) {
        let outgoing = focused.has(edge.source)
        if (!outgoing && !focused.has(edge.target)) continue
        let line = lineMachines(spec, totals, edge)
        if (!line) continue
        let machines = null
        if (line.supplier && line.consumer) machines = bothEnds(spec, line, outgoing ? "from" : "to")
        else if (outgoing ? line.supplier : line.consumer) machines = oneEnd(spec, line, outgoing)
        chips.set(edgeKey(edge), { pinned: true, rows: chipRows(spec, line.item, line.rate, machines, holdsRows(spec, line, holds)) })
        let theirs = outgoing ? line.consumer : line.supplier
        let far = outgoing ? edge.target : edge.source
        if (theirs && !focused.has(far)) answers.set(far, answer(spec, outgoing ? line.to : line.from, theirs, outgoing ? "use" : "send"))
    }
    let lit = hover?.card ? hoverSet(layout.edges, hover.card) : null
    let edge = hover?.line ? layout.edges.find(e => edgeKey(e) === hover.line) : null
    if (edge) {
        lit = { nodes: new Set([edge.source, edge.target]), edges: new Set([`${edge.source}>${edge.target}`]) }
        let item = spec.items.get(edge.item)
        let line = lineMachines(spec, totals, edge)
        if (item && !chips.has(hover.line)) chips.set(hover.line, { pinned: false, rows: chipRows(spec, item, edgeRate(edge), null, holdsRows(spec, line, holds)) })
        if (item && line?.supplier) answers.set(edge.source, answer(spec, line.from, line.supplier, "send"))
        if (item && line?.consumer) answers.set(edge.target, answer(spec, line.to, line.consumer, "use"))
    }
    return { chips, answers, lit, hot }
}

// The modules a card shows, copied so a module edit hands the strip new arrays; null without slots.
function cardModules(spec, recipe, node) {
    if (!recipe || !node.machine || node.machine.moduleSlots === 0) return null
    let m = spec.getModuleSpec(recipe)
    if (!m) return null
    return { modules: [...m.modules], moduleTiers: [...(m.moduleTiers ?? [])], beaconModules: [...m.beaconModules], beaconCount: m.beaconCount, beaconModuleTiers: [...(m.beaconModuleTiers ?? [])], beaconTier: m.beaconTier }
}

// A production or brought-in card's face; a single-product recipe is titled by its item, a multi-output one keeps its name.
export function cardFace(spec, totals, node, stalled) {
    let item = node.itemKey ? spec.items.get(node.itemKey) ?? null : null
    let recipe = node.kind === "input" ? null : spec.recipes.get(node.id) ?? null
    let multi = Boolean(recipe && isMultiOutput(recipe))
    let isStalled = recipe !== null && stalled.has(recipe)
    return {
        icon: multi ? recipe : item,
        title: item && recipe && recipe.products.length === 1 ? item.name : node.label,
        hand: Boolean(recipe && spec.handSet.has(recipe.key)),
        machine: node.machine && node.count ? { building: node.machine, tier: spec.machineTier(node.machine), text: `${node.count} × ${node.machine.name}` } : null,
        modules: cardModules(spec, recipe, node),
        outputs: multi ? outputsOf(totals, recipe).map(o => o.item) : null,
        outputCount: multi && !isStalled ? `${recipe.products.length} outputs` : null,
        rate: multi ? null : rateText(spec.format, node.rate),
        stalled: isStalled,
    }
}

// A sink card's face (Left over, Send out, What you asked for): the items that run into it and the tank it shows.
export function sinkFace(spec, node, edges) {
    let items = [...new Set(edges.filter(e => e.target === node.id).map(e => e.item))].map(key => spec.items.get(key)).filter(Boolean)
    return { out: node.id !== LEFT_OVER, items, tank: spec.items.get("storage-tank") || items[0] || null, sub: SINK_CARDS.get(node.id).sub }
}

// Every chip a line could show when focused (either end), so the column gap can fit the widest before layout.
export function probeChips(spec, totals, edges) {
    let chips = []
    for (let edge of edges) {
        let line = lineMachines(spec, totals, edge)
        if (!line) continue
        let rows = line.supplier && line.consumer
            ? [bothEnds(spec, line, "from"), bothEnds(spec, line, "to")]
            : [line.supplier && oneEnd(spec, line, true), line.consumer && oneEnd(spec, line, false)].filter(Boolean)
        for (let machines of rows.length ? rows : [null]) chips.push(chipRows(spec, line.item, line.rate, machines))
    }
    return chips
}

// Everything one redraw needs: the model, each card's face and the chips the column gap must fit.
export function graphOf(spec, totals) {
    let model = buildModel(spec, totals)
    let stalled = stalledRecipes(spec, totals)
    let faces = new Map(model.nodes.map(node => [node.id, node.kind === "sink" ? { sink: sinkFace(spec, node, model.edges) } : { card: cardFace(spec, totals, node, stalled) }]))
    return { model, faces, probe: probeChips(spec, totals, model.edges) }
}

export function colGapFor(widest) {
    return Math.max(BASE_COL_GAP, Math.ceil(widest + CHIP_MARGIN))
}

// The holds rows' max-width: the gap minus the chip's room either side and its own padding and border.
export function chipRoom(colGap) {
    return `${colGap - CHIP_MARGIN - CHIP_FRAME}px`
}
