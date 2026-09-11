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
//        links: [{item, itemName, from, to, rate, belts}]}
// A link's `from`/`to` are recipe keys (or `from: null` for a link with no
// producer at all). Two kinds of recipe never get a node of their own:
// isReal: false is the solver's internal OutputRecipe/SurplusRecipe sink
// (skipped entirely, not even drawn as an edge endpoint by the caller);
// isDisable: true is the `D-` stand-in for a supplied/ignored item (real,
// but not a production step) -- a link sourced from one is folded into a
// synthetic "input" node keyed by item instead.
export function buildFlowModel({recipes, links}) {
    const recipeByKey = new Map(recipes.map(r => [r.key, r]))
    const nodes = new Map()

    for (const r of recipes) {
        if (!r.isReal || r.isDisable) continue
        const kind = r.isResource ? "mined" : r.isTarget ? "target" : "recipe"
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
            existing.belts += link.belts
        } else {
            edges.set(key, {source, target: link.to, item: link.item, itemName: link.itemName, rate: link.rate, belts: link.belts})
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

// Layered, left-to-right layout ported from the graph-first prototype's
// renderVals() (docs/superpowers/mockups/calculator/graph-first/Main.tpl.html),
// plus cycle breaking so a recipe loop (e.g. a chemical-plant cycle) still
// ranks every node instead of recursing forever. Column 0 is everything
// brought in (sources); the last column is every sink (targets and anything
// else nothing consumes), pinned there even if its longest path is shorter.
export function layered(model, {nodeWidth = 216, nodeHeight = 64, dummyHeight = 10, rowGap = 22, colGap = 96, headerHeight = 46} = {}) {
    if (model.nodes.length === 0) return {nodes: [], edges: [], columns: [], width: 0, height: 0}
    const ids = model.nodes.map(n => n.id)
    const nodeById = new Map(model.nodes.map(n => [n.id, n]))
    const out = new Map(ids.map(id => [id, []]))   // forward adjacency, for ranking only
    const inn = new Map(ids.map(id => [id, []]))

    // 1. Break cycles: DFS, drop back edges from the ranking graph.
    const state = new Map()  // 0 unvisited, 1 on stack, 2 done
    const rankEdges = []
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
    for (const e of model.edges) if (!back.has(e.source + "|" + e.target)) { rankEdges.push(e); inn.get(e.target).push(e.source) }

    // 2. Rank: longest path from sources (memoised DFS over rankEdges), then pin sinks to the max rank.
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
    const maxRank = Math.max(...rank.values())
    const hasOut = new Set(rankEdges.map(e => e.source))
    for (const id of ids) if (!hasOut.has(id)) rank.set(id, maxRank)

    // 3. Columns with real and dummy items.
    const ncols = maxRank + 1
    const cols = []
    for (let c = 0; c < ncols; c++) cols.push([])
    const items = new Map()
    for (const id of ids) {
        const it = {id, col: rank.get(id), h: nodeHeight, real: true, left: [], right: []}
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

    // 5. Placement: stack each column with rowGap, centred on the tallest column.
    let maxColH = 0
    for (const col of cols) {
        let h = 0
        for (const it of col) h += it.h
        h += Math.max(0, col.length - 1) * rowGap
        col.h = h
        maxColH = Math.max(maxColH, h)
    }
    cols.forEach((col, c) => {
        let y = headerHeight + (maxColH - col.h) / 2
        for (const it of col) {
            it.x = c * (nodeWidth + colGap)
            it.y = y
            it.cy = y + it.h / 2
            y += it.h + rowGap
        }
    })
    const width = ncols ? ncols * nodeWidth + (ncols - 1) * colGap : 0
    const height = headerHeight + maxColH

    // 6. Column headers: the distinct kinds present, in first-seen order.
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
        return {rank: c, x: c * (nodeWidth + colGap), w: nodeWidth, kinds}
    })

    // 7. Node output: original model fields plus layout geometry.
    const nodes = model.nodes.map(n => {
        const it = items.get(n.id)
        return {...n, x: it.x, y: it.y, w: nodeWidth, h: nodeHeight, rank: it.col}
    })

    // 8. Edge paths: a polyline through any dummy points, straight (L) inside
    // a dummy column, cubic (C) between columns.
    const edges = chains.map(({seq, edge}) => {
        const pts = []
        seq.forEach((it, i) => {
            if (i === 0) pts.push([it.x + nodeWidth, it.cy])
            else if (i === seq.length - 1) pts.push([it.x, it.cy])
            else { pts.push([it.x, it.cy]); pts.push([it.x + nodeWidth, it.cy]) }
        })
        let d = "M" + pts[0][0] + " " + pts[0][1]
        for (let i = 1; i < pts.length; i++) {
            const [xa, ya] = pts[i - 1]
            const [xb, yb] = pts[i]
            if (ya === yb) d += " L" + xb + " " + yb
            else { const mx = (xa + xb) / 2; d += " C" + mx + " " + ya + " " + mx + " " + yb + " " + xb + " " + yb }
        }
        return {
            ...edge,
            d,
            lx: pts[0][0] + colGap / 2,
            ly: (pts[0][1] + pts[1][1]) / 2,
            points: pts,
        }
    })

    return {nodes, edges, columns, width, height}
}

// "assembler" | "furnace" | "drill" | "chem plant" | the building's own name lower-cased
export function machineWord(building) {
    if (!building) return ""
    const key = building.key || ""
    if (key.includes("assembling")) return "assembler"
    if (key.includes("furnace")) return "furnace"
    if (key.includes("mining-drill")) return "drill"
    if (key.includes("chemical") || key.includes("refinery")) return "chem plant"
    return (building.name || key).toLowerCase()
}

export function pluralise(count, word) { return `${count} ${word}${count === 1 ? "" : "s"}` }

// belts is a float number of belts
export function beltText(belts) {
    if (belts <= 0.5) return "half a belt"
    if (belts <= 1) return "1 belt"
    return `${Math.ceil(belts * 10) / 10} belts`
}
