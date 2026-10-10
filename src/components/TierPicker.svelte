<script>
    import Seg from "./Seg.svelte"
    import { TIERS } from "../lib/quality-core.js"
    import { qualityIconUrl } from "../lib/quality-ui.js"

    let { tier, onpick, label, id } = $props()
</script>

<Seg {id} tag="span" class="tierpick" role="group" aria-label={label} items={TIERS} key={t => t.key} selected={t => t === tier} {onpick} attrs={t => ({ "data-tier": t.key, title: t.name, "aria-label": t.name, "aria-pressed": String(t === tier) })}>
    {#snippet children(t)}<img src={qualityIconUrl(t.key)} alt="" width="18" height="18">{/snippet}
</Seg>
