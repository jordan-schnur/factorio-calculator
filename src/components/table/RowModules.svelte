<script>
    import { legacyNode } from "../../lib/legacy-attach.js"
    import { beaconBadge, moduleStrip } from "../../lib/modules-strip.js"

    let { mods } = $props()

    function line(ms) {
        return () => [moduleStrip(ms.modules, 24, ms.moduleTiers), beaconBadge(ms.beaconModules, ms.beaconCount, 18, true, ms.beaconModuleTiers, ms.beaconTier)]
    }
</script>

<span class="mods">{#if mods}<span class="mods-line" {@attach legacyNode(line(mods.ms))}></span>{#if mods.hand}<span class="tag hand">Set by hand</span>{:else if mods.note}<span class="muted mods-note">{mods.note}</span>{/if}{/if}</span>
