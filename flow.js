// calc/flow.js — DOM layer for the graph: builds a flow-core model from the
// current solution, lays it out (flow-core's layered(), a pure left-to-right
// stage layout -- see the plan's "Layout") and renders node cards, stage
// stripes and edges into the page. All the model math and layout arithmetic
// live in flow-core.js so they stay node-testable; this file only touches
// spec/d3/the DOM.
import { registerRenderer } from "./render.js"
import { spec } from "./factory.js"
import { zero } from "./rational.js"
import { buildFlowModel, layered, machineWord, pluralise, beltText } from "./flow-core.js"
import { RATE_LABEL } from "./table-core.js"

let lastTotals = null
let lastRenderKey = null
let lastLayout = null
let lastNodeIdsKey = null
let zoomBehavior = null
let viewport = null
// True until the graph has been fitted inside a container that had a real
// size. The dataset fetch that populates spec.items/spec.recipes is async,
// so the very first solve can land before #flow-container has laid out.
let needsFit = true

// Node ids the user has folded (their upstream, non-input production
// collapsed into this node's card). Module-level so a re-render triggered
// by an unrelated solve doesn't reset what the user folded, mirroring
// table.js's expandedRows.
const folded = new Set()

function renderKey() {
    return `${spec.format.rateName}:${spec.format.ratePrecision}:${spec.belt.key}`
}

function itemKeyFor(node) {
    if (node.kind === "input") return node.id.slice("in:".length)
    let recipe = spec.recipes.get(node.id)
    return recipe ? recipe.products[0].item.key : null
}

// A node's rate is the total flow of its item: for a production node, the
// share of that item this specific recipe contributes (totals.producers);
// for a brought-in node, the total downstream demand for that item
// (totals.items, which sums consumption -- exactly what's being supplied).
function nodeRate(totals, node, itemKey) {
    if (itemKey === null) return zero
    if (node.kind === "input") {
        let item = spec.items.get(itemKey)
        return (item && totals.items.get(item)) || zero
    }
    let recipe = spec.recipes.get(node.id)
    if (!recipe) return zero
    let item = recipe.products[0].item
    let producerMap = totals.producers.get(item)
    return (producerMap && producerMap.get(recipe)) || zero
}

function buildModel(totals) {
    let isTargetRecipe = new Set()
    for (let [recipe] of totals.rates) {
        if (spec.buildTargets.some(t => recipe.products.some(p => p.item === t.item))) {
            isTargetRecipe.add(recipe.key)
        }
    }

    // totals.rates also carries solve.js's OutputRecipe/SurplusRecipe
    // sentinels (isReal() false, no `.key`/`.isResource()`/`.isDisable()`)
    // marking where a target's demand terminates; they aren't a production
    // step, so skip isResource()/isDisable()/getCount()/getBuilding() for
    // anything that isn't real. A `D-` DisabledRecipe stand-in for a
    // supplied/ignored item *is* real (isReal() true) but isDisable() true;
    // flow-core folds it into an "input" node rather than a recipe node.
    let recipes = [...totals.rates].map(([recipe, rate]) => {
        let isReal = recipe.isReal()
        return {
            key: recipe.key,
            name: recipe.name,
            isReal,
            isDisable: isReal ? recipe.isDisable() : false,
            isResource: isReal ? recipe.isResource() : false,
            isTarget: isTargetRecipe.has(recipe.key),
            count: isReal ? Math.ceil(spec.getCount(recipe, rate).toFloat()) : 0,
            machine: isReal ? spec.getBuilding(recipe) : null,
        }
    })

    // Drop links into/out of those same sentinels: they have no `.key`, so
    // they can't be represented as a flow-core node or link endpoint. `from`
    // may legitimately be `null` (flow-core's own "no producer" case), so
    // check that before touching `.key`.
    let links = totals.proportionate
        .filter(({from, to}) => (from === null || from.key !== undefined) && to.key !== undefined)
        .map(({item, from, to, rate}) => ({
            item: item.key,
            itemName: item.name,
            from: from === null ? null : from.key,
            to: to.key,
            rate: rate.toFloat(),
            belts: item.phase === "solid" ? spec.getBeltCount(rate).toFloat() : 0,
        }))

    let model = buildFlowModel({recipes, links})
    for (let node of model.nodes) {
        node.itemKey = itemKeyFor(node)
        node.rate = nodeRate(totals, node, node.itemKey)
    }
    return model
}

