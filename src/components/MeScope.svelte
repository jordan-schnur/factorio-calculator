<script>
    import { chooseScope, scopeChoices, scopeNote } from "../lib/modules-editor.svelte.js"
    import { plan } from "../lib/plan.svelte.js"

    let { opts, target, sel } = $props()

    let choices = $derived(scopeChoices(plan.spec, opts, target, sel))

    function change(event, value) {
        if (event.currentTarget.checked) chooseScope(opts, target, value)
    }
</script>

<div class="me-block me-scope"><span class="lbl">Use these modules for</span>{#each choices as c (c.value)}<label class="me-radio" title={c.why || undefined}><input type="radio" name={`me-scope-${opts.recipe.key}`} value={c.value} checked={target === c.value} disabled={!c.enabled} onchange={event => change(event, c.value)}>{` ${c.text}`}</label>{/each}<div class="muted me-scope-note">{scopeNote(plan.spec, opts, target)}</div></div>
