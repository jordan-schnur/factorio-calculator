<script>
    import { plan } from "../lib/plan.svelte.js"

    let notes = $derived(plan.spec?.targetNotes ?? [])

    $effect(() => {
        if (plan.spec && plan.spec.buildTargets.length > 0) {
            try {
                localStorage.setItem("calc.lastHash", location.hash)
            } catch (err) {
                // Private browsing / storage disabled: losing "restore last" is harmless.
            }
        }
    })
</script>

<div id="target-notes" class="muted" hidden={notes.length === 0}>
    {#each notes as note}
        <div>{note}</div>
    {/each}
</div>
