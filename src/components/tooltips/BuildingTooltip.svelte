<script>
    import { plan } from "../../lib/plan.svelte.js"
    import { buildingStats } from "../../lib/tooltip-core.js"
    import StatLines from "./StatLines.svelte"
    import TooltipFrame from "./TooltipFrame.svelte"

    let { thing } = $props()
</script>

<TooltipFrame {thing}><StatLines stats={buildingStats(thing, plan.spec.format)} /></TooltipFrame>
