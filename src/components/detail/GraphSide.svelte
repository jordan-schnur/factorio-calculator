<script>
    import { sideModel } from "../../lib/details-core.js"
    import { iconOf } from "../../lib/icon-attach.js"
    import { plan } from "../../lib/plan.svelte.js"
    import { selectItem } from "../../lib/select.js"
    import Detail from "./Detail.svelte"

    let side = $derived(sideModel(plan.spec, plan.totals))
</script>

<div class="frame" id="graph-side" hidden={!side}>
    {#if side}
        <div class="head"><span class="slot" {@attach iconOf(side.icon, 28, true)}></span><span class="text"><span class="title">{side.title}</span><br><span class="muted num">{side.sub}</span></span><button type="button" class="x" id="details-close" onclick={() => selectItem(null)}>✕</button></div>
        <Detail item={side.item} />
    {/if}
</div>

<style>
    .head { display: flex; align-items: center; gap: 10px; }
    .text { flex: 1; line-height: 1.15; }
</style>
