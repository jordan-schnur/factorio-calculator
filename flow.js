// calc/flow.js — DOM layer for the reduced Graph view: builds a flow-core
// model from the current solution, lays it out (flow-core's layered(), a
// pure left-to-right stage layout) and renders node cards, stage stripes
// and edges into #graph-frame. The card itself is deliberately thin (icon,
// name, machine count, rate) -- recipe pick, needs/goes-to and the fold/tip
// affordances that used to live on the card now live in the item table
// (itemtable.js) and the details side card (details.js); this file only
// draws the picture and dispatches calc:select on a click. All the model
// math and layout arithmetic live in flow-core.js so they stay
// node-testable; this file only touches spec/d3/the DOM.
import { registerRenderer } from "./render.js"
import { spec } from "./factory.js"
import { Rational, zero } from "./rational.js"
import { buildFlowModel, hoverSet, layered, rankNodes, stackLabels } from "./flow-core.js"
import { RATE_LABEL } from "./table-core.js"
import { linkMachines } from "./details.js"
import { beltWords, lineEnd } from "./ratio-core.js"

// The last totals a solve produced, remembered even while the Graph view
// isn't showing (view=table) so switching to it via calc:view can draw
// immediately instead of waiting for the next solve.
let lastTotals = null
// Snapshot of the totals/format the graph was actually drawn for, so an
// unrelated re-render (e.g. a solve with the exact same result) is a no-op.
let lastDrawnTotals = null
let lastDrawnKey = null
let lastLayout = null
let lastNodeIdsKey = null
let zoomBehavior = null
let viewport = null
// True until the graph has been fitted inside a container that had a real
// size. The dataset fetch that populates spec.items/spec.recipes is async,
// and the container is hidden (width/height 0) whenever the page isn't on
// the Graph view, so the first draw after either can land before
// #flow-container has laid out.
let needsFit = true
// True as long as the visible transform is exactly what fitToView() last
// produced -- set true there, false by any zoom/pan the user initiates
// (a d3-zoom event with event.sourceEvent non-null). A resize only re-fits
// while this holds, so a user who has manually framed the graph isn't
// yanked back to the fitted view.
let isFitted = true

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
            rateExact: rate,
            belts: item.phase === "solid" ? spec.getBeltCount(rate).toFloat() : 0,
        }))

    let model = buildFlowModel({recipes, links})
    for (let node of model.nodes) {
        node.itemKey = itemKeyFor(node)
        node.rate = nodeRate(totals, node, node.itemKey)
    }
    return model
}

function selectNode(itemKey) {
    if (itemKey === null) return
    spec.whereItem = spec.whereItem === itemKey ? null : itemKey
    spec.setHash()
    document.dispatchEvent(new CustomEvent("calc:select", {detail: {item: spec.whereItem}}))
}

// span.sub.num: machine icon + "N × <machine name>", empty for a node with
// no machine (brought-in, or a recipe/target the solver gave zero count).
function nodeSub(node) {
    if (!node.machine || !node.count) return null
    return {icon: node.machine.icon, text: `${node.count} × ${node.machine.name}`}
}

