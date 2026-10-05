// calc/flow-core.js — pure model-building and layered left-to-right layout
// math for the Flow tab. Imports nothing that touches window/document/d3/dagre
// at import time; this file stays node-testable (see
// tests/js/calc_flow_check.mjs).

// Belt-load edge width in SVG px: 1.5px minimum (so a hairline flow is still
// visible) growing with belt count, capped at 8px so a firehose input
// doesn't dwarf the diagram.
export function edgeWidth(belts) {
    return Math.min(8, 1.5 + 5 * belts)
}

// spec: {recipes: [{key, name, isReal, isDisable, isResource, isTarget, count, machine}],
//        links: [{item, itemName, from, to, rate, rateExact, belts}]}
// A link's `from`/`to` are recipe keys (or `from: null` for a link with no
// producer at all). Two kinds of recipe never get a node of their own:
// isReal: false is the solver's internal OutputRecipe/SurplusRecipe sink
// (skipped entirely, not even drawn as an edge endpoint by the caller);
// isDisable: true is the `D-` stand-in for a supplied/ignored item (real,
// but not a production step) -- a link sourced from one is folded into a
// synthetic "input" node keyed by item instead. `sink: true` is the caller's
// stand-in for what the solver leaves over (a "Left over" or "Send out"
// card); it becomes a node of kind "sink".
export function buildFlowModel({recipes, links}) {
    const recipeByKey = new Map(recipes.map(r => [r.key, r]))
    const nodes = new Map()

    for (const r of recipes) {
        if (!r.isReal || r.isDisable) continue
        const kind = r.sink ? "sink" : r.isResource ? "mined" : r.isTarget ? "target" : "recipe"
        nodes.set(r.key, {id: r.key, kind, label: r.name, count: r.count, machine: r.machine})
    }

    const edges = new Map()
    for (const link of links) {
        if (!(link.rate > 0)) continue
        const producer = link.from === null ? null : recipeByKey.get(link.from)
        let source
        if (producer && producer.isReal && !producer.isDisable) {
            source = link.from
        } else {
            source = "in:" + link.item
            if (!nodes.has(source)) {
                nodes.set(source, {id: source, kind: "input", label: link.itemName, count: null, machine: null})
            }
        }
        const key = source + "|" + link.to + "|" + link.item
        const existing = edges.get(key)
        if (existing) {
            existing.rate += link.rate
            // A merge with either side missing rateExact can't be summed exactly,
            // so the label falls back to the float sum (see renderEdges()).
            existing.rateExact = existing.rateExact && link.rateExact ? existing.rateExact.add(link.rateExact) : null
            existing.belts += link.belts
        } else {
            edges.set(key, {source, target: link.to, item: link.item, itemName: link.itemName, rate: link.rate, rateExact: link.rateExact ?? null, belts: link.belts})
        }
    }

    return {
        nodes: [...nodes.values()],
        edges: [...edges.values()].map(e => ({...e, width: edgeWidth(e.belts)})),
    }
}

// Lays `model` out left-to-right (or per `rankdir`) with `dagreLib`
// (a UMD `dagre` module handed in by the caller) and returns node top-left
// corners plus edge endpoints running from the source node's right-middle
// to the target node's left-middle.
export function layout(model, dagreLib, {rankdir = "LR", ranksep = 140, nodesep = 24, nodeWidth = 210, nodeHeight = 44} = {}) {
    // dagre's g.graph().width/height is -Infinity for a graph with no
    // nodes (it maxes over an empty set); short-circuit rather than hand
    // a caller a negative-infinite SVG viewBox.
    if (model.nodes.length === 0) {
        return {nodes: [], edges: [], width: 0, height: 0}
    }
    const g = new dagreLib.graphlib.Graph()
    g.setGraph({rankdir, ranksep, nodesep})
    g.setDefaultEdgeLabel(() => ({}))
    for (const n of model.nodes) {
        g.setNode(n.id, {width: nodeWidth, height: nodeHeight})
    }
    for (const e of model.edges) {
        g.setEdge(e.source, e.target)
    }
    dagreLib.layout(g)

    const nodes = model.nodes.map(n => {
        const dn = g.node(n.id)
        return {...n, x: dn.x - nodeWidth / 2, y: dn.y - nodeHeight / 2}
    })
    const nodeById = new Map(nodes.map(n => [n.id, n]))
    const edges = model.edges.map(e => {
        const s = nodeById.get(e.source)
        const t = nodeById.get(e.target)
        return {
            ...e,
            x1: s.x + nodeWidth,
            y1: s.y + nodeHeight / 2,
            x2: t.x,
            y2: t.y + nodeHeight / 2,
        }
    })
    const {width, height} = g.graph()
    // Clamp to a finite, non-negative value so a caller building an SVG
    // viewBox never sees NaN/-Infinity from a degenerate graph.
    const clamp = v => (Number.isFinite(v) && v > 0 ? v : 0)
    return {nodes, edges, width: clamp(width), height: clamp(height)}
}

