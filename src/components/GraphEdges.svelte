<svelte:options namespace="svg" />

<script>
    import { edgeKey, edgePaint } from "../lib/graph-core.js"
    import { hoverOn } from "../lib/graph.svelte.js"
    import { inlineStyle } from "../lib/style-attach.js"

    let { edges, nodes, looks, focus } = $props()

    let inputs = $derived(new Set(nodes.filter(node => node.kind === "input").map(node => node.id)))

    function edgeClass(edge) {
        const hot = focus !== null && (focus.hot.has(edge.source) || focus.hot.has(edge.target))
        const lit = focus?.lit?.edges.has(`${edge.source}>${edge.target}`)
        return ["edge", inputs.has(edge.source) && "in", hot && "hot", lit && "lit"]
    }
</script>

{#each edges as edge (edgeKey(edge))}<path class={edgeClass(edge)} d={edge.d} data-from={edge.source} data-to={edge.target} data-item={edge.item} stroke-width={edge.width} {@attach inlineStyle(edgePaint(looks.get(edgeKey(edge)), edge.width))} />{/each}{#each edges as edge (edgeKey(edge))}<path class="hit" d={edge.d} data-from={edge.source} data-to={edge.target} data-item={edge.item} {@attach hoverOn({ line: edgeKey(edge) })} />{/each}
