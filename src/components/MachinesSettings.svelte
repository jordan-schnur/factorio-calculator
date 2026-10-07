<script>
    import AsmSeg from "./AsmSeg.svelte"
    import Choices from "./Choices.svelte"
    import Field from "./Field.svelte"
    import Section from "./Section.svelte"
    import { iconOf } from "../lib/icon-attach.js"
    import { plan } from "../lib/plan.svelte.js"
    import { TIERS, isNormal, tierOf } from "../lib/quality-core.js"
    import { qualityIconUrl } from "../lib/quality-ui.js"
    import { Rational } from "../lib/rational.js"
    import { markOverride } from "../lib/savesettings.js"
    import { pickBuilding } from "../lib/settings.js"
    import { sorted } from "../lib/sort.js"

    const CATEGORY_LABELS = new Map([["crafting", "Assembling"], ["smelting", "Smelting"], ["basic-solid", "Mining"]])
    const HUNDRED = Rational.from_float(100)

    let buildingGroups = $derived(plan.spec?.buildings)
    let groups = $derived(buildingGroups ? sorted(new Set([...buildingGroups.values()].filter(g => g.buildings.length > 1)), g => g.getDefault().name) : [])
    let machines = $derived(sorted(new Set(groups.flatMap(g => g.buildings)), b => b.name))
    let belts = $derived(plan.spec ? [...plan.spec.belts.values()] : [])
    let qualityMachines = $derived(plan.spec ? machinesWithQuality(plan.spec) : [])
    let beltSummary = $derived(plan.spec && describeBelt(plan.spec))

    function categoryLabel(group) {
        let cats = [...buildingGroups].filter(([, g]) => g === group).map(([cat]) => cat)
        let named = cats.find(cat => CATEGORY_LABELS.has(cat))
        if (named) return CATEGORY_LABELS.get(named)
        return cats.length > 0 ? cats[0].replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : "Building"
    }

    function machinesWithQuality(spec) {
        let found = new Map()
        for (let [recipe] of spec.lastTotals?.rates ?? []) {
            let building = recipe.isReal() && !recipe.isDisable() && spec.getBuilding(recipe)
            if (building && building.takesQuality) found.set(building.key, building)
        }
        for (let key of spec.machineQuality.keys()) {
            let building = spec.buildingKeys.get(key)
            if (building) found.set(key, building)
        }
        return [...found.values()].sort((a, b) => a.name.localeCompare(b.name))
    }

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
    <Field label="Machines"><span id="building_selector">{#each groups as group (group)}<Field label={categoryLabel(group)}><span style="display: flex; gap: 4px;"><Choices items={group.buildings} selected={b => plan.spec.getBuildingGroup(b).building === b} onpick={pickBuilding} /></span></Field>{/each}</span></Field>
    <Field label="Available"><span id="machine_allow" style="display: flex; flex-wrap: wrap; gap: 4px;"><Choices items={machines} off={b => plan.spec.excludedBuildings.has(b.key)} label={b => b.name + (plan.spec.excludedBuildings.has(b.key) ? " (off)" : "")} onpick={toggleMachine} /></span></Field>
    <Field label="Quality"><div id="machine_quality">
        {#if plan.spec && qualityMachines.length === 0}<span class="muted">No machines in this plan.</span>{/if}
        {#each qualityMachines as building (building.key)}
            {@const tier = tierOf(plan.spec.machineTier(building))}
            <div class="mq-row" data-machine={building.key}>
                <span class="slot slot-sm" class:qwrap={!isNormal(tier.key)} {@attach iconOf(building, 20, true)}>{#if !isNormal(tier.key)}<img class="qbadge" src={qualityIconUrl(tier.key)} width="10" height="10" style="width: 10px; height: 10px;" alt={tier.name} title={tier.name} data-tier={tier.key}>{/if}</span>
                <span class="mq-name">{building.name}</span>
                <span class="seg tierpick" role="group" aria-label="{building.name} quality"><Choices variant="tier" items={TIERS} selected={t => t === tier} onpick={t => setMachineTier(building, t)} /></span>
            </div>
        {/each}
    </div></Field>
    <Field label="Belt"><span id="belt_selector" class="radio-setting">{#if plan.spec}<Choices items={belts} selected={b => plan.spec.belt === b} onpick={pickBelt} /><span class="muted belt-summary" style="margin-left: 10px; font-size: 13px;">{beltSummary}</span>{/if}</span></Field>
    <Field label="Mining"><span class="muted">productivity</span>+<input id="mprod" class="num mprod" type="number" step="10" value={plan.spec ? plan.spec.miningProd.mul(HUNDRED).toFloat() : 0} min="0" onchange={changeMprod}><span class="muted">%</span></Field>
</Section>
