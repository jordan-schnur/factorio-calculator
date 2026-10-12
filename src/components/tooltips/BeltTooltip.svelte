<script>
    import { plan } from "../../lib/plan.svelte.js"
    import InlineStat from "./InlineStat.svelte"
    import TooltipFrame from "./TooltipFrame.svelte"

    let { thing } = $props()
    let format = $derived(plan.spec.format)
</script>

<TooltipFrame {thing}><InlineStat label="Max throughput: " value={`${format.rate(thing.rate)}/${format.longRate}`} /></TooltipFrame>
