<script>
    import BeaconBadge from "./BeaconBadge.svelte"
    import Button from "./Button.svelte"
    import ModuleStrip from "./ModuleStrip.svelte"
    import { iconOf } from "../lib/icon-attach.js"
    import { handRows } from "../lib/modules-ui-core.js"
    import { plan } from "../lib/plan.svelte.js"

    let rows = $derived(handRows(plan.spec, plan.totals))
    let beacon = $derived(plan.spec.items.get("beacon"))
    let anyHand = $derived(plan.spec.handSet.size > 0)

    function reset(recipe) {
        plan.spec.commitModules(() => plan.spec.releaseRow(recipe))
    }

    function resetAll() {
        plan.spec.commitModules(() => plan.spec.releaseAllRows())
    }
</script>

<div class="ms-group ms-handset"><div class="ms-head">Set by hand</div>{#if rows.length === 0}<div class="muted">No rows set by hand.</div>{/if}{#each rows as row (row.recipe.key)}<div class="ms-row" data-recipe={row.recipe.key}><span class="slot sm" {@attach iconOf(row.recipe, 24, true)}></span><span class="ms-name">{row.recipe.name}</span><ModuleStrip modules={row.modules} size={20} tiers={row.tiers} /><BeaconBadge {beacon} beaconModules={row.beaconModules} beaconCount={row.beaconCount} size={16} tiers={row.beaconTiers} beaconTier={row.beaconTier} /><span class="ms-actions"><Button size="sm" class="ms-reset" onclick={() => reset(row.recipe)}>Reset</Button></span></div>{/each}{#if anyHand}<Button size="sm" id="modules-reset-all" onclick={resetAll}>Reset all</Button>{/if}<div class="muted ms-foot">Rows win over machines, machines win over the plan. Open a row in the table to set its modules.</div></div>
