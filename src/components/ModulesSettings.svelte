<script>
    import MsHandSet from "./MsHandSet.svelte"
    import MsMachines from "./MsMachines.svelte"
    import MsStrategy from "./MsStrategy.svelte"
    import { plan } from "../lib/plan.svelte.js"
</script>

{#if plan.spec?.modules}<MsStrategy /><MsMachines /><MsHandSet />{/if}