// target -> [ids of nodes whose output it directly consumes], built once per
// draw from the unfiltered model so fold state never has to touch it.
function upstreamOf(model) {
    let up = new Map(model.nodes.map(n => [n.id, []]))
    for (let e of model.edges) {
        up.get(e.target).push(e.source)
    }
    return up
}

// Walks from every target backwards across `edges`, stopping at any node in
// `foldedSet` (its own upstream stays hidden). Mirrors the graph-first
// prototype's visibleRows().
function visibleIds(model, upstream, foldedSet) {
    let seen = new Set()
    let walk = id => {
        if (seen.has(id)) return
        seen.add(id)
        if (foldedSet.has(id)) return
        for (let src of upstream.get(id) || []) walk(src)
    }
    for (let n of model.nodes) {
        if (n.kind === "target") walk(n.id)
    }
    return seen
}

function filterModel(model, ids) {
    return {
        nodes: model.nodes.filter(n => ids.has(n.id)),
        edges: model.edges.filter(e => ids.has(e.source) && ids.has(e.target)),
    }
}

// A node can fold only if it has at least one upstream node that is itself
// a production step (not a brought-in input) -- folding an input away
// wouldn't hide anything.
function canFold(nodeById, upstream, id) {
    return (upstream.get(id) || []).some(src => {
        let n = nodeById.get(src)
        return n && n.kind !== "input"
    })
}

function hiddenCountFor(model, upstream, id) {
    let without = visibleIds(model, upstream, new Set([...folded].filter(k => k !== id)))
    let withIt = visibleIds(model, upstream, folded)
    return without.size - withIt.size
}

function nodeSub(node, isFluid, hidden) {
    let base
    if (node.kind === "input") {
        base = isFluid ? "piped in" : "brought in"
    } else {
        base = pluralise(node.count, machineWord(node.machine))
    }
    return hidden > 0 ? `${base} · ${hidden} hidden` : base
}

function beltsText(node, item, rateRat) {
    if (item && item.phase === "fluid") return "pipe"
    return beltText(spec.getBeltCount(rateRat).toFloat())
}

function selectNode(itemKey) {
    if (itemKey === null) return
    spec.whereItem = spec.whereItem === itemKey ? null : itemKey
    spec.setHash()
    document.dispatchEvent(new CustomEvent("calc:select", {detail: {item: spec.whereItem}}))
}

function nodeMarkup(node, hasUpstreamProduction) {
    let item = node.itemKey ? spec.items.get(node.itemKey) : null
    let isFluid = item ? item.phase === "fluid" : false
    let isFolded = folded.has(node.id)

    let div = document.createElement("div")
    let cls = ["node"]
    if (node.kind === "input") cls.push("in")
    if (node.kind === "target") cls.push("tgt")
    if (isFolded) cls.push("folded")
    if (node.itemKey !== null && spec.whereItem === node.itemKey) cls.push("sel")
    div.className = cls.join(" ")
    div.dataset.node = node.id
    if (node.itemKey !== null) div.dataset.item = node.itemKey
    div.style.left = node.x + "px"
    div.style.top = node.y + "px"
    div.style.width = node.w + "px"
    div.style.height = node.h + "px"

    let body = document.createElement("button")
    body.type = "button"
    body.className = "nbody"

    let slot = document.createElement("span")
    slot.className = "slot slot-sm"
    if (item) slot.appendChild(item.icon.make(20, true))
    body.appendChild(slot)

    let info = document.createElement("span")
    info.style.cssText = "flex: 1; min-width: 0; text-align: left; overflow: hidden;"
    let name = document.createElement("div")
    name.style.cssText = "font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"
    name.textContent = node.label
    info.appendChild(name)

    let sub = document.createElement("div")
    sub.className = "sub num muted"
    sub.style.cssText = "font-size: 12px; display: flex; align-items: center; gap: 5px; white-space: nowrap; overflow: hidden;"
    if (node.machine) {
        sub.appendChild(node.machine.icon.make(16, true))
    }
    let subText = document.createElement("span")
    sub.appendChild(subText)
    info.appendChild(sub)
    body.appendChild(info)

    let rateBlock = document.createElement("span")
    rateBlock.style.cssText = "text-align: right;"
    let rateText = spec.format.rate(node.rate)
    let rateSpan = document.createElement("span")
    rateSpan.className = "rate num"
    rateSpan.dataset.value = rateText
    rateSpan.textContent = `${rateText}${RATE_LABEL[spec.format.rateName] || "/min"}`
    rateBlock.appendChild(rateSpan)
    let beltsSpan = document.createElement("div")
    beltsSpan.className = "belts num muted"
    beltsSpan.style.fontSize = "11px"
    beltsSpan.textContent = beltsText(node, item, node.rate)
    rateBlock.appendChild(beltsSpan)
    body.appendChild(rateBlock)

    body.addEventListener("click", event => {
        if (event.target.closest(".rate")) return
        selectNode(node.itemKey)
    })
    body.addEventListener("pointerenter", () => setEdgeHot(node.id, true))
    body.addEventListener("pointerleave", () => setEdgeHot(node.id, false))
    div.appendChild(body)

    if (hasUpstreamProduction) {
        let fold = document.createElement("button")
        fold.type = "button"
        fold.className = "fold"
        fold.textContent = isFolded ? "+" : "−"
        fold.title = isFolded ? "Show what it needs" : "Fold what it needs into this node"
        fold.addEventListener("click", event => {
            event.stopPropagation()
            if (isFolded) folded.delete(node.id)
            else folded.add(node.id)
            draw(lastTotals)
        })
        div.appendChild(fold)
    }

    return {div, subText, isFluid}
}

