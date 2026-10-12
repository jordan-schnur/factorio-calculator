<script>
    import { inlineStyle } from "../lib/style-attach.js"
    import { effectRows } from "../lib/modules-editor.svelte.js"
    import { percentWords } from "../lib/modules-core.js"
    import { plan } from "../lib/plan.svelte.js"

    let { opts, entry } = $props()

    let fx = $derived(effectRows(plan.spec, opts, entry))
</script>

<div class="me-block me-effects"><span class="lbl">What they do, per machine</span>{#each fx.rows as row (row.key)}<div class="me-eff" data-effect={row.key}><span class="me-ename">{row.label}</span><span class="me-bar"><span class={["me-fill", { bad: !row.good }]} {@attach inlineStyle({ "--fill": row.width })}></span></span><span class="num me-pct">{percentWords(row.value)}</span></div>{/each}{#if fx.floored}<div class="muted me-floor">Speed stops at −80%, as in the game.</div>{/if}</div>
