<script>
    import { moduleStats } from "../../lib/tooltip-core.js"
    import StatLines from "./StatLines.svelte"
    import TooltipFrame from "./TooltipFrame.svelte"

    let { thing } = $props()
</script>

<TooltipFrame {thing}><StatLines stats={moduleStats(thing)} /></TooltipFrame>
