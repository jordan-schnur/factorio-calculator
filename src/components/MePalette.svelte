<script>
    import ModuleSlot from "./ModuleSlot.svelte"
    import TierPicker from "./TierPicker.svelte"
    import { chooseTier, nextTier, paletteLines, pick } from "../lib/modules-editor.svelte.js"
    import { plan } from "../lib/plan.svelte.js"
    import { tierOf } from "../lib/quality-core.js"

    let { opts, target, sel } = $props()

    let tier = $derived(nextTier(opts))
    let lines = $derived(paletteLines(plan.spec, opts, sel, target))
</script>

<div class="me-block me-palette"><div class="me-tierpick me-module-tier"><span class="muted">Module quality</span><TierPicker tier={tierOf(tier)} label="Module quality" onpick={t => chooseTier(plan.spec, opts, t.key)} /></div>{#each lines as line (line.label)}<div class="me-prow"><span class="muted me-plabel">{line.label}</span>{#each line.picks as p (p.key)}<ModuleSlot module={p.module} {tier} iconSize={28} badge={12} class="me-pick" data-module={p.key} disabled={p.reason !== null} title={p.reason || p.title} onpick={() => pick(plan.spec, opts, p.module)} />{/each}</div>{/each}<div class="muted me-note">Quality modules only slow the machine here; planning for quality output isn't supported yet.</div></div>
