<script>
    import { itemNames, joinWords, stalls } from "../lib/byproduct-core.js"
    import { applied, blockKey, computeFixes, dismissed, setDismissed } from "../lib/byproducts.svelte.js"
    import { plan } from "../lib/plan.svelte.js"
    import BpBlock from "./BpBlock.svelte"
    import Button from "./Button.svelte"

    let totals = $derived(plan.totals)
    let blocks = $derived(totals && plan.spec && plan.spec.buildTargets.length > 0 ? stalls(totals, plan.spec.sendOut) : [])
    let hidden = $derived(blocks.filter(block => dismissed.has(blockKey(block))))
    let activeApplied = $derived(applied.current && applied.current.totals === totals ? applied.current : null)

    let fixesFor = null
    let generation = 0
    let fixesCache = $state.raw(null)

    $effect(() => {
        if (!totals || blocks.length === 0 || fixesFor === totals) return
        fixesFor = totals
        const mine = ++generation
        const computingBlocks = blocks
        setTimeout(() => {
            if (mine !== generation || plan.totals !== totals) return
            fixesCache = { totals, results: computeFixes(totals, computingBlocks) }
        }, 0)
    })

    function foundFor(i) {
        return fixesCache && fixesCache.totals === totals ? fixesCache.results[i] : null
    }

    let hiddenNames = $derived(hidden.map(block => block.recipe ? block.recipe.name : itemNames(block)))
</script>

<div id="byproducts" hidden={blocks.length === 0 && !activeApplied}>
    {#if activeApplied}
        <div class="bp-done" role="status">
            <span class="bp-ok"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5 9.5 18 20 6"></path></svg></span>
            <span class="bp-done-text">{activeApplied.text}</span>
            <Button size="sm" class="bp-undo" onclick={() => activeApplied?.undo()}>Undo</Button>
        </div>
    {/if}
    {#if blocks.length > 0}
        {#if hidden.length > 0}
            <div class="bp-hidden">
                <span class="bp-hidden-text">{hidden.length === 1 ? "A byproduct warning is" : `${hidden.length} byproduct warnings are`} hidden: {joinWords(hiddenNames)}.</span>
                <Button size="sm" class="bp-show" onclick={() => setDismissed(hidden.map(blockKey), false)}>Show</Button>
            </div>
        {/if}
        {#if hidden.length < blocks.length}
            <section class="bp-bar" aria-label="Byproducts">
                {#each blocks as block, i (blockKey(block))}
                    {#if !dismissed.has(blockKey(block))}
                        <BpBlock {block} found={foundFor(i)} />
                    {/if}
                {/each}
            </section>
        {/if}
    {/if}
</div>
