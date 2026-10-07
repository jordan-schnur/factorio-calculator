<script>
    import Field from "./Field.svelte"
    import RadioGroup from "./RadioGroup.svelte"
    import Section from "./Section.svelte"
    import { DEFAULT_BELT_FORMAT, DEFAULT_COUNT_PRECISION, DEFAULT_FORMAT, DEFAULT_RATE_PRECISION, longRateNames } from "../lib/align.js"
    import { colorblindOn, setColorblind } from "../lib/colorblind.js"
    import { plan } from "../lib/plan.svelte.js"
    import { setRoundMachines } from "../lib/settings.js"

    const RATE_OPTIONS = [...longRateNames].map(([rate, name]) => ({ value: rate, label: `items/${name}`, id: `${rate}_rate` }))
    const FORMAT_OPTIONS = [{ value: "decimal", label: "Decimals", id: "decimal_format" }, { value: "rational", label: "Rationals", id: "rational_format" }]
    const BELT_OPTIONS = [{ value: "fraction", label: "1 1/3 belts", id: "fraction_belts" }, { value: "decimal", label: "1.33 belts", id: "decimal_belts" }]
    const ROUNDING = [{ key: "up", name: "rounded up" }, { key: "exact", name: "exact" }]

    let rateName = $derived(plan.spec?.format.rateName)
    let ratePrecision = $derived(plan.spec?.format.ratePrecision ?? DEFAULT_RATE_PRECISION)
    let countPrecision = $derived(plan.spec?.format.countPrecision ?? DEFAULT_COUNT_PRECISION)
    let displayFormat = $derived(plan.spec?.format.displayFormat ?? DEFAULT_FORMAT)
    let beltFormat = $derived(plan.spec?.format.beltFormat ?? DEFAULT_BELT_FORMAT)
    // eslint-disable-next-line svelte/prefer-writable-derived -- localStorage must stay out of render, so this needs the effect below
    let colorblind = $state(false)

    $effect(() => {
        colorblind = plan.spec ? colorblindOn() : false
    })

    function setFormat(field, value) {
        plan.spec.format[field] = value
        plan.spec.display()
    }

    function setRate(rate) {
        plan.spec.format.setDisplayRate(rate)
        plan.spec.display()
    }

    function setBeltFormat(value) {
        plan.spec.format.beltFormat = value
        plan.spec.setHash()
        plan.spec.display()
    }

    function toggleColorblind(event) {
        setColorblind(event.target.checked)
        colorblind = event.target.checked
    }
</script>

<Section title="Display" deepId="settings-display">
    <Field label="Rates" narrow><form id="display_rate">{#if plan.spec}<RadioGroup name="rate" options={RATE_OPTIONS} value={rateName} onchange={setRate} br />{/if}</form></Field>
    <Field label="Decimal places" narrow>
        <input id="rprec" class="num prec" type="number" value={ratePrecision} min="0" max="6" onchange={event => setFormat("ratePrecision", Number(event.target.value))}>
        <span class="muted">decimals for rates,</span>
        <input id="cprec" class="num prec" type="number" value={countPrecision} min="0" max="6" onchange={event => setFormat("countPrecision", Number(event.target.value))}>
        <span class="muted">for machine counts</span>
    </Field>
    <Field label="Values" narrow><form id="value_format"><RadioGroup name="format" options={FORMAT_OPTIONS} value={displayFormat} onchange={value => setFormat("displayFormat", value)} /></form></Field>
    <Field label="Belts" narrow><form id="belt_format"><RadioGroup name="beltformat" options={BELT_OPTIONS} value={beltFormat} onchange={setBeltFormat} /></form></Field>
    <Field label="Colour-blind" narrow>
        <input id="colorblind_toggle" type="checkbox" checked={colorblind} onchange={toggleColorblind}><label for="colorblind_toggle">Write the colour on belt, splitter and inserter icons (yellow, red, blue, green)</label>
    </Field>
    {#if plan.spec}<Field label="Machines" narrow id="machines-round-toggle">{#each ROUNDING as r (r.key)}<button type="button" class="radio" onclick={() => setRoundMachines(r.key === "up")}><span class="dot" class:on={(r.key === "up") === plan.spec.roundMachines}></span>{r.name}</button>{/each}</Field>{/if}
</Section>
