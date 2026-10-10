<script>
    import { plan } from "../lib/plan.svelte.js"

    let notes = $derived(plan.spec?.targetNotes ?? [])
</script>

<div id="target-notes" class="muted" hidden={notes.length === 0}>
    {#each notes as note (note)}
        <div>{note}</div>
    {/each}
</div>
