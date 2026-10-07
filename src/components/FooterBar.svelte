<script>
    import { sentOut } from "../lib/byproduct-core.js"
    import { plan } from "../lib/plan.svelte.js"
    import { zero } from "../lib/rational.js"
    import { RATE_LABEL } from "../lib/table-core.js"
    import { buildingCount, buildRows, powerRepr } from "../lib/table.js"

    let { hidden } = $props()

    let summary = $derived(summarize(plan.spec, plan.totals))

    function listed(spec, entries) {
        let unit = RATE_LABEL[spec.format.rateName] || "/min"
        return entries.map(({ item, rate }) => `${item.name.toLowerCase()} ${spec.format.rate(rate)}${unit}`).join(", ")
    }

    function summarize(spec, totals) {
        if (!spec || !totals || spec.buildTargets.length === 0) return null
        let rows = buildRows(totals)
        let made = rows.filter(row => row.isReal)
        let machines = made.reduce((n, row) => n + buildingCount(row), 0)
        let power = made.reduce((sum, row) => sum.add(spec.getPowerUsage(row.recipe, row.recipeRate).power), zero)
        let brought = rows.filter(row => !row.isReal).map(row => ({ item: row.item, rate: row.itemRate }))
        let sent = listed(spec, sentOut(totals, spec.sendOut))
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