export function edgePath(e) {
    const dx = Math.max(60, (e.x2 - e.x1) / 2)
    return `M ${e.x1} ${e.y1} C ${e.x1 + dx} ${e.y1}, ${e.x2 - dx} ${e.y2}, ${e.x2} ${e.y2}`
}

// Ranks a model: cycle-breaking DFS, then longest path from the sources,
// then sinks pinned to the last rank. Returned separately from layered()
// so flow.js can rank the FULL model and lay out only the visible part
// of it -- a folded card then keeps its stage column instead of being
// re-ranked as a source. `rankEdges` are the model's edges minus the
// back edges the DFS dropped.
export function rankNodes(model) {
    const ids = model.nodes.map(n => n.id)
    const out = new Map(ids.map(id => [id, []]))
    const inn = new Map(ids.map(id => [id, []]))
    const state = new Map()  // 0 unvisited, 1 on stack, 2 done
    for (const e of model.edges) out.get(e.source).push(e.target)
    const back = new Set()
    const visit = (v) => {
        state.set(v, 1)
        for (const w of out.get(v)) {
            const s = state.get(w) || 0
            if (s === 1) back.add(v + "|" + w)
            else if (s === 0) visit(w)
        }
        state.set(v, 2)
    }
    for (const id of ids) if (!state.get(id)) visit(id)
    const rankEdges = []
    for (const e of model.edges) if (!back.has(e.source + "|" + e.target)) { rankEdges.push(e); inn.get(e.target).push(e.source) }
    const rank = new Map()
    const rankOf = (v) => {
        if (rank.has(v)) return rank.get(v)
        rank.set(v, 0)  // guard against a residual cycle
        let r = 0
        for (const p of inn.get(v)) r = Math.max(r, rankOf(p) + 1)
        rank.set(v, r)
        return r
    }
    ids.forEach(rankOf)
    pinSinks(ids, rank, rankEdges)
    return {rank, rankEdges}
}

function pinSinks(ids, rank, rankEdges) {
    const maxRank = ids.length ? Math.max(...rank.values()) : 0
    const hasOut = new Set(rankEdges.map(e => e.source))
    for (const id of ids) if (!hasOut.has(id)) rank.set(id, maxRank)
}

