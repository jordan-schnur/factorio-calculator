<script>
    import { inlineStyle } from "../lib/style-attach.js"
    import { isNormal, qualityIconUrl, tierOf } from "../lib/quality-core.js"

    let { tier, size = 12 } = $props()

    let t = $derived(tierOf(tier))
</script>

{#if !isNormal(tier)}<img class="qbadge" src={qualityIconUrl(t.key)} width={size} height={size} alt={t.name} title={t.name} data-tier={t.key} {@attach inlineStyle({ "--qb-size": `${size}px` })}>{/if}
