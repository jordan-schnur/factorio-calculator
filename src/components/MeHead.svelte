<script>
    import Button from "./Button.svelte"
    import HandTag from "./HandTag.svelte"
    import { backToPlan } from "../lib/modules-editor.svelte.js"
    import { plan } from "../lib/plan.svelte.js"

    let { opts } = $props()

    let source = $derived(opts.scope === "machine" ? null : plan.spec.moduleSource(opts.recipe))

    function back(event) {
        event.stopPropagation()
        backToPlan(plan.spec, opts)
    }
</script>

<div class="me-head"><span class="me-title">Modules</span>{#if opts.scope === "machine"}<span class="muted me-source">{`Every ${opts.machine.name.toLowerCase()} without a row set by hand`}</span>{:else if source === "hand"}<HandTag /><Button size="sm" class="me-back" onclick={back}>Back to plan default</Button>{:else if source === "machine"}<span class="muted me-source">{`From ${opts.machine.name} settings`}</span>{:else}<span class="muted me-source">From the plan</span>{/if}</div>
