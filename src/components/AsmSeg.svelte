<script>
    import * as d3 from "d3"
    import Field from "./Field.svelte"
    import { plan } from "../lib/plan.svelte.js"
    import { markOverride } from "../lib/savesettings.js"

    let group = $derived(plan.spec && Array.from(new Set(plan.spec.buildings.values())).find(g => g.buildings.some(b => b.key.startsWith("assembling-machine"))))
    let tiers = $derived(group?.buildings.filter(b => b.key.startsWith("assembling-machine")).sort((a, b) => tier(a) - tier(b)) ?? [])

    function tier(building) {
        return Number(building.key.match(/(\d+)$/)[1])
    }

    function pick(building) {
        let spec = plan.spec
        spec.setMinimumBuilding(building)
        markOverride("buildings")
        d3.selectAll("#building_selector button.slot").classed("sel", b => spec.getBuildingGroup(b).building === b)
        spec.updateSolution()
    }
</script>

<Field label="Assemblers" hidden={plan.spec && tiers.length === 0}>
    <div class="seg" id="asm-seg">{#each tiers as building (building.key)}<button data-building={building.key} title={building.name} class:on={group.building === building} onclick={() => pick(building)}>{tier(building)}</button>{/each}</div>
</Field>
