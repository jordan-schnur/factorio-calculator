<script>
    import { plan } from "../lib/plan.svelte.js"
    import { pageTitle } from "../lib/settings.js"

    let title = $derived(pageTitle(plan.spec))
</script>

<svelte:head><title>{title}</title></svelte:head>
