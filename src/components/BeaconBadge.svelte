<script>
    import QualityIcon from "./QualityIcon.svelte"
    import { badgeSize, beaconNumber, beaconSlots } from "../lib/modules-ui-core.js"

    let { beacon, beaconModules, beaconCount, size, withModules = true, tiers = [], beaconTier = "normal" } = $props()

    let count = $derived(beaconNumber(beaconCount))
    let slots = $derived(beaconSlots(beaconModules, tiers))
</script>

{#if count > 0 && slots.length > 0}<span class="beaconbadge" title={`${count} beacon${count === 1 ? "" : "s"} around each machine`}>{#if beacon}<QualityIcon thing={beacon} {size} tier={beaconTier} badge={badgeSize(size)} />{/if}<span class="num">{`×${count}`}</span>{#if withModules}{#each slots as slot (slot)}<QualityIcon thing={slot.module} {size} tier={slot.tier} badge={badgeSize(size)} />{/each}{/if}</span>{/if}
