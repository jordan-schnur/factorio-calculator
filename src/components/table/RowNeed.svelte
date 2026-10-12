<script>
    import { tooltip } from "../../lib/tooltip.svelte.js"
    import FlowTooltip from "../tooltips/FlowTooltip.svelte"

    let { need, outputCount } = $props()
</script>

{#if need}<span class={["need num", { flow: !!need.card }]} {@attach need.card && tooltip(FlowTooltip, need.card)}>{need.text}<span class="belts">{need.belts}</span></span>{:else}<span class="need num">{outputCount}</span>{/if}
