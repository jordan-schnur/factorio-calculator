<script>
    import { compareCells } from "../lib/modules-editor.svelte.js"
    import { powerWords } from "../lib/modules-core.js"
    import { plan } from "../lib/plan.svelte.js"
    import { rateText } from "../lib/table-core.js"

    let { opts, entry } = $props()

    let view = $derived(compareCells(plan.spec, opts, entry))
</script>

<div class="me-block me-compare"><span class="lbl">{`For ${rateText(plan.spec.format, view.output)}`}</span><div class="me-cells">{#each view.cells as cell (cell.key)}<div class={["me-cell", { cur: cell.key === "these" }]} data-cell={cell.key}><span class="me-clabel">{cell.label}</span><span class="num me-machines">{`${cell.machines.toFixed(1)} machines`}</span><span class="muted me-mw">{powerWords(cell.watts)}</span></div>{/each}</div><div class="muted me-note">{`Machines on this row, and their power. Beacons draw their own ${powerWords(view.beaconWatts)} each on top.`}</div></div>
