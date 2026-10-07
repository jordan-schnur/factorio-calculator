<script>
    import AdvancedSettings from "./AdvancedSettings.svelte"
    import Button from "./Button.svelte"
    import DisplaySettings from "./DisplaySettings.svelte"
    import MachinesSettings from "./MachinesSettings.svelte"
    import RecipesSettings from "./RecipesSettings.svelte"
    import Section from "./Section.svelte"
    import { plan } from "../lib/plan.svelte.js"
    import { clearOverrides } from "../lib/savesettings.js"

    let { open = $bindable(false) } = $props()
</script>

<svelte:window onkeydown={event => event.key === "Escape" && (open = false)} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div id="settings-drawer" hidden={!open} onclick={event => event.target === event.currentTarget && (open = false)}>
    <div class="frame" id="settings-panel">
        <div class="titlebar"><span class="title">Settings</span><div class="spacer"></div><button class="x" id="settings-close" onclick={() => (open = false)}>&#10005;</button></div>

        <Section title="From your save" class="needs-companion" deepId="settings-fromsave"></Section>

        <div id="settings-overrides">
            {#if plan.spec}<div class="kv needs-companion"><Button type="button" size="sm" id="overrides-reset-all" onclick={clearOverrides}>Reset all</Button></div>{/if}
            <MachinesSettings />
            <RecipesSettings />
        </div>

        <Section title="Modules" id="modules-sec" deepId="settings-modules"></Section>

        <DisplaySettings />

        <AdvancedSettings />
    </div>
</div>
