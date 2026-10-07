<script>
    import Choices from "./Choices.svelte"
    import Field from "./Field.svelte"
    import Section from "./Section.svelte"
    import { plan } from "../lib/plan.svelte.js"
    import { pickPlanet } from "../lib/settings.js"
    import { sorted } from "../lib/sort.js"

    let planets = $derived(plan.spec?.planets?.size > 1 ? sorted(plan.spec.planets.values(), p => p.order) : [])
    let fuels = $derived(plan.spec ? [...plan.spec.fuels.values()] : [])

    function onPlanet(planet, event) {
        if (event.shiftKey) event.preventDefault()
        pickPlanet(planet, event.shiftKey)
    }

    function pickFuel(fuel) {
        plan.spec.fuel = fuel
        plan.spec.updateSolution()
    }
</script>

<Section title="Recipes">
    <Field label="Planets" id="planet_setting_row" hidden={plan.spec && planets.length === 0}><div id="planet_selector"><Choices variant="check" items={planets} selected={p => plan.spec.selectedPlanets.has(p)} onpick={onPlanet} /></div></Field>
    <Field label="Preferred fuel"><span id="fuel_selector" class="radio-setting">{#if plan.spec}<Choices items={fuels} selected={f => plan.spec.fuel === f} onpick={pickFuel} /><span class="muted" style="margin-left: 10px; font-size: 13px;">for boilers and burner machines</span>{/if}</span></Field>
    <span class="muted">Which recipe makes each item is picked on its row in the table.</span>
</Section>
