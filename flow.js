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
import { buildFlowModel, cardHeight, dashArray, hoverSet, itemStyles, layered, lineStyle, rankNodes, stackLabels } from "./flow-core.js"
import { beaconBadge, moduleStrip } from "./modules-strip.js"
import { RATE_LABEL } from "./table-core.js"
import { linkMachines } from "./details.js"
import { beltWords, lineEnd, lineRatio, perBelt } from "./ratio-core.js"
import { tierWord } from "./colorblind.js"

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
    // beltFormat too: chipGap measures chips with their belt wording.
    // modulesVersion: commitModules() redisplays with the same totals object
    // when only speed/power moved (no re-solve), so without this a module
    // edit that doesn't change machine counts enough to move the totals
    // would leave stale cards -- see modules-editor.js's commit path.
    return `${spec.format.rateName}:${spec.format.ratePrecision}:${spec.belt.key}:${spec.format.beltFormat}:${spec.modulesVersion}`
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

// The modules this card's recipe runs with: 16px slot icons under the
// machine line and a "beacon ×N" badge. Null for a card whose machine has
// no module slots (or no machine).
function cardModules(recipe, node) {
    if (!recipe || !node.machine || node.machine.moduleSlots === 0) return null
    let moduleSpec = spec.getModuleSpec(recipe)
    if (!moduleSpec) return null
    let line = document.createElement("span")
    line.className = "mods"
    line.appendChild(moduleStrip(moduleSpec.modules, 16))
    let badge = beaconBadge(moduleSpec.beaconModules, moduleSpec.beaconCount, 14, false)
    if (badge) line.appendChild(badge)
    return line
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
    if (recipe && spec.handSet.has(recipe.key)) div.classList.add("hand")
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
    let mods = cardModules(recipe, node)
    if (mods) {
        mid.appendChild(mods)
        div.classList.add("has-mods")
    }
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
const HOVER_SWITCH = 250
const HOVER_OUT = 300
let hoverTimer = null
let hoverShowing = false

// Moving onto a chip that's showing keeps whatever it belongs to: the
// pending clear (from leaving the card or line) or switch (from crossing
// another line on the way) is cancelled.
function hoverKeep() {
    if (hoverShowing) clearTimeout(hoverTimer)
}

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
// of its lines (applyFocus). The column gaps are already wide enough for
// any chip (chipGap), so nothing moves.
let hoverCard = null

function showCardHover(id) {
    setLineHover(null)
    if (hoverCard !== id) {
        hoverCard = id
        applyFocus()
    }
    setHover(id)
}

function clearCardHover() {
    if (hoverCard === null) return
    hoverCard = null
    applyFocus()
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
    restack()
}

// Hovering one line (its path or its label) lights just that line and its
// two cards, and answers on them instead of in a pop-up: the label turns
// into item icon, rate, belt icon and belts (spec.format.beltFormat), the
// sending card says how many of its machines this line takes and the
// receiving card how many of its machines it feeds. `restoreLine` undoes
// every swap.
let restoreLine = []

function setLineHover(edge) {
    let had = restoreLine.length > 0
    for (let undo of restoreLine) undo()
    restoreLine = []
    if (had) restack()
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
    if (label && !label.classList.contains("pinned")) {
        swapChildren(label, lineChip(item, rate), "chip")
        restack()
    }
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

// A hovered or focused line's chip: item icon, rate, belt icon and belts
// on the first row; `machines` adds a second row: {recipe, words} for one
// side's machine icon and share, or bothEnds()'s {from, to, ratio} for the
// machines at each end and the ratio between them; its `belt` (beltRow())
// adds a third row, the machines one full belt covers.
function lineChip(item, rate, machines = null) {
    let row = document.createElement("div")
    row.className = "chip-row"
    row.append(...withWord(item, item.icon.make(18, true)), textSpan(`${spec.format.rate(rate)}${RATE_LABEL[spec.format.rateName] || "/min"}`), textSpan("|", "sep"))
    if (item.phase === "fluid") {
        let pipe = spec.items.get("pipe")
        if (pipe) row.append(pipe.icon.make(18, true))
        row.append(textSpan("pipe"))
    } else {
        row.append(...withWord(spec.belt, spec.belt.icon.make(18, true)), textSpan(beltWords(spec.getBeltCount(rate).toFloat(), spec.format.beltFormat)))
    }
    if (machines === null) return [row]
    let second = document.createElement("div")
    second.className = "chip-row machines"
    if (machines.ratio) {
        second.append(
            spec.getBuilding(machines.fromRecipe).icon.make(18, true), textSpan(machines.from), textSpan("→"),
            spec.getBuilding(machines.toRecipe).icon.make(18, true), textSpan(machines.to),
            textSpan("|", "sep"), textSpan(machines.ratio))
    } else {
        second.append(spec.getBuilding(machines.recipe).icon.make(18, true), textSpan(machines.words))
    }
    if (!machines.belt) return [row, second]
    let {belt} = machines
    let third = document.createElement("div")
    third.className = "chip-row machines"
    third.append(...withWord(spec.belt, spec.belt.icon.make(18, true)), textSpan("1 belt:"))
    let end = (recipe, count) => [spec.getBuilding(recipe).icon.make(18, true), textSpan(count)]
    if (belt.from !== null) third.append(...end(belt.fromRecipe, belt.from))
    if (belt.from !== null && belt.to !== null) third.append(textSpan("→"))
    if (belt.to !== null) third.append(...end(belt.toRecipe, belt.to))
    return [row, second, third]
}

// An icon followed by its colour word in colour-blind mode (belts,
// splitters, inserters), since at graph zoom the icon's own badge is too
// small to read.
function withWord(obj, icon) {
    let word = tierWord(obj)
    return word ? [icon, word] : [icon]
}

// "32 of 56 send this" out of the whole machines the card itself shows
// ("56 × ..."), not the exact 55.8, so the two numbers on one card agree.
function machineWords(machines, verb) {
    return lineEnd(machines.count, Math.ceil(machines.total - 1e-9), verb)
}

// A line with machines at both ends: how many of the sender's feed how many
// of the receiver's, and the ratio with the focused end (`root`, "from" or
// "to") as 1 -- copper cable focused, 13.33 of 134 foundries -> 480
// assembling machines, 1 : 36. Totals are whole, as machineWords' are.
function bothEnds(line, root) {
    let whole = m => ({count: m.count, total: Math.ceil(m.total - 1e-9)})
    return {fromRecipe: line.from, toRecipe: line.to, ...lineRatio(whole(line.supplier), whole(line.consumer), root), belt: beltRow(line)}
}

// The machines at each end one full belt of the line covers -- copper
// cable into advanced circuits, 5 foundries -> 180 assemblers per belt;
// null for a fluid, or when neither end has a machine.
function beltRow(line) {
    if (line.item.phase === "fluid" || (!line.supplier && !line.consumer)) return null
    let belt = perBelt(line.supplier ? line.supplier.count : null, line.consumer ? line.consumer.count : null,
        spec.getBeltCount(line.rate).toFloat())
    return belt && {fromRecipe: line.from, toRecipe: line.to, ...belt}
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

// The cards in focus -- the selected item's (a click) and the hovered one
// -- answer on every one of their lines at once: each line's label becomes
// the chip plus how many of the focused card's machines that line takes,
// and the card at the other end says how many of its machines it feeds or
// is fed by. Chips sharing a column gap are stacked so none overlap
// (stackLabels). Everything is swapped in place and undone through
// `focusUndo`, so focusing never lays the graph out again.
let focusUndo = []

function lineMachines(edge) {
    let item = spec.items.get(edge.item)
    let to = spec.recipes.get(edge.target) || null
    if (!item || !to || !lastDrawnTotals) return null
    let rate = edge.rateExact ?? Rational.from_float(edge.rate)
    let from = edge.source.startsWith("in:") ? null : spec.recipes.get(edge.source) || null
    return {item, rate, from, to, ...linkMachines(lastDrawnTotals, item, from, to, rate)}
}

function applyFocus() {
    let had = focusUndo.length > 0
    for (let undo of focusUndo.reverse()) undo()
    focusUndo = []
    if (had) restack()
    if (!lastLayout) return
    let item = spec.whereItem
    let focused = new Set(lastLayout.nodes.filter(n => item !== null && n.itemKey === item).map(n => n.id))
    if (hoverCard !== null) focused.add(hoverCard)
    if (focused.size === 0) return
    let placed = []
    for (let edge of lastLayout.edges) {
        let outgoing = focused.has(edge.source)
        if (!outgoing && !focused.has(edge.target)) continue
        let label = findLabel(edge)
        let line = lineMachines(edge)
        if (!label || !line) continue
        let mine = outgoing ? line.supplier : line.consumer
        let machines = null
        if (line.supplier && line.consumer) {
            machines = bothEnds(line, outgoing ? "from" : "to")
        } else if (mine) {
            machines = {recipe: outgoing ? line.from : line.to, words: machineWords(mine, outgoing ? "send" : "use"), belt: beltRow(line)}
        }
        swapChildren(label, lineChip(line.item, line.rate, machines), "chip", focusUndo)
        label.classList.add("pinned")
        focusUndo.push(() => label.classList.remove("pinned"))
        let theirs = outgoing ? line.consumer : line.supplier
        // A line between two focused cards keeps its chip; the far card's
        // machine line isn't swapped twice.
        if (theirs && !focused.has(outgoing ? edge.target : edge.source)) {
            answerOnCard(outgoing ? edge.target : edge.source, outgoing ? line.to : line.from, theirs, outgoing ? "use" : "send", focusUndo)
        }
    }
    restack()
}

// Every label in a column gap stacked so none overlap (flow-core's
// stackLabels), each as near its own line as the others allow: a gap that
// many lines leave from (iron plate, gears) would otherwise pile its rates
// on top of one another. Rerun whenever a label turns into a chip or back,
// since chips are taller. A label hidden while zoomed out measures 0, so
// it's counted at a plain label's height.
function restack() {
    // While hovering only the lit labels show (calc.css hides the rest), so
    // only they are stacked, close together; the rest keep their places
    // until the hover ends and this runs again for all of them.
    let hovering = document.querySelector("#flow-container")?.classList.contains("hovering")
    let labels = [...document.querySelectorAll("#flow-nodes .elbl")].filter(el => !hovering || el.classList.contains("lit"))
    let ys = stackLabels(labels.map((el, id) => ({id, x: Number(el.dataset.lx), y: Number(el.dataset.ly), h: el.offsetHeight || PLAIN_LABEL_H})), 3)
    labels.forEach((el, id) => { el.style.top = ys.get(id) + "px" })
}

// The gap between columns that fits the widest chip any line of this plan
// could show, measured off-screen before layout so hovering or clicking
// never has to lay the graph out again (and chips never reach into the
// stage columns).
function chipGap(edges) {
    // On <body>, not in #flow-nodes: zoomed out, #flow-nodes.small hides
    // every label that isn't hot, and a hidden chip measures 0 wide.
    let probe = document.createElement("div")
    // cb-probe: measured with the colour-blind words showing, so turning
    // the mode on later never makes a chip outgrow its gap.
    probe.className = "cb-probe"
    probe.style.cssText = "position: absolute; left: 0; top: 0; visibility: hidden; pointer-events: none;"
    document.body.appendChild(probe)
    let widest = 0
    for (let edge of edges) {
        let line = lineMachines(edge)
        if (!line) continue
        // every machine row applyFocus could give it, whichever end is focused
        let rows = line.supplier && line.consumer
            ? [bothEnds(line, "from"), bothEnds(line, "to")]
            : [
                line.supplier && {recipe: line.from, words: machineWords(line.supplier, "send"), belt: beltRow(line)},
                line.consumer && {recipe: line.to, words: machineWords(line.consumer, "use"), belt: beltRow(line)},
            ].filter(Boolean)
        for (let machines of rows.length ? rows : [null]) {
            let chip = document.createElement("div")
            chip.className = "elbl chip"
            chip.style.transform = "none"
            chip.append(...lineChip(line.item, line.rate, machines))
            probe.appendChild(chip)
            widest = Math.max(widest, chip.offsetWidth)
        }
    }
    probe.remove()
    return Math.max(BASE_COL_GAP, Math.ceil(widest + CHIP_MARGIN))
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
    // A view=graph link draws while the graph is still hidden, where every
    // chip measures 0 tall; this is the first moment they have real sizes.
    restack()
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
    // One look per item (flow-core's lineStyle): colour and dash pattern,
    // so lines can be told apart and followed without hovering.
    let styles = itemStyles(laidOut.edges)
    let look = d => lineStyle(styles.get(d.item) ?? 0)
    viewport.selectAll("path")
        .data(laidOut.edges)
        .join("path")
            .attr("class", d => nodeKind.get(d.source) === "input" ? "edge in" : "edge")
            .attr("d", d => d.d)
            .attr("data-from", d => d.source)
            .attr("data-to", d => d.target)
            .attr("data-item", d => d.item)
            .attr("stroke-width", d => d.width)
            .style("stroke", d => look(d).color)
            .style("stroke-dasharray", d => dashArray(look(d).dash, d.width))
            .style("stroke-linecap", d => look(d).dash ? "round" : null)
    // A wide invisible twin per edge, so a thin line is easy to hover.
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
        label.dataset.lx = edge.lx
        label.dataset.ly = edge.ly
        label.dataset.from = edge.source
        label.dataset.to = edge.target
        let exact = edge.rateExact ?? Rational.from_float(edge.rate)
        let {color, dash} = look(edge)
        label.style.borderColor = color
        label.append(lineSwatch(color, dash))
        let item = spec.items.get(edge.item)
        if (item) label.append(...withWord(item, item.icon.make(14, true)))
        label.append(textSpan(`${spec.format.rate(exact)}${RATE_LABEL[spec.format.rateName] || "/min"}`))
        label.dataset.item = edge.item
        label.addEventListener("mouseenter", () => {
            if (label.classList.contains("chip")) hoverKeep()
            else hoverIntent(() => showLineHover(edge))
        })
        label.addEventListener("mouseleave", () => hoverIntent(null))
        nodesLayer.appendChild(label)
    }
}

// A short sample of a line's colour and dash, leading its label, so a
// label can be matched to its line at a glance.
function lineSwatch(color, dash) {
    let ns = "http://www.w3.org/2000/svg"
    let svg = document.createElementNS(ns, "svg")
    svg.setAttribute("width", "22")
    svg.setAttribute("height", "8")
    svg.setAttribute("class", "swatch")
    let line = document.createElementNS(ns, "line")
    for (let [k, v] of [["x1", "2"], ["y1", "4"], ["x2", "20"], ["y2", "4"], ["stroke", color], ["stroke-width", "3"]]) line.setAttribute(k, v)
    if (dash) {
        line.setAttribute("stroke-dasharray", dashArray(dash, 1.2))
        line.setAttribute("stroke-linecap", "round")
    }
    svg.appendChild(line)
    return svg
}

// flow-core's default gap between columns, and the room a chip needs
// either side of it (see chipGap()).
const BASE_COL_GAP = 96
const CHIP_MARGIN = 32
const PLAIN_LABEL_H = 18

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
    // Wide enough for any line's chip, decided once per solve (chipGap);
    // as tall as the module strip needs, decided once per solve too
    // (cardHeight). The strip is never part of a chip or of the machine
    // line answerOnCard swaps, so neither measurement changes on hover.
    let laidOut = layered(model, {nodeWidth: 210, nodeHeight: cardHeight(model.nodes), ranks, colGap: chipGap(model.edges)})
    lastLayout = laidOut
    focusUndo = []
    restoreLine = []
    renderColumns(laidOut)
    renderNodes(laidOut)
    renderEdges(laidOut)
    // Node markup already sets .sel from spec.whereItem, but the edges it
    // implies (e.g. a selection carried in from the page's own fragment on
    // the very first draw) need the same pass the details card's open/close
    // uses.
    refreshEdgeHot()
    restack()
    applyFocus()

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
    if (totals !== lastDrawnTotals) hoverCard = null
    draw(totals)
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

    document.addEventListener("calc:select", () => {
        updateSelectionClasses()
        setLineHover(null)
        applyFocus()
    })

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
