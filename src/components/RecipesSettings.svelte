<script>
    import Field from "./Field.svelte"
    import Section from "./Section.svelte"
    import SlotPicker from "./SlotPicker.svelte"
    import { plan } from "../lib/plan.svelte.js"
    import { pickPlanet } from "../lib/settings.js"
    import { sorted } from "../lib/sort.js"

    let planets = $derived(plan.spec?.planets?.size > 1 ? sorted(plan.spec.planets.values(), p => p.order) : [])
    let fuels = $derived(plan.spec ? [...plan.spec.fuels.values()] : [])

    function onPlanet(planet, event) {
        if (event.shiftKey) event.preventDefault()
        pickPlanet(planet, event.shiftKey)
    }

    function planetKeydown(planet, event) {
        if (event.key !== "Enter" && event.key !== " ") return
        event.preventDefault()
        onPlanet(planet, event)
    }

    function pickFuel(fuel) {
        plan.spec.fuel = fuel
        plan.spec.updateSolution()
    }
</script>

<Section title="Recipes">
    <Field label="Planets" id="planet_setting_row" override="planet" hidden={plan.spec && planets.length === 0}><div id="planet_selector">{#each planets as planet (planet.key)}<span class="radio" role="button" tabindex="0" onclick={event => onPlanet(planet, event)} onkeydown={event => planetKeydown(planet, event)}><span class="check">{plan.spec.selectedPlanets.has(planet) ? "✓" : ""}</span> {planet.name}</span>{/each}</div></Field>
    <Field label="Preferred fuel"><span id="fuel_selector" class="radio-setting">{#if plan.spec}<SlotPicker items={fuels} selected={f => plan.spec.fuel === f} onpick={pickFuel} note="for boilers and burner machines" />{/if}</span></Field>
    <span class="muted">Which recipe makes each item is picked on its row in the table.</span>
</Section>
