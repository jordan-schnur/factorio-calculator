<script>
    import QualityBadge from "./QualityBadge.svelte"
    import { emptySlot } from "../lib/empty-slot.js"
    import { iconOf } from "../lib/icon-attach.js"
    import { badgeSize } from "../lib/modules-ui-core.js"
    import { isNormal } from "../lib/quality-core.js"

    let { modules, size, tiers = [] } = $props()

    let slots = $derived(modules.map((module, i) => ({ module, tier: tiers[i] })))
</script>

<span class="modstrip">{#each slots as slot (slot)}<span class={["modslot", { empty: !slot.module, qwrap: Boolean(slot.module) && !isNormal(slot.tier) }]} {@attach iconOf(slot.module ?? emptySlot(), size, true)}>{#if slot.module}<QualityBadge tier={slot.tier} size={badgeSize(size)} />{/if}</span>{/each}</span>
