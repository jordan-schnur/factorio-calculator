// calc/flow-core.js — pure model-building and dagre-layout math for the
// Flow tab. Imports nothing that touches window/document/d3/dagre/pako at
// import time; `dagre` itself is passed into layout() by the caller so this
// file stays node-testable (see tests/js/calc_flow_check.mjs).

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
    return {nodes, edges, width, height}
}

export function edgePath(e) {
    const dx = Math.max(60, (e.x2 - e.x1) / 2)
    return `M ${e.x1} ${e.y1} C ${e.x1 + dx} ${e.y1}, ${e.x2 - dx} ${e.y2}, ${e.x2} ${e.y2}`
}
