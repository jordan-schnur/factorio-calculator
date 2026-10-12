<script>
    import InlineStat from "./InlineStat.svelte"
    import TooltipFrame from "./TooltipFrame.svelte"

    let { thing } = $props()
</script>

<TooltipFrame {thing}><InlineStat label="Energy: " value={thing.valueString()} /></TooltipFrame>
