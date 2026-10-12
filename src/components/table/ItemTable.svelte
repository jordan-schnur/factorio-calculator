<script>
    import { tableModel } from "../../lib/itemtable-core.js"
    import { plan } from "../../lib/plan.svelte.js"
    import Detail from "../detail/Detail.svelte"
    import ModulesBar from "./ModulesBar.svelte"
    import TableRow from "./TableRow.svelte"

    let table = $derived(plan.totals ? tableModel(plan.totals) : null)
    let open = $derived(plan.spec?.whereItem ?? null)
</script>

<div id="item-table">
    {#if table}
        <ModulesBar bar={table.bar} />
        {#each table.groups as group (group.name)}
            <div class="sect"><span class="lbl">{group.name}</span><span class="lbl r">Need</span><span class="lbl">{group.machHdr}</span><span class="lbl">Modules</span><span></span></div>
            {#each group.rows as r (r.row.key)}
                <TableRow {r} open={open === r.itemKey} />
                {#if open === r.itemKey}<Detail item={r.row.item} />{/if}
            {/each}
        {/each}
    {/if}
</div>
