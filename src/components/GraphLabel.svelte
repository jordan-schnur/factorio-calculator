<script>
    import { dashArray } from "../lib/flow-core.js"
    import { edgeKey, edgeRate } from "../lib/graph-core.js"
    import { hoverOn } from "../lib/graph.svelte.js"
    import { plan } from "../lib/plan.svelte.js"
    import { inlineStyle } from "../lib/style-attach.js"
    import { rateText } from "../lib/table-core.js"
    import LineChip, { iconWord } from "./LineChip.svelte"

    let { edge, look, focus } = $props()

    let key = $derived(edgeKey(edge))
    let chip = $derived(focus?.chips.get(key) ?? null)
    let item = $derived(plan.spec.items.get(edge.item))
    let hot = $derived(focus !== null && (focus.hot.has(edge.source) || focus.hot.has(edge.target)))
    let lit = $derived(Boolean(focus?.lit?.edges.has(`${edge.source}>${edge.target}`)))
    let classes = $derived(["elbl", "num", hot && "hot", lit && "lit", chip && "chip", chip?.pinned && "pinned"])
    let box = $derived({ left: `${edge.lx}px`, "border-color": look.color })
    // Only seeds `top` for a new line; from then on graph-view's restack owns it.
    let start = $derived({ top: `${edge.ly}px` })
</script>

<div class={classes} data-lx={edge.lx} data-ly={edge.ly} data-from={edge.source} data-to={edge.target} data-item={edge.item} {@attach inlineStyle(start)} {@attach inlineStyle(box)} {@attach hoverOn({ line: key }, chip !== null)}>{#if chip}<LineChip rows={chip.rows} />{:else}<svg width="22" height="8" class="swatch"><line x1="2" y1="4" x2="20" y2="4" stroke={look.color} stroke-width="3" stroke-dasharray={dashArray(look.dash, 1.2)} stroke-linecap={look.dash ? "round" : null} /></svg>{#if item}{@render iconWord(item, 14)}{/if}<span>{rateText(plan.spec.format, edgeRate(edge))}</span>{/if}</div>