function nodeMarkup(node) {
    let item = node.itemKey ? spec.items.get(node.itemKey) : null

    let div = document.createElement("div")
    let cls = ["node"]
    if (node.kind === "input") cls.push("in")
    if (node.kind === "target") cls.push("tgt")
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

    let mid = document.createElement("span")
    mid.className = "mid"
    let name = document.createElement("span")
    name.className = "name"
    // A single-product recipe's card is titled by its item (e.g. "Petroleum gas"),
    // not the recipe name, which can run long and get clipped ("Light oil
    // cracking to…"). Multi-product recipes (advanced oil processing, coal
    // liquefaction) keep the recipe name since the icon/rate are only the
    // first product.
    let recipe = node.kind === "input" ? null : spec.recipes.get(node.id)
    let title = node.label
    if (item && recipe && recipe.products.length === 1) title = item.name
    name.textContent = title
    mid.appendChild(name)

    let sub = document.createElement("span")
    sub.className = "sub num"
    let subInfo = nodeSub(node)
    if (subInfo) {
        sub.appendChild(subInfo.icon.make(16, true))
        sub.appendChild(document.createTextNode(subInfo.text))
    }
    mid.appendChild(sub)
    body.appendChild(mid)

    let right = document.createElement("span")
    right.className = "right"
    let rateText = spec.format.rate(node.rate)
    let rateSpan = document.createElement("span")
    // No data-value here: scratchpad.js's document-wide click delegate
    // pastes any `.num[data-value]` it catches into the scratch pad, and a
    // card click already does something else (toggles selection) -- the
    // graph card's rate isn't click-to-paste.
    rateSpan.className = "rate num"
    rateSpan.textContent = `${rateText}${RATE_LABEL[spec.format.rateName] || "/min"}`
    right.appendChild(rateSpan)
    body.appendChild(right)

    body.addEventListener("click", event => {
        // d3-zoom sets defaultPrevented on the click that ends a drag, so a
        // pan doesn't also register as a node click.
        if (event.defaultPrevented) return
        selectNode(node.itemKey)
    })
    div.appendChild(body)
    div.addEventListener("mouseenter", () => hoverIntent(() => showCardHover(node.id)))
    div.addEventListener("mouseleave", () => hoverIntent(null))

    return div
}

// Hover waits before it shows and before it clears, so skimming the mouse
// across the graph doesn't flicker every card and line it crosses: a first
// hover shows after HOVER_IN ms, moving on to another card or line switches
// after HOVER_SWITCH, and leaving clears after HOVER_OUT unless something
// else is entered first.
const HOVER_IN = 250
const HOVER_SWITCH = 120
const HOVER_OUT = 150
let hoverTimer = null
let hoverShowing = false

function hoverIntent(show) {
    clearTimeout(hoverTimer)
    let delay = show === null ? HOVER_OUT : hoverShowing ? HOVER_SWITCH : HOVER_IN
    hoverTimer = setTimeout(() => {
        hoverTimer = null
        if (show === null) {
            setLineHover(null)
            clearCardHover()
            setHover(null)
            hoverShowing = false
        } else {
            show()
            hoverShowing = true
        }
    }, delay)
}

// Hovering a card previews what clicking it shows: the chip on every one
// of its lines (renderSelectionChips), laid out again with the hovered card
// held in place. The column gaps only ever widen (stickyGap), so moving
// from card to card doesn't shuffle the graph back and forth.
let hoverCard = null

function showCardHover(id) {
    setLineHover(null)
    if (hoverCard !== id) {
        hoverCard = id
        redrawKeeping(id)
    }
    setHover(id)
}

function clearCardHover() {
    if (hoverCard === null) return
    hoverCard = null
    if (lastDrawnTotals && spec.view === "graph") draw(lastDrawnTotals)
}

function redrawKeeping(id) {
    if (!lastDrawnTotals || !lastLayout || spec.view !== "graph") return
    let before = lastLayout.nodes.find(n => n.id === id)
    draw(lastDrawnTotals)
    if (before) keepAnchor(before)
}

function showLineHover(edge) {
    setLineHover(null)
    clearCardHover()
    setLineHover(edge)
}

// Hovering a card lights it, the cards it is made from and goes to, and the
// edges between them (flow-core's hoverSet); #flow-container.hovering dims
// everything else. Independent of the click selection's "hot" edges.
function setHover(id) {
    applyLit(id === null || !lastLayout ? null : hoverSet(lastLayout.edges, id))
}

function applyLit(lit) {
    let container = document.querySelector("#flow-container")
    if (!container) return
    container.classList.toggle("hovering", lit !== null)
    document.querySelectorAll("#flow-nodes .node").forEach(el => {
        el.classList.toggle("lit", lit !== null && lit.nodes.has(el.dataset.node))
    })
    document.querySelectorAll("#flow path.edge, #flow-nodes .elbl").forEach(el => {
        el.classList.toggle("lit", lit !== null && lit.edges.has(`${el.dataset.from}>${el.dataset.to}`))
    })
}

