<script>
    import { sentOut } from "../lib/byproduct-core.js"
    import { plan } from "../lib/plan.svelte.js"
    import { zero } from "../lib/rational.js"
    import { rateText } from "../lib/table-core.js"
    import { buildRows, countMachines, powerRepr } from "../lib/table.js"

    let { hidden } = $props()

    let summary = $derived(plan.planned ? summarize(plan.spec, plan.totals) : null)

    function listed(spec, entries) {
        return entries.map(({ item, rate }) => `${item.name.toLowerCase()} ${rateText(spec.format, rate)}`).join(", ")
    }

    function summarize(spec, totals) {
        if (!totals) return null
        const rows = buildRows(totals)
        const made = rows.filter(row => row.isReal)
        const { machines } = countMachines(totals)
        const power = made.reduce((sum, row) => sum.add(spec.getPowerUsage(row.recipe, row.recipeRate).power), zero)
        const brought = rows.filter(row => !row.isReal).map(row => ({ item: row.item, rate: row.itemRate }))
        const sent = listed(spec, sentOut(totals, spec.sendOut))
        return {
            totals: `${machines} machines · ${powerRepr(power)}`,
            bring: brought.length ? `Brought in: ${listed(spec, brought)}` : "Everything is made here from raw ore, gas and water.",
            sent: sent && `Sent out: ${sent}`,
        }
    }
</script>

<div class="frame" id="footer" {hidden}>
    <span class="num" id="footer-totals">{summary?.totals ?? ""}</span>
    <div class="spacer"></div>
    <span class="muted" id="footer-bring">{summary?.bring ?? ""}</span>
    <span id="footer-sendout" hidden={!summary?.sent}>{summary?.sent ?? ""}</span>
</div>
