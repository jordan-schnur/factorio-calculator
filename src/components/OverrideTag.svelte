<script>
    import { plan } from "../lib/plan.svelte.js"

    let { field } = $props()

    let text = $derived(plan.spec ? describe(plan.spec, field) : "")

    function describe(spec, field) {
        if (spec.saveState.overrides.has(field)) return "override"
        return spec.saveState.save !== null ? "from save" : ""
    }
</script>

<span class="muted override-tag needs-companion">{text}</span>