// Hovering one line (its path or its label) lights just that line and its
// two cards, and answers on them instead of in a pop-up: the label turns
// into item icon, rate, belt icon and belts (spec.format.beltFormat), the
// sending card says how many of its machines this line takes and the
// receiving card how many of its machines it feeds. `restoreLine` undoes
// every swap.
let restoreLine = []

function setLineHover(edge) {
    for (let undo of restoreLine) undo()
    restoreLine = []
    if (edge === null) {
        applyLit(null)
        return
    }
    applyLit({nodes: new Set([edge.source, edge.target]), edges: new Set([`${edge.source}>${edge.target}`])})
    let item = spec.items.get(edge.item)
    let totals = lastDrawnTotals
    if (!item || !totals) return
    let rate = edge.rateExact ?? Rational.from_float(edge.rate)
    let label = findLabel(edge)
    if (label && !label.classList.contains("pinned")) swapChildren(label, lineChip(item, rate), "chip")
    let from = edge.source.startsWith("in:") ? null : spec.recipes.get(edge.source) || null
    let to = spec.recipes.get(edge.target) || null
    if (!to) return
    let {supplier, consumer} = linkMachines(totals, item, from, to, rate)
    if (supplier) answerOnCard(edge.source, from, supplier, "send")
    if (consumer) answerOnCard(edge.target, to, consumer, "use")
}

function swapChildren(el, children, cls, undo = restoreLine) {
    let old = [...el.childNodes]
    let had = el.classList.contains(cls)
    el.replaceChildren(...children)
    el.classList.add(cls)
    if (undo) undo.push(() => {
        el.replaceChildren(...old)
        el.classList.toggle(cls, had)
    })
}

function textSpan(t, className) {
    let span = document.createElement("span")
    span.textContent = t
    if (className) span.className = className
    return span
}

function lineChip(item, rate) {
    let parts = [item.icon.make(18, true), textSpan(`${spec.format.rate(rate)}${RATE_LABEL[spec.format.rateName] || "/min"}`), textSpan("|", "sep")]
    if (item.phase === "fluid") {
        let pipe = spec.items.get("pipe")
        if (pipe) parts.push(pipe.icon.make(18, true))
        parts.push(textSpan("pipe"))
    } else {
        parts.push(spec.belt.icon.make(18, true))
        parts.push(textSpan(beltWords(spec.getBeltCount(rate).toFloat(), spec.format.beltFormat)))
    }
    return parts
}

// "32 of 56 send this" out of the whole machines the card itself shows
// ("56 × ..."), not the exact 55.8, so the two numbers on one card agree.
function machineWords(machines, verb) {
    return lineEnd(machines.count, Math.ceil(machines.total - 1e-9), verb)
}

function answerOnCard(nodeId, recipe, machines, verb, undo = restoreLine) {
    let node = [...document.querySelectorAll("#flow-nodes .node")].find(n => n.dataset.node === nodeId)
    let sub = node && node.querySelector(".sub")
    if (!sub) return
    swapChildren(sub, [spec.getBuilding(recipe).icon.make(16, true), textSpan(machineWords(machines, verb))], "answer", undo)
    if (!node.classList.contains("answering")) {
        node.classList.add("answering")
        if (undo) undo.push(() => node.classList.remove("answering"))
    }
}

function findLabel(edge) {
    return [...document.querySelectorAll("#flow-nodes .elbl")].find(l =>
        l.dataset.from === edge.source && l.dataset.to === edge.target && l.dataset.item === edge.item)
}

