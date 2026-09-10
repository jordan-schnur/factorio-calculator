// calc/flow.js — DOM layer for the Flow tab: builds a flow-core model from
// the current solution, lays it out with dagre and renders it into
// svg#flow with d3. All the model math lives in flow-core.js so it stays
// node-testable; this file only touches spec/d3/dagre/the DOM.
import { registerRenderer } from "./render.js"
import { spec } from "./factory.js"
import { Rational } from "./rational.js"
import { buildFlowModel, layout, edgePath } from "./flow-core.js"
import { laneNote } from "./table-core.js"

const NODE_WIDTH = 210
const NODE_HEIGHT = 44

let lastTotals = null
let lastRenderKey = null
let lastLayout = null
let zoomBehavior = null
let viewport = null
// True until the graph has been fitted inside a container that had a real
// size. The pane is usually hidden when the solve renders (clientWidth 0),
// so the fit is deferred to the moment the Flow tab is shown.
let needsFit = true

// Display-only changes (rate unit, precision, belt) call spec.display()
// without a new solve, so `totals` stays the same object; re-render on a
// change to any of these even when the identity check alone would skip.
function renderKey() {
    return `${spec.format.rateName}:${spec.format.ratePrecision}:${spec.belt.key}`
}

function itemKeyFor(node) {
    if (node.kind === "input") return node.id.slice("in:".length)
    let recipe = spec.recipes.get(node.id)
    return recipe ? recipe.products[0].item.key : null
}

function dispatchWhere(itemKey) {
    if (itemKey === null) return
    document.dispatchEvent(new CustomEvent("calc:where", {detail: {item: itemKey}}))
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

    return buildFlowModel({recipes, links})
}

function nodeMarkup(node) {
    let div = document.createElement("div")
    div.className = "node " + (node.kind === "target" ? "tgt" : node.kind === "recipe" ? "" : "inp")
    div.style.left = node.x + "px"
    div.style.top = node.y + "px"
    div.style.height = NODE_HEIGHT + "px"
    let slot = document.createElement("span")
    slot.className = "slot slot-sm"
    let item = spec.items.get(itemKeyFor(node))
    if (item) {
        slot.appendChild(item.icon.make(20, true))
    }
    div.appendChild(slot)
    let label = document.createElement("span")
    label.textContent = node.label
    div.appendChild(label)
    if (node.kind === "recipe" || node.kind === "target" || node.kind === "mined") {
        let machineSlot = document.createElement("span")
        machineSlot.className = "slot slot-sm"
        machineSlot.style.marginLeft = "auto"
        if (node.machine) {
            machineSlot.appendChild(node.machine.icon.make(20, true))
        }
        div.appendChild(machineSlot)
        let count = document.createElement("span")
        count.className = "num"
        count.dataset.value = node.count
        count.textContent = node.count
        div.appendChild(count)
    }
    div.addEventListener("click", () => dispatchWhere(itemKeyFor(node)))
    return div
}

// `spec` is always the module singleton imported above; the renderer
// registry calls every renderer as fn(spec, totals) so the parameter is
// kept (unused) to match that shape.
function renderFlow(_spec, totals) {
    let key = renderKey()
    if (totals === lastTotals && key === lastRenderKey) return
    lastTotals = totals
    lastRenderKey = key

    let model = buildModel(totals)

    let svg = d3.select("svg#flow")
    svg.selectAll("*").remove()
    let nodesLayer = document.querySelector("#flow-nodes")
    nodesLayer.replaceChildren()
    lastLayout = null

    if (model.nodes.length === 0) {
        document.querySelector("#flow-note").textContent = spec.buildTargets.length === 0
            ? "Add a target to see its flow graph."
            : "Nothing to draw: no recipe produces these targets with the current settings."
        return
    }

    let laidOut = layout(model, dagre, {rankdir: "LR", ranksep: 140, nodesep: 24, nodeWidth: NODE_WIDTH, nodeHeight: NODE_HEIGHT})
    lastLayout = laidOut

    ensureZoom()
    viewport = svg.append("g").classed("viewport", true)

    viewport.append("g").classed("edges", true)
        .selectAll("path")
        .data(laidOut.edges)
        .join("path")
            .attr("d", edgePath)
            .attr("stroke", "#7a6a45")
            .attr("stroke-width", d => d.width)
            .attr("fill", "none")
            .each(function(d) {
                d3.select(this).append("title")
                    .text(`${d.itemName} · ${spec.format.rate(Rational.from_float(d.rate))}/${spec.format.rateName} · ${d.belts.toFixed(2)} belts · ${laneNote(d.belts)}`)
            })

    // Rate labels are HTML too (.lbl centres itself with a CSS translate,
    // which on an SVG <text> would resolve against the whole canvas).
    for (let edge of laidOut.edges) {
        let label = document.createElement("div")
        label.className = "lbl"
        label.style.left = (edge.x1 + edge.x2) / 2 + "px"
        label.style.top = (edge.y1 + edge.y2) / 2 + "px"
        label.textContent = `${spec.format.rate(Rational.from_float(edge.rate))}/${spec.format.rateName}`
        label.title = `${edge.itemName} · ${edge.belts.toFixed(2)} belts · ${laneNote(edge.belts)}`
        nodesLayer.appendChild(label)
    }

    // Nodes are plain HTML in a layer over the svg rather than
    // <foreignObject>: Chromium clips foreignObject content to a sliver
    // once an ancestor <g> carries a scale transform.
    for (let node of laidOut.nodes) {
        nodesLayer.appendChild(nodeMarkup(node))
    }

    let note = document.querySelector("#flow-note")
    let sentence = "Scroll to zoom, drag to pan. Hover an edge for its rate and belt load. Click a node to open it in “Where it goes”. Supplied items and mined resources both start on the left; nothing is drawn upstream of them."
    if (laidOut.nodes.length > 60) {
        sentence += ` This graph has ${laidOut.nodes.length} nodes; supply intermediates from elsewhere to simplify it.`
    }
    note.textContent = sentence

    needsFit = true
    fitToView()
}

// Zoom and pan live on the container; the edges live in svg g.viewport and
// the nodes in div#flow-nodes, and both get the same transform. The
// behaviour is attached once and survives the per-render wipe of the
// svg's children.
function ensureZoom() {
    if (zoomBehavior !== null) return
    zoomBehavior = d3.zoom()
        .scaleExtent([0.1, 4])
        .on("zoom", event => {
            let t = event.transform
            if (viewport !== null) viewport.attr("transform", t)
            document.querySelector("#flow-nodes").style.transform = `translate(${t.x}px, ${t.y}px) scale(${t.k})`
        })
    d3.select("#flow-container").call(zoomBehavior).on("dblclick.zoom", null)
}

function containerSize() {
    let container = document.querySelector("#flow-container")
    return {width: container.clientWidth, height: container.clientHeight}
}

// Fits the whole graph inside the container, centred, never scaling nodes
// above their natural size. A hidden pane (size 0) can't be fitted; leave
// needsFit set so the tab-shown hook tries again.
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

export function initFlow() {
    registerRenderer(renderFlow)
    document.addEventListener("calc:tab", event => {
        if (event.detail.tab === "flow" && needsFit) fitToView()
    })
    window.addEventListener("resize", () => {
        if (needsFit) fitToView()
    })
    document.querySelector("#flow-fit").addEventListener("click", () => fitToView())
    document.querySelector("#flow-zoom-in").addEventListener("click", () => zoomBy(1.4))
    document.querySelector("#flow-zoom-out").addEventListener("click", () => zoomBy(1 / 1.4))
}
