<script>
    import { cssVars } from "../lib/css-vars.js"
    import { BASE_COL_GAP, chipRoom, colGapFor, edgeKey, edgeLooks, graphFocus, layoutModel } from "../lib/graph-core.js"
    import { followZoom, graphView, placeGraph, refitIfNeeded, restack, zoomable } from "../lib/graph-view.svelte.js"
    import { drawnGraph, graphHover } from "../lib/graph.svelte.js"
    import { plan } from "../lib/plan.svelte.js"
    import ChipProbe from "./ChipProbe.svelte"
    import GraphCard from "./GraphCard.svelte"
    import GraphEdges from "./GraphEdges.svelte"
    import GraphLabel from "./GraphLabel.svelte"
    import GraphStage from "./GraphStage.svelte"

    let { shown } = $props()

    let measured = $state.raw(null)
    let drawn = $derived(shown && plan.totals ? drawnGraph(plan.spec, plan.totals) : null)
    let measuring = $derived(drawn !== null && drawn.probe.length > 0 && measured?.probe !== drawn.probe)
    let colGap = $derived(drawn === null || measuring ? null : drawn.probe.length === 0 ? BASE_COL_GAP : measured.gap)
    let layout = $derived(colGap === null ? null : layoutModel(drawn.model, colGap))
    let looks = $derived(layout && edgeLooks(layout.edges))
    let focus = $derived(layout && graphFocus(plan.spec, plan.totals, layout, { selected: plan.spec.whereItem, hover: graphHover.current, holds: graphHover.holds }))
    let room = $derived({ "--chip-room": colGap === null ? null : chipRoom(colGap) })
    let t = $derived(graphView.transform)

    $effect(() => placeGraph(layout, shown))

    function measuredWidth(probe, widest) {
        measured = { probe, gap: colGapFor(widest) }
    }
</script>

<svelte:window onresize={refitIfNeeded} />

<div id="flow-container" class={["canvas", { hovering: Boolean(focus?.lit) }]} {@attach zoomable}><div id="flow-columns" {@attach followZoom}>{#if layout}{#each layout.columns as column (column.rank)}<GraphStage {column} last={layout.columns.length - 1} height={layout.height} />{/each}{/if}</div><svg id="flow"><g class="viewport" transform={`translate(${t.x},${t.y}) scale(${t.k})`}>{#if layout}<GraphEdges edges={layout.edges} nodes={layout.nodes} {looks} {focus} />{/if}</g></svg><div id="flow-nodes" class={{ small: graphView.small }} {@attach followZoom} {@attach cssVars(room)} {@attach restack(focus, graphView.fits)}>{#if layout}{#each layout.nodes as node (node.id)}<GraphCard {node} face={drawn.faces.get(node.id)} {focus} />{/each}{#each layout.edges as edge (edgeKey(edge))}<GraphLabel {edge} look={looks.get(edgeKey(edge))} {focus} />{/each}{/if}</div>{#if measuring}<ChipProbe chips={drawn.probe} onmeasure={measuredWidth} />{/if}</div>