// A clicked card answers on every one of its lines at once, for as long as
// it stays selected: each line's label becomes the chip (item, rate, belts)
// plus how many of the selected card's machines that line takes, and the
// card at the other end says how many of its machines it feeds or is fed
// by. Chips in the same column gap are stacked so none overlap
// (stackLabels); returns the widest chip, so draw() can widen the gaps
// between columns when one doesn't fit.
function renderSelectionChips() {
    let item = spec.whereItem
    let totals = lastDrawnTotals
    if (!lastLayout || !totals) return 0
    let selected = new Set(lastLayout.nodes.filter(n => item !== null && n.itemKey === item).map(n => n.id))
    if (hoverCard !== null) selected.add(hoverCard)
    if (selected.size === 0) return 0
    let placed = []
    for (let edge of lastLayout.edges) {
        let outgoing = selected.has(edge.source)
        if (!outgoing && !selected.has(edge.target)) continue
        let label = findLabel(edge)
        let lineItem = spec.items.get(edge.item)
        let to = spec.recipes.get(edge.target) || null
        if (!label || !lineItem || !to) continue
        let rate = edge.rateExact ?? Rational.from_float(edge.rate)
        let from = edge.source.startsWith("in:") ? null : spec.recipes.get(edge.source) || null
        let {supplier, consumer} = linkMachines(totals, lineItem, from, to, rate)
        let chip = lineChip(lineItem, rate)
        let mine = outgoing ? supplier : consumer
        let mineRecipe = outgoing ? from : to
        if (mine) {
            chip.push(textSpan("|", "sep"), spec.getBuilding(mineRecipe).icon.make(18, true), textSpan(machineWords(mine, outgoing ? "send" : "use")))
        }
        swapChildren(label, chip, "chip", null)
        label.classList.add("pinned")
        let theirs = outgoing ? consumer : supplier
        // A line between two focused cards (the selection and the hovered
        // card) keeps the chip; the far card's line isn't swapped twice.
        if (theirs && !selected.has(outgoing ? edge.target : edge.source)) {
            answerOnCard(outgoing ? edge.target : edge.source, outgoing ? to : from, theirs, outgoing ? "use" : "send", null)
        }
        placed.push({el: label, x: edge.lx, y: edge.ly, w: label.offsetWidth, h: label.offsetHeight})
    }
    let ys = stackLabels(placed.map((p, id) => ({id, x: p.x, y: p.y, h: p.h})), 6)
    placed.forEach((p, id) => { p.el.style.top = ys.get(id) + "px" })
    return placed.reduce((w, p) => Math.max(w, p.w), 0)
}

// The selected item's node(s) get their edges/labels marked "hot" -- there
// is no hover state any more (see the module header comment). Edge labels
// (`.elbl`) carry the same data-from/data-to as their edge and follow it,
// so a hot label survives zoomed-out label hiding (see the `small` toggle
// in ensureZoom()).
function refreshEdgeHot() {
    let ids = new Set()
    if (spec.whereItem !== null) {
        document.querySelectorAll("#flow-nodes .node").forEach(el => {
            if (el.dataset.item === spec.whereItem) ids.add(el.dataset.node)
        })
    }
    document.querySelectorAll("#flow path.edge").forEach(p => {
        p.classList.toggle("hot", ids.has(p.dataset.from) || ids.has(p.dataset.to))
    })
    document.querySelectorAll("#flow-nodes .elbl").forEach(l => {
        l.classList.toggle("hot", ids.has(l.dataset.from) || ids.has(l.dataset.to))
    })
}

function containerSize() {
    let container = document.querySelector("#flow-container")
    return container ? {width: container.clientWidth, height: container.clientHeight} : {width: 0, height: 0}
}