// Layered, left-to-right layout ported from the graph-first prototype's
// renderVals() (docs/superpowers/mockups/calculator/graph-first/Main.tpl.html),
// plus cycle breaking so a recipe loop (e.g. a chemical-plant cycle) still
// ranks every node instead of recursing forever. Column 0 is everything
// brought in (sources); the last column is every sink (targets and anything
// else nothing consumes), pinned there even if its longest path is shorter.
//
// direction "TB" lays the same ranks out top to bottom instead (a phone's
// graph): each rank is a row, its cards side by side, with a headerHeight
// strip above them for the stage label. Steps 1-4 never see the direction;
// placement works in rank ("main") and across-rank ("cross") coordinates
// and toXY() turns them into x/y at the end. colGap is the gap between
// ranks and rowGap the gap between cards in a rank, whichever way they run.
export function layered(model, {nodeWidth = 216, nodeHeight = 64, dummyHeight = 10, rowGap = 22, colGap = 96, headerHeight = 46, ranks = null, direction = "LR"} = {}) {
    if (model.nodes.length === 0) return {nodes: [], edges: [], columns: [], width: 0, height: 0, direction}
    const tb = direction === "TB"
    // A card's length along the ranks and across them.
    const mainSize = tb ? nodeHeight : nodeWidth
    const crossSize = tb ? nodeWidth : nodeHeight
    const toXY = (m, c) => tb ? [c, m] : [m, c]
    const ids = model.nodes.map(n => n.id)
    const nodeById = new Map(model.nodes.map(n => [n.id, n]))

    // 1+2. Rank. With `ranks` (from rankNodes() on the full model) the given
    // ranks win for every node that has one; the used ranks are then
    // compressed to 0..k so hiding a whole stage leaves no empty column, and
    // sinks are pinned to the last column again.
    const {rank, rankEdges} = rankNodes(model)
    if (ranks) {
        for (const id of ids) if (ranks.has(id)) rank.set(id, ranks.get(id))
        const used = [...new Set(rank.values())].sort((a, b) => a - b)
        const packed = new Map(used.map((r, i) => [r, i]))
        for (const [id, r] of rank) rank.set(id, packed.get(r))
        pinSinks(ids, rank, rankEdges)
    }
    const maxRank = Math.max(...rank.values())

    // 3. Columns with real and dummy items.
    const ncols = maxRank + 1
    const cols = []
    for (let c = 0; c < ncols; c++) cols.push([])
    const items = new Map()
    for (const id of ids) {
        const it = {id, col: rank.get(id), h: crossSize, real: true, left: [], right: []}
        items.set(id, it)
        cols[it.col].push(it)
    }
    // Long edges get a dummy node in every column they cross so they route
    // between nodes, not through them. Edges whose ranking direction was
    // reversed by cycle-breaking are drawn as a single cubic with no dummies.
    const chains = []
    for (const e of model.edges) {
        const a = items.get(e.source)
        const b = items.get(e.target)
        if (a.col >= b.col) {
            chains.push({seq: [a, b], edge: e})
            continue
        }
        const seq = [a]
        for (let c = a.col + 1; c < b.col; c++) {
            const id = e.source + ">" + e.target + "@" + c
            const v = {id, col: c, h: dummyHeight, real: false, left: [], right: []}
            items.set(id, v)
            cols[c].push(v)
            seq.push(v)
        }
        seq.push(b)
        for (let i = 0; i + 1 < seq.length; i++) { seq[i].right.push(seq[i + 1]); seq[i + 1].left.push(seq[i]) }
        chains.push({seq, edge: e})
    }

    // 4. Barycenter sweeps: alternate left-to-right and right-to-left passes,
    // sorting each column by the mean index of its neighbours on that side.
    const index = () => cols.forEach(col => col.forEach((it, i) => { it.i = i }))
    index()
    const bary = (it, side) => {
        const ns = it[side]
        if (!ns.length) return it.i
        let s = 0
        for (const n of ns) s += n.i
        return s / ns.length
    }
    for (let pass = 0; pass < 4; pass++) {
        const l2r = pass % 2 === 0
        for (let k = 0; k < ncols; k++) {
            const c = l2r ? k : ncols - 1 - k
            cols[c].forEach(it => { it.b = bary(it, l2r ? "left" : "right") })
            cols[c].sort((x, y) => x.b - y.b || x.i - y.i)
            index()
        }
    }

    // 5. Placement: stack each rank with rowGap, centred on the longest
    // rank. `h` is an item's length across the ranks (a dummy's is
    // dummyHeight); main is where its rank starts along them. LR keeps the
    // header above every column on the cross axis; TB gives each rank row
    // its own header strip on the main axis.
    let maxColH = 0
    for (const col of cols) {
        let h = 0
        for (const it of col) h += it.h
        h += Math.max(0, col.length - 1) * rowGap
        col.h = h
        maxColH = Math.max(maxColH, h)
    }
    const crossStart = tb ? 0 : headerHeight
    const pitch = mainSize + colGap + (tb ? headerHeight : 0)
    const mainStart = c => c * pitch + (tb ? headerHeight : 0)
    cols.forEach((col, c) => {
        let y = crossStart + (maxColH - col.h) / 2
        for (const it of col) {
            it.m = mainStart(c)
            it.c = y
            it.cc = y + it.h / 2
            ;[it.x, it.y] = toXY(it.m, it.c)
            y += it.h + rowGap
        }
    })
    const mainLength = ncols ? ncols * pitch - colGap : 0
    const crossLength = crossStart + maxColH
    const [width, height] = tb ? [crossLength, mainLength] : [mainLength, crossLength]

    // 6. Stage headers: the distinct kinds present, in first-seen order. A
    // stage is a column (LR) or a row with its header strip (TB).
    const kindOf = (n) => {
        if (n.kind === "input") return "brought in"
        if (n.kind === "mined") return n.machine && n.machine.key && n.machine.key.includes("pump") ? "pipes" : "drills"
        const key = (n.machine && n.machine.key) || ""
        if (key.includes("assembling")) return "assemblers"
        if (key.includes("furnace")) return "furnaces"
        if (key.includes("chemical") || key.includes("refinery")) return "chem plants"
        return "other"
    }
    const columns = cols.map((col, c) => {
        const kinds = []
        for (const it of col) {
            if (!it.real) continue
            const k = kindOf(nodeById.get(it.id))
            if (!kinds.includes(k)) kinds.push(k)
        }
        const band = tb
            ? {x: 0, y: c * pitch, w: width, h: headerHeight + mainSize}
            : {x: c * pitch, y: 0, w: nodeWidth, h: height}
        return {rank: c, ...band, kinds}
    })

    // 7. Node output: original model fields plus layout geometry.
    const nodes = model.nodes.map(n => {
        const it = items.get(n.id)
        return {...n, x: it.x, y: it.y, w: nodeWidth, h: nodeHeight, rank: it.col}
    })

    // 8. Edge paths: a polyline through any dummy points, straight (L) inside
    // a dummy's rank, cubic (C) between ranks, built along the main axis and
    // turned into x/y by toXY().
    const edges = chains.map(({seq, edge}) => {
        const pts = []
        seq.forEach((it, i) => {
            if (i === 0) pts.push([it.m + mainSize, it.cc])
            else if (i === seq.length - 1) pts.push([it.m, it.cc])
            else { pts.push([it.m, it.cc]); pts.push([it.m + mainSize, it.cc]) }
        })
        const xy = ([m, c]) => toXY(m, c).join(" ")
        let d = "M" + xy(pts[0])
        for (let i = 1; i < pts.length; i++) {
            const [ma, ca] = pts[i - 1]
            const [mb, cb] = pts[i]
            if (ca === cb) d += " L" + xy(pts[i])
            else { const mm = (ma + mb) / 2; d += " C" + xy([mm, ca]) + " " + xy([mm, cb]) + " " + xy([mb, cb]) }
        }
        const [lx, ly] = toXY(pts[0][0] + colGap / 2, (pts[0][1] + pts[1][1]) / 2)
        return {
            ...edge,
            d,
            lx,
            ly,
            points: pts.map(([m, c]) => toXY(m, c)),
        }
    })

    return {nodes, edges, columns, width, height, direction}
}

