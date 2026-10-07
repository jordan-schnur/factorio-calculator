<script>
    import AsmSeg from "./AsmSeg.svelte"
    import Field from "./Field.svelte"
    import Radio from "./Radio.svelte"
    import Section from "./Section.svelte"
    import { changeBeltFormat, changeColorblind, changeCountPrecision, changeFormat, changeMprod, changeRatePrecision, changeTitle } from "../lib/events.js"

    let { open = $bindable(false) } = $props()
</script>

<svelte:window onkeydown={event => event.key === "Escape" && (open = false)} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div id="settings-drawer" hidden={!open} onclick={event => event.target === event.currentTarget && (open = false)}>
    <div class="frame" id="settings-panel">
        <div class="titlebar"><span class="title">Settings</span><div class="spacer"></div><button class="x" id="settings-close" onclick={() => (open = false)}>&#10005;</button></div>

        <Section title="From your save" class="needs-companion" deepId="settings-fromsave"></Section>

        <div id="settings-overrides">
            <Section title="Machines">
                <AsmSeg />
                <Field label="Machines"><span id="building_selector"></span></Field>
                <Field label="Available"><span id="machine_allow"></span></Field>
                <Field label="Quality"><div id="machine_quality"></div></Field>
                <Field label="Belt"><span id="belt_selector" class="radio-setting"></span></Field>
                <Field label="Mining"><span class="muted">productivity</span>+<input id="mprod" class="num mprod" type="number" step="10" value="0" min="0" onchange={changeMprod}><span class="muted">%</span></Field>
            </Section>

            <Section title="Recipes">
                <Field label="Planets" id="planet_setting_row"><div id="planet_selector"></div></Field>
                <Field label="Preferred fuel"><span id="fuel_selector" class="radio-setting"></span></Field>
                <span class="muted">Which recipe makes each item is picked on its row in the table.</span>
            </Section>
        </div>

        <Section title="Modules" id="modules-sec" deepId="settings-modules"></Section>

        <Section title="Display" deepId="settings-display">
            <Field label="Rates" width={90}><form id="display_rate"></form></Field>
            <Field label="Decimal places" width={90}>
                <input id="rprec" class="num prec" type="number" value="1" min="0" max="6" onchange={changeRatePrecision}>
                <span class="muted">decimals for rates,</span>
                <input id="cprec" class="num prec" type="number" value="1" min="0" max="6" onchange={changeCountPrecision}>
                <span class="muted">for machine counts</span>
            </Field>
            <Field label="Values" width={90}><form id="value_format">
                <Radio id="decimal_format" name="format" value="decimal" label="Decimals" checked onchange={changeFormat} />
                <Radio id="rational_format" name="format" value="rational" label="Rationals" onchange={changeFormat} />
            </form></Field>
            <Field label="Belts" width={90}><form id="belt_format">
                <Radio id="fraction_belts" name="beltformat" value="fraction" label="1 1/3 belts" checked onchange={changeBeltFormat} />
                <Radio id="decimal_belts" name="beltformat" value="decimal" label="1.33 belts" onchange={changeBeltFormat} />
            </form></Field>
            <Field label="Colour-blind" width={90}>
                <input id="colorblind_toggle" type="checkbox" onchange={changeColorblind}><label for="colorblind_toggle">Write the colour on belt, splitter and inserter icons (yellow, red, blue, green)</label>
            </Field>
        </Section>

        <details class="adv">
            <summary class="kv"><span class="title">Advanced</span></summary>
            <details><summary class="kv"><span class="muted" style="width: 110px;">Toggle recipes</span></summary><div id="recipe_toggles"></div></details>
            <details><summary class="kv"><span class="muted" style="width: 110px;">Resource priority</span></summary><div id="resource_settings"></div></details>
            <Field label="Data"><select id="data_set"></select></Field>
            <Field label="Title"><input id="title_setting" type="text" size="30" placeholder="Factorio Calculator" oninput={changeTitle}></Field>
        </details>
    </div>
</div>
