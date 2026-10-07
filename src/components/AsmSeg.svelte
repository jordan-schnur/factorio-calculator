<script>
    import Field from "./Field.svelte"
    import { plan } from "../lib/plan.svelte.js"
    import { pickBuilding } from "../lib/settings.js"

    let group = $derived(plan.spec && Array.from(new Set(plan.spec.buildings.values())).find(g => g.buildings.some(b => b.key.startsWith("assembling-machine"))))
    let tiers = $derived(group?.buildings.filter(b => b.key.startsWith("assembling-machine")).sort((a, b) => tier(a) - tier(b)) ?? [])

    function tier(building) {
        return Number(building.key.match(/(\d+)$/)[1])
    }
</script>

<Field label="Assemblers" hidden={plan.spec && tiers.length === 0}>
    <div class="seg" id="asm-seg">{#each tiers as building (building.key)}<button data-building={building.key} title={building.name} class:on={group.building === building} onclick={() => pickBuilding(building)}>{tier(building)}</button>{/each}</div>
</Field>