// Fits the whole graph inside the container, centred, never scaling nodes
// above their natural size. A hidden/zero-size container can't be fitted;
// leave needsFit set so the next render or resize tries again. The 40/190px
// margins (not a symmetric pad) are pinned: they keep the graph clear of the
// Make panel (top-left) and the footer (bottom), which float over the
// canvas rather than reserving layout space. #graph-side (details.js) and
// #flow-fit sit on top of the canvas as absolute overlays, not reserved
// width -- the graph always fits the whole #flow-container.
export function fitToView() {
    if (lastLayout === null || zoomBehavior === null) return
    let {width: W, height: H} = containerSize()
    if (W === 0 || H === 0) return
    let k = Math.min(1, (W - 40) / lastLayout.width, (H - 190) / lastLayout.height)
    if (!isFinite(k) || k <= 0) return
    let tx = (W - lastLayout.width * k) / 2
    let ty = 96 + Math.max(0, (H - 190 - lastLayout.height * k) / 2)
    d3.select("#flow-container").call(zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(k))
    needsFit = false
    isFitted = true
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
            // event.sourceEvent is set only for a zoom/pan the user actually
            // drove (wheel, drag, pinch); fitToView()/focusNode() call
            // zoomBehavior.transform programmatically, which fires this
            // handler too but with sourceEvent null.
            if (event.sourceEvent) isFitted = false
            let t = event.transform
            let css = `translate(${t.x}px, ${t.y}px) scale(${t.k})`
            if (viewport !== null) viewport.attr("transform", t)
            let nodesLayer = document.querySelector("#flow-nodes")
            nodesLayer.style.transform = css
            document.querySelector("#flow-columns").style.transform = css
            // Below this scale the 11px edge labels overlap into unreadable
            // clutter on a wide graph; hide the non-hot ones (see calc.css).
            nodesLayer.classList.toggle("small", t.k < 0.6)
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
    if (!container) return
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

function renderNodes(laidOut) {
    let nodesLayer = document.querySelector("#flow-nodes")
    if (!nodesLayer) return
    nodesLayer.replaceChildren()
    for (let node of laidOut.nodes) {
        nodesLayer.appendChild(nodeMarkup(node))
    }
}

function renderEdges(laidOut) {
    let svgEl = document.querySelector("svg#flow")
    if (!svgEl) return
    let nodeKind = new Map(laidOut.nodes.map(n => [n.id, n.kind]))
    let svg = d3.select(svgEl)
    svg.selectAll("*").remove()
    viewport = svg.append("g").classed("viewport", true)
    viewport.attr("transform", d3.zoomTransform(document.querySelector("#flow-container")))
    viewport.selectAll("path")
        .data(laidOut.edges)
        .join("path")
            .attr("class", d => nodeKind.get(d.source) === "input" ? "edge in" : "edge")
            .attr("d", d => d.d)
            .attr("data-from", d => d.source)
            .attr("data-to", d => d.target)
            .attr("stroke-width", d => d.width)
    // A wide invisible twin per edge, so a thin line is easy to hover.
    restoreLine = []
    viewport.selectAll("path.hit")
        .data(laidOut.edges)
        .join("path")
            .attr("class", "hit")
            .attr("d", d => d.d)
            .attr("data-from", d => d.source)
            .attr("data-to", d => d.target)
            .attr("data-item", d => d.item)
            .on("mouseenter", (_event, d) => hoverIntent(() => showLineHover(d)))
            .on("mouseleave", () => hoverIntent(null))

    // Edge rate labels are plain HTML (like the node cards) rather than SVG
    // <text>, positioned at the edge's own midpoint (lx/ly, from layered()).
    // `edge.rateExact` is the exact Rational carried from buildModel's links
    // (null only for a merged edge whose inputs lacked one); falling back to
    // Rational.from_float(edge.rate) there avoids a float round-trip that
    // would otherwise print "10.0/min" next to a card reading "10/min".
    let nodesLayer = document.querySelector("#flow-nodes")
    if (!nodesLayer) return
    for (let edge of laidOut.edges) {
        let label = document.createElement("div")
        label.className = "elbl num"
        label.style.left = edge.lx + "px"
        label.style.top = edge.ly + "px"
        label.dataset.from = edge.source
        label.dataset.to = edge.target
        let exact = edge.rateExact ?? Rational.from_float(edge.rate)
        label.textContent = `${spec.format.rate(exact)}${RATE_LABEL[spec.format.rateName] || "/min"}`
        label.dataset.item = edge.item
        label.addEventListener("mouseenter", () => hoverIntent(() => showLineHover(edge)))
        label.addEventListener("mouseleave", () => hoverIntent(null))
        nodesLayer.appendChild(label)
    }
}

// flow-core's default gap between columns, and the room a selection chip
// needs either side of it before the gaps widen.
const BASE_COL_GAP = 96
const CHIP_MARGIN = 32
// The widest gap any chip has needed since the last solve; kept so the
// graph widens once instead of breathing on every hover.
let stickyGap = BASE_COL_GAP

// The full draw pass, called whenever the Graph view needs a picture: on a
// fresh solve while it's showing, and once when calc:view switches to it
// (see initFlow()).
function draw(totals) {
    if (spec.buildTargets.length === 0 || totals === null) {
        document.querySelector("#flow-columns")?.replaceChildren()
        document.querySelector("#flow-nodes")?.replaceChildren()
        d3.select("svg#flow").selectAll("*").remove()
        lastLayout = null
        lastNodeIdsKey = null
        return
    }

    // Set here, not in renderFlow(), so a draw() triggered off the
    // calc:view listener (a solve whose renderFlow() call returned early
    // because the Graph view wasn't showing yet) also marks itself drawn --
    // otherwise a later renderFlow() call with that same totals/key would
    // wrongly dedupe away a redraw the page never actually did (e.g. rate
    // unit changes while off Graph, then back).
    lastDrawnTotals = totals
    lastDrawnKey = renderKey()

    let model = buildModel(totals)

    // 210x58: the prototype's .gcard size, which calc.css's .node now
    // matches exactly -- these are the inline width/height nodeMarkup()
    // writes onto each card, so a mismatch here would leave .node's CSS
    // size dead.
    let ranks = rankNodes(model).rank
    ensureZoom()
    // A selected card's chips are wider than a plain rate label; when the
    // widest doesn't fit the gap between columns, lay out again with gaps
    // wide enough for it (the graph spreads out; see keepAnchor()).
    let colGap = stickyGap
    let laidOut = null
    for (let pass = 0; pass < 2; pass++) {
        laidOut = layered(model, {nodeWidth: 210, nodeHeight: 58, ranks, colGap})
        lastLayout = laidOut
        renderColumns(laidOut)
        renderNodes(laidOut)
        renderEdges(laidOut)
        // Node markup already sets .sel from spec.whereItem, but the edges it
        // implies (e.g. a selection carried in from the page's own fragment on
        // the very first draw) need the same pass the details card's open/close
        // uses.
        refreshEdgeHot()
        let widest = renderSelectionChips()
        if (widest + CHIP_MARGIN <= colGap) break
        colGap = Math.ceil(widest + CHIP_MARGIN)
        stickyGap = colGap
    }

    let idsKey = laidOut.nodes.map(n => n.id).sort().join(",")
    if (idsKey !== lastNodeIdsKey) {
        lastNodeIdsKey = idsKey
        needsFit = true
    }
    if (needsFit) fitWithRetry()
}

// fitToView() early-returns on a 0x0 container -- true not just while the
// dataset fetch is pending but on a first load of a view=graph link, where
// header.js's calc:view dispatch (and the renderer that draws off it, see
// below) runs before header's own renderer has unhidden #graph-frame.
// Deferring one tick gives that renderer a chance to run first; if the
// container is still 0x0 even then (e.g. two renderers land in the same
// microtask but different timer callbacks), retry exactly once more rather
// than looping forever. setTimeout, not requestAnimationFrame: headless
// Edge under the page tests' --virtual-time-budget never fires rAF, so a
// deferral built on it would just never run there (see the note near
// tests/test_calc_page.py:124); a 0ms timer advances under virtual time the
// same as it would after one real frame.
function fitWithRetry() {
    setTimeout(() => {
        fitToView()
        if (needsFit) setTimeout(() => fitToView(), 0)
    }, 0)
}

// `spec` is always the module singleton imported above; the renderer
// registry calls every renderer as fn(spec, totals) so the parameter is
// kept (unused) to match that shape. The graph only actually redraws while
// it's the visible view (spec.view === "graph"); otherwise it just
// remembers `totals` for the calc:view listener below to draw with once the
// container has a real size to fit into.
function renderFlow(_spec, totals) {
    lastTotals = totals
    if (spec.view !== "graph") return
    if (spec.buildTargets.length !== 0 && totals === lastDrawnTotals && renderKey() === lastDrawnKey) return
    if (totals !== lastDrawnTotals) {
        stickyGap = BASE_COL_GAP
        hoverCard = null
    }
    draw(totals)
}

// Selecting (or closing) a card redraws the graph, since its chips can
// widen the column gaps; the card keeps its place on screen so the graph
// spreads around it instead of jumping under the mouse.
let lastSelected = null

function redrawForSelection() {
    let anchorItem = spec.whereItem ?? lastSelected
    lastSelected = spec.whereItem
    if (spec.view !== "graph" || !lastDrawnTotals || !lastLayout) {
        updateSelectionClasses()
        return
    }
    let before = lastLayout.nodes.find(n => n.itemKey === anchorItem)
    draw(lastDrawnTotals)
    if (before) keepAnchor(before)
    // After #graph-side has opened (details.js renders off the same event).
    if (spec.whereItem !== null) setTimeout(bringSelectionIntoView, 0)
}

// Pans (never zooms) the least amount that shows the selected card and
// every card it connects to, clear of the details panel on the right; a
// neighbourhood too wide for the view is lined up on its left edge.
function bringSelectionIntoView() {
    if (!lastLayout || zoomBehavior === null || spec.whereItem === null) return
    let ids = new Set()
    for (let n of lastLayout.nodes) {
        if (n.itemKey !== spec.whereItem) continue
        for (let id of hoverSet(lastLayout.edges, n.id).nodes) ids.add(id)
    }
    let nodes = lastLayout.nodes.filter(n => ids.has(n.id))
    if (nodes.length === 0) return
    let container = document.querySelector("#flow-container")
    let {width, height} = containerSize()
    let side = document.querySelector("#graph-side")
    let right = width - (side && !side.hidden ? side.offsetWidth : 0)
    let t = d3.zoomTransform(container)
    let pad = 24
    let shift = (lo, hi, min, max) => {
        if (hi - lo > max - min - 2 * pad || lo < min + pad) return min + pad - lo
        if (hi > max - pad) return max - pad - hi
        return 0
    }
    let dx = shift(Math.min(...nodes.map(n => n.x)) * t.k + t.x, Math.max(...nodes.map(n => n.x + n.w)) * t.k + t.x, 0, right)
    let dy = shift(Math.min(...nodes.map(n => n.y)) * t.k + t.y, Math.max(...nodes.map(n => n.y + n.h)) * t.k + t.y, 0, height)
    if (dx === 0 && dy === 0) return
    d3.select(container).call(zoomBehavior.translateBy, dx / t.k, dy / t.k)
}

function keepAnchor(before) {
    let after = lastLayout && lastLayout.nodes.find(n => n.id === before.id)
    if (!after || zoomBehavior === null || needsFit) return
    let dx = before.x - after.x
    let dy = before.y - after.y
    if (dx === 0 && dy === 0) return
    d3.select("#flow-container").call(zoomBehavior.translateBy, dx, dy)
}

function updateSelectionClasses() {
    let sel = spec.whereItem
    document.querySelectorAll("#flow-nodes .node").forEach(el => {
        el.classList.toggle("sel", sel !== null && el.dataset.item === sel)
    })
    refreshEdgeHot()
}

export function initFlow() {
    registerRenderer(renderFlow)

    document.addEventListener("calc:select", redrawForSelection)

    // The container is hidden (0-size) until the view actually switches to
    // Graph, so a solve that happened while on Table couldn't have fitted
    // anything. header.js dispatches this event BEFORE its own renderer
    // unhides #graph-frame (applyVisibility runs after the dispatch), so
    // drawing/fitting on the same tick would still see a 0x0 container;
    // deferring gives that unhide a chance to land first. setTimeout, not
    // requestAnimationFrame -- see the comment on fitWithRetry().
    document.addEventListener("calc:view", event => {
        if (event.detail && event.detail.view === "graph" && lastTotals) {
            setTimeout(() => {
                draw(lastTotals)
                fitToView()
            }, 0)
        }
    })

    window.addEventListener("resize", () => {
        if (needsFit) fitToView()
    })
    // This observer catches every way #flow-container's box changes size
    // (window resize is also covered by the listener above, but a
    // ResizeObserver additionally fires for layout-only changes with no
    // window resize event, e.g. switching to the Graph view).
    let container = document.querySelector("#flow-container")
    if (container) {
        new ResizeObserver(() => {
            if (isFitted) fitToView()
        }).observe(container)
    }
    document.querySelector("#flow-fit")?.addEventListener("click", () => fitToView())
}
