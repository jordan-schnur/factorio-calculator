<script>
    import Choices from "./Choices.svelte"
    import Field from "./Field.svelte"
    import Radio from "./Radio.svelte"
    import Section from "./Section.svelte"
    import { DEFAULT_BELT_FORMAT, DEFAULT_COUNT_PRECISION, DEFAULT_FORMAT, DEFAULT_RATE_PRECISION, longRateNames } from "../lib/align.js"
    import { colorblindOn, setColorblind } from "../lib/colorblind.js"
    import { plan } from "../lib/plan.svelte.js"
    import { setRoundMachines } from "../lib/settings.js"

    const RATES = [...longRateNames]
    const ROUNDING = [{ key: "up", name: "rounded up" }, { key: "exact", name: "exact" }]

    let rateName = $derived(plan.spec?.format.rateName)
    let ratePrecision = $derived(plan.spec?.format.ratePrecision ?? DEFAULT_RATE_PRECISION)
    let countPrecision = $derived(plan.spec?.format.countPrecision ?? DEFAULT_COUNT_PRECISION)
    let displayFormat = $derived(plan.spec?.format.displayFormat ?? DEFAULT_FORMAT)
    let beltFormat = $derived(plan.spec?.format.beltFormat ?? DEFAULT_BELT_FORMAT)
    let colorblind = $derived(plan.spec ? colorblindOn() : false)

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
</script>

<Section title="Display" deepId="settings-display">
    <Field label="Rates" width={90}><form id="display_rate">{#if plan.spec}{#each RATES as [rate, name] (rate)}<span><Radio id="{rate}_rate" name="rate" value={rate} label="items/{name}" checked={rate === rateName} onchange={() => setRate(rate)} /><br></span>{/each}{/if}</form></Field>
    <Field label="Decimal places" width={90}>
        <input id="rprec" class="num prec" type="number" value={ratePrecision} min="0" max="6" onchange={event => setFormat("ratePrecision", Number(event.target.value))}>
        <span class="muted">decimals for rates,</span>
        <input id="cprec" class="num prec" type="number" value={countPrecision} min="0" max="6" onchange={event => setFormat("countPrecision", Number(event.target.value))}>
        <span class="muted">for machine counts</span>
    </Field>
    <Field label="Values" width={90}><form id="value_format">
        <Radio id="decimal_format" name="format" value="decimal" label="Decimals" checked={displayFormat === "decimal"} onchange={() => setFormat("displayFormat", "decimal")} />
        <Radio id="rational_format" name="format" value="rational" label="Rationals" checked={displayFormat === "rational"} onchange={() => setFormat("displayFormat", "rational")} />
    </form></Field>
    <Field label="Belts" width={90}><form id="belt_format">
        <Radio id="fraction_belts" name="beltformat" value="fraction" label="1 1/3 belts" checked={beltFormat === "fraction"} onchange={() => setBeltFormat("fraction")} />
        <Radio id="decimal_belts" name="beltformat" value="decimal" label="1.33 belts" checked={beltFormat === "decimal"} onchange={() => setBeltFormat("decimal")} />
    </form></Field>
    <Field label="Colour-blind" width={90}>
        <input id="colorblind_toggle" type="checkbox" checked={colorblind} onchange={event => setColorblind(event.target.checked)}><label for="colorblind_toggle">Write the colour on belt, splitter and inserter icons (yellow, red, blue, green)</label>
    </Field>
    {#if plan.spec}<Field label="Machines" width={90} id="machines-round-toggle"><Choices variant="dot" items={ROUNDING} selected={r => (r.key === "up") === plan.spec.roundMachines} onpick={r => setRoundMachines(r.key === "up")} /></Field>{/if}
</Section>