function setEdgeHot(nodeId, on) {
    document.querySelectorAll(`#flow path[data-from="${nodeId}"], #flow path[data-to="${nodeId}"]`).forEach(p => {
        p.classList.toggle("hot", on)
    })
}

function containerSize() {
    let container = document.querySelector("#flow-container")
    return {width: container.clientWidth, height: container.clientHeight}
}

// Fits the whole graph inside the container, centred, never scaling nodes
// above their natural size. A hidden/zero-size container can't be fitted;
// leave needsFit set so the next render or resize tries again.
export function fitToView() {
    if (lastLayout === null || zoomBehavior === null) return
    let {width, height} = containerSize()
    if (width === 0 || height === 0) return
    const PAD = 24
    let k = Math.min(1, (width - 2 * PAD) / lastLayout.width, (height - 2 * PAD) / lastLayout.height)
    if (!isFinite(k) || k <= 0) return
    let tx = (width - lastLayout.width * k) / 2
    let ty = (height - lastLayout.height * k) / 2
    d3.select("#flow-container").call(zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(k))
    needsFit = false
}

function zoomBy(factor) {
    if (zoomBehavior === null) return
    d3.select("#flow-container").transition().duration(150).call(zoomBehavior.scaleBy, factor)
}

// Pans (keeping scale) so `item`'s node card sits at the container's centre.
export function focusNode(item) {
    if (lastLayout === null || zoomBehavior === null) return
    let node = lastLayout.nodes.find(n => n.itemKey === item)
    if (!node) return
    let {width, height} = containerSize()
    if (width === 0 || height === 0) return
    let transform = d3.zoomTransform(document.querySelector("#flow-container"))
    let k = transform.k
    let tx = width / 2 - (node.x + node.w / 2) * k
    let ty = height / 2 - (node.y + node.h / 2) * k
    d3.select("#flow-container").call(zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(k))
}

function ensureZoom() {
    if (zoomBehavior !== null) return
    zoomBehavior = d3.zoom()
        .scaleExtent([0.1, 4])
        .on("zoom", event => {
            let t = event.transform
            let css = `translate(${t.x}px, ${t.y}px) scale(${t.k})`
            if (viewport !== null) viewport.attr("transform", t)
            document.querySelector("#flow-nodes").style.transform = css
            document.querySelector("#flow-columns").style.transform = css
        })
    d3.select("#flow-container").call(zoomBehavior).on("dblclick.zoom", null)
}

function stageLabel(rank, lastRank) {
    if (rank === 0) return "BRING IN"
    if (rank === lastRank) return "TARGET"
    return `STAGE ${lastRank - rank}`
}

function renderColumns(laidOut) {
    let container = document.querySelector("#flow-columns")
    container.replaceChildren()
    let lastRank = laidOut.columns.length - 1
    for (let col of laidOut.columns) {
        let stage = document.createElement("div")
        stage.className = "stage"
        stage.style.left = col.x + "px"
        stage.style.width = col.w + "px"
        stage.style.height = laidOut.height + "px"
        let label = document.createElement("div")
        label.className = "stage-label"
        label.textContent = stageLabel(col.rank, lastRank)
        stage.appendChild(label)
        let sub = document.createElement("div")
        sub.className = "stage-sub"
        sub.textContent = col.kinds.join(", ")
        stage.appendChild(sub)
        container.appendChild(stage)
    }
}

