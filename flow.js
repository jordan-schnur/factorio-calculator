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

    if (model.nodes.length === 0) {
        document.querySelector("#flow-note").textContent = "Add a target to see its flow graph."
        return
    }

    let laidOut = layout(model, dagre, {rankdir: "LR", ranksep: 140, nodesep: 24, nodeWidth: NODE_WIDTH, nodeHeight: NODE_HEIGHT})

    let container = document.querySelector("#flow-container")
    // A hidden pane reports clientWidth 0; fall back to a plausible width
    // so the graph still renders (just not at the container's real size)
    // rather than collapsing to zero height.
    let containerWidth = container.clientWidth || 1400
    let displayHeight = Math.max(200, containerWidth * (laidOut.height / laidOut.width))
    svg.attr("viewBox", `0 0 ${laidOut.width} ${laidOut.height}`)
        .attr("width", "100%")
        .attr("height", displayHeight)

    svg.append("g").classed("edges", true)
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

    svg.append("g").classed("labels", true)
        .selectAll("text")
        .data(laidOut.edges)
        .join("text")
            .classed("lbl", true)
            .attr("x", d => (d.x1 + d.x2) / 2)
            .attr("y", d => (d.y1 + d.y2) / 2)
            .attr("fill", "#ffe6c0")
            .style("font", "600 12px sans-serif")
            .text(d => `${spec.format.rate(Rational.from_float(d.rate))}/${spec.format.rateName}`)

    svg.append("g").classed("nodes", true)
        .selectAll("foreignObject")
        .data(laidOut.nodes)
        .join("foreignObject")
            .attr("x", d => d.x)
            .attr("y", d => d.y)
            .attr("width", NODE_WIDTH)
            .attr("height", NODE_HEIGHT)
            .each(function(d) {
                this.appendChild(nodeMarkup(d))
            })

    let note = document.querySelector("#flow-note")
    let sentence = "Hover an edge for its rate and belt load. Click a node to open it in “Where it goes”. Supplied items and mined resources both start on the left; nothing is drawn upstream of them."
    if (laidOut.nodes.length > 60) {
        sentence += ` This graph has ${laidOut.nodes.length} nodes; supply intermediates from elsewhere to simplify it.`
    }
    note.textContent = sentence
}

export function initFlow() {
    registerRenderer(renderFlow)
}
