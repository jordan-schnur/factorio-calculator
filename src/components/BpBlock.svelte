<script>
    import { itemNames } from "../lib/byproduct-core.js"
    import { applySendOut, blockKey, fixKey, setDismissed } from "../lib/byproducts.svelte.js"
    import { iconOf } from "../lib/icon-attach.js"
    import { plan } from "../lib/plan.svelte.js"
    import { plural } from "../lib/ratio-core.js"
    import { rateText } from "../lib/table-core.js"
    import { buildingCount } from "../lib/table.js"
    import BpAction from "./BpAction.svelte"
    import BpFixRow from "./BpFixRow.svelte"
    import Button from "./Button.svelte"

    let { block, found } = $props()

    const SHOWN_ITEMS = 4

    let row = $derived(block.recipe && plan.totals ? { isReal: true, recipe: block.recipe, recipeRate: plan.totals.rates.get(block.recipe) } : null)
    let count = $derived(row ? buildingCount(row) : 0)
    let building = $derived(block.recipe ? plan.spec.getBuilding(block.recipe) : null)
    let shown = $derived(block.items.length > SHOWN_ITEMS + 1 ? block.items.slice(0, SHOWN_ITEMS) : block.items)
    let rest = $derived(block.items.slice(shown.length))
    let one = $derived(block.items.length === 1)

    function itemComma(i) {
        return i !== shown.length - 1 && !(i === shown.length - 2 && rest.length === 0) ? "," : ""
    }

    function sendOutDone() {
        return `${block.items.map(({ item }) => item.name).join(" and ")} ${one ? "is" : "are"} sent out. Take ${one ? "it" : "them"} to storage or another build.`
    }
</script>

<div class="bp-block">
    <div class="bp-head">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 2 21h20L12 3z"></path><path d="M12 10v5"></path><path d="M12 18h.01"></path></svg>
        <span class="bp-title">{block.recipe ? `${block.recipe.name} will back up and stop` : `Nothing here uses ${itemNames(block)}`}</span>
        <Button size="sm" class="bp-dismiss" title="Dismiss this warning" aria-label="Dismiss this warning" onclick={() => setDismissed([blockKey(block)], true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"></path></svg>
        </Button>
    </div>
    <div class="bp-line">
        {#if block.recipe}
            <span {@attach iconOf(block.recipe, 24, true)}></span>
            <span>{building ? `${count} ${plural(building.name, count)}` : block.recipe.name} also make{building && count === 1 ? "s" : ""}</span>
        {/if}
        {#each shown as { item, rate }, i (item.key)}
            {#if i > 0 && i === shown.length - 1 && rest.length === 0}<span>and</span>{/if}
            <span {@attach iconOf(item, 20, true)}></span>
            <span class="bp-rate num">{rateText(plan.spec.format, rate)} {item.name.toLowerCase()}{itemComma(i)}</span>
        {/each}
        {#if rest.length > 0}
            <span class="bp-more" title={rest.map(({ item, rate }) => `${item.name}: ${rateText(plan.spec.format, rate)}`).join("\n")}>and {rest.length} more</span>
        {/if}
        <span>{block.recipe ? "that nothing in this plan uses." : "is left over."}</span>
    </div>
    <div class="bp-fixes">
        {#if found === null}
            <span class="muted bp-checking">Checking fixes…</span>
        {:else}
            {#each found.fixes as fix (fixKey(fix))}
                <BpFixRow {block} {fix} {found} />
            {/each}
            {#if found.fixes.length === 0}
                <span class="muted bp-none">No recipe you could switch on uses it up, and no other recipe avoids it.</span>
            {/if}
            <BpAction dataFix="out" label={one ? "Send it out" : "Send them out"} onclick={() => applySendOut(block, sendOutDone())}>
                {#snippet what()}Keep this plan and take {one ? "it" : "them"} to storage or another build. No change in machines.{/snippet}
            </BpAction>
        {/if}
    </div>
</div>