// "assembler" | "furnace" | "drill" | "chem plant" | the building's own name lower-cased
// What a hover on card `id` lights up: the card itself, every card one edge
// upstream (what it is made from) or downstream (where it goes), and those
// edges, keyed "source>target" as flow.js tags each path.
export function hoverSet(edges, id) {
    const nodes = new Set([id])
    const lit = new Set()
    for (const e of edges) {
        if (e.source === id || e.target === id) {
            nodes.add(e.source)
            nodes.add(e.target)
            lit.add(`${e.source}>${e.target}`)
        }
    }
    return {nodes, edges: lit}
}

export function machineWord(building) {
    if (!building) return ""
    const key = building.key || ""
    if (key.includes("assembling")) return "assembler"
    if (key.includes("furnace")) return "furnace"
    if (key.includes("mining-drill")) return "drill"
    if (key.includes("refinery")) return "refinery"
    if (key.includes("chemical")) return "chem plant"
    return (building.name || key).toLowerCase()
}

export function pluralise(count, word) {
    if (count === 1) return `${count} ${word}`
    return `${count} ${word.endsWith("y") ? word.slice(0, -1) + "ies" : word + "s"}`
}

// belts is a float number of belts
export function beltText(belts) {
    if (belts < 0.05) return "a trickle"
    if (belts <= 0.25) return "a quarter belt"
    if (belts <= 0.5) return "half a belt"
    if (belts <= 1) return "1 belt"
    return `${Math.ceil(belts * 10) / 10} belts`
}

