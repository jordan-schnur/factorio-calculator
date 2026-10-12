<script>
    import { detailModel } from "../../lib/details-core.js"
    import { plan } from "../../lib/plan.svelte.js"
    import FlowCol from "./FlowCol.svelte"
    import MakesCol from "./MakesCol.svelte"
    import ModBand from "./ModBand.svelte"
    import SourceCol from "./SourceCol.svelte"

    let { item } = $props()

    let d = $derived(detailModel(plan.spec, plan.totals, item))
</script>

<div class="detail">
    <FlowCol kind="needs" label="Needs" col={d.needs} />
    {#if d.makes}<MakesCol makes={d.makes} />{:else}<FlowCol kind="goesto" label="Goes to" col={d.goesTo} />{/if}
    <SourceCol {item} source={d.source} />
    {#if d.band}<ModBand band={d.band} />{/if}
</div>
