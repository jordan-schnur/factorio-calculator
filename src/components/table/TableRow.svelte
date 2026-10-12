<script>
    import { selectItem } from "../../lib/select.js"
    import RowItem from "./RowItem.svelte"
    import RowMachines from "./RowMachines.svelte"
    import RowModules from "./RowModules.svelte"
    import RowNeed from "./RowNeed.svelte"

    let { r, open } = $props()
</script>

<button type="button" class={["lrow", r.tone, { open }]} data-item={r.itemKey} onclick={() => selectItem(open ? null : r.itemKey)}>
    <RowItem {r} />
    <RowNeed need={r.need} outputCount={r.outputCount} />
    <RowMachines m={r.machine} />
    <RowModules mods={r.mods} />
    <span class="chev">{open ? "▴" : "▾"}</span>
</button>
