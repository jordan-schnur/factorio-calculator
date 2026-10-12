<script>
    import { tick } from "svelte"
    import LineChip from "./LineChip.svelte"

    let { chips, onmeasure } = $props()

    function measure(measured) {
        return node => {
            tick().then(() => {
                if (!node.isConnected) return
                onmeasure(measured, Math.max(0, ...[...node.children].map(chip => chip.offsetWidth)))
            })
        }
    }
</script>

<div class="cb-probe" {@attach measure(chips)}>{#each chips as rows (rows)}<div class="elbl chip"><LineChip {rows} /></div>{/each}</div>

<style>
    .cb-probe { position: absolute; left: 0; top: 0; visibility: hidden; pointer-events: none; }
</style>
