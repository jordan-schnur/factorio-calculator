<script>
    import { tooltip } from "../../lib/tooltip.svelte.js"
    import FlowTooltip from "../tooltips/FlowTooltip.svelte"

    let { text, card = null } = $props()
</script>

<!-- data-value is the exact on-screen text: the scratch pad inserts it verbatim. -->
<span class={["num", { flow: !!card }]} data-value={text} {@attach card && tooltip(FlowTooltip, card)}>{text}</span>