// A selected card's line chips, stacked so none overlap: chips in the same
// column gap (same x, to the pixel) are sorted by y and each pushed below
// the one above with `gap` px between, then the whole stack is shifted back
// so it stays centred on where the chips wanted to be. labels: [{id, x, y,
// h}] with y the chip's centre; returns Map id -> new centre y.
// Card height for a plan: 58px, or 78px when any card shows a module strip
// (its machine has module slots), so every card in one plan is the same
// height and hovering or focusing never moves one.
export const CARD_HEIGHT = 58
export const CARD_HEIGHT_WITH_MODULES = 78

export function cardHeight(nodes) {
    return nodes.some(n => n.machine && n.machine.moduleSlots > 0) ? CARD_HEIGHT_WITH_MODULES : CARD_HEIGHT
}

//
// axis "x" does the same sideways, for a top-to-bottom graph whose chips
// share a row gap: grouped by y, spread along x by width w, and the Map
// holds new centre x values.
export function stackLabels(labels, gap = 4, axis = "y") {
    if (axis === "x") return stackLabels(labels.map(l => ({id: l.id, x: l.y, y: l.x, h: l.w})), gap)
    const out = new Map()
    const groups = new Map()
    for (const l of labels) {
        const k = Math.round(l.x)
        if (!groups.has(k)) groups.set(k, [])
        groups.get(k).push(l)
    }
    for (const group of groups.values()) {
        group.sort((a, b) => a.y - b.y)
        const ys = []
        let bottom = -Infinity
        for (const l of group) {
            const y = Math.max(l.y, bottom + gap + l.h / 2)
            ys.push(y)
            bottom = y + l.h / 2
        }
        const shift = group.reduce((s, l, i) => s + (ys[i] - l.y), 0) / group.length
        group.forEach((l, i) => out.set(l.id, ys[i] - shift))
    }
    return out
}

// One look per item for the graph's lines, so they can be told apart at a
// glance and without relying on colour alone: seven colour-blind-safe
// colours (Okabe-Ito, lifted for the dark canvas) crossed with six dash
// patterns. 7 and 6 share no factor, so the first 42 items all differ and
// neighbouring indices differ in both colour and pattern. Dash lengths are
// in units of the line's own width (a 0 dash with round caps is a dot).
const LINE_COLORS = ["#e69f00", "#56b4e9", "#2fbf8f", "#f0e442", "#cc79a7", "#ff8a4c", "#d8c7a6"]
const LINE_DASHES = [null, [4, 2.5], [0, 2.2], [6, 2, 0, 2], [10, 3], [5, 2, 0, 2, 0, 2]]

export function lineStyle(index) {
    return {color: LINE_COLORS[index % LINE_COLORS.length], dash: LINE_DASHES[index % LINE_DASHES.length]}
}

// SVG stroke-dasharray for `dash` on a line `width` px wide; null is solid.
export function dashArray(dash, width) {
    if (!dash) return null
    const unit = Math.max(2, width)
    return dash.map(v => Math.round(v * unit * 10) / 10).join(" ")
}

// Item key -> style index, numbering items in the order their first line
// leaves its card, left to right then top to bottom, so lines that start
// side by side get neighbouring (so fully different) styles. `edges` are
// layered()'s, with `points`.
export function itemStyles(edges) {
    const order = [...edges].sort((a, b) => a.points[0][0] - b.points[0][0] || a.points[0][1] - b.points[0][1])
    const out = new Map()
    for (const e of order) {
        if (!out.has(e.item)) out.set(e.item, out.size)
    }
    return out
}
