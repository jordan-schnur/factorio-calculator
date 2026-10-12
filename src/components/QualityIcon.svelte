<script>
    import QualityBadge from "./QualityBadge.svelte"
    import { iconOf, iconOnto } from "../lib/icon-attach.js"
    import { isNormal } from "../lib/quality-core.js"

    let { thing, size, tier, badge } = $props()
</script>

{#if isNormal(tier)}<img alt="" {@attach iconOnto(thing, size)}>{:else}<span class="qwrap qwrap-inline" {@attach iconOf(thing, size, true)}><QualityBadge {tier} size={badge} /></span>{/if}
