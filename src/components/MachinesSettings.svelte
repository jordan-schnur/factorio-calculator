<script>
    import AsmSeg from "./AsmSeg.svelte"
    import Field from "./Field.svelte"
    import Section from "./Section.svelte"
    import SlotPicker from "./SlotPicker.svelte"
    import TierPicker from "./TierPicker.svelte"
    import { iconOf } from "../lib/icon-attach.js"
    import { buildingGroups, categoryLabel, isChosenBuilding, machinesWithQuality } from "../lib/machines-core.js"
    import { plan } from "../lib/plan.svelte.js"
    import { isNormal, tierOf } from "../lib/quality-core.js"
    import { qualityIconUrl } from "../lib/quality-ui.js"
    import { Rational } from "../lib/rational.js"
    import { markOverride } from "../lib/savesettings.js"
    import { pickBuilding } from "../lib/settings.js"
    import { sorted } from "../lib/sort.js"

    const HUNDRED = Rational.from_float(100)

    let groups = $derived(plan.spec ? sorted([...buildingGroups(plan.spec)].filter(g => g.buildings.length > 1), g => g.getDefault().name) : [])
    let machines = $derived(sorted(new Set(groups.flatMap(g => g.buildings)), b => b.name))
    let belts = $derived(plan.spec ? [...plan.spec.belts.values()] : [])
    let qualityMachines = $derived(plan.spec ? machinesWithQuality(plan.spec) : [])
    let beltSummary = $derived(plan.spec && describeBelt(plan.spec))


    function describeBelt({ belt, format }) {
        return `${belt.name} · ${format.rate(belt.rate)}/${format.longRate} · ${format.rate(belt.rate.div(Rational.from_float(2)))} per lane`
    }

    function toggleMachine(building) {
        plan.spec.toggleExcludedBuilding(building)
        markOverride("machines")
        plan.spec.updateSolution()
    }

    function setMachineTier(building, tier) {
        markOverride("quality")
        plan.spec.commitModules(() => plan.spec.setMachineQuality(building.key, tier.key))
    }

    function pickBelt(belt) {
        plan.spec.belt = belt
        markOverride("belt")
        plan.spec.display()
    }

    function changeMprod(event) {
        markOverride("mprod")
        plan.spec.miningProd = Rational.from_string(event.target.value).div(HUNDRED)
        plan.spec.updateSolution()
    }
</script>

<Section title="Machines">
    <AsmSeg />
    <Field label="Machines" override="buildings"><span id="building_selector">{#each groups as group (group)}<Field label={categoryLabel(plan.spec.buildings, group)}><span class="slots"><SlotPicker items={group.buildings} selected={b => isChosenBuilding(plan.spec, b)} onpick={pickBuilding} /></span></Field>{/each}</span></Field>
    <Field label="Available" override="machines"><span id="machine_allow" class="slots wrap"><SlotPicker items={machines} off={b => plan.spec.excludedBuildings.has(b.key)} label={b => b.name + (plan.spec.excludedBuildings.has(b.key) ? " (off)" : "")} onpick={toggleMachine} /></span></Field>
    <Field label="Quality" override="quality"><div id="machine_quality">
        {#if plan.spec && qualityMachines.length === 0}<span class="muted">No machines in this plan.</span>{/if}
        {#each qualityMachines as building (building.key)}
            {@const tier = tierOf(plan.spec.machineTier(building))}
            <div class="mq-row" data-machine={building.key}>
                <span class="slot slot-sm" class:qwrap={!isNormal(tier.key)} {@attach iconOf(building, 20, true)}>{#if !isNormal(tier.key)}<img class="qbadge" src={qualityIconUrl(tier.key)} width="10" height="10" alt={tier.name} title={tier.name} data-tier={tier.key}>{/if}</span>
                <span class="mq-name">{building.name}</span>
                <TierPicker {tier} label="{building.name} quality" onpick={t => setMachineTier(building, t)} />
            </div>
        {/each}
    </div></Field>
    <Field label="Belt" override="belt"><span id="belt_selector" class="radio-setting">{#if plan.spec}<SlotPicker items={belts} selected={b => plan.spec.belt === b} onpick={pickBelt} note={beltSummary} />{/if}</span></Field>
    <Field label="Mining" override="mprod"><span class="muted">productivity</span>+<input id="mprod" class="num mprod" type="number" step="10" value={plan.spec ? plan.spec.miningProd.mul(HUNDRED).toFloat() : 0} min="0" onchange={changeMprod}><span class="muted">%</span></Field>
</Section>
