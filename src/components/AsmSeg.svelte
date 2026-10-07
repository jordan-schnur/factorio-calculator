<script>
    import Field from "./Field.svelte"
    import Seg from "./Seg.svelte"
    import { plan } from "../lib/plan.svelte.js"
    import { findGroup } from "../lib/machines-core.js"
    import { pickBuilding } from "../lib/settings.js"

    let group = $derived(plan.spec && findGroup(plan.spec, g => g.buildings.some(b => b.key.startsWith("assembling-machine"))))
    let tiers = $derived(group?.buildings.filter(b => b.key.startsWith("assembling-machine")).sort((a, b) => tier(a) - tier(b)) ?? [])

    function tier(building) {
        return Number(building.key.match(/(\d+)$/)[1])
    }
</script>

<Field label="Assemblers" hidden={plan.spec && tiers.length === 0}>
    <Seg id="asm-seg" items={tiers} key={b => b.key} selected={b => plan.spec.getBuildingGroup(b).building === b} onpick={pickBuilding} attrs={b => ({ "data-building": b.key, title: b.name })}>
        {#snippet children(building)}{tier(building)}{/snippet}
    </Seg>
</Field>
