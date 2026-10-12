<script>
    import { iconOf } from "../../lib/icon-attach.js"
    import { tooltip } from "../../lib/tooltip.svelte.js"
    import BacksUpMarker from "../BacksUpMarker.svelte"
    import Badge from "../Badge.svelte"
    import FlowTooltip from "../tooltips/FlowTooltip.svelte"

    let { r } = $props()
</script>

<span class="item"><span class="slot sm" {@attach iconOf(r.icon, 24, true)}></span><span class="name">{r.name}</span>{#if r.badge}<Badge kind={r.badge.kind} text={r.badge.text} />{/if}{#if r.outputs}<span class="outs">{#each r.outputs as o (o)}<span class={["out", { flow: !!o.card }]} data-output={o.item.key} {@attach iconOf(o.item, 16, true)} {@attach o.card && tooltip(FlowTooltip, o.card)}></span>{/each}</span>{/if}{#if r.stalled}<BacksUpMarker size={14} />{/if}{#if r.sentOut}<Badge kind="out" text={r.sentOut} />{/if}</span>