function renderNodes(model, laidOut, upstream, nodeById) {
    let nodesLayer = document.querySelector("#flow-nodes")
    nodesLayer.replaceChildren()
    for (let node of laidOut.nodes) {
        let {div, subText, isFluid} = nodeMarkup(node, canFold(nodeById, upstream, node.id))
        let hidden = folded.has(node.id) ? hiddenCountFor(model, upstream, node.id) : 0
        subText.textContent = nodeSub(node, isFluid, hidden)
        nodesLayer.appendChild(div)
    }
}

function renderEdges(laidOut) {
    let svg = d3.select("svg#flow")
    svg.selectAll("*").remove()
    viewport = svg.append("g").classed("viewport", true)
    viewport.selectAll("path")
        .data(laidOut.edges)
        .join("path")
            .attr("d", d => d.d)
            .attr("data-from", d => d.source)
            .attr("data-to", d => d.target)
            .attr("stroke", "#8a7040")
            .attr("stroke-width", d => d.width)
            .attr("fill", "none")
}

// The full draw pass: unconditional (unlike renderFlow's solve-triggered
// entry point), since fold/select changes need to redraw without a new
// solve, and folding needs the *unfiltered* model to compute hidden counts
// and fold eligibility.
function draw(totals) {
    let empty = document.querySelector("#flow-empty")
    if (spec.buildTargets.length === 0) {
        empty.hidden = false
        document.querySelector("#flow-columns").replaceChildren()
        document.querySelector("#flow-nodes").replaceChildren()
        d3.select("svg#flow").selectAll("*").remove()
        lastLayout = null
        lastNodeIdsKey = null
        return
    }
    empty.hidden = true
    if (totals === null) return

    let model = buildModel(totals)
    let nodeById = new Map(model.nodes.map(n => [n.id, n]))
    let upstream = upstreamOf(model)
    // A folded node the model no longer contains (its recipe dropped out of
    // the solution) can never unfold again; drop it rather than carry dead
    // state across solves.
    for (let id of [...folded]) {
        if (!upstream.has(id)) folded.delete(id)
    }
    let visible = visibleIds(model, upstream, folded)
    let shown = filterModel(model, visible)

    let laidOut = layered(shown)
    lastLayout = laidOut

    ensureZoom()
    renderColumns(laidOut)
    renderNodes(model, laidOut, upstream, nodeById)
    renderEdges(laidOut)

    let idsKey = laidOut.nodes.map(n => n.id).sort().join(",")
    if (idsKey !== lastNodeIdsKey) {
        lastNodeIdsKey = idsKey
        needsFit = true
    }
    if (needsFit) fitToView()
}

// `spec` is always the module singleton imported above; the renderer
// registry calls every renderer as fn(spec, totals) so the parameter is
// kept (unused) to match that shape.
function renderFlow(_spec, totals) {
    let key = renderKey()
    if (spec.buildTargets.length !== 0 && totals === lastTotals && key === lastRenderKey) return
    lastTotals = totals
    lastRenderKey = key
    draw(totals)
}

function updateSelectionClasses() {
    let sel = spec.whereItem
    document.querySelectorAll("#flow-nodes .node").forEach(el => {
        el.classList.toggle("sel", sel !== null && el.dataset.item === sel)
    })
}

export function initFlow() {
    registerRenderer(renderFlow)

    document.addEventListener("calc:select", updateSelectionClasses)

    document.addEventListener("calc:focus-node", event => {
        let item = event.detail.item
        spec.whereItem = item
        spec.setHash()
        document.dispatchEvent(new CustomEvent("calc:select", {detail: {item}}))
        focusNode(item)
    })

    // The ledger toggle changes #flow-container's width without a new
    // solve; refit once its transition/reflow has actually happened.
    document.addEventListener("calc:layout", () => {
        requestAnimationFrame(() => fitToView())
    })

    window.addEventListener("resize", () => {
        if (needsFit) fitToView()
    })
    document.querySelector("#flow-fit").addEventListener("click", () => fitToView())
    document.querySelector("#flow-zoom-in").addEventListener("click", () => zoomBy(1.4))
    document.querySelector("#flow-zoom-out").addEventListener("click", () => zoomBy(1 / 1.4))
}
